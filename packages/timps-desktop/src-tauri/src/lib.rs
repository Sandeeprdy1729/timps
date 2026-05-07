mod commands;

pub use commands::*;

pub fn run() {
    let tray = tauri::tray::TrayIconBuilder::new()
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png")).unwrap())
        .tooltip("TIMPS — The AI Coding Agent")
        .menu_on_left_click(true)
        .build_menu(|menu_builder| {
            menu_builder
                .item(&tauri::menu::MenuItem::with_id(tauri::menu::WINDOW_MENU_ID, "Show Window", true, None::<&str>).unwrap())
                .separator()
                .item(&tauri::menu::MenuItem::with_id("quit", "Quit TIMPS", true, None::<&str>).unwrap())
        });

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Register global hotkey: Cmd+Shift+T to show window
            use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
            let shortcut: Shortcut = "CommandOrControl+Shift+T".parse().unwrap();
            app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
