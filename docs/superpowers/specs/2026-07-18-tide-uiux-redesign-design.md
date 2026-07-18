# Tide — UI/UX Redesign Design

## Context

Shokz Audio (internal working name) is a Tauri + React desktop companion app: paste a
YouTube/Apple Podcasts URL, convert to MP3 at an adjustable speed, and sync the result
to a connected USB earpiece (e.g. Shokz OpenSwim) for offline underwater listening.

The current UI (`src/App.tsx`) is a plain, unstyled utility screen: white background,
gray text, default shadcn components, everything in one vertical scroll (add bar →
library list → storage settings). It has no visual identity and no concept tying it
to its actual use case — a quick on-land tool for prepping audio before a swim.

This spec covers a full concept + visual + interaction redesign: naming/identity,
visual language, layout restructuring, and component-level UX changes. It does not
change any backend/Tauri command behavior — all existing commands, events, and data
shapes (`AudioFile`, `UsbDevice`, `download-progress`/`download-complete`/`sync-complete`
events) are reused as-is.

## Concept & Identity

- **Name:** *Tide* — audio flows in from the web and out to the device, like a tide.
  Replaces "Shokz Audio" as the in-app name and window title (`tauri.conf.json`
  `windows[0].title`).
- **Tagline** (empty state only): "Pull it in, take it under."
- **Icon/wordmark:** a simple concentric-ripple mark (2–3 offset arcs suggesting a
  drop hitting water), replacing the default Tauri/React icon set
  (`src-tauri/icons/*`, `src/assets/react.svg` no longer used) and shown as a small
  mark next to the "Tide" label in the header.
- **Color direction ("ocean/ambient"):** aqua-to-deep-teal gradient family as the
  primary accent (header surface, primary button, sync/progress states); warm
  sand/off-white neutrals for backgrounds and cards (replacing pure white/gray);
  one coral/amber accent reserved exclusively for warnings (destructive actions,
  low device storage) so it stays meaningful rather than decorative.
- **Type/shape direction:** keep the existing system sans (Tailwind default), but
  increase corner rounding on cards/buttons/inputs and add more generous
  padding/whitespace and soft shadows — this is what makes it read as "ocean/ambient"
  rather than a re-colored default theme.
- **Motion motif:** a subtle ripple/wave, used sparingly — a faint wave line under
  the sticky header, and a ripple pulse on the capacity gauge when a sync completes.
  Not applied as decoration elsewhere.

## Layout & Structure

Replaces the single continuous scroll with a **sticky header + scrolling library**
layout, so the two things used every session (adding audio, checking device
capacity) stay on-screen regardless of library length, while one-time setup moves
out of the main flow.

**Sticky header** (ocean-gradient surface, does not scroll):
- Row 1 — Quick-add: URL input (flex-1) + speed `Select` + primary button labeled
  "Pull in" (replaces "Add"), with a small ripple-drop icon. Inline validation
  message below, same logic as today (`validate_url` invoke), recolored
  teal (success) / coral (error).
- Row 2 — Capacity gauge (see Components below), or a collapsed "no device" pill
  when `usbDevices` is empty/no device selected.
- Top-right corner: a small gear icon opening the Settings popover.

**Scrolling body — Library:**
- Existing list of `AudioFile` rows, restyled (see Components), same 5-state model
  (`queued | downloading | local | syncing | synced`) — no new states introduced.
- A selection toolbar appears above the list only when `selectedFiles.size > 0`,
  replacing today's always-visible-but-disabled Delete button.

**Settings popover** (opened from the header gear icon):
- Contains the existing "Local storage path + Change" control
  (`handleChangeStorage`), moved out of the main flow since it's configured
  once and rarely revisited.

## Component Details

**Quick-add row**
- Placeholder text unchanged (URL format hint).
- Button: "Pull in" + ripple-drop icon, primary teal fill.
- Speed `Select`: same 5 options (1.0/1.25/1.5/2.0/3.0x), restyled (rounded, teal
  focus ring).
- Validation message: reuses existing `validationMsg` state/logic, recolored to
  teal/coral.

**Capacity gauge**
- `list_usb_devices` only returns free space today (`space_available: "{:.1} GB
  available"` in `src-tauri/src/lib.rs`) — there is no total/used capacity field,
  and adding one is out of scope (see below). So the gauge is a **free-space
  indicator**, not a used/total fill bar: a rounded pill showing
  `{device.name} · {space_available}`, with an icon whose fill/tone shifts by an
  absolute free-space threshold rather than a percentage:
  - ≥ 1 GB free: teal/aqua tone (healthy).
  - < 1 GB free: coral tone + "· low space" appended to the label.
  (1 GB is a placeholder threshold — trivial to tune once real device sizes are
  observed in testing; not worth a config option at this stage.)
- On `sync-complete` event: the pill briefly pulses (CSS animation) instead of
  updating instantly — purely a frontend animation on an existing event, no new
  event payload needed.
- No device connected/selected: row collapses to a slim pill: "No earpiece
  connected — files will save locally."

**Library list items**
- Same row shape (badge + filename + optional `download_log` line).
- Badge recolor only (states unchanged): queued=sand, downloading=aqua,
  local=amber, syncing=teal with pulse animation, synced=teal solid + check.
- Row corners rounded; hover = soft aqua tint (replaces `hover:bg-gray-50`);
  selected = teal-tinted background (replaces `bg-blue-50`).

**Selection toolbar**
- Renders only when `selectedFiles.size > 0`: "`N selected`" + coral Delete button
  (destructive-action color, per the palette rule above). Reuses existing
  `handleDelete` logic and confirm dialog.

**Empty state**
- No audio files: centered ripple icon + "Pull it in, take it under." + subtext
  "Paste a YouTube or Apple Podcasts link above to get started."

## Out of Scope

- No new backend/Tauri commands, no new state values, no new data fields.
- No tabbed navigation (rejected in favor of sticky-header approach — keeps
  quick-add always one glance/click away, per priority: quick-add speed first,
  storage awareness second, library browsing third).
- No changes to chunking, USB device detection, or yt-dlp/auto-update behavior.
- App name change is cosmetic (window title, in-app label, icon) — package name
  (`shokz-audio-app`) and repo name are unchanged.

## Testing

- Manual verification via `npm run tauri dev`: quick-add flow, capacity gauge across
  connected/disconnected/low-space device states, library item states (all 5),
  selection toolbar appear/disappear, settings popover open/change path, empty
  state.
- No new automated test infra exists in this repo today; none added by this change
  (visual/layout change, not new logic).
