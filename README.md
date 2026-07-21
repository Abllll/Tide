# Tide

Tide is a desktop companion for swimmers who prepare audio for offline listening on compatible waterproof devices. It turns the practical work of collecting, organising, preparing, and syncing media into a calm pre-swim ritual.

> Import → Organise → Prepare → Sync → Swim

## Product Overview

Tide brings a desktop workflow to the moment before a swim. A person adds supported media to an offline library, adjusts listening speed when useful, reviews what is ready, and syncs the collection to a connected device.

The concept is designed as a portfolio case study for product thinking, desktop interaction design, motion, and system architecture—not as a platform-specific media service.

## Problem

Preparing audio for a swim is usually fragmented: media lives across sources, files are difficult to review on a desktop, and device transfer feels like an opaque utility step. The workflow is functional, but it offers little confidence about what is ready to take offline.

## Solution

Tide makes preparation legible in one place:

- Add supported media to an offline library.
- Set a listening speed before preparation.
- Review local items and their readiness state.
- Connect a compatible waterproof device and sync deliberately.
- Use waterline motion as feedback for preparation and transfer progress.

## Key Features

- **Offline library** — a local collection for media prepared for the water.
- **Media preparation** — supported media links are prepared as device-ready audio, with optional speed adjustment and long-form segmentation.
- **Device sync workspace** — local and device libraries are shown side by side so transfer state is easy to understand.
- **Water-led feedback** — the waterline, rising sync layer, and earpiece completion flicker make progress visible without interrupting the workflow.
- **Recording previews** — local-library and connected-device preview states support portfolio demonstrations without requiring hardware.

## Interaction Design

The landing view is intentionally quiet: add media, choose a pace, and pull it into Tide. The waterline responds as preparation progresses. When the library is opened, a water-forward transition carries the user into the desktop workspace.

Sync is an explicit action. A foreground water layer rises quickly and eases at the end, while the device library confirms completion with a subtle flicker. Scrolling upward from the Library returns to the landing view through the reverse transition.

## Architecture

```text
Supported Media Source
          ↓
   Preparation Service
          ↓
    Offline Library
          ↓
      Sync Service
          ↓
Compatible Device
```

- **Frontend:** React components render the landing, library, sync workspace, and water-motion states.
- **Desktop shell:** Tauri provides the native window, file dialogs, and command bridge.
- **Local workflow:** Rust manages library storage, media preparation, removable-device discovery, and file copying.
- **Progress system:** command events update the UI, waterline, and preparation states without blocking the desktop experience.

## Tech Stack

- Tauri 2
- React 19 + TypeScript
- Rust
- Vite + Tailwind CSS
- FFmpeg for local audio preparation
- `yt-dlp` as a bundled media-source adapter

## Design Decisions

- **Keep the source abstract.** Tide asks for a supported media link, keeping the product centered on preparation rather than any single platform.
- **Make transfer intentional.** Sync happens in its own workspace after a device is connected; it is not hidden inside import.
- **Use motion as state.** Water is not decoration—the waterline communicates preparation and sync progress.
- **Preserve desktop context.** Library location, removable storage, and file-level states are first-class parts of the experience.
- **Build for demonstration.** Preview controls make key hardware states reproducible for user testing and portfolio recordings.

## Future Exploration

- Native device integrations for compatible waterproof players
- Drag-and-drop local media import
- Richer collection management, tags, and swim-session playlists
- Device-specific capacity planning and offline recommendations
- Accessibility settings for motion intensity and contrast

## Running from Source

1. Install Node.js and Rust.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Launch the desktop app:

   ```bash
   npm run tauri dev
   ```

## Project Note

This project demonstrates interaction design and desktop workflow concepts. Users should only import media they are authorized to use.
