mod commands;

pub use commands::*;

pub fn run() {
    let tray = tauri::tray::TrayIconBuilder::new()
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png")).unwrap())
        .tooltip("TIMPS — The AI Coding Agent (Cmd+Shift+T)")
        .menu_on_left_click(true)
        .build_menu(|menu_builder| {
            menu_builder
                .item(&tauri::menu::MenuItem::with_id(tauri::menu::WINDOW_MENU_ID, "Show Window", true, None::<&str>).unwrap())
                .item(&tauri::menu::MenuItem::with_id("quick_capture", "Quick Capture...", true, Some("Cmd+Shift+N")).unwrap())
                .separator()
                .item(&tauri::menu::MenuItem::with_id("settings", "Settings", true, None::<&str>).unwrap())
                .separator()
                .item(&tauri::menu::MenuItem::with_id("quit", "Quit TIMPS", true, None::<&str>).unwrap())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "quick_capture" => {
                    // Emit event to show Quick Capture modal in renderer
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("show-quick-capture", ());
                    }
                }
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("show-settings", ());
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Register global hotkey: Cmd+Shift+T to show window
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
            
            let shortcut_show: Shortcut = "CommandOrControl+Shift+T".parse().unwrap();
            app.global_shortcut().on_shortcut(shortcut_show, |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            })?;

            // Register global hotkey: Cmd+Shift+N for Quick Capture
            let shortcut_capture: Shortcut = "CommandOrControl+Shift+N".parse().unwrap();
            app.global_shortcut().on_shortcut(shortcut_capture, |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
