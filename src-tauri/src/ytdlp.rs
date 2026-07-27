//! Self-updating yt-dlp management.
//!
//! yt-dlp depends on YouTube's internals, which change often, so a binary frozen
//! at app-release time goes stale and breaks. Instead of running the bundled
//! sidecar directly, we keep a writable copy in the OS *cache* dir and silently
//! refresh it from the yt-dlp nightly channel on every launch (best-effort).
//!
//! Isolation: the binary is always invoked by absolute path; nothing is written to
//! $PATH or system locations, so a user's own yt-dlp is never touched or used.
//! See docs/superpowers/specs/2026-06-14-self-updating-yt-dlp-design.md.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;

const NIGHTLY_LATEST_URL: &str =
    "https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest";
/// A real yt-dlp binary is tens of MB; anything smaller is a failed/HTML download.
const MIN_VALID_BYTES: usize = 1_000_000;

#[derive(Debug, Default, Serialize, Deserialize)]
struct YtdlpMeta {
    /// The nightly tag currently on disk (empty until first successful update).
    version: String,
}

/// The yt-dlp nightly release asset for the current build target.
pub fn nightly_asset_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "yt-dlp_macos" // universal2 — works on arm64 and x86_64
    } else if cfg!(target_os = "windows") {
        "yt-dlp.exe"
    } else if cfg!(target_arch = "aarch64") {
        "yt-dlp_linux_aarch64"
    } else {
        "yt-dlp_linux"
    }
}

/// On-disk binary name (Windows needs the .exe suffix to be executable).
fn bin_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "yt-dlp.exe"
    } else {
        "yt-dlp"
    }
}

/// Writable per-user dir holding our yt-dlp copy + metadata. Cache dir, because
/// the binary is fully regenerable; the OS may purge it and we re-seed silently.
fn ytdlp_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("no cache dir: {e}"))?
        .join("bin");
    std::fs::create_dir_all(&dir).map_err(|e| format!("create cache dir: {e}"))?;
    Ok(dir)
}

/// Locate the bundled seed yt-dlp shipped with the app (next to the executable,
/// or in the resource dir). Matches any `yt-dlp*` file, ignoring archives/json.
fn find_seed(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            dirs.push(parent.to_path_buf());
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        dirs.push(res);
    }

    for dir in dirs {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.starts_with("yt-dlp")
                        && !name.ends_with(".zip")
                        && !name.ends_with(".json")
                        && !name.ends_with(".tmp")
                    {
                        return Some(entry.path());
                    }
                }
            }
        }
    }
    None
}

/// Resolve the path to run yt-dlp from, seeding from the bundle on first use.
pub fn yt_dlp_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dest = ytdlp_dir(app)?.join(bin_name());
    if !dest.exists() {
        let seed = find_seed(app).ok_or("bundled yt-dlp seed not found")?;
        std::fs::copy(&seed, &dest).map_err(|e| format!("seed copy failed: {e}"))?;
        set_executable(&dest)?;
    }
    Ok(dest)
}

/// Spawn-friendly entry point: never returns an error to the caller, so a failed
/// update can never break a working install. Logs and moves on.
pub async fn ensure_ytdlp_fresh(app: tauri::AppHandle) {
    if let Err(e) = update_if_stale(&app).await {
        eprintln!("[ytdlp] update skipped (keeping current binary): {e}");
    }
}

