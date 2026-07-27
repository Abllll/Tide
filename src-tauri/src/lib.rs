use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tauri::Emitter;
use sysinfo::Disks;
use std::fs;
use std::io::Write;
use tauri_plugin_shell::ShellExt;
use tauri::Manager;

mod ytdlp;

const CONFIG_FILENAME: &str = ".tide-config.json";

#[derive(Debug, Serialize, Deserialize)]
struct AppConfig {
    storage_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFile {
    pub id: String,
    pub filename: String,
    pub state: AudioState,
    pub download_log: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioState {
    Queued,
    Downloading,
    Local,
    Syncing,
    Synced,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub source_type: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsbDevice {
    pub id: String,
    pub name: String,
    pub mount_point: String,
    pub available_space_gb: f64,
    pub total_space_gb: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub id: String,
    pub status: String,
    pub progress: Option<f32>,
    pub log: String,
}

fn get_config_path() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    Ok(PathBuf::from(home).join(CONFIG_FILENAME))
}

fn load_config() -> Option<AppConfig> {
    if let Ok(path) = get_config_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str(&content) {
                    return Some(config);
                }
            }
        }
    }
    None
}

fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path()?;
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    let mut file = fs::File::create(path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

// Supported-media-link validation command.
#[tauri::command]
fn validate_url(url: String) -> ValidationResult {
    let url = url.trim();

    if url.is_empty() {
        return ValidationResult {
            valid: false,
            source_type: None,
            message: String::new(),
        };
    }

    // Supported hosted-video URL patterns.
    if url.contains("youtube.com/watch") || url.contains("youtu.be/") {
        return ValidationResult {
            valid: true,
            source_type: Some("youtube".to_string()),
            message: "✓ Supported media source detected".to_string(),
        };
    }

    // Supported podcast URL pattern.
    if url.contains("podcasts.apple.com") {
        return ValidationResult {
            valid: true,
            source_type: Some("apple_podcast".to_string()),
            message: "✓ Supported media source detected".to_string(),
        };
    }

    ValidationResult {
        valid: false,
        source_type: None,
        message: "⚠ Unsupported media link".to_string(),
    }
}

// Get app storage directory
#[tauri::command]
fn get_storage_path() -> Result<String, String> {
    // Try to load from config first
    if let Some(config) = load_config() {
        let path = PathBuf::from(&config.storage_path);
        // Create directory if it doesn't exist
        if !path.exists() {
             let _ = std::fs::create_dir_all(&path);
        }
        return Ok(config.storage_path);
    }

    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let storage_path = PathBuf::from(home).join("ShokzAudio");

    // Create directory if it doesn't exist
    if !storage_path.exists() {
        std::fs::create_dir_all(&storage_path).map_err(|e| e.to_string())?;
    }

    Ok(storage_path.to_string_lossy().to_string())
}

#[tauri::command]
fn set_storage_path(path: String) -> Result<(), String> {
    let config = AppConfig {
        storage_path: path,
    };
    save_config(&config)?;
    Ok(())
}

fn scan_directory(path: PathBuf) -> Vec<AudioFile> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Some(filename) = entry.file_name().to_str() {
                if filename.starts_with('.') {
                    continue;
                }
                if filename.ends_with(".mp3") || filename.ends_with(".m4a") {
                    files.push(AudioFile {
                        id: filename.to_string(), // Use filename as ID for easier merging
                        filename: filename.to_string(),
                        state: AudioState::Local,
                        download_log: None,
                    });
                }
            }
        }
    }
    files
}

