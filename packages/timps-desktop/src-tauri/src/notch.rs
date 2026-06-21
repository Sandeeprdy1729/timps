use core_graphics::display::CGDisplay;
use core_graphics::event::CGEvent;
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
use std::time::{Duration, Instant};
use std::thread;
use tauri::Manager;

const POLL_MS: u64 = 16;
const DWELL_MS: u64 = 120;
const COOLDOWN_MS: u64 = 800;
const NOTCH_ZONE_HEIGHT: f64 = 60.0;
const NOTCH_ZONE_HALF_WIDTH: f64 = 180.0;
const CHAT_W: f64 = 400.0;
const CHAT_Y: f64 = 36.0;

#[link(name = "mouse_position", kind = "static")]
extern "C" {
    fn cursor_position_get(x: *mut f64, y: *mut f64);
}

enum ZoneState {
    Idle,
    Hovering(Instant),
}

fn get_mouse_position_nsevent() -> Option<(f64, f64)> {
    unsafe {
        let mut x: f64 = 0.0;
        let mut y: f64 = 0.0;
        cursor_position_get(&mut x as *mut f64, &mut y as *mut f64);
        Some((x, y))
    }
}

fn get_mouse_position_cgevent() -> Option<(f64, f64)> {
    if let Ok(source) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
        if let Ok(event) = CGEvent::new(source) {
            let loc = event.location();
            return Some((loc.x, loc.y));
        }
    }
    if let Ok(source) = CGEventSource::new(CGEventSourceStateID::Private) {
        if let Ok(event) = CGEvent::new(source) {
            let loc = event.location();
            return Some((loc.x, loc.y));
        }
    }
    None
}

fn get_mouse_position() -> Option<(f64, f64)> {
    // Primary: NSEvent.mouseLocation (same approach as Clicky app)
    if let Some(pos) = get_mouse_position_nsevent() {
        return Some(pos);
    }
    // Fallback: core_graphics CGEvent
    if let Some(pos) = get_mouse_position_cgevent() {
        return Some(pos);
    }
    None
}

fn get_screen_size() -> Option<(f64, f64)> {
    let display = CGDisplay::main();
    let bounds = display.bounds();
    Some((bounds.size.width, bounds.size.height))
}

pub fn start(app_handle: tauri::AppHandle) {
    thread::spawn(move || {
        eprintln!("[notch] watcher started (poll={}ms, dwell={}ms)", POLL_MS, DWELL_MS);

        thread::sleep(Duration::from_millis(500));

        match app_handle.get_webview_window("chat-popup") {
            Some(_) => eprintln!("[notch] chat-popup found"),
            None => eprintln!("[notch] chat-popup NOT FOUND!"),
        }

        let mut zone_state = ZoneState::Idle;
        let mut last_trigger: Option<Instant> = None;
        let mut mouse_fail_count: u64 = 0;

        loop {
            thread::sleep(Duration::from_millis(POLL_MS));

            let now = Instant::now();

            if let Some(lt) = last_trigger {
                if now.duration_since(lt).as_millis() < COOLDOWN_MS as u128 {
                    continue;
                }
            }

            let pos = get_mouse_position();
            let screen = get_screen_size();

            let (mx, my) = match pos {
                Some(p) => {
                    mouse_fail_count = 0;
                    p
                }
                None => {
                    mouse_fail_count += 1;
                    if mouse_fail_count == 1 || mouse_fail_count % 100 == 0 {
                        eprintln!("[notch] get_mouse_position FAILED (x{})", mouse_fail_count);
                    }
                    continue;
                }
            };
            let (sw, sh) = match screen {
                Some(s) => s,
                None => continue,
            };

            let notch_top = sh - NOTCH_ZONE_HEIGHT;
            let center_x = sw / 2.0;
            let in_notch =
                my > notch_top && (mx - center_x).abs() < NOTCH_ZONE_HALF_WIDTH;

            zone_state = match (&zone_state, in_notch) {
                (ZoneState::Idle, true) => {
                    eprintln!("[notch] ENTER: ({:.0},{:.0}) zone=({:.0}-{:.0}, top={:.0})",
                        mx, my,
                        center_x - NOTCH_ZONE_HALF_WIDTH,
                        center_x + NOTCH_ZONE_HALF_WIDTH,
                        notch_top);
                    ZoneState::Hovering(now)
                }
                (ZoneState::Hovering(enter), true) => {
                    let elapsed = now.duration_since(*enter).as_millis();
                    if elapsed >= DWELL_MS as u128 {
                        eprintln!("[notch] TRIGGER after {}ms", elapsed);

                        if let Some(popup) =
                                app_handle.get_webview_window("chat-popup")
                            {
                                let chat_x = (sw - CHAT_W) / 2.0;
                                if let Err(e) = popup.set_position(
                                    tauri::LogicalPosition::new(chat_x, CHAT_Y),
                                ) {
                                    eprintln!("[notch] set_position error: {}", e);
                                }
                                if let Err(e) = popup.show() {
                                    eprintln!("[notch] show error: {}", e);
                                }
                                if let Err(e) = popup.set_focus() {
                                    eprintln!("[notch] set_focus error: {}", e);
                                }
                                eprintln!("[notch] chat open at ({:.0}, {:.0})", chat_x, CHAT_Y);
                            } else {
                                eprintln!("[notch] chat-popup window NOT FOUND");
                            }
                        last_trigger = Some(now);
                        ZoneState::Idle
                    } else {
                        ZoneState::Hovering(*enter)
                    }
                }
                (ZoneState::Hovering(_), false) => {
                    ZoneState::Idle
                }
                (ZoneState::Idle, false) => ZoneState::Idle,
            };
        }
    });
}
