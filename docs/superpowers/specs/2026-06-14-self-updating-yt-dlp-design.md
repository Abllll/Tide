# Self-Updating yt-dlp — Design

Date: 2026-06-14
Status: Approved (pending spec review)

## Problem

yt-dlp depends on YouTube's (and other sites') internals, which change frequently —
often weekly. A binary baked into the app at release time goes stale and the app
breaks until a whole new release is cut. On macOS there is an extra constraint: a
signed/notarized `.app` cannot self-modify binaries inside the bundle without
invalidating its signature.

Currently yt-dlp is shipped as a Tauri sidecar (`externalBin` in
`src-tauri/tauri.conf.json`) and invoked via `app.shell().sidecar("yt-dlp")` in
`src-tauri/src/lib.rs` (`get_metadata`, `run_yt_dlp`).

## Goal

Keep yt-dlp fresh without re-releasing the app, with zero user intervention, and
never break a working install because an update failed.

## Core Idea

Bundle a **seed** copy of yt-dlp (so the app works offline on first launch) but run
from a **writable per-user copy** that silently updates itself from yt-dlp's
**nightly** channel on every launch. ffmpeg is left bundled as-is — it
does not suffer the same breakage.

Decisions locked in:
- Update trigger: **auto on launch, silent**.
- Channel: **nightly** (`yt-dlp/yt-dlp-nightly-builds`).
- **Cross-platform** (macOS / Windows / Linux) from the start.
- Writable copy lives in the **OS cache dir** (disposable / regenerable), not
  app-data. No in-app uninstall UI.

## Isolation Guarantee

The app never touches the user's existing environment:
- The seed is copied into the app's **own private cache dir** on first launch.
- yt-dlp is always invoked by **absolute path**, never resolved off `$PATH`.
- Nothing is written to `/usr/local/bin`, `~/.local/bin`, Homebrew, pip, or `$PATH`.

A user's system-installed yt-dlp (Homebrew/pip/etc.) is therefore neither modified
nor used. The app's copy is fully sandboxed and version-controlled by the app. We
deliberately do **not** reuse a system yt-dlp, to avoid inheriting a stale/broken
version — the exact failure mode this design exists to prevent.

## Architecture

### 1. Runtime location
Run yt-dlp from a writable per-user **cache** directory, not the read-only app
bundle:

```
<cache_dir>/bin/yt-dlp        (macOS/Linux)
<cache_dir>/bin/yt-dlp.exe    (Windows)
```

