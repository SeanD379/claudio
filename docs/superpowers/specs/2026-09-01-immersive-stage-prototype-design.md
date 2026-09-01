# Immersive Stage Prototype Design

## Goal

Replace the listen-mode silk background with a lightweight, pixel-art 360-degree concert stage that feels alive while music plays. The prototype proves the visual experience before the full sound-effect preset system is built.

## Scope

Included:

- One pixel-art 360-degree circular stage background with a blank overhead halo reserved for DOM-rendered lyrics.
- Album-cover-derived stage colors, constrained to readable warm/dark tones.
- Three animation classes: slow lighting loop, beat/low-frequency response, and sparse pixel particles.
- The existing `dynamicBg` setting as the single on/off switch.
- Reduced-motion, hidden-tab, pause, and mobile performance fallbacks.

Excluded:

- True Dolby Atmos or hardware spatial audio claims.
- The ten EQ presets and their final settings UI.
- Three.js/WebGL scenes, video backgrounds, live artist imagery, or new backend APIs.

## Alternatives Considered

1. Static image with CSS color overlay: fastest but does not respond to music.
2. **Layered 2D stage (selected):** static pixel-art base plus CSS and Canvas effects driven by the existing audio analyser. This delivers a convincing live stage at controlled cost.
3. Three.js/WebGL stage: richer depth but adds rendering, battery, and mobile-risk costs that do not help validate the first experience.

## Visual Composition

The stage base places the overhead lyric halo in the upper 12-35% of the viewport. The circular main stage occupies approximately 30-52%, with one singer on the inner platform and a compact band on the outer ring. The central-lower area remains quiet for visual breathing; the lower 20% remains suitable for the current player card.

The lyric halo is not image text. The existing lyric component will be repositioned to the halo display region and remains real DOM text, so lyric synchronization, accessibility, and responsive typography are retained.

## Runtime Layers

```
stage base image
  + cover palette wash
  + slow CSS light arcs and arena glow
  + Canvas pixel particles / beat accents
  + DOM lyric halo
  + existing player controls
```

`StageBackground` owns only visuals. It reads the current cover and analyser values but does not own playback. The player and lyric components continue to own their current responsibilities.

## Audio Integration

The current analyser already attaches one `MediaElementAudioSourceNode` and exposes bass, mid, high, energy, and beat values. For this prototype it remains an analysis source only.

When EQ is added later, the existing single graph must be extended rather than creating another media source:

```
audio -> EQ filters -> optional ambience -> analyser -> destination
```

This preserves a single audio route and ensures visual response reflects processed output.

## Animation Rules

- Cover change: crossfade palette over 900-1200ms; clamp luminance so lyrics remain readable.
- Slow loop: rotate/translate light gradients over 8-16 seconds using transform and opacity.
- Audio response: map bass to stage-rim scale, mid to side-light width, high to sparse particles, and beat to a capped 100ms ring pulse.
- Canvas work uses `requestAnimationFrame`, writes directly to a canvas/ref, and does not trigger React renders every frame.
- Mobile reduces particles and beat-update rate; hidden tabs and paused playback stop the loop.

## Fallbacks and Accessibility

- `dynamicBg=false`: render no stage animation and preserve the existing quiet background behavior.
- `prefers-reduced-motion: reduce`: static stage plus one non-looping palette transition.
- No analyser/audio support: retain palette and slow CSS loop only.
- Lyrics always render on an opaque enough halo scrim; visual color is never the only indication of a selected setting.

## Verification

1. Play a track with a bright and a dark cover: verify palette transitions are smooth and lyrics stay legible.
2. Play a bass-heavy track: verify a visible but non-flashing stage-rim response.
3. Toggle dynamic background, reduced motion, pause, and a hidden tab: verify loops stop or degrade correctly.
4. Check 375px mobile and desktop playback: no controls or lyrics overlap the stage's important content.
5. Run targeted type/lint checks for changed components and inspect the actual listen-mode page.
