# Tide Water-Level Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat capacity pill with a canvas-rendered, continuously-animated water visual that reflects real earpiece storage fullness — as a ~2.2s full-screen entrance on every launch, and as a small persistent "tank" in the header afterward.

**Architecture:** One small, contained Rust change (add real numeric capacity fields to `UsbDevice`) plus three new/rewritten frontend pieces: a shared `WaterCanvas` (the actual wave rendering, used at two sizes), `WaterIntro` (the full-screen entrance sequencer built on top of `WaterCanvas`), and a rewritten `CapacityGauge` (same external props as before, new internals).

**Tech Stack:** Same as the base redesign (React 19 + TypeScript, Tailwind, Tauri 2) plus the Rust `sysinfo` crate already in use, and the plain browser Canvas 2D API (no new dependencies on either side).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-tide-water-indicator-design.md`. This plan assumes the base redesign (`docs/superpowers/plans/2026-07-18-tide-uiux-redesign.md`) is already implemented — it is, as of the current `main`.
- **This plan touches Rust** (`src-tauri/src/lib.rs`), unlike the base redesign. **This environment has no Rust toolchain installed** (`cargo`/`rustc` not found) — Task 1's Rust change cannot be compiled or `cargo check`-ed here. The change must be correct by careful reading: it mirrors the exact pattern already used one line above it (`disk.available_space()` → `disk.total_space()` is the same `sysinfo::Disk` API, same units, same cast pattern), which keeps the risk low, but this is a real gap — flag it to the user, and if a machine with Rust becomes available, `cargo check` inside `src-tauri/` should be run before trusting this shipped.
- No automated test framework exists in this repo. Frontend verification is `npx tsc --noEmit` + `npm run build`, same as the base redesign.
- No new npm dependencies, no WebGL/three.js — `WaterCanvas` is plain Canvas 2D, procedurally drawn (per spec).
- This plan changes existing behavior slightly beyond the spec's literal text: `loadUsbDevices` (`src/App.tsx`) currently never auto-selects a device — `selectedDevice` only ever changes via manual dropdown interaction. Without a fix, the entrance would show "no device" on every launch even with an earpiece plugged in, defeating the point of the feature. Task 6 makes `loadUsbDevices` auto-select the first available device when none is currently selected/valid (manual switching via the dropdown still works exactly as before). This is a necessary, narrowly-scoped fix to make the already-approved feature function, not a new product decision — flagged here for visibility.

## File Structure

| File | Responsibility |
|---|---|
| `src-tauri/src/lib.rs` | **Modify.** `UsbDevice` struct gains `available_space_gb: f64` / `total_space_gb: f64`, replacing `space_available: String`. `list_usb_devices` computes both. |
| `src/types.ts` | **Modify.** `UsbDevice` interface mirrors the new Rust fields. |
| `src/components/WaterCanvas.tsx` | **Create.** Shared animated wave-fill renderer (`requestAnimationFrame`, layered sine waves, depth gradient, specular highlight, visibility-aware pause). |
| `src/components/WaterIntro.tsx` | **Create.** Full-screen entrance sequencer: waits for `ready`, animates 0→target fill (eased), holds, fades out. Built on `WaterCanvas`. |
| `src/components/CapacityGauge.tsx` | **Modify.** Same external props (`device`, `justSynced`); internals become a small `WaterCanvas` + text label formatted from the new numeric fields (old regex-parsing removed). |
| `src/App.tsx` | **Modify.** Auto-select first device in `loadUsbDevices`; track initial-load readiness; mount `WaterIntro`; update the device-select label to use the new numeric field. |

---

## Task 1: Backend — real capacity numbers

**Files:**
- Modify: `src-tauri/src/lib.rs:49-54` (struct), `src-tauri/src/lib.rs:208-213` (construction)

**Interfaces:**
- Produces: `UsbDevice { id, name, mount_point, available_space_gb: f64, total_space_gb: f64 }` (serialized to the frontend via serde, consumed as `src/types.ts`'s `UsbDevice` in Task 2 onward).

- [ ] **Step 1: Update the struct**

In `src-tauri/src/lib.rs`, replace:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct UsbDevice {
    pub id: String,
    pub name: String,
    pub space_available: String,
    pub mount_point: String,
}
```

