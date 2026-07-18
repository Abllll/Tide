# Tide 3D Water Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Canvas2D water rendering (`WaterCanvas`) with a real, lit 3D water surface built on `@react-three/fiber`, used both in the full-screen entrance and a new, larger persistent header panel.

**Architecture:** One shared `WaterScene` component (real vertex-displaced geometry, `MeshPhysicalMaterial`, directional + ambient lighting, a drei `PerspectiveCamera` per variant) rendered inside an `@react-three/fiber` `<Canvas>` by each of the two consumers (`WaterIntro`, `CapacityGauge`), which keep their existing external props/behavior otherwise unchanged.

**Tech Stack:** React 19 + TypeScript, Tailwind, Tauri 2 (unchanged) + newly added `three`, `@react-three/fiber`, `@react-three/drei`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-tide-3d-water-design.md`. Assumes the water-indicator plan (`docs/superpowers/plans/2026-07-18-tide-water-indicator.md`) is already implemented — it is, as of current `main`.
- **New dependencies are explicitly authorized** for this plan only (per the user's request) — this reverses the "no new dependencies" constraint from earlier plans.
- **Implementation deviation from the spec's literal wording:** the spec describes vertex displacement via a shader patched with `onBeforeCompile`. This plan instead displaces the plane's vertex positions directly in JavaScript every frame (via `useFrame`) and calls `geometry.computeVertexNormals()` afterward, letting `MeshPhysicalMaterial`'s built-in (untouched) lighting model read the real, correctly-lit displaced surface. Same visible requirement satisfied (real 3D ripples, real lighting response to that geometry) with no custom GLSL and no dependency on three.js's internal shader-chunk naming across versions — lower risk to get right without being able to visually compile-check it here.
- **No visual verification tool available in this sandbox** (same limitation as prior plans: no Rust toolchain, no headless-browser/screenshot tool). All camera positions, plane sizes, lighting intensities, and material parameters below are reasonable first-pass values, not visually tuned — flag this plainly rather than claiming the look has been confirmed. The user has a working browser preview (`npm run dev`) and can iterate on these constants directly (they're all named constants in `WaterScene.tsx`, not scattered magic numbers).
- No automated test framework exists in this repo — verification is `npx tsc --noEmit` + `npm run build`, same as prior plans.
- `three` ships its own TypeScript types; don't add `@types/three` unless `tsc` actually reports missing types for it (concrete symptom to check for, not assumed upfront).

## File Structure

| File | Responsibility |
|---|---|
| `package.json` / `package-lock.json` | **Modify.** Add `three`, `@react-three/fiber`, `@react-three/drei`. |
| `src/components/WaterScene.tsx` | **Create.** Shared 3D scene content: displaced water plane, lighting, camera, optional tank walls — rendered inside a consumer-provided `<Canvas>`. |
| `src/components/WaterIntro.tsx` | **Modify (full replace).** Same phase/timing state machine as before; renders a full-viewport `<Canvas>` + `<WaterScene variant="intro" />` instead of `WaterCanvas`. |
| `src/components/CapacityGauge.tsx` | **Modify (full replace).** Same external props; renders a bigger panel containing `<Canvas>` + `<WaterScene variant="panel" />` instead of the old pill. |
| `src/components/WaterCanvas.tsx` | **Delete.** Fully superseded — no remaining consumers after the above two changes. |

---

## Task 1: Install 3D dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install three @react-three/fiber @react-three/drei`

- [ ] **Step 2: Check for peer-dependency problems**

Run: `npm ls @react-three/fiber @react-three/drei three 2>&1`
Expected: no `UNMET PEER DEPENDENCY` or `invalid` warnings for React (this project is on React 19; `@react-three/fiber` v9+ supports React 19 — if npm resolved an older v8, `npm install @react-three/fiber@latest` explicitly and re-check).

- [ ] **Step 3: Confirm the existing codebase still compiles unmodified**

Run: `npx tsc --noEmit` → expect 0 errors (installing dependencies alone shouldn't change this; confirms a clean starting point before Task 2's code changes).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add three, @react-three/fiber, @react-three/drei"
```

---

## Task 2: Shared `WaterScene` component

**Files:**
- Create: `src/components/WaterScene.tsx`

**Interfaces:**
- Produces: `export function WaterScene(props: { fillFraction: number; tone: "healthy" | "low"; variant: "intro" | "panel" }): JSX.Element`. Must be rendered as a child of an `@react-three/fiber` `<Canvas>` (it renders three.js scene primitives — camera, lights, meshes — not a `<canvas>` itself). Consumed by `WaterIntro` and `CapacityGauge` (Tasks 3–4).

- [ ] **Step 1: Create the component**

```tsx
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

