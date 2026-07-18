# Tide — Water-Level Storage Indicator Design

## Context

This extends the Tide UI/UX redesign (`docs/superpowers/specs/2026-07-18-tide-uiux-redesign-design.md`,
implemented in `docs/superpowers/plans/2026-07-18-tide-uiux-redesign.md`) with a functional,
continuously-animated water indicator that reflects how full the connected earpiece's
storage is — both as a full-screen entrance moment on every launch, and as a persistent
animated element in the header afterward. This is not purely decorative: the water level
is meant to be read as "how much room is left before you need to clean up before your
next sync," matching the product's actual constraint (small earpiece storage).

## Data Model Change (backend)

`UsbDevice` (`src-tauri/src/lib.rs`) currently returns only a formatted free-space string
(`space_available: String`, e.g. `"3.2 GB available"`), which is enough for a text label
but not enough to compute a fill percentage. This spec changes it to real numbers:

```rust
pub struct UsbDevice {
    pub id: String,
    pub name: String,
    pub mount_point: String,
    pub available_space_gb: f64,  // replaces space_available: String
    pub total_space_gb: f64,      // new
}
```

`list_usb_devices` already iterates `sysinfo::Disks` and reads `disk.available_space()`;
`disk.total_space()` is available on the same `Disk` object, so this is additive to code
that's already there, not a rewrite. The two frontend call sites that previously displayed
`device.space_available` directly (the header's capacity indicator, and the device-select
dropdown label) instead format `available_space_gb` themselves (e.g.
`` `${available_space_gb.toFixed(1)} GB free` ``) — this also removes the regex-based
parsing (`parseFreeGb`) the original `CapacityGauge` used to guess a number back out of a
string, which is no longer needed once the number is available directly.

`used_fraction = 1 - available_space_gb / total_space_gb` is the single value that drives
every water visual described below.

**Threshold:** `used_fraction >= 0.9` (≤10% free) is the "low space" state — coral tone,
"· low space" label — replacing the original spec's fixed "<1GB free" rule now that a real
percentage is available.

## Shared Rendering: `WaterCanvas`

A new component wraps a `<canvas>` driven by `requestAnimationFrame`. Props:
`{ fillFraction: number; tone: "healthy" | "low"; width: number; height: number }`.

Each frame draws:
1. A top-to-bottom depth gradient for the filled region (lighter teal/coral at the surface,
   deeper toward the bottom) — `tone` selects the teal or coral gradient stops.
2. 2–3 overlapping sine-wave layers at different phase offsets and speeds for the top
   surface, so the motion reads as organic water rather than a single repeating loop.
   Exact amplitude/speed constants are an implementation-tuning detail, not a spec
   requirement — the requirement is: motion must never be a single, obviously-looping
   flat wave.
3. A moving specular highlight band tracking the wave crest, for a glossy/wet look.

The animation loop pauses (via the `visibilitychange` event) when the document is hidden,
so a continuously-running canvas doesn't burn CPU while the app is backgrounded — this
matters here because, unlike the original spec's static badges, this element runs
indefinitely for as long as the app is open.

`WaterCanvas` is used at two sizes: full-screen (the entrance) and small/header (the
persistent gauge). Same component, different `width`/`height`, so the wave rendering logic
exists in exactly one place.

## Entrance Sequence: `WaterIntro`

Plays on **every launch** (not just first-ever — a one-time-only splash would show stale
data forever after, which defeats the point of it being a real indicator).

1. Renders as a fixed, full-viewport overlay (`z-50`) immediately on mount.
2. Waits for the app's initial data load (device list + audio library, both already fetched
   by `App.tsx` on mount today) to resolve before animating, so it never flashes a wrong
   level. If no device is connected/selected, `fillFraction` uses a fixed small floor value
   (`0.04`) rather than 0, so there's always a thin visible strip of water rather than an
   empty screen doing nothing — consistent with the "no earpiece connected" framing used
   elsewhere (files still save locally; the app still "holds a little water").
3. Animates `fillFraction` from `0` to the resolved `used_fraction` (or the floor value)
   over ~1.2s (ease-out), holds ~0.4s, then fades and drifts upward slightly over ~0.6s to
   reveal the app beneath. Total ~2.2s — brief enough that it doesn't feel like a delay
   before the quick-add bar becomes usable, since this now runs on every open.
4. On completion, `App.tsx` stops rendering `WaterIntro` entirely (unmounts it, cleaning up
   its own animation frame) — the already-rendered header/`CapacityGauge` underneath
   continues the same wave motion independently. A perfectly seamless handoff between the
   two canvases is not required.

## Persistent Indicator: `CapacityGauge`

Keeps its existing external interface (`device: UsbDevice | null`, `justSynced: boolean` —
unchanged from the original spec), but its internals change from a flat colored pill to a
small `WaterCanvas` (continuously animating, never static, using the same `used_fraction`
and `tone` rule as the entrance) plus the existing text label reformatted from
`available_space_gb`/`total_space_gb` instead of a parsed string. The existing
sync-complete pulse (`justSynced` → brief scale-up) still applies on top of the continuous
wave motion. No device connected → tank renders dry/empty (animation not running), same
copy as today ("No earpiece connected — files will save locally.").

## Out of Scope

- No changes to the original redesign's layout, color tokens, or other components
  (`LibraryList`, `SettingsPopover`, `BrandMarks`) beyond what's described above.
- No WebGL/shader-based rendering and no new npm dependencies — `WaterCanvas` is plain
  Canvas 2D, procedurally drawn.
- No real filmed/rendered water footage (would require a licensed/generated video asset
  not available in this environment).
- No skip-intro control (e.g. click-to-skip) — out of scope unless it becomes annoying in
  practice, per the ~2.2s duration decision above.

## Testing

- Manual verification via `npm run tauri dev` (same limitation as the original plan: no
  automated test framework exists in this repo). Specifically: entrance plays on every
  launch and matches current device fill level; no-device launch shows the floor-value
  puddle instead of nothing; low-space coral tone triggers at ≥90% used; the header tank's
  wave motion never visibly stops while the app is open; the sync-complete pulse still
  fires correctly on top of the continuous animation; the canvas animation pauses when the
  window loses visibility (checkable via a `visibilitychange` breakpoint/log during
  implementation) and resumes when it regains it.