with:

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct UsbDevice {
    pub id: String,
    pub name: String,
    pub mount_point: String,
    pub available_space_gb: f64,
    pub total_space_gb: f64,
}
```

- [ ] **Step 2: Compute both numbers in `list_usb_devices`**

In the same file, replace:

```rust
            let available_gb = disk.available_space() as f64 / 1024.0 / 1024.0 / 1024.0;

            devices.push(UsbDevice {
                id: disk.name().to_string_lossy().to_string(),
                name: disk.name().to_string_lossy().to_string(),
                space_available: format!("{:.1} GB available", available_gb),
                mount_point: mount_point.to_string(),
            });
```

with:

```rust
            let available_gb = disk.available_space() as f64 / 1024.0 / 1024.0 / 1024.0;
            let total_gb = disk.total_space() as f64 / 1024.0 / 1024.0 / 1024.0;

            devices.push(UsbDevice {
                id: disk.name().to_string_lossy().to_string(),
                name: disk.name().to_string_lossy().to_string(),
                mount_point: mount_point.to_string(),
                available_space_gb: available_gb,
                total_space_gb: total_gb,
            });
```

- [ ] **Step 3: Verify as best this environment allows**

Run: `grep -n "space_available" src-tauri/src/*.rs` → expect **no matches** (confirms every Rust reference to the old field name is gone; if any remain, the crate won't compile).

Since `cargo`/`rustc` aren't available here, this grep plus careful visual comparison against the pattern above is the only verification possible in this environment — see Global Constraints. Do not claim this compiles; state that it hasn't been compiler-verified.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(backend): expose real available/total USB capacity in GB"
```

---

## Task 2: Frontend types

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `export interface UsbDevice { id: string; name: string; mount_point: string; available_space_gb: number; total_space_gb: number }` — consumed by `CapacityGauge`, `WaterIntro` (indirectly via `App.tsx`), and `App.tsx` itself.

- [ ] **Step 1: Update the interface**

In `src/types.ts`, replace:

```ts
export interface UsbDevice {
  id: string;
  name: string;
  space_available: string;
  mount_point: string;
}
```

with:

```ts
export interface UsbDevice {
  id: string;
  name: string;
  mount_point: string;
  available_space_gb: number;
  total_space_gb: number;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`. Expected: **errors** at every remaining reference to `.space_available` (`src/App.tsx:459`, `src/components/CapacityGauge.tsx:27` and `:37`) — this is expected at this point in the plan; they're fixed in Tasks 5 and 6. Confirm the errors are exactly those three locations and nothing else.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: update UsbDevice type to numeric capacity fields"
```

---

## Task 3: Shared water-wave canvas

**Files:**
- Create: `src/components/WaterCanvas.tsx`

**Interfaces:**
- Produces: `export function WaterCanvas(props: { fillFraction: number; tone: "healthy" | "low"; width: number; height: number; className?: string }): JSX.Element`. Consumed by `WaterIntro` (Task 4) and `CapacityGauge` (Task 5). `fillFraction` is read live every animation frame (via a ref), so the caller can change it continuously without this component's own animation loop restarting.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef } from "react";

interface WaterCanvasProps {
  fillFraction: number;
  tone: "healthy" | "low";
  width: number;
  height: number;
  className?: string;
}

const TONES: Record<"healthy" | "low", { top: string; bottom: string; highlight: string }> = {
  healthy: { top: "#5fd4c8", bottom: "#0f6f6a", highlight: "rgba(255,255,255,0.55)" },
  low: { top: "#f2a08a", bottom: "#c04a34", highlight: "rgba(255,255,255,0.45)" },
};

export function WaterCanvas({ fillFraction, tone, width, height, className }: WaterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fillRef = useRef(fillFraction);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(true);

  useEffect(() => {
    fillRef.current = fillFraction;
  }, [fillFraction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const colors = TONES[tone];
    let start: number | null = null;

    const waveLayers = [
      { amp: height * 0.035, speed: 1.6, phase: 0, alpha: 1 },
      { amp: height * 0.02, speed: 2.3, phase: 2, alpha: 0.6 },
      { amp: height * 0.012, speed: 3.1, phase: 4, alpha: 0.4 },
    ];

    const draw = (timestamp: number) => {
      if (start === null) start = timestamp;
      const t = (timestamp - start) / 1000;

      ctx.clearRect(0, 0, width, height);

      const level = height * (1 - fillRef.current);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 4) {
        let y = level;
        for (const layer of waveLayers) {
          y += Math.sin((x / width) * Math.PI * 2 + t * layer.speed + layer.phase) * layer.amp * layer.alpha;
        }
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.clip();

      const gradient = ctx.createLinearGradient(0, level, 0, height);
      gradient.addColorStop(0, colors.top);
      gradient.addColorStop(1, colors.bottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const y = level + Math.sin((x / width) * Math.PI * 2 + t * waveLayers[0].speed) * waveLayers[0].amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      if (runningRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        runningRef.current = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else if (!runningRef.current) {
        runningRef.current = true;
        start = null;
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tone, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={className}
      aria-hidden="true"
    />
  );
}
```

Save as `src/components/WaterCanvas.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect the same three pre-existing `.space_available` errors from Task 2 (this new file introduces none of its own).

- [ ] **Step 3: Commit**

```bash
git add src/components/WaterCanvas.tsx
git commit -m "feat: add WaterCanvas shared animated wave renderer"
```

---

## Task 4: Full-screen entrance — `WaterIntro`

**Files:**
- Create: `src/components/WaterIntro.tsx`

**Interfaces:**
- Consumes: `WaterCanvas` from `@/components/WaterCanvas`.
- Produces: `export function WaterIntro(props: { targetFraction: number; ready: boolean; onComplete: () => void }): JSX.Element`. `App.tsx` (Task 6) renders this conditionally, passing the current device's used-fraction, an `initialLoadComplete` boolean, and a callback that unmounts it.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef, useState } from "react";
import { WaterCanvas } from "@/components/WaterCanvas";

interface WaterIntroProps {
  targetFraction: number;
  ready: boolean;
  onComplete: () => void;
}

const FLOOR_FRACTION = 0.04;
const RISE_MS = 1200;
const HOLD_MS = 400;
const FADE_MS = 600;
const LOW_SPACE_THRESHOLD = 0.9;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function WaterIntro({ targetFraction, ready, onComplete }: WaterIntroProps) {
  const [fillFraction, setFillFraction] = useState(0);
  const [phase, setPhase] = useState<"waiting" | "rising" | "holding" | "fading">("waiting");
  const rafRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!ready || phase !== "waiting") return;

    setPhase("rising");
    const target = Math.max(targetFraction, FLOOR_FRACTION);
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / RISE_MS, 1);
      setFillFraction(target * easeOutCubic(t));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPhase("holding");
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, phase, targetFraction]);

  useEffect(() => {
    if (phase !== "holding") return;
    const timer = setTimeout(() => setPhase("fading"), HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const timer = setTimeout(onComplete, FADE_MS);
    return () => clearTimeout(timer);
  }, [phase, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-[600ms] ${
        phase === "fading" ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
      }`}
    >
      <WaterCanvas
        fillFraction={fillFraction}
        tone={targetFraction >= LOW_SPACE_THRESHOLD ? "low" : "healthy"}
        width={viewport.w}
        height={viewport.h}
        className="absolute inset-0"
      />
    </div>
  );
}
```

Save as `src/components/WaterIntro.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect the same three pre-existing `.space_available` errors, nothing new.

- [ ] **Step 3: Commit**

```bash
git add src/components/WaterIntro.tsx
git commit -m "feat: add WaterIntro full-screen entrance sequence"
```

---

## Task 5: Rewrite `CapacityGauge` internals

**Files:**
- Modify: `src/components/CapacityGauge.tsx` (full replace)

**Interfaces:**
- Unchanged external interface: `export function CapacityGauge(props: { device: UsbDevice | null; justSynced: boolean }): JSX.Element`.
- Consumes: `WaterCanvas` from `@/components/WaterCanvas`; `UsbDevice` from `@/types` (now with `available_space_gb`/`total_space_gb`).

- [ ] **Step 1: Replace the file**

```tsx
import { WaterCanvas } from "@/components/WaterCanvas";
import type { UsbDevice } from "@/types";

interface CapacityGaugeProps {
  device: UsbDevice | null;
  justSynced: boolean;
}

const LOW_SPACE_THRESHOLD = 0.9;
const TANK_WIDTH = 40;
const TANK_HEIGHT = 24;

export function CapacityGauge({ device, justSynced }: CapacityGaugeProps) {
  if (!device) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <div
          className="rounded-sm bg-muted-foreground/10"
          style={{ width: TANK_WIDTH, height: TANK_HEIGHT }}
        />
        No earpiece connected — files will save locally.
      </div>
    );
  }

  const usedFraction = 1 - device.available_space_gb / device.total_space_gb;
  const isLow = usedFraction >= LOW_SPACE_THRESHOLD;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-transform duration-300 ${
        isLow ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
      } ${justSynced ? "scale-105" : "scale-100"}`}
    >
      <div className="overflow-hidden rounded-sm" style={{ width: TANK_WIDTH, height: TANK_HEIGHT }}>
        <WaterCanvas
          fillFraction={usedFraction}
          tone={isLow ? "low" : "healthy"}
          width={TANK_WIDTH}
          height={TANK_HEIGHT}
        />
      </div>
      {device.name} · {device.available_space_gb.toFixed(1)} GB free
      {isLow ? " · low space" : ""}
    </div>
  );
}
```

Save as `src/components/CapacityGauge.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect **one** remaining pre-existing error, at `src/App.tsx:459` (the device-select label is the only unfixed `.space_available` reference left; `CapacityGauge`'s two errors are now resolved).

- [ ] **Step 3: Commit**

```bash
git add src/components/CapacityGauge.tsx
git commit -m "feat: rewrite CapacityGauge to use animated WaterCanvas tank"
```

---

## Task 6: Integrate — auto-select device, intro readiness, mount `WaterIntro`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `WaterIntro` from `@/components/WaterIntro`.
- Produces: no new exports — top-level composition.

- [ ] **Step 1: Add intro/readiness state**

In `src/App.tsx`, alongside the existing state declarations, add:

```tsx
  const [showIntro, setShowIntro] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
```

(Place these two lines directly after the existing `const [justSynced, setJustSynced] = useState(false);` line.)

- [ ] **Step 2: Await the initial loads instead of firing them blind**

Replace:

```tsx
  // Load initial data and setup listeners
  useEffect(() => {
    loadStoragePath();
    loadAudioLibrary();
    loadUsbDevices();

    // Listeners
```

with:

```tsx
  // Load initial data and setup listeners
  useEffect(() => {
    Promise.allSettled([loadStoragePath(), loadAudioLibrary(), loadUsbDevices()]).then(() => {
      setInitialLoadComplete(true);
    });

    // Listeners
```

- [ ] **Step 3: Auto-select the first available device**

Replace:

```tsx
  const loadUsbDevices = async () => {
    try {
      const devices = await invoke<UsbDevice[]>("list_usb_devices");
      setUsbDevices(devices);

      // Clear selection if currently selected device is no longer available
      if (selectedDevice && !devices.find(d => d.id === selectedDevice)) {
        setSelectedDevice("");
      }
    } catch (error) {
      console.error("Failed to list USB devices:", error);
    }
  };
```

with:

```tsx
  const loadUsbDevices = async () => {
    try {
      const devices = await invoke<UsbDevice[]>("list_usb_devices");
      setUsbDevices(devices);

      // Auto-select the first device if none is currently selected/valid,
      // so the water indicator reflects a connected device without
      // requiring the user to manually pick one every launch.
      setSelectedDevice(prev => {
        if (prev && devices.find(d => d.id === prev)) return prev;
        return devices.length > 0 ? devices[0].id : "";
      });
    } catch (error) {
      console.error("Failed to list USB devices:", error);
    }
  };
```

- [ ] **Step 4: Fix the device-select label**

Replace:

```tsx
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.space_available})
                    </SelectItem>
```

with:

```tsx
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.available_space_gb.toFixed(1)} GB free)
                    </SelectItem>
```

- [ ] **Step 5: Import `WaterIntro` and compute the intro's target fraction**

Add to the imports:

```tsx
import { WaterIntro } from "@/components/WaterIntro";
```

Directly below the existing `const currentDevice = usbDevices.find(d => d.id === selectedDevice) ?? null;` line, add:

```tsx
  const introFraction = currentDevice
    ? 1 - currentDevice.available_space_gb / currentDevice.total_space_gb
    : 0;
```

- [ ] **Step 6: Mount `WaterIntro`**

Replace the `return (` block's outer wrapper:

```tsx
  return (
    <div className="min-h-screen bg-background text-sm text-foreground">
```

with:

```tsx
  return (
    <>
      {showIntro && (
        <WaterIntro
          targetFraction={introFraction}
          ready={initialLoadComplete}
          onComplete={() => setShowIntro(false)}
        />
      )}
      <div className="min-h-screen bg-background text-sm text-foreground">
```

And replace the final closing of the component's return (currently):

```tsx
      </div>
    </div>
  );
}
```

with:

```tsx
      </div>
      </div>
    </>
  );
}
```

(This closes the new `<>` fragment and the pre-existing `min-h-screen` div, which now sits one level deeper. Double-check indentation only — no functional difference — but confirm with the type-check in Step 7 that JSX nesting is balanced.)

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit` → expect **zero** errors (this closes out the last two `.space_available` references from Task 2's expected-error baseline).

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: mount WaterIntro and auto-select earpiece on launch"
```

---

## Task 7: Final verification and push

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 2: Full production build**

Run: `npm run build` → expect success.

- [ ] **Step 3: Static content check**

Run: `grep -rn "space_available" src/ src-tauri/src/` → expect **no matches anywhere** (confirms the old field name is fully retired on both sides).

- [ ] **Step 4: Manual verification pass (state explicitly what could/couldn't be checked)**

If a display and/or Rust toolchain are available: run `npm run tauri dev` (or `npm run dev` for a browser-only, no-backend preview) and confirm:
1. On launch, the full-screen water rises to a level, holds briefly, then fades to reveal the app (or a thin puddle if no device is connected).
2. The header's capacity tank shows continuous wave motion the entire time the app is open (never freezes).
3. Switching to another window/tab and back doesn't leave the animation stuck (visibility pause/resume).
4. If reachable, connect/simulate a device near-full (≥90% used) and confirm the coral "low space" tone appears in both the intro and the persistent tank.

If neither a Rust toolchain nor a display is available in the execution environment (as is the case in this sandbox), state plainly that steps 1–4 were not visually confirmed, and that only `tsc`/`build`/`grep` verification was possible — do not claim visual behavior is correct without having seen it.

- [ ] **Step 5: Push**

```bash
git push origin main
```
