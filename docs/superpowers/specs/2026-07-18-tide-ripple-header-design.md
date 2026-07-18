# Tide — Interactive Ripple Header Design

## Context

This adds an interactive water-ripple distortion effect to the app's sticky header
background, using the `jquery.ripples` plugin (https://github.com/sirxemic/jquery.ripples)
at the user's explicit request — including the explicit choice to use the actual
plugin + jQuery rather than porting the technique to avoid that dependency. This is
additive to, not a replacement of, the 3D water work
(`docs/superpowers/specs/2026-07-18-tide-3d-water-design.md`): the entrance and capacity
gauge keep rendering via `WaterScene`/`react-three-fiber`; this spec only touches the
header's background surface.

## How the plugin actually works (confirmed from source)

- It requires an actual `background-image` (URL or data-URI) on the target element —
  it does not work on a plain CSS gradient/color, and doesn't add its own lighting to a
  color-only background. Our header currently uses `.bg-tide-header`, a CSS
  `linear-gradient` with no underlying image, so it has nothing to distort as-is.
- It appends its own WebGL `<canvas>` as a child of the target element, absolutely
  positioned, `z-index: -1`, and hides the element's existing `background-image`
  (sets it to `none`), rendering the distorted image via WebGL in its place. Normal
  child DOM content (our header's logo/quick-add/gauge) renders above it in the normal
  stacking order — text and controls are not distorted, only the background is.
- It's a UMD module (`typeof exports === 'object' ? factory(require('jquery')) : ...`),
  published on npm as `jquery.ripples@0.6.3`, no declared dependency on `jquery` itself
  (peer expectation) and no bundled TypeScript types.

## Fix for the "needs a real image" requirement: generated gradient texture

A one-time canvas-drawn PNG (data URL) matching the header's existing gradient colors
(`hsl(190 70% 92%)` → `hsl(189 60% 80%)`, the same values already in
`--tide-gradient-from`/`--tide-gradient-to`) is generated at runtime and passed as the
plugin's `imageUrl` option. This keeps the header's at-rest appearance visually
unchanged from today, while giving the plugin something real to ripple/refract.
`.bg-tide-header` (the CSS gradient class) is removed from the header markup and from
`src/index.css` — fully superseded by this texture, not kept as dead code.

## Component: `RippleSurface`

A thin wrapper component: `{ className?: string; children: React.ReactNode }`. Renders a
`div` (ref-attached); on mount, initializes `$(el).ripples({ imageUrl: <generated
texture>, resolution: 256, dropRadius: 20, perturbance: 0.03, interactive: true })`
(plugin defaults for resolution/dropRadius/perturbance — not tuned, see Testing); on
unmount, calls `$(el).ripples('destroy')` to clean up (removes its canvas, restores the
hidden background property, per the plugin's own documented teardown behavior).

The existing sticky header container in `App.tsx` (currently
`<div className="sticky top-0 z-20 bg-tide-header">`, wrapping the quick-add row,
capacity gauge, and `WaveDivider`) becomes `<RippleSurface className="sticky top-0
z-20">` with the same children unchanged — `WaveDivider` and everything inside it are
untouched by this spec.

Default interactive behavior (ripples follow mouse movement/clicks over the header) is
used as-is — no custom wiring to specific buttons or events, kept additive and simple
per the request.

## TypeScript

Neither `jquery.ripples` nor its extension of jQuery's type system ships types. This
spec adds:
- `@types/jquery` (devDependency) for base `$`/`JQuery` types.
- An ambient declaration file (`src/types/jquery-ripples.d.ts`) that (a) declares the
  `"jquery.ripples"` side-effect-only module so its bare import type-checks, and
  (b) extends the global `JQuery` interface with typed `ripples(...)` overloads
  (init-with-options, `'destroy'`, `'drop'`) instead of relying on `any`-casts at every
  call site.

## Real risk, stated plainly

`jquery.ripples` is roughly a decade old and WebGL1-only; bundling a UMD-only,
jQuery-dependent package into a modern Vite/React/ESM app is a well-trodden pattern in
general, but this specific package has not been test-bundled here before. To reduce (not
eliminate) the chance of a Vite dependency-pre-bundling issue, `vite.config.ts` proactively
adds `optimizeDeps.include: ["jquery.ripples"]` (its only reachable import is a bare
side-effect import, which Vite's dependency scanner can sometimes miss without this hint).
If a bundling error still surfaces during implementation, it should be treated as an
expected possible outcome to troubleshoot, not a sign the plan is wrong.

## Out of Scope

- No changes to `WaterScene`, `WaterIntro`, or `CapacityGauge` (the 3D water work stays
  as-is).
- No custom ripple triggers tied to specific UI actions (e.g. a manual `.ripples('drop',
  ...)` call on button click) — only the plugin's default interactive mouse behavior.
- No tuning pass on `resolution`/`dropRadius`/`perturbance` — plugin defaults are used as
  a starting point (see Testing).

## Testing

- Same manual-verification limitation as prior plans (no automated test framework, no
  Rust toolchain or headless browser in this sandbox as of the last check). Specific
  things to verify once a real render is possible: the header's at-rest appearance still
  looks like the existing gradient (via the generated texture); moving the mouse over the
  header visibly ripples/distorts it; header text/controls remain crisp, undistorted, and
  clickable on top; unmounting (e.g. navigating away, if that ever applies) cleanly
  restores state without leaking the plugin's canvas or event listeners.
- `resolution`/`dropRadius`/`perturbance` are plugin defaults, not tuned — expect a
  follow-up round of adjustment once actually seen, same as the 3D water constants.