`cache_dir` comes from Tauri's `app.path().app_cache_dir()`
(e.g. `~/Library/Caches/com.shokz.audio/` on macOS,
`%LOCALAPPDATA%\com.shokz.audio\` on Windows,
`~/.cache/com.shokz.audio/` on Linux). This lives outside the `.app`/install
bundle, so updates never touch code signing.

The cache dir is chosen over app-data deliberately: the binary is fully
regenerable (re-seed from bundle, then re-download), so semantically it is a cache,
not user data. The OS and third-party cleaner tools may purge it at any time; the
resolver re-seeds transparently on the next call, so a purge is harmless. User data
(downloaded audio, `storage_path`) is stored separately and is never affected.

### 2. Platform asset map
A pure function `nightly_asset_name() -> &'static str` keyed on the compile-time
target, returning the correct nightly release asset:

| Target | Asset |
|---|---|
| `aarch64-apple-darwin`, `x86_64-apple-darwin` | `yt-dlp_macos` (universal) |
| `x86_64-pc-windows-msvc` | `yt-dlp.exe` |
| `x86_64-unknown-linux-gnu` | `yt-dlp_linux` |
| `aarch64-unknown-linux-gnu` | `yt-dlp_linux_aarch64` |

Implemented with `cfg!(target_os/target_arch)`. On-disk binary name gets `.exe`
appended on Windows.

### 3. Resolver — `yt_dlp_path(app) -> Result<PathBuf, String>`
Replaces the bare `sidecar("yt-dlp")` calls. Logic:
1. Compute the cache-dir binary path.
2. If it does not exist, copy the bundled seed sidecar there and set the
   executable bit (`0o755`) on Unix.
3. Return the cache-dir path.

All invocations switch from `app.shell().sidecar("yt-dlp")` to
`app.shell().command(path)` (or `std::process::Command`) using this path.

### 4. Updater — `ensure_ytdlp_fresh(app)`
Spawned once on startup as a non-blocking background task. Best-effort. Runs the
check on **every launch** — no throttle. (An earlier revision throttled checks to
every 12 h via a `checked_at` timestamp and a `force` flag; both were removed
2026-07-05 in favor of always-fresh. Old `ytdlp-meta.json` files carrying a
`checked_at` field still parse — serde ignores unknown fields.)
1. Ensure the seed has been materialized (call resolver).
2. `GET https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest`
   (with a `User-Agent` header) → read `tag_name` as the latest version.
3. Read `<cache_dir>/bin/ytdlp-meta.json` (`{ version }`). If
   `latest == meta.version`, return — nothing to download.
4. Find the asset matching `nightly_asset_name()`, download its
   `browser_download_url` to `<path>.download.tmp`.
5. Sanity-check the temp file (non-empty, set exec bit), then **atomically rename**
   over the live binary.
6. Write `ytdlp-meta.json` with the new `version`.
7. Any error at any step is logged and swallowed — the existing working binary
   keeps running.

Cost of the per-launch check: one small GitHub API request. The unauthenticated
rate limit (60/hr per IP) is ample for normal use; a rate-limited or offline check
fails gracefully like any other error.

## Data Flow

```
App launch
  ├─ spawn ensure_ytdlp_fresh(app)  ──(background, best-effort)──▶ cache_dir/bin/yt-dlp updated
  └─ UI ready immediately (never blocked on the updater)

Download / metadata request
  └─ yt_dlp_path(app)  ─▶  cache copy (seeded from bundle if absent)  ─▶  spawn
```

## Install / Uninstall Lifecycle

### Fresh install
1. App is installed normally (drag `.app`, run installer, etc.). The seed yt-dlp
   ships inside the bundle as a sidecar.
2. On first launch the resolver copies the seed into `<cache_dir>/bin/` and sets
   the exec bit. The app is immediately usable, offline.
3. The background updater then refreshes it to the latest nightly when online.

No system locations are written; an existing user yt-dlp is untouched (see
Isolation Guarantee).

### Uninstall cleanup (per platform)
Full auto-cleanup on uninstall is only natively achievable on Windows; the cache
dir location is chosen to make the leftover both harmless and easy to reclaim
everywhere else.

| Platform | Uninstall mechanism | Cleanup of `<cache_dir>/bin/` |
|---|---|---|
| **Windows** | NSIS uninstaller | Wire an uninstall hook (`nsis` template) to delete `%LOCALAPPDATA%\com.shokz.audio\`. |
| **macOS** | Drag `.app` to Trash (no OS hook) | Left behind, but it sits in `~/Library/Caches/`, which the OS and cleaner tools (e.g. AppCleaner) treat as purgeable. Documented in README. |
| **Linux (.deb)** | `postrm` | Per-user `$HOME/.cache` is not removed by convention (multi-user safety); documented in README. |
| **Linux (AppImage)** | Delete the file (no hook) | Documented manual path in README. |

Because the binary lives in a cache dir, any leftover is semantically disposable:
re-running the app re-seeds it, and deleting it frees the space with no data loss.
Downloaded audio (`storage_path`) is user data and is intentionally **not** removed
by any uninstall path.

No in-app "remove components" UI is included (out of scope).

## Robustness

- **Atomic replace** (temp + rename) — a killed/half-finished download can never
  leave a corrupt binary in place.
- **Seed-on-first-run** — the app works the instant it is installed, before any
  network call.
- **Best-effort updates** — failures are invisible and never block a download.
- **Version short-circuit** — the per-launch check downloads nothing when the
  on-disk version already matches the latest nightly.

## Out of Scope (YAGNI)

- Removing the bundled seed (kept for offline first-run).
- Any change to ffmpeg.
- Stable-vs-nightly fallback logic — straight nightly.
- A user-facing update button/UI (unnecessary now that every launch checks).
- An in-app "remove downloaded components" action.
- Auto-cleanup on macOS/Linux uninstall (not possible without an OS hook; cache-dir
  placement + README docs are the chosen mitigation).
- SHA256/signature verification of the download beyond the non-empty/exec sanity
  check (HTTPS via GitHub assumed; can be added later).

## Testing

- **Unit**
  - `nightly_asset_name()` returns the correct asset per `cfg` target.
  - Resolver seeds the binary into app-data when absent and is a no-op when present.
  - Version compare: no download when `latest == meta.version`.
  - Meta parsing tolerates the legacy `checked_at` field from pre-2026-07-05 builds.
- **Integration**
  - Point the updater at a fake release JSON + local asset; assert the binary is
    replaced atomically and `ytdlp-meta.json` updated.
  - Simulate a download failure mid-stream; assert the previous binary is intact
    and usable.

## Affected Code

- `src-tauri/tauri.conf.json` — keep `externalBin` seeds; ensure per-target seed
  binaries exist for any platform built.
- `src-tauri/src/lib.rs` — new `yt_dlp_path`, `nightly_asset_name`,
  `ensure_ytdlp_fresh`; spawn updater in `setup`; replace `sidecar("yt-dlp")` in
  `get_metadata` and `run_yt_dlp`.
- `src-tauri/Cargo.toml` — no new deps needed: `reqwest` (with `json`) and
  `serde_json` are already present and are used for the GitHub API call + download.
- `src-tauri/tauri.conf.json` (bundle/windows) + an NSIS uninstall hook template —
  delete `%LOCALAPPDATA%\com.shokz.audio\` on Windows uninstall.
- `README.md` — document the per-user cache path and manual removal on
  macOS/Linux uninstall.
