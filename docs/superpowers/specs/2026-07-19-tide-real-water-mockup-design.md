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

## Confirmed Assets

- `public/water/pool-surface.mp4` — a real top-down pool water clip: 1920×1080, h264,
  ~20.4s, 30fps, ~24MB. Bright, clean, sunlit caustic ripple patterns, no people, no
  branding. Used as the ambient full-page background layer (see Technical Approach).
- `public/water/hero-waterline.mp4` (from `11066-228113758.mp4` in the user's reference
  folder) — a real infinity-pool waterline shot: blurred warm greenery above the waterline,
  clear rippling blue water below, golden/warm light quality. Used for the hero section
  specifically (see Layout below) — only the lower "clear water" portion is used; the
  blurred upper portion is cropped away and replaced with solid white, matching the
  reference layout.
- Two real Shokz product photos (`shokz reference.jpg`, `shokz reference 02.jpg`) — the
  actual bone-conduction earpiece mid-splash, with the "SHOKZ" wordmark visible. **Explicit
  informed decision:** the user has confirmed using these as-is (visible branding included)
  is acceptable for this personal, non-commercial portfolio mockup, understanding they are
  real third-party product photography. Copied to `public/product/`.
- A surface→underwater transition clip is still wanted but not provided/blocking (see
  "Resource Still Wanted" below — unchanged from before).

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

## Layout Restructure (app's main screen becomes a landing-page hero)

This is a structural change to `App.tsx`'s own main screen (confirmed by the user — not a
separate marketing page). It moves from the current compact 800×600 utility layout to a
scrollable, hero-section landing-page layout, directly modeled on the reference image's
composition (white upper section, water lower section, waterline as the dividing motif),
adapted to Tide's own content:

1. **Hero section (first screen):**
   - Upper portion: solid white background containing the settings gear (top corner,
     unchanged position/behavior), the "Tide" wordmark in a large, organic/rounded,
     dark-blue display font (see Typography below), the tagline ("Pull it in, take it
     under."), the quick-add input + speed selector + "Pull in" button (restyled per the
     Button/Input System below), and the Shokz product photo placed within this white
     area.
   - Lower portion (roughly the bottom half of the hero section, matching the reference's
     proportions): `hero-waterline.mp4`, cropped to show only its clear-water portion —
     the blurred-greenery top of that clip is cropped away, not shown; solid white fills
     above the waterline instead, so the transition from "white section" to "water
     section" reads as one clean horizon line, matching the reference composition.
   - **The waterline's vertical position is the storage-fullness indicator** (see Storage
     Level Motion below) — this is the same "water is functional, not decorative"
     principle carried into the new layout: the hero water band is not just mood/decor, it
     doubles as the real capacity readout.
2. **Library section (scrolls into view below the hero):** the existing `LibraryList`
   content, unchanged in function, restyled to match the new visual system (soft
   rounded/organic cards rather than sharp rectangles).

## Typography

The "Tide" wordmark in the hero uses a rounded/organic display font (soft, flowing
letterforms — not the current system sans used for body text elsewhere), set in a dark
blue (distinct from the existing `--primary` teal — a deeper navy/blue reads better as
large display text on white than the teal accent does), generously sized as a true hero
headline rather than a small inline label.

## Button / Input "Water Bubble" System

Every interactive control (the "Pull in" button, the quick-add input box, the sync
button, delete/secondary buttons, etc.) is restyled to match the second reference image: a
soft, blurred, glossy blob — pastel blue blended with a warm/orange glow, rounded-organic
(not a sharp rectangle or perfect circle), reading as if it's made of the same soft
translucent light as the water itself. This explicitly replaces flat/sharp button
treatments — **not** glassmorphism (a sharp frosted-glass panel look), and not a flat
gradient circle; the reference is soft-focus, glowing, blob-shaped, with warm light
blended into the cool blue. Applied consistently across every control so the whole page
reads as one visual system (the same "semantic unity" principle as the water background).

## Sync Interaction (new — supersedes the earlier "not in scope" decision)

An explicit Sync button is added (previously sync was fully automatic with no user-facing
button/prompt — this is a deliberate, now-approved addition to that behavior, requested
directly by the user). Pressing it triggers a **"water rises from bottom to full"**
motion — the same water-level-as-fill-indicator concept from the hero section, but played
as a short, deliberate rise-to-full animation as the sync action's primary feedback,
rather than (or alongside) the passive automatic sync status text that exists today.

## Storage Level Motion

The waterline (in the hero section, and reused for the sync animation above) rises and
falls to reflect `used_fraction`, exactly as the earlier 3D-tank and Canvas2D versions
did — same semantics, same "0.9 = low space" threshold — just expressed now as the real
water-video layer's visible level within the hero band, rather than a separate small
gauge widget.

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

## Window Sizing

The current fixed 800×600 window (`src-tauri/tauri.conf.json`) was sized for a compact
utility layout, not a hero-section landing page. Bumped taller (e.g. 900×760) and made
resizable, so the hero composition has room to breathe and the library section below it
has a reason to scroll. This is a one-line config change, not a functional/backend change.

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
