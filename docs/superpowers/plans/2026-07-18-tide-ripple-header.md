# Tide Interactive Ripple Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sticky header's background an interactive, mouse-reactive water ripple surface using `jquery.ripples`, replacing the static `.bg-tide-header` CSS gradient with a generated texture image the plugin can distort.

**Architecture:** A generated one-time PNG texture (canvas-drawn, matching the existing gradient colors) feeds `jquery.ripples` via a small `RippleSurface` wrapper component that owns the plugin's lifecycle (`init` on mount, `destroy` on unmount). Typed via a new ambient declaration file since neither the plugin nor its jQuery extension ship types. Additive only — no changes to the 3D water work (`WaterScene`/`WaterIntro`/`CapacityGauge`).

**Tech Stack:** React 19 + TypeScript, Tailwind, Tauri 2, Vite (unchanged) + newly added `jquery`, `jquery.ripples`, `@types/jquery`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-tide-ripple-header-design.md`. Assumes the 3D water plan (`docs/superpowers/plans/2026-07-18-tide-3d-water.md`) is already implemented — it is, as of current `main`.
- New dependencies are explicitly authorized (per the user's prior request covering the water-effect work generally).
- No automated test framework exists in this repo — verification is `npx tsc --noEmit` + `npm run build`, same as prior plans.
- **Known risk, not a plan defect:** `jquery.ripples` is a decade-old, WebGL1-only, UMD-only package with no prior history of being bundled in this project. `vite.config.ts` proactively adds it to `optimizeDeps.include` to reduce (not eliminate) the chance of a dependency-pre-bundling issue, since its only reachable import is a bare side-effect import. If a bundling error appears anyway during Task 1 or Task 4's verification, treat it as an expected possible outcome to diagnose (check the browser console error via the dev server, check `node_modules/.vite` needs clearing, check whether `optimizeDeps.include` needs the deep path `"jquery.ripples/dist/jquery.ripples.js"` instead of the bare specifier) rather than a sign of a wrong plan.
- No visual verification tool available in this sandbox (same limitation as prior plans: no Rust toolchain, no headless-browser/screenshot tool) — state plainly what could/couldn't be checked in Task 6.

## File Structure

| File | Responsibility |
|---|---|
| `package.json` / `package-lock.json` | **Modify.** Add `jquery`, `jquery.ripples`; add `@types/jquery` as a devDependency. |
| `vite.config.ts` | **Modify.** Add `optimizeDeps.include: ["jquery.ripples"]`. |
| `src/lib/generateHeaderTexture.ts` | **Create.** One-time canvas-drawn gradient PNG (data URL) matching the retired `.bg-tide-header` colors. |
| `src/types/jquery-ripples.d.ts` | **Create.** Ambient module declaration for `"jquery.ripples"` plus typed `JQuery.ripples(...)` overloads. |
| `src/components/RippleSurface.tsx` | **Create.** Wrapper component owning the plugin's init/destroy lifecycle. |
| `src/App.tsx` | **Modify.** Swap the header's outer `<div className="sticky top-0 z-20 bg-tide-header">` for `<RippleSurface className="sticky top-0 z-20">` (same children, same closing position). |
| `src/index.css` | **Modify.** Remove the now-superseded `.bg-tide-header` rule and its two `--tide-gradient-*` custom properties (no longer referenced anywhere after this change). |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`, `vite.config.ts`

- [ ] **Step 1: Install**

Run: `npm install jquery jquery.ripples && npm install -D @types/jquery`

- [ ] **Step 2: Check for install problems**

Run: `npm ls jquery jquery.ripples @types/jquery 2>&1`
Expected: all three listed with no `UNMET`/`invalid` warnings.

- [ ] **Step 3: Add the Vite dependency-optimization hint**

In `vite.config.ts`, add an `optimizeDeps` entry to the config object (as a sibling of the existing `plugins`/`resolve`/`server` keys):

```ts
  optimizeDeps: {
    include: ["jquery.ripples"],
  },
```

- [ ] **Step 4: Confirm the existing codebase still compiles unmodified**

Run: `npx tsc --noEmit` → expect 0 errors (installing dependencies and editing `vite.config.ts` alone shouldn't change this).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: add jquery, jquery.ripples, and Vite optimizeDeps hint"
```

---

## Task 2: Generated header texture

**Files:**
- Create: `src/lib/generateHeaderTexture.ts`

**Interfaces:**
- Produces: `export function generateHeaderTexture(width?: number, height?: number): string` — returns a `data:image/png;base64,...` URL. Consumed by `RippleSurface` (Task 4).

- [ ] **Step 1: Create the file**

```ts
export function generateHeaderTexture(width = 512, height = 256): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "hsl(190, 70%, 92%)");
  gradient.addColorStop(1, "hsl(189, 60%, 80%)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL("image/png");
}
```

Save as `src/lib/generateHeaderTexture.ts`. (Colors match the retired `--tide-gradient-from`/`--tide-gradient-to` values exactly — see Task 5 for their removal from CSS.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/generateHeaderTexture.ts
git commit -m "feat: add generated gradient texture for ripple header background"
```

---

