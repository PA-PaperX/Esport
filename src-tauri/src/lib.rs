// State management module
pub mod state;

// Server module
pub mod server;

use std::time::Duration;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Start HTTP server in background thread
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async {
            if let Err(e) = server::start_server().await {
                log::error!("Server error: {}", e);
                eprintln!("❌ Server error: {}", e);
            }
        });
    });

    // Wait a moment for server to start
    std::thread::sleep(Duration::from_millis(500));

    // Check if server is ready by trying to connect
    for i in 0..10 {
        if reqwest_check_server() {
            println!("✅ Server is ready!");
            break;
        }
        if i == 9 {
            println!("⚠️ Server may not be ready, continuing anyway...");
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    // Start Tauri app
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            log::info!("🚀 Esport Control Panel started");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Simple check if server is running
fn reqwest_check_server() -> bool {
    std::net::TcpStream::connect_timeout(
        &"127.0.0.1:3000".parse().unwrap(),
        Duration::from_millis(100),
    )
    .is_ok()
}
