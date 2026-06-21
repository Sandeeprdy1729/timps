mod commands;
mod nexus_bridge;

#[cfg(target_os = "macos")]
mod notch;

use tauri::Emitter;
use tauri::Manager;
pub use commands::*;

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
        // ── Window event handling ───────────────────────────────────────
        // "main" → hide to tray on close.
        // "chat-popup" → hide on close or on blur (dropdown behavior).
        .on_window_event(|window, event| {
            match window.label() {
                "main" => {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
                "chat-popup" => {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
                _ => {}
            }
        })
        .setup(|app| {
            // ── Create the chat-popup window (hidden, top-right) ────────
            use tauri::WebviewWindowBuilder;
            use tauri::WebviewUrl;

            let (popup_x, popup_y) = app
                .primary_monitor()
                .ok()
                .flatten()
                .map(|monitor| {
                    let size = monitor.size();
                    let scale = monitor.scale_factor();
                    let screen_w = size.width as f64 / scale;
                    let x = (screen_w - 400.0) / 2.0;
                    (x.max(0.0), 36.0)
                })
                .unwrap_or((1440.0, 36.0));

            let popup_result = WebviewWindowBuilder::new(
                app,
                "chat-popup",
                WebviewUrl::App("popup.html".into()),
            )
            .title("")
            .inner_size(400.0, 520.0)
            .position(popup_x, popup_y)
            .decorations(false)
            .resizable(false)
            .always_on_top(true)
            .shadow(true)
            .skip_taskbar(true)
            .visible(false)
            .build();
            match &popup_result {
                Ok(_) => eprintln!("[setup] chat-popup created at ({}, {})", popup_x, popup_y),
                Err(e) => eprintln!("[setup] chat-popup creation FAILED: {}", e),
            }
            let _ = popup_result;

            // ── Build tray icon and menu ────────────────────────────────
            use tauri::tray::{TrayIconBuilder, TrayIconEvent};
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            use tauri::image::Image;

            let open_item = MenuItem::with_id(app, "open", "Open TIMPS", true, None::<&str>)?;
            let capture_item = MenuItem::with_id(app, "quick_capture", "Quick Capture...  ⌘⇧N", true, None::<&str>)?;
            let lens_item = MenuItem::with_id(app, "lens", "⚡ Lens — Today's Links", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let autostart_item = MenuItem::with_id(app, "toggle_autostart", "Launch at Login", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit TIMPS", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[
                &open_item,
                &capture_item,
                &lens_item,
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
                .show_menu_on_left_click(false)
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
                        "lens" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.emit("show-lens", ());
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
                        if let Some(popup) = app.get_webview_window("chat-popup") {
                            if popup.is_visible().unwrap_or(false) {
                                let _ = popup.hide();
                            } else {
                                if let Some(monitor) = app.primary_monitor().ok().flatten() {
                                    let size = monitor.size();
                                    let scale = monitor.scale_factor();
                                    let sw = size.width as f64 / scale;
                                    let _ = popup.set_position(
                                        tauri::LogicalPosition::new((sw - 400.0) / 2.0, 36.0),
                                    );
                                }
                                let _ = popup.show();
                                let _ = popup.set_focus();
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

            // ── Notch activation (macOS only) ───────────────────────────
            #[cfg(target_os = "macos")]
            {
                eprintln!("[setup] starting notch watcher...");
                notch::start(app.handle().clone());
            }
            #[cfg(not(target_os = "macos"))]
            eprintln!("[setup] notch watcher skipped (not macOS)");

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

            let popup_shortcut: Shortcut = "CommandOrControl+Shift+P".parse().unwrap();
            app.global_shortcut().on_shortcut(popup_shortcut, |app, _s, ev| {
                if ev.state() == ShortcutState::Pressed {
                    if let Some(popup) = app.get_webview_window("chat-popup") {
                        if popup.is_visible().unwrap_or(false) {
                            let _ = popup.hide();
                        } else {
                            if let Some(monitor) = app.primary_monitor().ok().flatten() {
                                let size = monitor.size();
                                let scale = monitor.scale_factor();
                                let sw = size.width as f64 / scale;
                                let _ = popup.set_position(
                                    tauri::LogicalPosition::new((sw - 400.0) / 2.0, 36.0),
                                );
                            }
                            let _ = popup.show();
                            let _ = popup.set_focus();
                        }
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
            commands::load_knowledge_graph,
            commands::list_projects,
            commands::search_memory,
            commands::store_memory,
            commands::delete_memory,
            commands::chat,
            commands::list_ollama_models,
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
            // Lens — frictionless link analysis
            commands::detect_link_type,
            commands::save_to_lens_queue,
            commands::get_lens_queue,
            commands::remove_from_lens_queue,
            commands::mark_lens_analyzed,
            commands::get_lens_history,
            commands::fetch_github_meta,
            commands::fetch_hf_meta,
            commands::analyze_lens_link,
            nexus_bridge::load_unified_graph,
            // Project path auto-detection
            commands::detect_project_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