## Task 3: Ambient types for `jquery.ripples`

**Files:**
- Create: `src/types/jquery-ripples.d.ts`

- [ ] **Step 1: Create the declaration file**

```ts
declare module "jquery.ripples";

interface RipplesOptions {
  imageUrl?: string | null;
  resolution?: number;
  dropRadius?: number;
  perturbance?: number;
  interactive?: boolean;
  crossOrigin?: string;
}

interface JQuery {
  ripples(options?: RipplesOptions): JQuery;
  ripples(method: "destroy"): JQuery;
  ripples(method: "drop", x: number, y: number, radius: number, strength: number): JQuery;
}
```

Save as `src/types/jquery-ripples.d.ts`. (`tsconfig.json`'s `include: ["src"]` picks this up automatically — no config change needed.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/jquery-ripples.d.ts
git commit -m "feat: add ambient types for jquery.ripples"
```

---

## Task 4: `RippleSurface` component

**Files:**
- Create: `src/components/RippleSurface.tsx`

**Interfaces:**
- Consumes: `$` from `jquery`; the side-effect module `"jquery.ripples"`; `generateHeaderTexture` from `@/lib/generateHeaderTexture`.
- Produces: `export function RippleSurface(props: { className?: string; children: React.ReactNode }): JSX.Element`. Consumed by `App.tsx` (Task 5) as a drop-in replacement for the header's outer `<div>`.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef, type ReactNode } from "react";
import $ from "jquery";
import "jquery.ripples";
import { generateHeaderTexture } from "@/lib/generateHeaderTexture";

interface RippleSurfaceProps {
  className?: string;
  children: ReactNode;
}

export function RippleSurface({ className, children }: RippleSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const $el = $(el);
    $el.ripples({
      imageUrl: generateHeaderTexture(),
      resolution: 256,
      dropRadius: 20,
      perturbance: 0.03,
      interactive: true,
    });

    return () => {
      $el.ripples("destroy");
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
```

Save as `src/components/RippleSurface.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors (this file isn't consumed yet, so no integration errors possible at this point).

- [ ] **Step 3: Commit**

```bash
git add src/components/RippleSurface.tsx
git commit -m "feat: add RippleSurface component wrapping jquery.ripples lifecycle"
```

---

## Task 5: Integrate into the header, retire `.bg-tide-header`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Import `RippleSurface` in `App.tsx`**

Add to the imports:

```tsx
import { RippleSurface } from "@/components/RippleSurface";
```

- [ ] **Step 2: Swap the header's outer element (opening tag)**

Replace:

```tsx
      <div className="min-h-screen bg-background text-sm text-foreground">
      <div className="sticky top-0 z-20 bg-tide-header">
```

with:

```tsx
      <div className="min-h-screen bg-background text-sm text-foreground">
      <RippleSurface className="sticky top-0 z-20">
```

- [ ] **Step 3: Swap the header's outer element (closing tag)**

Replace:

```tsx
        <WaveDivider />
      </div>

      <div className="max-w-2xl mx-auto p-4">
```

with:

```tsx
        <WaveDivider />
      </RippleSurface>

      <div className="max-w-2xl mx-auto p-4">
```

- [ ] **Step 4: Remove the now-superseded CSS**

In `src/index.css`, remove this entire block (the `.bg-tide-header` rule is fully replaced by the generated texture in Task 2; the two custom properties it was the only consumer of go with it):

```css
@layer utilities {
  .bg-tide-header {
    background: linear-gradient(
      135deg,
      hsl(var(--tide-gradient-from)),
      hsl(var(--tide-gradient-to))
    );
  }
}
```

And remove these two lines from the `:root` block:

```css
    --tide-gradient-from: 190 70% 92%;
    --tide-gradient-to: 189 60% 80%;
```

- [ ] **Step 5: Verify**

Run: `grep -rn "bg-tide-header\|tide-gradient" src/` → expect no matches anywhere (confirms full retirement, not just the JSX usage).

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: wire RippleSurface into the header, retire bg-tide-header"
```

---

## Task 6: Final verification and push

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 2: Full production build**

Run: `npm run build` → expect success. If this specific step fails with a jQuery/UMD-related bundling error, treat it as the known risk called out in Global Constraints and troubleshoot (check the exact error against Vite's dependency optimization docs) rather than reverting — do not silently skip verification if it fails.

- [ ] **Step 3: Static content check**

Run: `grep -rn "bg-tide-header\|tide-gradient" src/` → expect no matches. Run: `grep -rln "RippleSurface" src/` → expect exactly `src/App.tsx` and `src/components/RippleSurface.tsx`.

- [ ] **Step 4: Manual verification pass — state explicitly what could/couldn't be checked**

If a browser is available (e.g. via `npm run dev`): confirm the header's at-rest look is visually the same gradient as before; moving the mouse over the header ripples/distorts it; header text/controls (logo, quick-add input, buttons, capacity panel, settings gear) remain crisp and clickable; no console errors on load or on interaction.

If no visual check is possible in the execution environment, state that plainly — only `tsc`/`build`/`grep` verification was possible.

- [ ] **Step 5: Push**

```bash
git push origin main
```
