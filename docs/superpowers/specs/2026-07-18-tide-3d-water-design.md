# Tide — 3D Water Rendering Design

## Context

This replaces the Canvas2D water rendering built in
`docs/superpowers/specs/2026-07-18-tide-water-indicator-design.md` /
`docs/superpowers/plans/2026-07-18-tide-water-indicator.md` with a real 3D, lit water
surface. Same functional behavior and data (`fillFraction`/`used_fraction`, the
healthy/low tone rule, the entrance sequence, the persistent header indicator) — only the
rendering technology and the persistent indicator's size/prominence change. This is the
first of two sub-projects for the broader aesthetic pass the user asked for; the second
(header/quick-add/library/settings layout and interaction rework) is a separate spec that
follows this one and will be designed to match whatever this produces.

**Explicitly authorized for this sub-project:** new npm dependencies (`three`,
`@react-three/fiber`, `@react-three/drei`) — the "no new dependencies" constraint from the
earlier specs is lifted here at the user's explicit request.

## Stack

- `three` — the underlying 3D engine.
- `@react-three/fiber` — React renderer for `three`, used for the `<Canvas>` and
  declarative scene graph.
- `@react-three/drei` — used only for small non-network helpers (e.g. the `shaderMaterial`
  convenience factory for defining custom uniforms/shaders tersely). **Not** used for
  `<Environment>`/HDRI-based reflections — those fetch image assets from a CDN at runtime,
  which is a poor fit for a desktop app that should work offline. Lighting is real
  three.js `DirectionalLight` + `AmbientLight` only, no environment map.

Versions: whatever `npm install` resolves as compatible with React 19 at implementation
time (`@react-three/fiber` v9+ supports React 19) — not pinned here; the implementation
plan verifies peer-dependency compatibility during install.

## Shared 3D Component: `WaterScene`

Props: `{ fillFraction: number; tone: "healthy" | "low"; variant: "intro" | "panel" }`.
Rendered as the content of an `@react-three/fiber` `<Canvas>` (the `<Canvas>` wrapper
itself lives in the two consumers below, not in `WaterScene`, so each consumer controls
its own canvas sizing/camera framing).

- **Geometry:** a subdivided plane mesh (real vertices, not a flat quad) whose vertex
  shader displaces height using the same conceptual layered-sine-wave technique as the
  retired `WaterCanvas` (2–3 sine terms at different speeds/phases, so motion never reads
  as a single repeating loop) — translated from a 2D path into actual 3D vertex
  displacement. Surface normals are computed analytically from the sine sum's partial
  derivatives (no extra texture sampling needed), so lighting responds correctly to the
  real displaced surface.
- **Material:** `THREE.MeshPhysicalMaterial` (low roughness, some `transmission` for a
  glassy/translucent look, `ior` ≈ 1.33 to approximate water's refractive index), patched
  via `onBeforeCompile` to inject the vertex displacement and normal perturbation above.
  Using the built-in physical material means three.js's own tested PBR lighting model
  (including its Fresnel-like grazing-angle brightening) drives realism, rather than
  hand-writing a full lighting model from scratch.
- **Lights:** one `DirectionalLight` (simulating an overhead/angled "sun," fixed position)
  plus one low-intensity `AmbientLight` (so unlit areas aren't pure black), added to the
  scene by `WaterScene` itself — consumers don't manage lighting.
- **Color:** `tone` selects the same two color families already established —
  teal/aqua (`#5fd4c8` → `#0f6f6a`) for `"healthy"`, coral (`#f2a08a` → `#c04a34`) for
  `"low"` — applied as the material's base color, blended by depth (shallower = lighter).
- **Fill level:** `fillFraction` sets how high the water plane sits — `0` = empty,
  `1` = completely full — identical semantics to the retired Canvas2D version (including
  the calling components' existing `0.04` floor value and `0.9` low-space threshold; this
  spec doesn't change those numbers, only how the water itself is drawn).
- **`variant`:** `"intro"` frames the plane to fill the entire camera view with no visible
  container edges (open water, screen-edge-to-screen-edge). `"panel"` frames a smaller
  water plane inside a visible translucent "tank" (a thin-walled box mesh, same physical
  material family at higher transparency/lower opacity) so it reads as a vessel holding
  water rather than a floating shape. Camera position/FOV and tank geometry are internal
  implementation details of `WaterScene`, not prescribed further here.

## Entrance: `WaterIntro` (rewritten)

Keeps the exact same phase state machine, timing constants, and semantics as the previous
plan (`waiting → rising → holding → fading`, `RISE_MS=1200`, `HOLD_MS=400`, `FADE_MS=500`,
`FLOOR_FRACTION=0.04`, `LOW_SPACE_THRESHOLD=0.9`, waits for `ready` before animating). The
only change: instead of a 2D `<canvas>` via `WaterCanvas`, it renders a full-viewport
`@react-three/fiber` `<Canvas>` containing `<WaterScene variant="intro" .../>`, with the
camera angled slightly downward/elevated (rather than a flat orthographic-feeling view) so
the 3D geometry and lighting are visible as the water rises, not just implied.

## Persistent Indicator: `CapacityGauge` (rewritten)

The 40×24px pill is replaced with a proper panel: a rounded card in the header (several
times larger than the old pill — exact dimensions are an implementation/visual-tuning
detail, not prescribed to the pixel here, but it must be large enough that the 3D
lighting/motion is actually legible, not a decorative sliver) containing an
`@react-three/fiber` `<Canvas>` with `<WaterScene variant="panel" .../>`, plus the existing
text label (device name, free space, "· low space" suffix) — same external props
(`device`, `justSynced`) and same no-device/dry-state behavior as before.

## Performance

- Continuous vertex-shader animation (via `useFrame`) is heavier than the retired
  Canvas2D approach. Both `WaterScene` consumers explicitly pause their render loop on
  `document.visibilitychange` (mirroring the previous plan's requirement) rather than
  relying solely on implicit browser rAF throttling, for guaranteed behavior.
- Geometry/shader complexity stays deliberately modest — this renders a small UI element
  in a desktop app window, not an open 3D scene; no post-processing passes, no
  reflection/refraction render targets, no orbit controls or user camera interaction.
- Bundle size grows meaningfully (three.js core + fiber + drei) — an accepted tradeoff per
  the user's explicit go-ahead to add dependencies for this feature.

## Out of Scope

- No HDRI/environment-map reflections (network dependency, ruled out above).
- No physically simulated fluid dynamics — displacement is the same layered-sine
  technique as before, just rendered as real 3D geometry instead of a 2D silhouette.
- No orbit controls / draggable camera / user interaction with the 3D scene itself.
- The broader header/quick-add/library/settings layout and interaction rework is a
  separate, following spec — not addressed here.
- `WaterCanvas.tsx` (the Canvas2D implementation) is deleted, not kept as a fallback —
  fully superseded, and dead code isn't kept "just in case" per project convention.

## Testing

- Same manual-verification limitation as prior plans in this repo (no automated test
  framework). Additionally: this sandbox has no Rust toolchain (noted in the prior plan)
  and, as of the last review, no confirmed working browser-based visual check either — the
  implementation plan must be explicit about what was and wasn't visually confirmed, the
  same way prior plans in this repo have been.
- Specific things to check when a real render is possible: water geometry visibly ripples
  in 3D (not a flat painted texture), lighting highlight moves correctly as waves move,
  low-space coral tone renders correctly, the panel variant's tank walls are visible as a
  container, the intro variant fills the viewport with no visible tank edges, and the
  render loop actually pauses when the window/tab is hidden.