async fn update_if_stale(app: &tauri::AppHandle) -> Result<(), String> {
    // Guarantee a working binary exists before we consider updating.
    let dest = yt_dlp_path(app)?;
    let dir = ytdlp_dir(app)?;
    let meta_path = dir.join("ytdlp-meta.json");
    let mut meta = read_meta(&meta_path);

    let client = reqwest::Client::builder()
        .user_agent("tide")
        // Some networks reset HTTP/2 streams to GitHub mid-transfer (observed as
        // "connection closed via error"); HTTP/1.1 is reliable and costs nothing here.
        .http1_only()
        .build()
        .map_err(|e| format!("http client: {e}"))?;

    let release: serde_json::Value = client
        .get(NIGHTLY_LATEST_URL)
        .send()
        .await
        .map_err(|e| format!("fetch release: {e}"))?
        .json()
        .await
        .map_err(|e| format!("parse release: {e}"))?;

    let latest = release["tag_name"]
        .as_str()
        .ok_or("release has no tag_name")?
        .to_string();

    // Already current: nothing to download.
    if latest == meta.version {
        return Ok(());
    }

    let url = find_asset_url(&release, nightly_asset_name())
        .ok_or_else(|| format!("asset {} not in release", nightly_asset_name()))?;

    let bytes = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("download: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("read download: {e}"))?;

    if bytes.len() < MIN_VALID_BYTES {
        return Err(format!("download too small ({} bytes)", bytes.len()));
    }

    // Write to a temp file, then atomically rename over the live binary so a
    // killed/partial download can never leave a corrupt yt-dlp in place.
    let tmp = dir.join("yt-dlp.download.tmp");
    std::fs::write(&tmp, &bytes).map_err(|e| format!("write temp: {e}"))?;
    set_executable(&tmp)?;
    std::fs::rename(&tmp, &dest).map_err(|e| format!("atomic replace: {e}"))?;

    meta.version = latest;
    write_meta(&meta_path, &meta);
    eprintln!("[ytdlp] updated to {}", meta.version);
    Ok(())
}

/// Pure: pull the download URL for `asset_name` out of a GitHub release JSON.
fn find_asset_url(release: &serde_json::Value, asset_name: &str) -> Option<String> {
    release["assets"]
        .as_array()?
        .iter()
        .find(|a| a["name"].as_str() == Some(asset_name))?["browser_download_url"]
        .as_str()
        .map(|s| s.to_string())
}

fn read_meta(path: &Path) -> YtdlpMeta {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_meta(path: &Path, meta: &YtdlpMeta) {
    if let Ok(s) = serde_json::to_string_pretty(meta) {
        let _ = std::fs::write(path, s);
    }
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(path)
        .map_err(|e| format!("stat: {e}"))?
        .permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(path, perms).map_err(|e| format!("chmod: {e}"))
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn asset_name_matches_host_target() {
        // On the dev/CI host (macOS) this must select the universal build.
        if cfg!(target_os = "macos") {
            assert_eq!(nightly_asset_name(), "yt-dlp_macos");
        }
        // Whatever the target, the name is always non-empty and yt-dlp-ish.
        assert!(nightly_asset_name().starts_with("yt-dlp"));
    }

    #[test]
    fn bin_name_has_exe_only_on_windows() {
        if cfg!(target_os = "windows") {
            assert_eq!(bin_name(), "yt-dlp.exe");
        } else {
            assert_eq!(bin_name(), "yt-dlp");
        }
    }

    #[test]
    fn finds_matching_asset_url() {
        let release = json!({
            "tag_name": "2026.06.14",
            "assets": [
                { "name": "yt-dlp_linux", "browser_download_url": "https://example/linux" },
                { "name": "yt-dlp_macos", "browser_download_url": "https://example/macos" }
            ]
        });
        assert_eq!(
            find_asset_url(&release, "yt-dlp_macos").as_deref(),
            Some("https://example/macos")
        );
    }

    #[test]
    fn missing_asset_returns_none() {
        let release = json!({ "tag_name": "x", "assets": [] });
        assert_eq!(find_asset_url(&release, "yt-dlp_macos"), None);
    }

    #[test]
    fn meta_roundtrips_through_json() {
        let meta = YtdlpMeta {
            version: "2026.06.14".into(),
        };
        let s = serde_json::to_string(&meta).unwrap();
        let back: YtdlpMeta = serde_json::from_str(&s).unwrap();
        assert_eq!(back.version, "2026.06.14");
    }

    #[test]
    fn meta_tolerates_legacy_checked_at_field() {
        // Meta files written by older builds carry a checked_at timestamp;
        // serde must ignore it rather than fail the parse.
        let back: YtdlpMeta =
            serde_json::from_str(r#"{ "version": "2026.06.28", "checked_at": 42 }"#).unwrap();
        assert_eq!(back.version, "2026.06.28");
    }
}
