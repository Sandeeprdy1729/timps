mod commands;

pub use commands::*;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        // ── Hide to tray on window close (don't quit) ──────────────────
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            // ── Build tray icon and menu ────────────────────────────────
            use tauri::tray::{TrayIconBuilder, TrayIconEvent};
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            use tauri::image::Image;

            let open_item = MenuItem::with_id(app, "open", "Open TIMPS", true, None::<&str>)?;
            let capture_item = MenuItem::with_id(app, "quick_capture", "Quick Capture...  ⌘⇧N", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let autostart_item = MenuItem::with_id(app, "toggle_autostart", "Launch at Login", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit TIMPS", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[
                &open_item,
                &capture_item,
                &sep1,
                &autostart_item,
                &sep2,
                &quit_item,
            ])?;

            let icon_bytes = include_bytes!("../icons/32x32.png");
            let icon = Image::from_bytes(icon_bytes)?;

            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("🤖 TIMPS — Listening in background (⌘⇧T)")
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "quick_capture" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.emit("show-quick-capture", ());
                            }
                        }
                        "toggle_autostart" => {
                            use tauri_plugin_autostart::ManagerExt;
                            let autolaunch = app.autolaunch();
                            let enabled = autolaunch.is_enabled().unwrap_or(false);
                            if enabled {
                                let _ = autolaunch.disable();
                            } else {
                                let _ = autolaunch.enable();
                            }
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.emit("autostart-changed", !enabled);
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // ── Hide window if launched with --minimized ────────────────
            let args: Vec<String> = std::env::args().collect();
            if args.contains(&"--minimized".to_string()) {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }

            // ── Global shortcuts ────────────────────────────────────────
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

            let show_shortcut: Shortcut = "CommandOrControl+Shift+T".parse().unwrap();
            app.global_shortcut().on_shortcut(show_shortcut, |app, _s, ev| {
                if ev.state() == ShortcutState::Pressed {
                    if let Some(w) = app.get_webview_window("main") {
                        if w.is_visible().unwrap_or(false) {
                            let _ = w.hide();
                        } else {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                }
            })?;

            let capture_shortcut: Shortcut = "CommandOrControl+Shift+N".parse().unwrap();
            app.global_shortcut().on_shortcut(capture_shortcut, |app, _s, ev| {
                if ev.state() == ShortcutState::Pressed {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                        let _ = w.emit("show-quick-capture", ());
                    }
                }
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::project_hash,
            commands::load_semantic,
            commands::load_episodes,
            commands::load_working,
            commands::get_memory_stats,
            commands::list_projects,
            commands::search_memory,
            commands::store_memory,
            commands::delete_memory,
            commands::chat,
            commands::get_version,
            commands::get_provider,
            commands::set_provider,
            commands::install_update,
            // Passive background learning
            commands::passive_store,
            commands::store_episode,
            // Autostart
            commands::enable_autostart,
            commands::disable_autostart,
            commands::is_autostart_enabled,
            // Clipboard watcher
            commands::start_clipboard_watcher,
            commands::stop_clipboard_watcher,
            // Background summarizer
            commands::run_background_summarizer,
            // Proactive notifications
            commands::check_proactive_notifications,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