// List USB devices (Real implementation)
#[tauri::command]
fn list_usb_devices() -> Vec<UsbDevice> {
    let disks = Disks::new_with_refreshed_list();
    let mut devices = Vec::new();

    eprintln!("Scanning for USB devices...");
    for disk in &disks {
        eprintln!("Found disk: Name: {:?}, Mount: {:?}, Removable: {:?}", disk.name(), disk.mount_point(), disk.is_removable());

        // Filter logic:
        // On macOS, external drives are usually mounted in /Volumes
        // On Windows, they are drive letters not containing system
        // Simple heuristic: check if removable OR in /Volumes
        let mount_point = disk.mount_point().to_string_lossy();

        if mount_point.starts_with("/Volumes") || disk.is_removable() {
             // Exclude main drive if it accidentally shows up (usually /)
             if mount_point == "/" { continue; }

             // Exclude some common system volumes if needed
             if mount_point.contains("Recovery") { continue; }

            let available_gb = disk.available_space() as f64 / 1024.0 / 1024.0 / 1024.0;
            let total_gb = disk.total_space() as f64 / 1024.0 / 1024.0 / 1024.0;

            devices.push(UsbDevice {
                id: disk.name().to_string_lossy().to_string(),
                name: disk.name().to_string_lossy().to_string(),
                mount_point: mount_point.to_string(),
                available_space_gb: available_gb,
                total_space_gb: total_gb,
            });
        }
    }
    eprintln!("Returning {} USB devices", devices.len());

    devices
}

// Sync file to USB
#[tauri::command]
async fn sync_to_usb(
    _file_id: String,
    filename: String,
    usb_mount_point: String,
) -> Result<(), String> {
    let storage_path = get_storage_path()?;
    let source_path = PathBuf::from(&storage_path).join(&filename);
    let dest_path = PathBuf::from(&usb_mount_point).join(&filename);

    if !source_path.exists() {
        return Err(format!("Source file not found: {}", filename));
    }

    // Perform copy
    std::fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(())
}

// Get audio library files
#[tauri::command]
async fn get_audio_library() -> Result<Vec<AudioFile>, String> {
    let storage_path = get_storage_path()?;
    Ok(scan_directory(PathBuf::from(storage_path)))
}

// Get files from USB
#[tauri::command]
async fn get_usb_files(mount_point: String) -> Result<Vec<AudioFile>, String> {
    let path = PathBuf::from(mount_point);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut files = scan_directory(path);
    // Mark files from USB as Synced
    for file in &mut files {
        file.state = AudioState::Synced;
    }
    Ok(files)
}

// Delete audio files
#[tauri::command]
async fn delete_audio_files(_file_ids: Vec<String>, filenames: Vec<String>, usb_mount_point: Option<String>) -> Result<(), String> {
    let storage_path = get_storage_path()?;
    let path = PathBuf::from(&storage_path);

    for filename in &filenames {
        let file_path = path.join(filename);
        if file_path.exists() {
            std::fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete {}: {}", filename, e))?;
        }
    }

    // Delete from USB if connected
    if let Some(mount_point) = usb_mount_point {
        let usb_path = PathBuf::from(mount_point);
        for filename in &filenames {
            let file_path = usb_path.join(filename);
            if file_path.exists() {
                // We attempt to delete but don't fail the whole operation if USB delete fails
                // (e.g. read-only fs, file missing, etc)
                if let Err(e) = std::fs::remove_file(&file_path) {
                    eprintln!("Failed to delete from USB {}: {}", filename, e);
                }
            }
        }
    }

    Ok(())
}

// Prepare audio from a supported media source for the offline library.
#[tauri::command]
async fn download_audio(
    app: tauri::AppHandle,
    url: String,
    speed: f32,
) -> Result<String, String> {
    let storage_path = get_storage_path()?;
    let download_id = uuid::Uuid::new_v4().to_string();
    let id_clone = download_id.clone();

    // Spawn download task
    tauri::async_runtime::spawn(async move {
        let id_for_task = id_clone.clone();
        if let Err(e) = download_audio_task(app.clone(), url, speed, storage_path, id_for_task.clone()).await {
            let _ = app.emit("download-error", json!({
                "id": id_for_task,
                "error": e,
            }));
        }
    });

    Ok(download_id)
}

async fn get_metadata(app: &tauri::AppHandle, url: &str) -> Result<(f64, String), String> {
    let bin = ytdlp::yt_dlp_path(app)?;
    let output = Command::new(&bin)
        .args(["--dump-json", "--no-playlist", "--flat-playlist", url])
        .output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Unable to read media details".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse metadata: {}", e))?;

    let duration = json["duration"].as_f64().ok_or("No duration found")?;
    let title = json["title"].as_str().unwrap_or("audio").to_string();

    Ok((duration, title))
}

