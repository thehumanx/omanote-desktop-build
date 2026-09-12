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

fn main() {
    #[cfg(target_os = "linux")]
    configure_webkit_rendering();

    omanote_desktop_lib::run()
}