interface WaterSceneProps {
  fillFraction: number;
  tone: "healthy" | "low";
  variant: "intro" | "panel";
}

const TONE_COLORS: Record<"healthy" | "low", { shallow: string; deep: string }> = {
  healthy: { shallow: "#5fd4c8", deep: "#0f6f6a" },
  low: { shallow: "#f2a08a", deep: "#c04a34" },
};

const WAVE_LAYERS = [
  { amp: 0.05, speed: 1.6, freq: 2.4, phase: 0 },
  { amp: 0.03, speed: 2.3, freq: 3.7, phase: 2 },
  { amp: 0.018, speed: 3.1, freq: 5.1, phase: 4 },
];

const PLANE_SEGMENTS = 40;

function displaceWater(geometry: THREE.PlaneGeometry, t: number, amplitude: number) {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    let z = 0;
    for (const layer of WAVE_LAYERS) {
      z += Math.sin(x * layer.freq + t * layer.speed + layer.phase) * layer.amp;
      z += Math.cos(y * layer.freq * 0.8 + t * layer.speed * 0.9 + layer.phase) * layer.amp * 0.6;
    }
    position.setZ(i, z * amplitude);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function WaterScene({ fillFraction, tone, variant }: WaterSceneProps) {
  const colors = TONE_COLORS[tone];
  const isIntro = variant === "intro";

  const planeWidth = isIntro ? 16 : 1.6;
  const planeDepth = isIntro ? 10 : 1.1;
  const tankHeight = isIntro ? 8 : 1.2;
  const waveAmplitude = isIntro ? 1 : 0.35;

  const waterGeometry = useMemo(
    () => new THREE.PlaneGeometry(planeWidth, planeDepth, PLANE_SEGMENTS, PLANE_SEGMENTS),
    [planeWidth, planeDepth]
  );

  useFrame((state) => {
    displaceWater(waterGeometry, state.clock.elapsedTime, waveAmplitude);
  });

  const waterLevelY = -tankHeight / 2 + tankHeight * Math.max(fillFraction, 0.02);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={isIntro ? [0, 3.5, 9] : [0, 1.1, 3.2]}
        fov={isIntro ? 55 : 40}
      />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#fff7ec" />
      <ambientLight intensity={0.4} color="#bfe9e4" />

      <mesh
        geometry={waterGeometry}
        position={[0, waterLevelY, 0]}
        rotation={[-Math.PI / 2.3, 0, 0]}
      >
        <meshPhysicalMaterial
          color={colors.deep}
          sheenColor={colors.shallow}
          sheen={1}
          roughness={0.15}
          metalness={0}
          transmission={0.5}
          thickness={0.6}
          ior={1.33}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {!isIntro && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[planeWidth + 0.15, tankHeight + 0.15, planeDepth + 0.15]} />
          <meshPhysicalMaterial
            color="#eaf7f5"
            transparent
            opacity={0.12}
            roughness={0.05}
            transmission={0.85}
            ior={1.5}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}
```

Save as `src/components/WaterScene.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`. At this point in the plan, expect this new file to compile cleanly on its own (it isn't imported by anything yet, so no consumer-side errors possible). If `tsc` reports missing type declarations for `"three"`, run `npm install -D @types/three` and re-check — otherwise skip that install entirely (see Global Constraints).

- [ ] **Step 3: Commit**

```bash
git add src/components/WaterScene.tsx
git commit -m "feat: add WaterScene 3D water renderer (react-three-fiber)"
```

---

## Task 3: Rewrite `WaterIntro` for 3D

**Files:**
- Modify: `src/components/WaterIntro.tsx` (full replace)

**Interfaces:**
- Unchanged external interface: `export function WaterIntro(props: { targetFraction: number; ready: boolean; onComplete: () => void }): JSX.Element`.
- Consumes: `Canvas` from `@react-three/fiber`; `WaterScene` from `@/components/WaterScene`.

- [ ] **Step 1: Replace the file**

```tsx
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { WaterScene } from "@/components/WaterScene";

interface WaterIntroProps {
  targetFraction: number;
  ready: boolean;
  onComplete: () => void;
}

const FLOOR_FRACTION = 0.04;
const RISE_MS = 1200;
const HOLD_MS = 400;
const FADE_MS = 500;
const LOW_SPACE_THRESHOLD = 0.9;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function WaterIntro({ targetFraction, ready, onComplete }: WaterIntroProps) {
  const [fillFraction, setFillFraction] = useState(0);
  const [phase, setPhase] = useState<"waiting" | "rising" | "holding" | "fading">("waiting");
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibility = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
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
      className={`fixed inset-0 z-50 transition-all duration-500 ${
        phase === "fading" ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
      }`}
    >
      <Canvas frameloop={frameloop} dpr={[1, 1.5]}>
        <WaterScene
          fillFraction={fillFraction}
          tone={targetFraction >= LOW_SPACE_THRESHOLD ? "low" : "healthy"}
          variant="intro"
        />
      </Canvas>
    </div>
  );
}
```

Save as `src/components/WaterIntro.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/WaterIntro.tsx
git commit -m "feat: rewrite WaterIntro to render 3D water via WaterScene"
```

---

## Task 4: Rewrite `CapacityGauge` as a bigger 3D panel

**Files:**
- Modify: `src/components/CapacityGauge.tsx` (full replace)

**Interfaces:**
- Unchanged external interface: `export function CapacityGauge(props: { device: UsbDevice | null; justSynced: boolean }): JSX.Element`.
- Consumes: `Canvas` from `@react-three/fiber`; `WaterScene` from `@/components/WaterScene`; `UsbDevice` from `@/types`.

- [ ] **Step 1: Replace the file**

```tsx
import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { WaterScene } from "@/components/WaterScene";
import type { UsbDevice } from "@/types";

