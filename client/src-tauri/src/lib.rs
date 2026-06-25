use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use tauri::{AppHandle, Manager, WebviewWindow};

#[derive(Serialize, Deserialize, Default, Clone)]
struct AppConfig {
    server_url: Option<String>,
}

fn get_config_path(app: &AppHandle) -> Option<PathBuf> {
    let mut path = app.path().app_config_dir().ok()?;
    fs::create_dir_all(&path).ok()?;
    path.push("config.json");
    Some(path)
}

fn read_config(app: &AppHandle) -> AppConfig {
    if let Some(path) = get_config_path(app) {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                    return config;
                }
            }
        }
    }
    AppConfig::default()
}

fn write_config(app: &AppHandle, config: &AppConfig) {
    if let Some(path) = get_config_path(app) {
        if let Ok(content) = serde_json::to_string_pretty(config) {
            let _ = fs::write(path, content);
        }
    }
}

fn normalize_url(url: &str) -> String {
    let mut clean = url.trim().to_string();
    if !clean.starts_with("http://") && !clean.starts_with("https://") {
        clean = format!("http://{}", clean);
    }
    if let Ok(parsed) = tauri::Url::parse(&clean) {
        if parsed.port().is_none() {
            let host_str = parsed.host_str().unwrap_or("");
            if !host_str.contains(':') {
                clean = format!("{}:3000", clean.trim_end_matches('/'));
            }
        }
    }
    clean
}

fn test_connection(url: &str) -> Result<(), String> {
    let health_url = format!("{}/api/health", url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(3))
        .build();
        
    match agent.get(&health_url).call() {
        Ok(response) => {
            if response.status() == 200 {
                Ok(())
            } else {
                Err(format!("Код ответа: {}", response.status()))
            }
        }
        Err(err) => Err(format!("Сервер недоступен: {}", err.to_string())),
    }
}

#[tauri::command]
fn get_version() -> String {
    "a0.2".to_string()
}

#[tauri::command]
fn try_connect(app: AppHandle, window: WebviewWindow, url: String) -> Result<String, String> {
    let normalized = normalize_url(&url);
    match test_connection(&normalized) {
        Ok(()) => {
            write_config(&app, &AppConfig { server_url: Some(normalized.clone()) });
            let target_url = tauri::Url::parse(&normalized).map_err(|e| e.to_string())?;
            let _ = window.navigate(target_url);
            
            let check_url = normalized.clone();
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let _ = check_for_updates(&app_clone, &check_url);
            });
            Ok("Успешно".to_string())
        }
        Err(err) => Err(err)
    }
}

fn check_for_updates(app: &AppHandle, server_url: &str) -> Result<(), String> {
    let version_url = format!("{}/api/version", server_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(3))
        .build();
        
    let response = agent.get(&version_url).call()
        .map_err(|e| e.to_string())?;
        
    if response.status() == 200 {
        if let Ok(json) = response.into_json::<serde_json::Value>() {
            if let Some(srv_ver) = json["version"].as_str() {
                if srv_ver != "a0.2" {
                    let app_clone = app.clone();
                    let _ = app.run_on_main_thread(move || {
                        let _ = tauri::WebviewWindowBuilder::new(
                            &app_clone,
                            "update_window",
                            tauri::WebviewUrl::App(std::path::PathBuf::from("updates.html")),
                        )
                        .title("ОБНОВЛЕНИЕ")
                        .inner_size(500.0, 250.0)
                        .resizable(false)
                        .maximizable(false)
                        .minimizable(false)
                        .center()
                        .build();
                    });
                }
            }
        }
    }
    Ok(())
}

fn download_and_update(app: &AppHandle, server_url: &str) -> Result<(), String> {
    let update_url = format!("{}/updates/anotree.exe", server_url.trim_end_matches('/'));
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let temp_exe = current_exe.with_extension("exe.tmp");

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(30))
        .build();
        
    let response = agent.get(&update_url).call()
        .map_err(|e| format!("Не удалось скачать обновление: {}", e.to_string()))?;
        
    if response.status() != 200 {
        return Err(format!("Сервер вернул код: {}", response.status()));
    }
    
    let mut file = std::fs::File::create(&temp_exe)
        .map_err(|e| format!("Не удалось создать файл: {}", e.to_string()))?;
        
    std::io::copy(&mut response.into_reader(), &mut file)
        .map_err(|e| format!("Ошибка записи: {}", e.to_string()))?;
        
    drop(file);

    let cmd_script = format!(
        "timeout /t 2 /nobreak && copy /y \"{}\" \"{}\" && del \"{}\" && start \"\" \"{}\"",
        temp_exe.to_string_lossy(),
        current_exe.to_string_lossy(),
        temp_exe.to_string_lossy(),
        current_exe.to_string_lossy()
    );

    std::process::Command::new("cmd")
        .args(&["/c", &cmd_script])
        .spawn()
        .map_err(|e| format!("Не удалось запустить обновление: {}", e.to_string()))?;

    app.exit(0);
    Ok(())
}

#[tauri::command]
fn start_update(app: AppHandle) -> Result<(), String> {
    let config = read_config(&app);
    if let Some(url) = config.server_url {
        download_and_update(&app, &url)
    } else {
        Err("Адрес сервера не найден в конфигурации".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
        let handle = app.handle().clone();
        std::thread::spawn(move || {
            let config = read_config(&handle);
            if let Some(ref saved_url) = config.server_url {
                let clean_url = normalize_url(saved_url);
                if test_connection(&clean_url).is_ok() {
                    if let Some(window) = handle.get_webview_window("main") {
                        if let Ok(target_url) = tauri::Url::parse(&clean_url) {
                            let _ = window.navigate(target_url);
                            let check_url = clean_url.clone();
                            let app_clone = handle.clone();
                            std::thread::spawn(move || {
                                let _ = check_for_updates(&app_clone, &check_url);
                            });
                        }
                    }
                }
            } else {
                let default_cloud = "http://34.51.214.5:3000".to_string();
                if test_connection(&default_cloud).is_ok() {
                    if let Some(window) = handle.get_webview_window("main") {
                        if let Ok(target_url) = tauri::Url::parse(&default_cloud) {
                            let _ = window.navigate(target_url);
                            write_config(&handle, &AppConfig { server_url: Some(default_cloud.clone()) });
                            let check_url = default_cloud.clone();
                            let app_clone = handle.clone();
                            std::thread::spawn(move || {
                                let _ = check_for_updates(&app_clone, &check_url);
                            });
                        }
                    }
                }
            }
        });
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_version, try_connect, start_update])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
