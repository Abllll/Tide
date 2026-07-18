# Tide UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle and restructure the Shokz Audio (Tauri + React) desktop app into "Tide" — an ocean/ambient-themed companion tool with a sticky quick-add + earpiece-capacity header and a scrolling audio library beneath it.

**Architecture:** Pure frontend change. Introduce a shared `src/types.ts` for the data shapes already used by `App.tsx`, extract four presentational components (`BrandMarks`, `CapacityGauge`, `SettingsPopover`, `LibraryList`) out of the current 600-line `App.tsx`, re-theme via CSS variables in `src/index.css` + `tailwind.config.js`, then rewire `App.tsx` to compose the new sticky-header layout. No Rust/Tauri command changes.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS (CSS-variable/shadcn theme pattern), lucide-react icons, Vite, Tauri 2.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-tide-uiux-redesign-design.md` — every requirement in it must map to a task below.
- No new Tauri commands, events, or data fields. `UsbDevice.space_available` remains a free-space-only string (`"{:.1} GB available"`, set in `src-tauri/src/lib.rs:211`) — the capacity gauge is a free-space indicator, not a used/total bar.
- No new npm dependencies. Everything is built with what's already in `package.json` (React, Tailwind, lucide-react, Radix primitives already installed).
- This repo has **no automated test framework** (no Jest/Vitest/RTL configured). Verification per task is: `npx tsc --noEmit` (must report zero errors — `tsconfig.json` has `strict`, `noUnusedLocals`, and `noUnusedParameters` on, so stray unused imports from the refactor will fail this) plus a manual check in `npm run tauri dev` (or `npm run dev` for pure browser preview where a Tauri window isn't needed).
- Window title changes from "Shokz Audio" to "Tide" (`src-tauri/tauri.conf.json`). Package name (`shokz-audio-app`), repo name, and README are unchanged — out of scope for this plan.
- Regenerating the taskbar/dock/window icon files under `src-tauri/icons/*` is **out of scope** for this plan (it requires a real image-generation pipeline/tooling not available here). Only the in-app SVG ripple mark (rendered directly in React) is added.
- Follow the existing shadcn CSS-variable theming convention: colors are defined once as HSL triples in `src/index.css` and consumed via `tailwind.config.js` `theme.extend.colors`, never hardcoded as raw Tailwind palette classes (e.g. no `bg-blue-500`) in component code.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types.ts` | **Create.** Shared `AudioState`, `AudioFile`, `UsbDevice` types — single source of truth, imported by `App.tsx` and all new components. |
| `src/index.css` | **Modify.** Ocean/ambient HSL palette, `<alpha-value>`-enabled color tokens, header gradient tokens, radius bump. |
| `tailwind.config.js` | **Modify.** Update color entries to the `hsl(var(--x) / <alpha-value>)` pattern so opacity utilities (`bg-primary/15`, `text-primary/40`) work. |
| `src-tauri/tauri.conf.json` | **Modify.** Window title `"Shokz Audio"` → `"Tide"`. |
| `src/components/BrandMarks.tsx` | **Create.** `RippleMark` (wordmark icon) and `WaveDivider` (header underline motif) — pure SVG, no state. |
| `src/components/CapacityGauge.tsx` | **Create.** Earpiece free-space pill: no-device / healthy / low-space states, sync-pulse animation hook. |
| `src/components/SettingsPopover.tsx` | **Create.** Gear-icon-triggered popover holding the local storage path + change control (moved out of the main flow). |
| `src/components/LibraryList.tsx` | **Create.** Extracted `StateBadge` + file list + selection toolbar + empty state, recolored to the new palette. |
| `src/App.tsx` | **Modify.** Remove the code now owned by the files above; compose the sticky header (quick-add + capacity gauge + settings) and scrolling library body; keep all existing data-fetching/event logic. |

---

## Task 1: Install dependencies and confirm baseline compiles

**Files:** none (environment setup only)

- [ ] **Step 1: Install npm dependencies**

Run: `npm install`
Expected: completes with no errors (installs React 19, Tauri CLI, Tailwind, lucide-react, Radix packages already listed in `package.json`).

- [ ] **Step 2: Confirm the unmodified codebase type-checks**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. This is the baseline every later task must preserve.

- [ ] **Step 3: Commit (lockfile only, if changed)**

```bash
git status
```
If `package-lock.json` shows no diff, skip committing. If it changed (e.g. due to a minor registry resolution), commit it alone:
```bash
git add package-lock.json
git commit -m "chore: refresh package-lock after clean install"
```

---

## Task 2: Ocean/ambient design tokens

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`
- Modify: `src-tauri/tauri.conf.json`

**Interfaces:**
- Produces: CSS custom properties `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`, `--tide-gradient-from`, `--tide-gradient-to`; a `.bg-tide-header` utility class. Tailwind color tokens `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `background`, `foreground`, `card`, `popover` now support opacity modifiers (e.g. `bg-primary/15`) — every later task's component code relies on this.

- [ ] **Step 1: Replace the CSS variable palette**

Replace the full contents of `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 36 40% 97%;
    --foreground: 200 35% 15%;
    --card: 36 35% 99%;
    --card-foreground: 200 35% 15%;
    --popover: 36 35% 99%;
    --popover-foreground: 200 35% 15%;
    --primary: 187 55% 32%;
    --primary-foreground: 0 0% 100%;
    --secondary: 190 45% 92%;
    --secondary-foreground: 195 40% 20%;
    --muted: 36 20% 93%;
    --muted-foreground: 200 15% 40%;
    --accent: 190 55% 90%;
    --accent-foreground: 195 45% 18%;
    --destructive: 9 70% 58%;
    --destructive-foreground: 0 0% 100%;
    --border: 36 25% 88%;
    --input: 36 25% 88%;
    --ring: 187 55% 40%;
    --radius: 0.75rem;
    --tide-gradient-from: 190 70% 92%;
    --tide-gradient-to: 189 60% 80%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

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

- [ ] **Step 2: Enable opacity modifiers on theme colors**

In `tailwind.config.js`, replace the `colors` block inside `theme.extend` with:

```js
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
      },
```

- [ ] **Step 3: Rename the window title**

In `src-tauri/tauri.conf.json`, change:
```json
        "title": "Shokz Audio",
```
to:
```json
        "title": "Tide",
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → expect 0 errors (CSS/JSON changes don't affect TS, this just re-confirms nothing else broke).
Run: `npm run tauri dev` (or `npm run dev` for a quicker browser-only check), confirm the (still old-layout) app now renders on a warm sand background with visibly different accent colors, and the window/tab title reads "Tide". Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/index.css tailwind.config.js src-tauri/tauri.conf.json
git commit -m "style: apply ocean/ambient design tokens and rename window to Tide"
```

---

## Task 3: Shared types module

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Produces: `export type AudioState = "queued" | "downloading" | "local" | "syncing" | "synced"`, `export interface AudioFile { id: string; filename: string; state: AudioState; download_log?: string }`, `export interface UsbDevice { id: string; name: string; space_available: string; mount_point: string }`. Every component task below imports these from `@/types` instead of redeclaring them.

- [ ] **Step 1: Create the types file**

```ts
export type AudioState =
  | "queued"
  | "downloading"
  | "local"
  | "syncing"
  | "synced";

export interface AudioFile {
  id: string;
  filename: string;
  state: AudioState;
  download_log?: string;
}

export interface UsbDevice {
  id: string;
  name: string;
  space_available: string;
  mount_point: string;
}
```

Save as `src/types.ts`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors (new file isn't imported anywhere yet, so it's inert but must still be syntactically/type valid).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: extract shared AudioFile/UsbDevice types"
```

---

## Task 4: Brand marks (ripple icon + wave divider)

**Files:**
- Create: `src/components/BrandMarks.tsx`

**Interfaces:**
- Produces: `export function RippleMark(props: { className?: string }): JSX.Element` and `export function WaveDivider(props: { className?: string }): JSX.Element`. Both are pure/stateless. Color comes from `currentColor`, so callers control color via a `text-*` Tailwind class in `className`. Used by `LibraryList` (empty state) and `App.tsx` (header) in later tasks.

- [ ] **Step 1: Create the component**

```tsx
export function RippleMark({ className = "h-5 w-5 text-primary" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </svg>
  );
}

export function WaveDivider({ className = "text-primary/40" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 12"
      preserveAspectRatio="none"
      className={`h-3 w-full ${className}`}
      aria-hidden="true"
    >
      <path
        d="M0 6 Q 25 0, 50 6 T 100 6 T 150 6 T 200 6 T 250 6 T 300 6 T 350 6 T 400 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
```

Save as `src/components/BrandMarks.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/BrandMarks.tsx
git commit -m "feat: add RippleMark and WaveDivider brand components"
```

---

## Task 5: Capacity gauge component

**Files:**
- Create: `src/components/CapacityGauge.tsx`

**Interfaces:**
- Consumes: `UsbDevice` from `@/types`.
- Produces: `export function CapacityGauge(props: { device: UsbDevice | null; justSynced: boolean }): JSX.Element`. `App.tsx` (Task 8) computes `device` as `usbDevices.find(d => d.id === selectedDevice) ?? null` and a `justSynced` boolean toggled briefly on the existing `sync-complete` Tauri event.

- [ ] **Step 1: Create the component**

```tsx
import { Droplet } from "lucide-react";
import type { UsbDevice } from "@/types";

interface CapacityGaugeProps {
  device: UsbDevice | null;
  justSynced: boolean;
}

const LOW_SPACE_THRESHOLD_GB = 1;

function parseFreeGb(spaceAvailable: string): number | null {
  const match = spaceAvailable.match(/^([\d.]+)\s*GB/i);
  if (!match) return null;
  return parseFloat(match[1]);
}

export function CapacityGauge({ device, justSynced }: CapacityGaugeProps) {
  if (!device) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        <Droplet className="h-3.5 w-3.5" />
        No earpiece connected — files will save locally.
      </div>
    );
  }

  const freeGb = parseFreeGb(device.space_available);
  const isLow = freeGb !== null && freeGb < LOW_SPACE_THRESHOLD_GB;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-transform duration-300 ${
        isLow ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
      } ${justSynced ? "scale-105" : "scale-100"}`}
    >
      <Droplet className="h-3.5 w-3.5" />
      {device.name} · {device.space_available}
      {isLow ? " · low space" : ""}
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
git commit -m "feat: add CapacityGauge component for earpiece free space"
```

---

## Task 6: Settings popover

**Files:**
- Create: `src/components/SettingsPopover.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`.
- Produces: `export function SettingsPopover(props: { storagePath: string; onChangeStorage: () => void }): JSX.Element`. `App.tsx` (Task 8) passes its existing `storagePath` state and `handleChangeStorage` handler unchanged.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef, useState } from "react";
import { Settings, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsPopoverProps {
  storagePath: string;
  onChangeStorage: () => void;
}

export function SettingsPopover({ storagePath, onChangeStorage }: SettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-foreground hover:bg-black/5"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-10 w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Local storage</div>
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm">{storagePath || "Loading..."}</span>
            <Button variant="secondary" size="sm" onClick={onChangeStorage}>
              <Folder className="w-4 h-4 mr-1.5" />
              Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Save as `src/components/SettingsPopover.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPopover.tsx
git commit -m "feat: add SettingsPopover component for storage path control"
```

---

## Task 7: Library list component

**Files:**
- Create: `src/components/LibraryList.tsx`

**Interfaces:**
- Consumes: `AudioFile`, `AudioState` from `@/types`; `Button` from `@/components/ui/button`; `RippleMark` from `@/components/BrandMarks`.
- Produces: `export function LibraryList(props: { files: AudioFile[]; selectedFiles: Set<string>; onFileClick: (fileId: string, shiftKey: boolean) => void; onDelete: () => void }): JSX.Element`. `App.tsx` (Task 8) passes its existing `audioFiles`, `selectedFiles`, `handleFileClick`, `handleDelete` unchanged.

- [ ] **Step 1: Create the component**

```tsx
import { Trash2, Clock, Download, HardDrive, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RippleMark } from "@/components/BrandMarks";
import type { AudioFile, AudioState } from "@/types";

interface LibraryListProps {
  files: AudioFile[];
  selectedFiles: Set<string>;
  onFileClick: (fileId: string, shiftKey: boolean) => void;
  onDelete: () => void;
}

const STATE_CONFIG: Record<
  AudioState,
  { icon: typeof Clock; className: string; tooltip: string }
> = {
  queued: {
    icon: Clock,
    className: "bg-muted text-muted-foreground",
    tooltip: "Waiting in queue to download",
  },
  downloading: {
    icon: Download,
    className: "bg-primary/15 text-primary",
    tooltip: "Downloading from source, will sync to USB when complete",
  },
  local: {
    icon: HardDrive,
    className: "bg-secondary text-secondary-foreground",
    tooltip: "File is on local machine only, waiting to sync to USB",
  },
  syncing: {
    icon: RefreshCw,
    className: "bg-primary/15 text-primary animate-pulse",
    tooltip: "Copying file to USB device",
  },
  synced: {
    icon: CheckCircle,
    className: "bg-primary text-primary-foreground",
    tooltip: "File is on local machine and USB device",
  },
};

function StateBadge({ state }: { state: AudioState }) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;
  return (
    <div
      className={`w-8 h-8 rounded-md flex items-center justify-center ${config.className}`}
      title={config.tooltip}
    >
      <Icon className="w-[18px] h-[18px]" />
    </div>
  );
}

export function LibraryList({ files, selectedFiles, onFileClick, onDelete }: LibraryListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 h-8">
        <div className="text-xs font-semibold text-muted-foreground">Audio Library</div>
        {selectedFiles.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedFiles.size} selected</span>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete
            </Button>
          </div>
        )}
      </div>
      <div className="border border-border rounded-lg max-h-[280px] overflow-y-auto">
        {files.length === 0 ? (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <RippleMark className="h-8 w-8 text-primary" />
            <div className="font-medium text-foreground">Pull it in, take it under.</div>
            <div>Paste a YouTube or Apple Podcasts link above to get started.</div>
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              className={`border-b last:border-b-0 border-border/60 cursor-pointer transition-colors ${
                selectedFiles.has(file.id) ? "bg-primary/10" : "hover:bg-accent"
              }`}
              onClick={(e) => onFileClick(file.id, e.shiftKey)}
            >
              <div className="px-3 py-2.5 flex items-center gap-2.5">
                <StateBadge state={file.state} />
                <span className="text-sm text-foreground flex-1">{file.filename}</span>
              </div>
              {file.download_log && (
                <div className="px-3 pb-2.5 pl-[48px]">
                  <div className="text-[11px] font-mono text-muted-foreground bg-muted px-3 py-1 rounded overflow-hidden text-ellipsis whitespace-nowrap">
                    {file.download_log}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

Save as `src/components/LibraryList.tsx`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → expect 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/LibraryList.tsx
git commit -m "feat: add LibraryList component with recolored states and selection toolbar"
```

---

## Task 8: Integrate — sticky header layout in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AudioState`, `AudioFile`, `UsbDevice` from `@/types`; `RippleMark`, `WaveDivider` from `@/components/BrandMarks`; `CapacityGauge` from `@/components/CapacityGauge`; `SettingsPopover` from `@/components/SettingsPopover`; `LibraryList` from `@/components/LibraryList`.
- Produces: the composed app shell — no new exports, this is the top-level component.

This task keeps every existing data/handler function (`loadStoragePath`, `loadAudioLibrary`, `loadUsbDevices`, `handleChangeStorage`, the URL-validation effect, `handleFileClick`, `handleDelete`, `handleAddUrl`, and all three event listeners) exactly as they are today — only the type declarations, the now-unused inline `StateBadge`, and the returned JSX change.

- [ ] **Step 1: Replace `src/App.tsx` in full**

Replace the entire file with:

```tsx
import { useState, useEffect, useRef } from "react";
import { Droplet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { RippleMark, WaveDivider } from "@/components/BrandMarks";
import { CapacityGauge } from "@/components/CapacityGauge";
import { SettingsPopover } from "@/components/SettingsPopover";
import { LibraryList } from "@/components/LibraryList";
import type { AudioFile, UsbDevice } from "@/types";

function App() {
  const [url, setUrl] = useState("");
  const [speed, setSpeed] = useState("1.0");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [storagePath, setStoragePath] = useState("");
  const [validationMsg, setValidationMsg] = useState<{type: string; message: string} | null>(null);
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [justSynced, setJustSynced] = useState(false);
  const audioFilesRef = useRef<AudioFile[]>([]);

  // Keep ref in sync with state for event listeners
  useEffect(() => {
    audioFilesRef.current = audioFiles;
  }, [audioFiles]);

  // Load initial data and setup listeners
  useEffect(() => {
    loadStoragePath();
    loadAudioLibrary();
    loadUsbDevices();

    // Listeners
    const unlistenProgress = listen<any>("download-progress", (event) => {
      setAudioFiles(prev => prev.map(file => {
        if (file.id !== event.payload.id) return file;

        // Update filename if provided in event and not already updated
        let filename = file.filename;
        if (event.payload.filename && filename === "Downloading...") {
          filename = event.payload.filename;
        }

        return {
          ...file,
          download_log: event.payload.log,
          state: "downloading",
          filename
        };
      }));
    });

    const unlistenComplete = listen<any>("download-complete", (event) => {
      setAudioFiles(prev => prev.map(file =>
        file.id === event.payload.id
          ? { ...file, state: "local" }
          : file
      ));
      loadAudioLibrary(event.payload.id);
    });

    const unlistenSync = listen<any>("sync-complete", (event) => {
      setAudioFiles(prev => prev.map(file =>
        file.id === event.payload.id
          ? { ...file, state: "synced" }
          : file
      ));
      setSyncStatus(`Synced "${event.payload.filename}" to USB device ✓`);
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 700);
      setTimeout(() => setSyncStatus(""), 3000);
    });

    return () => {
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
      unlistenSync.then(fn => fn());
    };
  }, []);

  // Auto-sync logic and Status updates
  useEffect(() => {
    if (!selectedDevice) {
      if (audioFiles.some(f => f.state === "downloading")) {
        // Keep downloading status or clear if needed, but don't show sync status
      } else {
        setSyncStatus("");
      }
      return;
    }

    if (audioFiles.length === 0) {
      setSyncStatus("");
      return;
    }

    const device = usbDevices.find(d => d.id === selectedDevice);
    if (!device) return;

    // 1. Handle Active Syncing State (UI feedback)
    const syncingCount = audioFiles.filter(f => f.state === "syncing").length;
    if (syncingCount > 0) {
      setSyncStatus(`Syncing ${syncingCount} file(s) to ${device.name}...`);
      // We don't return here because we might need to trigger more syncs if new 'local' files appeared
    }

    // 2. Trigger Sync for 'local' files
    const localFiles = audioFiles.filter(f => f.state === "local");
    if (localFiles.length > 0) {
      localFiles.forEach(async (file) => {
        // Immediately mark as syncing to prevent double-triggering
        setAudioFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, state: "syncing" } : f
        ));

        try {
          await invoke("sync_to_usb", {
            fileId: file.id,
            filename: file.filename,
            usbMountPoint: device.mount_point
          });

          // Mark as synced on success
          setAudioFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, state: "synced" } : f
          ));
        } catch (error) {
          console.error("Sync failed:", error);
          setAudioFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, state: "local" } : f
          ));
          setSyncStatus(`Sync failed for "${file.filename}"`);
        }
      });
      return; // State updated, effect will re-run
    }

    // 3. Final Status (All Synced)
    // Only show "All synced" if we are NOT currently syncing anything and everything is synced
    if (syncingCount === 0) {
      const allSynced = audioFiles.every(f => f.state === "synced");
      if (allSynced) {
        setSyncStatus(`All files synced to ${device.name} ✓`);
      } else if (audioFiles.some(f => f.state === "downloading")) {
        // Downloading... status is handled by per-item or ignored here
        setSyncStatus("");
      } else {
        // Mixed state (e.g. queued) or empty
        setSyncStatus("");
      }
    }
  }, [audioFiles, selectedDevice, usbDevices]);

  const loadStoragePath = async () => {
    try {
      const path = await invoke<string>("get_storage_path");
      setStoragePath(path);
    } catch (error) {
      console.error("Failed to get storage path:", error);
    }
  };

  const loadAudioLibrary = async (completedId?: string) => {
    try {
      // Use ref to avoid stale state in event listeners
      const currentFiles = audioFilesRef.current;
      const downloadingFiles = currentFiles.filter(f =>
        (f.state === "downloading" || f.state === "syncing") && f.id !== completedId
      );

      // 1. Get Local Files
      const localFiles = await invoke<AudioFile[]>("get_audio_library");

      // 2. Get USB Files if device selected
      let usbFiles: AudioFile[] = [];
      if (selectedDevice) {
        const device = usbDevices.find(d => d.id === selectedDevice);
        if (device) {
          try {
            usbFiles = await invoke<AudioFile[]>("get_usb_files", { mountPoint: device.mount_point });
          } catch (e) {
            console.error("Failed to get USB files", e);
          }
        }
      }

      // 3. Merge Local and USB
      const fileMap = new Map<string, AudioFile>();

      // Add local files first
      localFiles.forEach(f => {
        fileMap.set(f.filename, f);
      });

      // Process USB files
      usbFiles.forEach(f => {
        if (fileMap.has(f.filename)) {
          // Exists locally and on USB -> Synced
          const local = fileMap.get(f.filename)!;
          fileMap.set(f.filename, { ...local, state: "synced" });
        } else {
          // Only on USB -> Synced
          fileMap.set(f.filename, { ...f, state: "synced" });
        }
      });

      // Convert back to array
      const diskFiles = Array.from(fileMap.values());

      // Merge downloading/syncing files with disk files
      const mergedFiles = [
        ...downloadingFiles,
        ...diskFiles.filter(f => !downloadingFiles.some(df => df.filename === f.filename))
      ];

      setAudioFiles(mergedFiles);
    } catch (error) {
      console.error("Failed to load audio library:", error);
    }
  };

  // Reload library when device selection changes
  useEffect(() => {
    loadAudioLibrary();
  }, [selectedDevice]);

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

  const handleChangeStorage = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: storagePath,
      });

      if (selected) {
        const path = selected as string;
        await invoke("set_storage_path", { path });
        setStoragePath(path);
        // Reload library from new location
        loadAudioLibrary();
      }
    } catch (error) {
      console.error("Failed to change storage path:", error);
    }
  };

  // URL validation
  useEffect(() => {
    const validateUrl = async () => {
      if (!url.trim()) {
        setValidationMsg(null);
        return;
      }

      try {
        const result = await invoke<any>("validate_url", { url });
        if (result.valid) {
          setValidationMsg({ type: "success", message: result.message });
        } else {
          setValidationMsg({ type: "error", message: result.message });
        }
      } catch (error) {
        console.error("Validation error:", error);
      }
    };

    validateUrl();
  }, [url]);

  // File selection handler
  const handleFileClick = (fileId: string, shiftKey: boolean) => {
    if (shiftKey && lastSelectedId) {
      // Shift+Click: select range
      const startIndex = audioFiles.findIndex((f) => f.id === lastSelectedId);
      const endIndex = audioFiles.findIndex((f) => f.id === fileId);
      const [start, end] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];

      const newSelected = new Set(selectedFiles);
      for (let i = start; i <= end; i++) {
        newSelected.add(audioFiles[i].id);
      }
      setSelectedFiles(newSelected);
    } else {
      // Regular click: select only this file, deselect all others
      setSelectedFiles(new Set([fileId]));
      setLastSelectedId(fileId);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    // Filter out files that are currently downloading
    const filesToDelete = audioFiles.filter(
      (f) => selectedFiles.has(f.id) && f.state !== "downloading"
    );

    if (filesToDelete.length === 0) {
      alert("Cannot delete files that are currently downloading. Please wait for downloads to complete.");
      return;
    }

    const count = filesToDelete.length;
    const filenames = filesToDelete.map((f) => f.filename);
    const fileIds = filesToDelete.map((f) => f.id);

    const confirmed = window.confirm(
      `Delete ${count} file(s)?\n\n${filenames.join("\n")}\n\nFiles will be removed from:\n✓ Local storage (${storagePath})\n✓ USB device (SHOKZ_DEVICE)`
    );

    if (confirmed) {
      try {
        // Optimistically remove from UI immediately
        setAudioFiles(prev => prev.filter(f => !selectedFiles.has(f.id)));

        // Get USB mount point if selected
        const device = usbDevices.find(d => d.id === selectedDevice);
        const usbMountPoint = device ? device.mount_point : null;

        await invoke("delete_audio_files", {
          fileIds,
          filenames,
          usbMountPoint
        });

        // Only clear selected files that were actually deleted
        const newSelected = new Set(selectedFiles);
        fileIds.forEach(id => newSelected.delete(id));
        setSelectedFiles(newSelected);

        await loadAudioLibrary();
      } catch (error) {
        console.error("Delete failed:", error);
        alert("Failed to delete files: " + error);
      }
    }
  };

  // Add to download queue
  const handleAddUrl = async () => {
    if (!url.trim() || !validationMsg?.type || validationMsg.type !== "success") {
      alert("Please enter a valid YouTube or Apple Podcast URL");
      return;
    }

    try {
      const downloadId = await invoke<string>("download_audio", {
        url,
        speed: parseFloat(speed),
      });

      // Add a temporary entry to the audio library
      const tempFile: AudioFile = {
        id: downloadId,
        filename: "Downloading...",
        state: "downloading",
        download_log: "Starting download...",
      };

      setAudioFiles(prev => [tempFile, ...prev]);
      setUrl(""); // Clear input
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to start download: " + error);
    }
  };

  const currentDevice = usbDevices.find(d => d.id === selectedDevice) ?? null;

  return (
    <div className="min-h-screen bg-background text-sm text-foreground">
      <div className="sticky top-0 z-20 bg-tide-header">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <RippleMark className="h-5 w-5 text-primary" />
              Tide
            </div>
            <SettingsPopover storagePath={storagePath} onChangeStorage={handleChangeStorage} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              className="flex-1 text-sm"
            />
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger className="w-24 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.0">1.0x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2.0">2.0x</SelectItem>
                <SelectItem value="3.0">3.0x</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddUrl}>
              <Droplet className="w-4 h-4 mr-1.5" />
              Pull in
            </Button>
          </div>
          {validationMsg && (
            <div
              className={`text-xs ${
                validationMsg.type === "success" ? "text-primary" : "text-destructive"
              }`}
            >
              {validationMsg.message}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <CapacityGauge device={currentDevice} justSynced={justSynced} />
            {usbDevices.length > 0 && (
              <Select
                value={selectedDevice}
                onValueChange={setSelectedDevice}
                onOpenChange={(open) => {
                  if (open) loadUsbDevices();
                }}
              >
                <SelectTrigger className="w-44 h-7 text-xs">
                  <SelectValue placeholder="Select earpiece" />
                </SelectTrigger>
                <SelectContent>
                  {usbDevices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name} ({device.space_available})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {syncStatus && (
            <div className={`text-xs ${syncStatus.includes("failed") ? "text-destructive" : "text-muted-foreground"}`}>
              {syncStatus}
            </div>
          )}
        </div>
        <WaveDivider />
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <LibraryList
          files={audioFiles}
          selectedFiles={selectedFiles}
          onFileClick={handleFileClick}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors. If `noUnusedLocals`/`noUnusedParameters` flags anything, it means an import or variable from the old file was left in — remove it (every icon import in the new file above is used at least once).

- [ ] **Step 3: Manual verification pass**

Run: `npm run tauri dev`. Confirm each of the following (all reuse existing Tauri commands/events — no backend changes needed to exercise them):

1. **Quick-add**: paste a valid YouTube URL → validation message turns teal (`text-primary`) and reads success; paste garbage text → message turns coral (`text-destructive`).
2. **Sticky header**: with several files in the library (enough to require scrolling), scroll the library list and confirm the header (logo, quick-add row, capacity row) stays pinned at the top.
3. **Capacity gauge — no device**: with no USB device connected, confirm the pill reads "No earpiece connected — files will save locally." and the device `Select` is not rendered.
4. **Capacity gauge — device connected**: connect/mount a removable volume (or simulate by adjusting a disk temporarily), confirm the pill shows `{name} · {space_available}` in the teal/aqua tone.
5. **Capacity gauge — low space**: if a test volume with <1GB free is available, confirm the pill switches to the coral tone and appends "· low space"; otherwise, temporarily lower `LOW_SPACE_THRESHOLD_GB` in `CapacityGauge.tsx` to a large number (e.g. `999`) to force the low-space branch, confirm visually, then revert the change before committing.
6. **Sync pulse**: trigger a sync (add a URL with a device connected) and confirm the capacity pill briefly scales up (`scale-105`) when the `sync-complete` event fires.
7. **Library states**: confirm all five badge colors render distinctly (queued/downloading/local/syncing/synced) as files move through the pipeline.
8. **Selection toolbar**: click a library row — confirm the "N selected" + coral Delete button appears above the list, and disappears when nothing is selected.
9. **Settings popover**: click the gear icon in the header, confirm the storage-path popover opens showing the current path and a "Change" button; click outside it, confirm it closes.
10. **Empty state**: with an empty library (or a fresh `storagePath`), confirm the ripple icon + "Pull it in, take it under." + subtext render centered.

Stop the dev server once all checks pass. If step 5's threshold override was used, confirm it's been reverted (`LOW_SPACE_THRESHOLD_GB = 1`) before moving on.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: compose Tide sticky-header layout in App.tsx"
```

---

## Task 9: Final full-spec walkthrough and push

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit` → expect 0 errors across the whole changed surface.

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: completes with no errors (this runs `tsc && vite build`, exercising the full TypeScript + bundling pipeline, catching anything a dev-server hot-reload might have masked).

- [ ] **Step 3: Re-run the manual checklist from Task 8 Step 3 once more against the built/dev app**, this time reading it back against the spec's Component Details section (`docs/superpowers/specs/2026-07-18-tide-uiux-redesign-design.md`) line by line, to confirm no requirement was missed.

- [ ] **Step 4: Push**

```bash
git push origin main
```
