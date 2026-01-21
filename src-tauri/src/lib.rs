// Sidecar-based server launch
// The Bun server is compiled as a standalone executable and spawned as sidecar

use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            log::info!("🚀 Starting Esport Control Panel...");
            
            // Get the resource directory where public/ and data/ are bundled
            let resource_path = app.path().resource_dir()
                .expect("Failed to get resource directory");
            
            log::info!("📁 Resource directory: {:?}", resource_path);
            
            // Change to resource directory so the sidecar can find public/ and data/
            if std::env::set_current_dir(&resource_path).is_err() {
                log::warn!("Could not change to resource directory");
            }
            
            // Spawn the sidecar server
            let sidecar_command = app.shell().sidecar("esport-server")
                .expect("Failed to create sidecar command");
            
            let (mut rx, _child) = sidecar_command.spawn()
                .expect("Failed to spawn sidecar server");
            
            log::info!("✅ Sidecar server spawned");
            
            // Log sidecar output in background
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let msg = String::from_utf8_lossy(&line);
                            log::info!("Server: {}", msg);
                            println!("Server: {}", msg);
                        }
                        CommandEvent::Stderr(line) => {
                            let msg = String::from_utf8_lossy(&line);
                            log::error!("Server Error: {}", msg);
                            eprintln!("Server Error: {}", msg);
                        }
                        _ => {}
                    }
                }
            });
            
            // Wait for server to be ready
            std::thread::spawn(|| {
                for i in 0..30 {
                    std::thread::sleep(Duration::from_millis(200));
                    if check_server_ready() {
                        println!("✅ Server is ready on port 3000!");
                        log::info!("✅ Server is ready on port 3000!");
                        break;
                    }
                    if i == 29 {
                        println!("⚠️ Server may not be ready, continuing...");
                        log::warn!("Server startup timeout");
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Check if server is running by attempting TCP connection
fn check_server_ready() -> bool {
    std::net::TcpStream::connect_timeout(
        &"127.0.0.1:3000".parse().unwrap(),
        Duration::from_millis(100),
    )
    .is_ok()
}
