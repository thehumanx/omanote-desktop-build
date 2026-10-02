// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Works around WebKitGTK's accelerated-rendering paths on Linux.
///
/// Tauri uses WebKitGTK on Linux, whose DMABUF renderer is broken or
/// unaccelerated on a number of common Mesa and NVIDIA driver combinations. When
/// it misbehaves the app stays responsive but compositing degrades — scrolling
/// goes slow and tears — which reads as "the desktop app feels heavy" even
/// though nothing is actually blocking.
///
/// This must run before the webview is created, hence here rather than in
/// `lib.rs`'s setup hook.
///
/// Only set when absent, so it can be overridden from the shell without a
/// rebuild. The right value is hardware-dependent, so if scrolling is still bad
/// try the other knob before assuming this isn't the cause:
///
///   WEBKIT_DISABLE_DMABUF_RENDERER=0 WEBKIT_DISABLE_COMPOSITING_MODE=1 omanote
///
/// Note this only addresses compositing. The larger cost on this app is
/// main-thread React work, which WebKitGTK amplifies — see
/// docs/code-quality-audit-2026-09.md §S6.
#[cfg(target_os = "linux")]
fn configure_webkit_rendering() {
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        // Safe on edition 2021, and this runs before any other thread is
        // spawned or the Tauri runtime is initialised.
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

/// The GDK backend an AppImage should use, or `None` to leave it alone.
///
/// The AppImage's GTK hook (linuxdeploy-plugin-gtk) unconditionally exports
/// `GDK_BACKEND=x11`, guarding against a Wayland crash with mismatched bundled
/// libraries (tauri-apps/tauri#8541). On a Wayland session that puts the app
/// under XWayland: with fractional scaling the compositor upscales every frame
/// (choppy scrolling), and touchpad scrolling arrives as coarse wheel steps
/// (each swipe moves too little). Both were measured on an Intel Arc /
/// Hyprland / 1.25x machine and gone on native Wayland.
///
/// "wayland,x11" tries Wayland first and falls back to X11 if that fails, so
/// a machine that hits the original crash still opens. The hook overwrites
/// whatever the user set, so `OMANOTE_FORCE_X11=1` is the way to opt back out.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn appimage_gdk_backend(in_appimage: bool, wayland_session: bool, force_x11: bool) -> Option<&'static str> {
    (in_appimage && wayland_session && !force_x11).then_some("wayland,x11")
}

#[cfg(target_os = "linux")]
fn configure_gdk_backend() {
    let backend = appimage_gdk_backend(
        std::env::var_os("APPIMAGE").is_some(),
        std::env::var_os("WAYLAND_DISPLAY").is_some(),
        std::env::var_os("OMANOTE_FORCE_X11").is_some_and(|value| value == "1"),
    );
    if let Some(backend) = backend {
        // Same safety argument as configure_webkit_rendering: no other thread
        // exists yet and GTK has not read its environment.
        std::env::set_var("GDK_BACKEND", backend);
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    configure_webkit_rendering();
    #[cfg(target_os = "linux")]
    configure_gdk_backend();

    omanote_desktop_lib::run()
}

#[cfg(test)]
mod tests {
    use super::appimage_gdk_backend;

    #[test]
    fn appimage_on_wayland_prefers_wayland_with_x11_fallback() {
        assert_eq!(appimage_gdk_backend(true, true, false), Some("wayland,x11"));
    }

    #[test]
    fn leaves_the_backend_alone_outside_an_appimage_or_wayland() {
        assert_eq!(appimage_gdk_backend(false, true, false), None);
        assert_eq!(appimage_gdk_backend(true, false, false), None);
    }

    #[test]
    fn force_x11_keeps_xwayland() {
        assert_eq!(appimage_gdk_backend(true, true, true), None);
    }
}