async fn get_ffmpeg_path(app: &tauri::AppHandle) -> Option<String> {
    // Locate the bundled ffmpeg sidecar. In a packaged app the sidecar sits next
    // to the executable (e.g. Contents/MacOS), NOT in the resource dir, so we must
    // check both: the executable's directory first, then the resource dir.
    let is_ffmpeg = |name: &str| name.starts_with("ffmpeg") && !name.ends_with(".zip");

    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            dirs.push(parent.to_path_buf());
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        dirs.push(resource_dir);
    }

    for dir in dirs {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if is_ffmpeg(name) {
                        return Some(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}

async fn download_audio_task(
    app: tauri::AppHandle,
    url: String,
    speed: f32,
    storage_path: String,
    download_id: String,
) -> Result<(), String> {
    // Emit the first user-facing preparation status.
    let _ = app.emit("download-progress", serde_json::json!({
        "id": download_id,
        "log": "Reviewing media…",
        "status": "downloading",
    }));

    // 1. Get metadata to determine duration
    let (duration, title) = match get_metadata(&app, &url).await {
        Ok(data) => data,
        Err(e) => {
             // Fall back to direct preparation when media details are unavailable.
             eprintln!("Media detail lookup failed: {}, proceeding with direct preparation", e);
             return download_simple(&app, &url, speed, &storage_path, &download_id).await;
        }
    };

    // Adjust duration for speed (audio becomes shorter if speed > 1.0)
    let effective_duration = duration / speed as f64;

    // 2. Determine chunking strategy
    // 15 minutes = 900 seconds
    let num_chunks = (effective_duration / 900.0).floor() as u32;

    if num_chunks >= 2 {
        // Smart Chunking Mode
        let _ = app.emit("download-progress", serde_json::json!({
            "id": download_id,
            "log": format!("Preparing {} listening segments for your device…", num_chunks),
            "status": "downloading",
        }));

        download_and_chunk(&app, &url, speed, &storage_path, &download_id, &title, num_chunks, effective_duration).await
    } else {
        // Standard preparation path.
        download_simple(&app, &url, speed, &storage_path, &download_id).await
    }
}

async fn download_and_chunk(
    app: &tauri::AppHandle,
    url: &str,
    speed: f32,
    storage_path: &str,
    download_id: &str,
    title: &str,
    num_chunks: u32,
    duration: f64,
) -> Result<(), String> {
    // 1. Prepare the full source into a temporary local file.
    let temp_filename = format!("{}_temp", uuid::Uuid::new_v4());
    let output_template = format!("{}/{}.%(ext)s", storage_path, temp_filename);

    let _ = app.emit("download-progress", serde_json::json!({
        "id": download_id,
        "log": "Preparing media for offline listening…",
        "status": "downloading",
    }));

    // Reuse the standard preparation path with temporary output.
    run_yt_dlp(app, url, speed, &output_template, download_id, false).await?;

    // Find the prepared temporary file.
    let temp_path_base = std::path::Path::new(storage_path).join(&temp_filename);
    let temp_path = temp_path_base.with_extension("mp3");

    if !temp_path.exists() {
        return Err("Prepared temporary file was not found".to_string());
    }

    // 2. Split using ffmpeg
    let _ = app.emit("download-progress", serde_json::json!({
        "id": download_id,
        "log": "Optimizing media for device storage…",
        "status": "downloading",
    }));

    // Calculate exact segment time to split evenly
    // IMPORTANT: user wanted "31 min into 2 chunks" -> 15.5 min chunks.
    // Logic: Total duration / num_chunks
    // We add a small buffer (1.0s) to the segment time to prevent creating a tiny extra chunk
    // due to floating point precision issues or duration discrepancies.
    let segment_time = (duration / (num_chunks as f64)) + 1.0;

    // Sanitize title for filename
    let safe_title = title.replace("/", "-").replace(":", "-");
    let output_pattern = format!("{}/{}-part%03d.mp3", storage_path, safe_title);

    let mut cmd = app.shell().sidecar("ffmpeg")
        .map_err(|e| e.to_string())?;

    let args = vec![
        "-i".to_string(), temp_path.to_string_lossy().to_string(),
        "-f".to_string(), "segment".to_string(),
        "-segment_time".to_string(), format!("{}", segment_time),
        "-c".to_string(), "copy".to_string(),
        output_pattern,
    ];

    cmd = cmd.args(&args);
    let output = cmd.output().await.map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg split failed: {}", stderr));
    }

    // 3. Cleanup temp file
    if let Err(e) = std::fs::remove_file(&temp_path) {
        eprintln!("Warning: Failed to delete temp file: {}", e);
    }

    let _ = app.emit("download-complete", serde_json::json!({
        "id": download_id,
        "status": "completed",
    }));

    Ok(())
}

async fn download_simple(
    app: &tauri::AppHandle,
    url: &str,
    speed: f32,
    storage_path: &str,
    download_id: &str,
) -> Result<(), String> {
    let output_template = format!("{}/%(title)s.%(ext)s", storage_path);
    match run_yt_dlp(app, url, speed, &output_template, download_id, true).await {
        Ok(_) => {
             let _ = app.emit("download-complete", serde_json::json!({
                "id": download_id,
                "status": "completed",
            }));
            Ok(())
        },
        Err(e) => Err(e)
    }
}

async fn run_yt_dlp(
    app: &tauri::AppHandle,
    url: &str,
    speed: f32,
    output_template: &str,
    download_id: &str,
    emit_progress: bool,
) -> Result<(), String> {
    let bin = ytdlp::yt_dlp_path(app)?;

    let mut args = vec![
        "-f".to_string(), "bestaudio".to_string(),
        "-x".to_string(),
        "--audio-format".to_string(), "mp3".to_string(),
        "--audio-quality".to_string(), "0".to_string(),
        "-o".to_string(), output_template.to_string(),
        "--newline".to_string(),
        "--no-playlist".to_string(),
    ];

    if let Some(ffmpeg_path) = get_ffmpeg_path(app).await {
        args.push("--ffmpeg-location".to_string());
        args.push(ffmpeg_path);
    }

    if (speed - 1.0).abs() > 0.01 {
        args.push("--postprocessor-args".to_string());
        args.push(format!("ffmpeg:-filter:a atempo={}", speed));
    }

    args.push(url.to_string());

    let mut child = Command::new(&bin)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    // Drain stderr concurrently so a full pipe buffer can't deadlock the process,
    // and keep it for error reporting if yt-dlp exits non-zero.
    let stderr_handle = child.stderr.take().map(|stderr| {
        tokio::spawn(async move {
            let mut buf = String::new();
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                buf.push_str(&line);
                buf.push('\n');
            }
            buf
        })
    });

    // Always drain stdout (avoids deadlock); emit progress only when requested.
    if let Some(stdout) = child.stdout.take() {
        let mut lines = BufReader::new(stdout).lines();
        while let Some(line) = lines.next_line().await.map_err(|e| e.to_string())? {
            if !emit_progress { continue; }
            let line = line.trim();
            if line.is_empty() { continue; }

            // The media adapter emits percentages. Forward them so Tide can make
            // the waterline a real preparation indicator.
            let progress = line
                .split_whitespace()
                .find_map(|part| part.strip_suffix('%')?.parse::<f64>().ok());

            let mut filename = None;
            if line.contains("Destination: ") {
                if let Some(path_str) = line.split("Destination: ").nth(1) {
                    let path = std::path::Path::new(path_str.trim());
                    if let Some(name) = path.file_name() {
                        filename = Some(name.to_string_lossy().to_string());
                    }
                }
            }

            let display_log = match progress {
                Some(value) => format!("Preparing media · {:.0}%", value),
                None if filename.is_some() => "Adding to offline library…".to_string(),
                None => "Preparing media…".to_string(),
            };

            let _ = app.emit("download-progress", serde_json::json!({
                "id": download_id,
                "log": display_log,
                "status": "downloading",
                "filename": filename,
                "progress": progress
            }));
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    let stderr_text = match stderr_handle {
        Some(handle) => handle.await.unwrap_or_default(),
        None => String::new(),
    };

    if !status.success() {
        return Err(format!("yt-dlp failed: {}", stderr_text.trim()));
    }

    Ok(())
}



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Silently refresh yt-dlp from the nightly channel in the background
            // on every launch. Best-effort: never blocks startup, never fails the app.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(ytdlp::ensure_ytdlp_fresh(handle));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            validate_url,
            get_storage_path,
            set_storage_path,
            list_usb_devices,
            get_audio_library,
            get_usb_files,
            delete_audio_files,
            download_audio,
            sync_to_usb,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