interface CapacityGaugeProps {
  device: UsbDevice | null;
  justSynced: boolean;
}

const LOW_SPACE_THRESHOLD = 0.9;

export function CapacityGauge({ device, justSynced }: CapacityGaugeProps) {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");

  useEffect(() => {
    const handleVisibility = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  if (!device) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <div className="h-14 w-20 shrink-0 rounded-lg bg-muted-foreground/10" />
        No earpiece connected — files will save locally.
      </div>
    );
  }

  const usedFraction = 1 - device.available_space_gb / device.total_space_gb;
  const isLow = usedFraction >= LOW_SPACE_THRESHOLD;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-transform duration-300 ${
        isLow ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
      } ${justSynced ? "scale-105" : "scale-100"}`}
    >
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg">
        <Canvas frameloop={frameloop} dpr={[1, 1.5]}>
          <WaterScene fillFraction={usedFraction} tone={isLow ? "low" : "healthy"} variant="panel" />
        </Canvas>
      </div>
      <span>
        {device.name} · {device.available_space_gb.toFixed(1)} GB free
        {isLow ? " · low space" : ""}
      </span>
    </div>
  );
}
```

Save as `src/components/CapacityGauge.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CapacityGauge.tsx
git commit -m "feat: rewrite CapacityGauge as a bigger 3D water panel"
```

---

## Task 5: Delete the retired Canvas2D renderer

**Files:**
- Delete: `src/components/WaterCanvas.tsx`

- [ ] **Step 1: Confirm nothing still imports it**

Run: `grep -rn "WaterCanvas" src/`
Expected: no matches (Tasks 3–4 already removed the only two consumers). If anything still matches, stop and fix that reference before deleting.

- [ ] **Step 2: Delete the file**

```bash
rm src/components/WaterCanvas.tsx
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/components/WaterCanvas.tsx
git commit -m "chore: remove retired Canvas2D WaterCanvas, superseded by WaterScene"
```

---

## Task 6: Final verification and push

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 2: Full production build**

Run: `npm run build` → expect success. Note the bundle size increase from three.js/fiber/drei is expected and accepted per the spec.

- [ ] **Step 3: Static content check**

Run: `grep -rn "WaterCanvas" src/` → expect no matches. Run: `grep -rln "WaterScene" src/` → expect exactly `src/components/WaterIntro.tsx`, `src/components/CapacityGauge.tsx`, and `src/components/WaterScene.tsx` itself.

- [ ] **Step 4: Manual verification pass — state explicitly what could/couldn't be checked**

If a browser is available (e.g. via `npm run dev`, same limitations as prior plans re: no backend data): confirm the entrance renders a visibly 3D, lit water surface (not a flat 2D shape) rising on load, and the header panel shows a similarly lit, continuously-rippling water tank. Since camera/material constants here are first-pass estimates (see Global Constraints), expect to need at least one round of visual tuning (camera position, plane scale, light intensity, tank opacity) once actually seen — don't claim the final look is correct without having watched it.

If no visual check is possible in the execution environment, state that plainly — only `tsc`/`build`/`grep` verification was possible.

- [ ] **Step 5: Push**

```bash
git push origin main
```
