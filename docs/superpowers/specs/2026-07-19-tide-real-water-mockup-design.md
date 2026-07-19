# Tide — Real Water Background Design (Portfolio Mockup)

## Context

This replaces the 3D tank concept (`WaterScene`/`WaterIntro`/`CapacityGauge`'s canvas,
`docs/superpowers/specs/2026-07-18-tide-3d-water-design.md`) and the interactive ripple
header (`RippleSurface`/`jquery.ripples`,
`docs/superpowers/specs/2026-07-18-tide-ripple-header-design.md`) with a single, unified
water system: **real pool-water footage, distorted with a ripple effect, used across the
whole page** — not a stylized 3D tank icon, and not an effect confined to just the header
strip.

**This is explicitly a portfolio mockup, not the production app.** The bar is: the key
interaction ideas work, look genuinely good on camera, and align with the "Tide" concept
and tagline ("Pull it in, take it under.") well enough to record a few short videos of the
main interactions for a portfolio piece. It is *not* a bar of production robustness,
cross-platform correctness, or handling every edge case — polish where it's seen (the
water, the motion, the moments being recorded), not defensive engineering where it isn't.

Design principles behind this, from reference material and discussion:
- **Real footage, not illustration.** The reference (a swimwear-brand hero shot: a real
  waterline photo with reflection and ripple) is photographic and editorial in mood, not
  a rendered 3D icon. We're borrowing the *technique and mood* — real water, ripple
  distortion, cinematic — not the literal content (no people, no swimwear/surfboard
  imagery; concept and tagline stay ours).
- **Pool, not ocean.** Matches the actual product (a pool/swim earpiece), and — important
  correction from earlier design — **the water must never look murky or dirty**, even in
  a "low storage" warning state. Storage-state warnings move to a separate small
  accent/badge; the water itself always stays clean and inviting.
- **Semantic animation.** Per the user's reference material: separate motion elements
  should read as one connected living system, not isolated independent widgets. One water
  system, used consistently everywhere (header, background, entrance), rather than the
  previous split between a stylized 3D tank and a separately-scoped header ripple effect.
- **Parallax as depth, not just decoration.** The water reads as a background layer with
  depth relative to foreground UI content, not a flat overlay.

## Confirmed Asset

`public/water/pool-surface.mp4` (already copied into the project) — a real top-down pool
water clip: 1920×1080, h264, ~20.4s, 30fps, ~24MB. Bright, clean, sunlit caustic ripple
patterns, no people, no branding. Confirmed by the user as matching the desired "clean,
never murky" look. This is a **top-down** shot — it does not contain a surface→underwater
transition.

## Resource Still Wanted (not blocking)

The user described an additional desired shot for the entrance specifically: a camera
transition from water-surface level down to an underwater elevation view (looking
up/across from below, not top-down) — similar in spirit to the reference image's
waterline framing. No such clip has been provided yet, and both Pixabay and Pexels block
automated fetching/downloading (confirmed: both returned HTTP 403 to programmatic
requests), so sourcing it requires the user to manually download a candidate via browser,
same as the confirmed asset above. **This is a nice-to-have for the entrance, not a
blocker** — per the mockup framing, the entrance ships using the confirmed top-down clip
now (see Entrance section), and can be upgraded later if a suitable second clip is found.

## Technical Approach

`jquery.ripples` cannot be reused here — it only accepts a static image (`imageUrl`), not
a live video source. Instead, since `three`/`@react-three/fiber` are already dependencies:

- A `<video>` element (`autoplay muted loop playsInline`, pointing at
  `/water/pool-surface.mp4`) feeds a `THREE.VideoTexture`.
- A full-viewport plane mesh (reusing the same layered-sine vertex displacement technique
  already built for `WaterScene`, so the ripple motion technique carries over) samples that
  video texture instead of a flat material color — real footage, genuinely distorted in
  real time, not a static image.
- Mouse movement perturbs the displacement locally (an added ripple-from-cursor term),
  giving the same "interactive, reacts to you" quality the header ripple had, but now
  driven by real video rather than a generated gradient.
- This single component (`WaterBackground`, replacing `WaterScene`) is used in exactly
  one place structurally — a fixed, full-viewport, low-z-index layer behind all page
  content — rather than being duplicated per-consumer like the old intro/panel split. The
  "semantic unity" principle above is satisfied by there being one continuous water layer
  the whole app sits on top of, rather than separate instances.
- `WaterScene.tsx`, `WaterCanvas`'s successor concept, `RippleSurface.tsx`,
  `generateHeaderTexture.ts`, and the `jquery`/`jquery.ripples`/`@types/jquery`
  dependencies are all retired — fully superseded, not kept as a fallback.

## Where It Appears

- **Page background:** `WaterBackground` sits fixed behind the entire app (header,
  library, everything) at low opacity/blended with the existing sand/cream tones so text
  stays legible — the header and library card keep their own semi-opaque backgrounds for
  readability, same reasoning as previously discussed for the "whole page" request.
- **Entrance:** on launch, the same `WaterBackground` is shown at full prominence/opacity
  (no card content yet) for ~2s, then the UI fades in on top of it as it settles to its
  ambient background role — one continuous element changing role, not two separate
  systems handing off to each other.

## Storage-State Indication (moved off water color)

Since the water must never look murky, "low space" is no longer communicated by changing
the water's tone. Instead: a small coral badge/label next to the existing free-space text
in the capacity area (e.g. "· low space" already exists as text — it gains a small coral
dot/icon rather than the water itself shifting color). The water stays visually consistent
regardless of storage state.

## Mock Connected-Device State (mockup-only addition)

Since there is no real earpiece in the environment these portfolio videos will be recorded
in, and the capacity indicator's whole point is to show real device state, a small
dev-only affordance is added: a way to simulate a connected device with a chosen
fill level (e.g. a hidden/simple toggle, not part of the "real" product surface), purely
so the recorded videos can show the indicator in a non-empty state. This is explicitly
scoped as mockup-only scaffolding, not a real feature — it should be obviously
separable/removable later, not integrated into the real Tauri backend/device-detection
path.

## Out of Scope

- No new backend/Rust changes.
- No further asset-sourcing automation — any additional video candidates must be manually
  downloaded by the user, per the confirmed 403 blocks on both stock sites tried.
- No production hardening (this is a mockup) — e.g., video load-failure fallback, exact
  cross-platform video codec support, etc. are not being engineered for; if the video
  fails to load in whatever environment the recording happens in, that's a "swap the
  environment/asset" problem, not something to build extensive fallback logic for.
- The surface→underwater transition entrance treatment is deferred until/unless a second
  clip is provided — not built speculatively.

## Testing

- Same visual-verification limitations as prior specs in this repo apply (no automated
  test framework; this sandbox's WebGL/graphics-driver reliability is itself unconfirmed
  as of the last check — a separate, real issue from this design that should be verified
  before relying on this sandbox for the actual portfolio recording).
- Success bar per the mockup framing above: does it look good, does it read as "Tide,"
  does the main interaction (launch → header/background water → quick-add → capacity
  indicator reacting to the mock connected state) work end-to-end well enough to record.
