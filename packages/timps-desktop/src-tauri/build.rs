fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("mouse_position.m")
            .compile("mouse_position");
    }
    tauri_build::build()
}
