use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Linux-only teardown so the AppImage exits cleanly.
///
/// Two things kept the type-2 AppImage runtime from unmounting its squashfs at
/// `/tmp/.mount_omanote*`, which stalled system shutdown (systemd SIGTERMs the
/// cgroup and then waits on us):
///
/// 1. wry/GTK installs no SIGTERM handler, so the process just sat there.
/// 2. WebKitGTK's helpers (WebKitWebProcess, WebKitNetworkProcess, their bwrap
///    sandboxes) get reparented to init and keep the mount busy on their own.
///
/// `PR_SET_PDEATHSIG` is no use here — WebKit forks those helpers, not us — so
/// instead the app becomes its own process group leader before GTK starts and
/// sweeps the whole group on the way out.
#[cfg(target_os = "linux")]
mod linux_teardown {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::thread;
    use std::time::Duration;
    use tauri::AppHandle;

    /// If GTK/WebKit teardown wedges, die anyway well inside systemd's stop
    /// timeout — a hung process is exactly what pins the FUSE mount.
    const WATCHDOG: Duration = Duration::from_secs(3);

    static SIGNALLED: AtomicBool = AtomicBool::new(false);

    /// Must run before any GTK/WebKit initialisation: every helper WebKit forks
    /// later inherits this process group, which is the only reliable handle we
    /// have on them. Side effect: terminal job control (Ctrl-C from a shell) no
    /// longer reaches the app — irrelevant for the bundled GUI, and `kill -INT`
    /// is still handled by `watch_signals` below.
    pub fn detach_process_group() {
        unsafe {
            libc::setpgid(0, 0);
        }
    }

    /// Turn SIGTERM/SIGINT/SIGHUP into the normal Tauri quit path.
    pub fn watch_signals(app: AppHandle) {
        use signal_hook::consts::signal::{SIGHUP, SIGINT, SIGTERM};
        use signal_hook::iterator::Signals;

        let mut signals = match Signals::new([SIGTERM, SIGINT, SIGHUP]) {
            Ok(signals) => signals,
            Err(err) => {
                eprintln!("omanote: could not install signal handlers: {err}");
                return;
            }
        };

        thread::spawn(move || {
            for _ in signals.forever() {
                // A second signal falls through to the watchdog rather than
                // queueing another exit request.
                if SIGNALLED.swap(true, Ordering::SeqCst) {
                    continue;
                }
                arm_watchdog();
                app.exit(0);
            }
        });
    }

    fn arm_watchdog() {
        thread::spawn(|| {
            thread::sleep(WATCHDOG);
            unsafe { libc::_exit(0) }
        });
    }

    /// Runs on `RunEvent::Exit`, after Tauri has closed its windows: sweep any
    /// WebKit helper still holding the mount open.
    ///
    /// SIGTERM goes to the whole group (cheap, and lets the helpers flush), but
    /// the SIGKILL follow-up is aimed at individual pids rather than the group
    /// so we don't kill ourselves mid-shutdown and exit 137.
    pub fn kill_process_group() {
        unsafe {
            // We're in the group we're signalling; opt ourselves out first.
            libc::signal(libc::SIGTERM, libc::SIG_IGN);
            libc::killpg(0, libc::SIGTERM);
        }

        thread::sleep(Duration::from_millis(200));

        for pid in group_members_except_self() {
            unsafe {
                libc::kill(pid, libc::SIGKILL);
            }
        }
    }

    /// Every pid sharing our process group, minus our own. Read from /proc
    /// because there is no portable "list a process group" call.
    fn group_members_except_self() -> Vec<libc::pid_t> {
        let self_pid = std::process::id() as libc::pid_t;
        let self_pgid = unsafe { libc::getpgrp() };
        let mut members = Vec::new();

        let Ok(entries) = std::fs::read_dir("/proc") else {
            return members;
        };

        for entry in entries.flatten() {
            let Ok(pid) = entry.file_name().to_string_lossy().parse::<libc::pid_t>() else {
                continue;
            };
            if pid == self_pid {
                continue;
            }
            let Ok(stat) = std::fs::read_to_string(entry.path().join("stat")) else {
                continue;
            };
            // `comm` is parenthesised and may itself contain spaces, so fields
            // are only unambiguous after the last ')': state, ppid, pgrp.
            let Some((_, rest)) = stat.rsplit_once(')') else {
                continue;
            };
            if rest.split_whitespace().nth(2).and_then(|pgrp| pgrp.parse::<libc::pid_t>().ok())
                == Some(self_pgid)
            {
                members.push(pid);
            }
        }

        members
    }
}

/// The desktop app bundles the web frontend (built from the repo root with
/// .env.production) and serves it from the tauri:// origin. Sign-in happens
/// in the system browser on the production domain — the site's /auth/desktop
/// page mints a Clerk sign-in token and hands it back via the omanote://
/// deep link, so no OAuth cookies are ever needed inside the webview.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Before anything touches GTK/WebKit — see the linux_teardown docs.
    #[cfg(target_os = "linux")]
    linux_teardown::detach_process_group();

    let mut builder = tauri::Builder::default();

    // Single-instance must be the first plugin so a second launch focuses the
    // existing window instead of opening a duplicate. The "deep-link" feature
    // forwards omanote:// URLs from the second instance (Windows/Linux).
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    let app = builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // On Linux (always) and Windows (dev builds) the omanote:// scheme
            // must be registered at runtime; installers handle it elsewhere.
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }

            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("omanote")
                .inner_size(1200.0, 800.0)
                .min_inner_size(720.0, 480.0);

            // macOS: keep native traffic lights but let the web app's top bar
            // extend underneath them (the bar is a drag region).
            #[cfg(target_os = "macos")]
            let win_builder = win_builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true);

            // Windows: no native title bar; the web app renders its own
            // window controls in the top bar. Linux keeps native decorations
            // because undecorated GTK windows lose resize borders/shadows.
            #[cfg(target_os = "windows")]
            let win_builder = win_builder.decorations(false);

            win_builder.build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building omanote desktop app");

    #[cfg(target_os = "linux")]
    linux_teardown::watch_signals(app.handle().clone());

    app.run(|_app, _event| {
        #[cfg(target_os = "linux")]
        if matches!(_event, tauri::RunEvent::Exit) {
            linux_teardown::kill_process_group();
        }
    });
}
