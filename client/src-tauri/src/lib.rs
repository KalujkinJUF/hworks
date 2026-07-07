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
    auto_update: Option<bool>,
    autostart: Option<bool>,
    scale: Option<String>,
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

fn set_autostart(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Не удалось получить путь к exe: {}", e.to_string()))?;
        let exe_path_str = format!("\"{}\"", exe_path.to_string_lossy());
        
        if enabled {
            let status = std::process::Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v", "voidtree",
                    "/t", "REG_SZ",
                    "/d", &exe_path_str,
                    "/f"
                ])
                .status()
                .map_err(|e| format!("Не удалось запустить reg: {}", e.to_string()))?;
                
            if !status.success() {
                return Err("Ошибка при записи в реестр".to_string());
            }
        } else {
            let _ = std::process::Command::new("reg")
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v", "voidtree",
                    "/f"
                ])
                .status();
        }
    }
    Ok(())
}

#[tauri::command]
fn get_app_config(app: AppHandle) -> AppConfig {
    let mut config = read_config(&app);
    if config.auto_update.is_none() {
        config.auto_update = Some(true);
    }
    if config.autostart.is_none() {
        config.autostart = Some(true);
    }
    if config.scale.is_none() {
        config.scale = Some("1.0".to_string());
    }
    config
}

#[tauri::command]
fn update_app_config(app: AppHandle, auto_update: bool, autostart: bool, scale: String) -> Result<(), String> {
    let mut config = read_config(&app);
    config.auto_update = Some(auto_update);
    config.autostart = Some(autostart);
    config.scale = Some(scale);
    write_config(&app, &config);
    set_autostart(autostart)?;
    Ok(())
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
            let mut config = read_config(&app);
            config.server_url = Some(normalized.clone());
            config.last_version = Some(current_ver);
            write_config(&app, &config);
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

#[tauri::command]
fn auto_connect(app: AppHandle) -> Result<String, String> {
    let mut config = read_config(&app);
    let mut version_changed = false;
    let current_ver = get_version();
    if config.last_version.as_ref() != Some(&current_ver) {
        config.last_version = Some(current_ver.clone());
        write_config(&app, &config);
        version_changed = true;
    }

    let url = config.server_url.clone().unwrap_or_else(|| "https://hworks.space".to_string());
    let clean_url = normalize_url(&url);

    match test_connection(&clean_url) {
        Ok(()) => {
            if config.server_url.is_none() {
                config.server_url = Some(clean_url.clone());
                write_config(&app, &config);
            }
            
            let target_url_str = if version_changed {
                format!("{}?clear_session=true", clean_url.trim_end_matches('/'))
            } else {
                clean_url.clone()
            };
            
            Ok(target_url_str)
        }
        Err(err) => Err(err)
    }
}

#[tauri::command]
async fn save_file_to_disk(app: AppHandle, url: String) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let filename = url.split('/').last().unwrap_or("file").to_string();
    let (tx, rx) = std::sync::mpsc::channel();
    
    let filename_clone = filename.clone();
    let app_clone = app.clone();
    
    let _ = app.run_on_main_thread(move || {
        app_clone.dialog()
            .file()
            .set_file_name(&filename_clone)
            .save_file(move |file_path| {
                let _ = tx.send(file_path);
            });
    });
    
    let chosen_path = rx.recv()
        .map_err(|e| e.to_string())?;
        
    if let Some(file_path) = chosen_path {
        let path_buf = match file_path {
            tauri_plugin_dialog::FilePath::Path(p) => p,
            _ => return Err("Неподдерживаемый формат пути".to_string()),
        };
        
        let response = ureq::get(&url)
            .call()
            .map_err(|e| format!("Ошибка скачивания: {}", e.to_string()))?;
            
        let mut reader = response.into_reader();
        let mut file = std::fs::File::create(&path_buf)
            .map_err(|e| format!("Не удалось создать файл: {}", e.to_string()))?;
            
        std::io::copy(&mut reader, &mut file)
            .map_err(|e| format!("Ошибка записи: {}", e.to_string()))?;
            
        Ok(format!("Файл сохранен: {}", path_buf.to_string_lossy()))
    } else {
        Err("Отменено пользователем".to_string())
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

#[derive(Serialize)]
struct UpdateCheckResult {
    update_available: bool,
    current_version: String,
    latest_version: String,
}

#[tauri::command]
async fn check_for_updates_api(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let config = read_config(&app);
    let url = config.server_url.clone().unwrap_or_else(|| "https://hworks.space".to_string());
    let clean_url = normalize_url(&url);
    
    let version_url = format!("{}/api/version", clean_url.trim_end_matches('/'));
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(3))
        .build();
        
    let response = agent.get(&version_url).call()
        .map_err(|e| e.to_string())?;
        
    if response.status() == 200 {
        if let Ok(json) = response.into_json::<serde_json::Value>() {
            if let Some(srv_ver) = json["version"].as_str() {
                let current_ver = get_version();
                return Ok(UpdateCheckResult {
                    update_available: srv_ver != current_ver,
                    current_version: current_ver,
                    latest_version: srv_ver.to_string(),
                });
            }
        }
    }
    Ok(UpdateCheckResult {
        update_available: false,
        current_version: get_version(),
        latest_version: get_version(),
    })
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

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
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
                        let is_visible = window.is_visible().unwrap_or(false);
                        let is_focused = window.is_focused().unwrap_or(false);
                        
                        if is_visible && is_focused {
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

        Ok(())
    })
    .on_window_event(|window, event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let _ = window.hide();
            api.prevent_close();
        }
    })
    .invoke_handler(tauri::generate_handler![
        get_version,
        try_connect,
        start_update,
        close_window,
        open_url,
        auto_connect,
        save_file_to_disk,
        get_app_config,
        update_app_config,
        check_for_updates_api
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
