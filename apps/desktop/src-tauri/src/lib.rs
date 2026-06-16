use tauri::{WebviewUrl, WebviewWindowBuilder};

/// The desktop app bundles the web frontend (built from the repo root with
/// .env.production) and serves it from the tauri:// origin. Sign-in happens
/// in the system browser on the production domain — the site's /auth/desktop
/// page mints a Clerk sign-in token and hands it back via the omanote://
/// deep link, so no OAuth cookies are ever needed inside the webview.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
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
        .run(tauri::generate_context!())
        .expect("error while running omanote desktop app");
}
