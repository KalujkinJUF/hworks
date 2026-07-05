use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};
use tauri::{AppHandle, Manager, WebviewWindow};

static LAST_CLICK_MS: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize, Deserialize, Default, Clone)]
struct AppConfig {
    server_url: Option<String>,
    last_version: Option<String>,
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
        clean = format!("https://{}", clean);
    }
    if let Ok(parsed) = tauri::Url::parse(&clean) {
        if parsed.port().is_none() {
            let host_str = parsed.host_str().unwrap_or("");
            let is_local = host_str == "localhost" || host_str == "127.0.0.1";
            let is_http = clean.starts_with("http://");
            // Добавляем порт 3000 только для локального HTTP-сервера
            if is_local && is_http && !host_str.contains(':') {
                clean = format!("{}:3000", clean.trim_end_matches('/'));
            }
        }
    }
    clean
}

fn test_connection(url: &str) -> Result<(), String> {
    let health_url = format!("{}/api/health", url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(5))
        .redirects(5)
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
    format!("a{}", env!("CARGO_PKG_VERSION"))
}

#[tauri::command]
fn close_window(window: tauri::WebviewWindow) {
    let _ = window.close();
}

#[tauri::command]
fn try_connect(app: AppHandle, window: WebviewWindow, url: String) -> Result<String, String> {
    let normalized = normalize_url(&url);
    match test_connection(&normalized) {
        Ok(()) => {
            let current_ver = get_version();
            write_config(&app, &AppConfig {
                server_url: Some(normalized.clone()),
                last_version: Some(current_ver),
            });
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
                if srv_ver != get_version() {
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
    let update_url = format!("{}/updates/voidtree.exe", server_url.trim_end_matches('/'));

    // БЕЗОПАСНОСТЬ: обновление заменяет исполняемый файл, поэтому качаем только по HTTPS.
    // Иначе MITM может подменить .exe (RCE). TODO: добавить проверку цифровой подписи/SHA-256
    // (например, через официальный tauri-plugin-updater с Ed25519-ключом).
    if !update_url.starts_with("https://") {
        return Err("Обновление возможно только по защищённому соединению (HTTPS). Настройте TLS на сервере.".to_string());
    }
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    
    // Канонизируем путь и убираем UNC-префикс
    let current_exe = std::fs::canonicalize(&current_exe)
        .unwrap_or(current_exe);
    
    // Надежная чистка UNC-префикса через срез
    let current_exe_str = {
        let s = current_exe.to_string_lossy().to_string();
        if s.starts_with(r"\\?\") {
            s[4..].to_string()
        } else {
            s
        }
    };
    
    let temp_exe_str = format!("{}.tmp", &current_exe_str);

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(30))
        .build();
        
    let response = agent.get(&update_url).call()
        .map_err(|e| format!("Не удалось скачать обновление: {}", e.to_string()))?;
        
    if response.status() != 200 {
        return Err(format!("Сервер вернул код: {}", response.status()));
    }
    
    let mut file = std::fs::File::create(&temp_exe_str)
        .map_err(|e| format!("Не удалось создать файл: {}", e.to_string()))?;
        
    std::io::copy(&mut response.into_reader(), &mut file)
        .map_err(|e| format!("Ошибка записи: {}", e.to_string()))?;
        
    drop(file);

    let pid = std::process::id();
    
    // Используем PowerShell с циклом повторных попыток для обхода блокировок файлов и логированием ошибок
    let ps_script = format!(
        r#"$pid_to_kill = {pid}; $temp_path = '{temp}'; $exe_path = '{exe}'; $log_path = Join-Path (Split-Path $exe_path) 'update_error.log'; Start-Sleep -Milliseconds 500; Stop-Process -Id $pid_to_kill -Force -ErrorAction SilentlyContinue; $success = $false; $last_err = ''; for ($i = 0; $i -lt 30; $i++) {{ try {{ Copy-Item -Path $temp_path -Destination $exe_path -Force -ErrorAction Stop; $success = $true; break }} catch {{ $last_err = $_.Exception.Message; Start-Sleep -Milliseconds 300 }} }}; if ($success) {{ Remove-Item -Path $temp_path -Force -ErrorAction SilentlyContinue; if (Test-Path $log_path) {{ Remove-Item -Path $log_path -Force -ErrorAction SilentlyContinue }}; Start-Process -FilePath $exe_path }} else {{ $last_err | Out-File -FilePath $log_path; Start-Process -FilePath $exe_path }}"#,
        pid = pid,
        temp = temp_exe_str.replace("'", "''"),
        exe = current_exe_str.replace("'", "''"),
    );

    let mut cmd = std::process::Command::new("powershell");
    
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.args(&[
        "-WindowStyle", "Hidden",
        "-NonInteractive",
        "-Command", &ps_script,
    ])
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
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }))
    .setup(|app| {
        // Создаем системный трей
        let tray_menu = tauri::menu::Menu::with_items(app.handle(), &[
            &tauri::menu::MenuItem::with_id(app.handle(), "show", "Показать", true, None::<&str>).unwrap(),
            &tauri::menu::MenuItem::with_id(app.handle(), "exit", "Выйти", true, None::<&str>).unwrap(),
        ]).unwrap();

        let _tray = tauri::tray::TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .menu(&tray_menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| {
                match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "exit" => {
                        app.exit(0);
                    }
                    _ => {}
                }
            })
            .on_tray_icon_event(|tray, event| {
                if let tauri::tray::TrayIconEvent::Click {
                    button: tauri::tray::MouseButton::Left,
                    ..
                } = event {
                    let now_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;

                    let last = LAST_CLICK_MS.load(Ordering::Relaxed);
                    if now_ms - last < 500 {
                        return;
                    }
                    LAST_CLICK_MS.store(now_ms, Ordering::Relaxed);

                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            })
            .build(app)
            .unwrap();

        let handle = app.handle().clone();
        std::thread::spawn(move || {
            let mut config = read_config(&handle);
            let mut version_changed = false;
            let current_ver = get_version();
            if config.last_version.as_ref() != Some(&current_ver) {
                config.last_version = Some(current_ver.clone());
                write_config(&handle, &config);
                version_changed = true;
            }

            if let Some(ref saved_url) = config.server_url {
                let clean_url = normalize_url(saved_url);
                if test_connection(&clean_url).is_ok() {
                    if let Some(window) = handle.get_webview_window("main") {
                        let target_url_str = if version_changed {
                            format!("{}?clear_session=true", clean_url.trim_end_matches('/'))
                        } else {
                            clean_url.clone()
                        };
                        if let Ok(target_url) = tauri::Url::parse(&target_url_str) {
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
                let default_cloud = "https://hworks.space".to_string();
                if test_connection(&default_cloud).is_ok() {
                    if let Some(window) = handle.get_webview_window("main") {
                        let target_url_str = if version_changed {
                            format!("{}?clear_session=true", default_cloud.trim_end_matches('/'))
                        } else {
                            default_cloud.clone()
                        };
                        if let Ok(target_url) = tauri::Url::parse(&target_url_str) {
                            let _ = window.navigate(target_url);
                            write_config(&handle, &AppConfig {
                                server_url: Some(default_cloud.clone()),
                                last_version: Some(current_ver),
                            });
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
    .on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let _ = window.hide();
            api.prevent_close();
        }
    })
    .invoke_handler(tauri::generate_handler![get_version, try_connect, start_update, close_window])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
