# Claudio DESIGN.md

> An AI music companion — not a player, not a jukebox. A warm, sentient listening room where music and conversation become one.

---

## 1. Visual Theme & Atmosphere

### Concept: "The Listening Room"

Claudio is not Spotify. It is not Apple Music. It is not a content catalog.

Claudio is a **private listening room** — the feeling of walking into a warm, dimly lit space where someone who knows you deeply has already queued up the perfect record. The UI should feel like **amber light through vinyl**, like **a conversation between old friends at 2am**, like **the crackle before the first note**.

**Three principles that define Claudio's visual soul:**

1. **Warmth over cold precision.** Every AI product uses cool grays and electric blues. Claudio uses warm charcoal, amber, and cream. The interface should feel like it has a heartbeat.

2. **Intimacy over scale.** Spotify is a stadium. Apple Music is a gallery. Claudio is a living room. The UI breathes slowly. Elements have generous space around them. Nothing competes for attention — the music and the conversation are the only two things that matter.

3. **Analog soul in a digital body.** Subtle film grain. Serif typography for display text. Album art that bleeds color into the background. The turntable metaphor lives in the DNA — not as kitsch, but as a philosophy: music is physical, temporal, precious.

### What Claudio Is NOT

| If it feels like... | It's wrong |
|---|---|
| A content catalog with grids of album covers | Wrong — that's Spotify |
| A sterile white productivity tool | Wrong — that's Apple Music |
| A social media feed with comments and likes | Wrong — that's NetEase Cloud |
| A chat app with a mini player bolted on | Wrong — that's a chatbot |

### Surface Modes

Claudio has two atmospheric modes that shift with the theme:

1. **Night Room (Dark)** — The primary experience. Warm charcoal `#1a1814` base, like a room lit by a single amber lamp. Album art becomes the light source, bleeding color into the surrounding space. This is where Claudio lives.

2. **Day Room (Light)** — A sunlit version of the same room. Warm cream `#f8f5f0` base, like morning light through linen curtains. Soft, never stark. The warmth remains.

---

## 2. Color Palette & Roles

### Dark Mode (Primary — "Night Room")

**Surfaces:**
| Token | Hex | Role |
|---|---|---|
| `canvas` | `#1a1814` | Page background — warm near-black, NOT `#121212` |
| `surface` | `#222019` | Cards, panels, elevated containers |
| `surface-elevated` | `#2a2720` | Hover states, active cards, dropdown menus |
| `surface-glow` | `#2f2b24` | The "glow" layer behind album art |
| `overlay` | `rgba(10, 9, 7, 0.85)` | Modal backdrops, drawer overlays |

**Brand & Accent:**
| Token | Hex | Role |
|---|---|---|
| `accent` | `#d4a574` | Primary interactive — warm amber/copper. Play buttons, active states, CTAs |
| `accent-hover` | `#e0b88a` | Hover state — lighter amber |
| `accent-glow` | `rgba(212, 165, 116, 0.15)` | Ambient glow behind active elements |
| `accent-secondary` | `#c4956a` | Secondary interactive — deeper copper for less prominent actions |
| `accent-warm` | `#e8a55a` | Highlights, badges, notification dots |

**Text:**
| Token | Hex | Role |
|---|---|---|
| `text-primary` | `#f0ece4` | Headlines, primary content — warm white, NOT pure `#fff` |
| `text-secondary` | `#a09888` | Descriptions, metadata, timestamps |
| `text-muted` | `#6b6358` | Disabled text, placeholders, fine print |
| `text-on-accent` | `#1a1814` | Text on amber buttons — dark on warm |
| `text-inverse` | `#1a1814` | Text on light surfaces in dark mode (rare) |

**Borders & Dividers:**
| Token | Hex | Role |
|---|---|---|
| `border` | `rgba(240, 236, 228, 0.08)` | Subtle separation — almost invisible |
| `border-active` | `rgba(212, 165, 116, 0.3)` | Active/focused element borders |
| `divider` | `rgba(240, 236, 228, 0.05)` | Section dividers — ghostly thin |

**Semantic:**
| Token | Hex | Role |
|---|---|---|
| `success` | `#7db87d` | Favorited, saved, confirmed |
| `error` | `#d47474` | Errors, unavailable tracks |
| `warning` | `#d4a574` | Same as accent — warnings feel warm, not alarming |

### Light Mode ("Day Room")

**Surfaces:**
| Token | Hex | Role |
|---|---|---|
| `canvas` | `#f8f5f0` | Page background — tinted cream, NOT pure white |
| `surface` | `#ffffff` | Cards, panels — clean white against cream |
| `surface-elevated` | `#faf8f5` | Hover states |
| `surface-glow` | `#f0ece4` | Album art bleed area |
| `overlay` | `rgba(248, 245, 240, 0.90)` | Modal backdrops |

**Brand & Accent:**
| Token | Hex | Role |
|---|---|---|
| `accent` | `#b8834a` | Primary — deeper amber for light backgrounds |
| `accent-hover` | `#a07040` | Hover — darker on light |
| `accent-glow` | `rgba(184, 131, 74, 0.10)` | Subtle glow on light |
| `accent-secondary` | `#c49a6a` | Secondary actions |

**Text:**
| Token | Hex | Role |
|---|---|---|
| `text-primary` | `#1a1814` | Headlines — warm near-black |
| `text-secondary` | `#6b6358` | Descriptions |
| `text-muted` | `#a09888` | Placeholders, disabled |

### The Album Art Bleed

This is Claudio's signature visual effect. When a song plays, the album cover art is sampled (via CSS `backdrop-filter` and blurred color layers) and its dominant color bleeds into the surrounding surface — creating an ambient glow that makes the entire interface feel alive with the music's energy.

```
┌─────────────────────────────────────┐
│  canvas (#1a1814)                   │
│  ┌─────────────────────────────┐    │
│  │  surface-glow (album color) │    │
│  │  ┌─────────────────────┐    │    │
│  │  │   Album Art          │    │    │
│  │  │   (sharp, centered)  │    │    │
│  │  └─────────────────────┘    │    │
│  │  blur: 80px, opacity: 0.3   │    │
│  └─────────────────────────────┘    │
│                                     │
│  Song title, controls, chat...      │
└─────────────────────────────────────┘
```

Implementation: A blurred, scaled-up copy of the album cover sits behind the player card at 30% opacity with `filter: blur(80px)`. When the song changes, the color bleeds smoothly via `transition: background-image 1.5s ease`.

---

## 3. Typography Rules

### Font Stack

| Role | Font | Fallback |
|---|---|---|
| **Display** | `"Playfair Display", "Noto Serif SC", Georgia, serif` | Slab-serif for headlines — gives Claudio its literary, intimate voice |
| **Body/UI** | `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif` | Clean humanist sans for readability |
| **Mono** | `"JetBrains Mono", "SF Mono", "Fira Code", monospace` | For timestamps, technical metadata |

### Why Serif for Display?

Every music app uses sans-serif everywhere. The serif display is Claudio's **signature differentiator** — it says "this is a conversation, not a dashboard." It evokes album liner notes, poetry, and the written word. It makes song titles feel like titles, not list items.

### Type Hierarchy

| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| Display LG | 48px | 400 | 1.1 | -0.5px | Clock time (hero element) |
| Display MD | 32px | 400 | 1.15 | -0.3px | Song title when playing |
| Display SM | 24px | 400 | 1.2 | 0 | Section headers, page titles |
| Title LG | 20px | 500 | 1.3 | 0 | Card titles, playlist names |
| Title MD | 17px | 500 | 1.4 | 0 | Song list item titles |
| Body LG | 17px | 400 | 1.55 | 0 | Chat messages, long-form text |
| Body MD | 15px | 400 | 1.5 | 0 | Default body, descriptions |
| Body SM | 13px | 400 | 1.5 | 0.1px | Metadata, timestamps, captions |
| Label | 12px | 500 | 1.0 | 0.5px | Buttons, nav items, badges |
| Micro | 11px | 400 | 1.3 | 0.2px | Legal, fine print |

### Typography Principles

- **Display at weight 400, never bold.** The serif does the heavy lifting. Bold serif at display sizes feels heavy and editorial-in-a-bad-way. Regular weight with negative letter-spacing is Claudio's voice.
- **Body at 17px, not 16px.** Borrowed from Apple — the extra pixel creates a "reading pace" that matches the slow, intentional nature of listening to music.
- **Negative letter-spacing on display sizes.** `-0.3px` to `-0.5px` at 24px+ creates the tight, considered feel of album liner notes.
- **Chat messages use Body LG (17px).** Conversations with Claudio should feel substantial, not like SMS.

---

## 4. Component Stylings

### Player Card

The heart of the interface. Not a bar, not a widget — a **stage**.

```
┌──────────────────────────────────────┐
│                                      │
│         ┌──────────────────┐         │
│         │                  │         │
│         │   Album Art      │         │
│         │   (circular)     │         │
│         │   240px × 240px  │         │
│         │                  │         │
│         └──────────────────┘         │
│         (rotates when playing)       │
│                                      │
│    "Song Title"                      │
│    Artist Name                       │
│                                      │
│    ──────────●────────────  3:24     │
│                                      │
│       ⏮    ▶ / ⏸    ⏭              │
│                                      │
│    🔀          🔊━━━━━━       ❤️     │
│                                      │
└──────────────────────────────────────┘
```

**Specifications:**
- Container: `surface` background, 24px radius, 32px padding
- Album art: 240px diameter circle, `border-radius: 50%`
- Rotation: `animation: spin 20s linear infinite` when playing, pause on hover
- Shadow on album art: `0 8px 40px rgba(0, 0, 0, 0.4)` — the ONLY prominent shadow in the system
- Progress bar: 4px height, `accent` fill, `surface-elevated` track, 12px circular thumb
- Controls: 40px hit targets, `text-secondary` default, `text-primary` on hover, `accent` on active
- Play button: 56px circle, `accent` background, `text-on-accent` icon, `scale(1.05)` on hover

### Chat Interface

The conversation is not a sidebar. It is **half the experience**.

**Message Bubbles:**
- Claudio messages: `surface` background, `text-primary`, 16px radius (rounded except top-left corner = 4px)
- User messages: `accent` background at 15% opacity, `text-primary`, 16px radius (rounded except top-right = 4px)
- Max width: 85% of container
- Padding: 14px × 18px
- Entry animation: `opacity: 0 → 1, translateY(8px → 0)` over 300ms, stagger 50ms

**Input Area:**
- Background: `surface-elevated`, pill radius (9999px), 48px height
- Border: 1px `border` default, 1px `border-active` on focus
- Placeholder: `text-muted`, italic
- Send button: 36px circle, `accent` background, appears when text is entered

**Song Recommendation Cards (inside chat):**
- Background: `surface-elevated`, 12px radius
- Layout: Horizontal — album art (48px square, 8px radius) + title/artist + play button
- Group header: "Claudio recommends" with a small music note icon
- Play-all button: `accent` outline pill

### Navigation Bar

Not a tab bar. A **mood indicator**.

- Position: Fixed bottom, 72px height
- Background: `canvas` with `backdrop-filter: blur(20px)`, 90% opacity
- Active indicator: 48px pill, `accent-glow` background, `accent` text — slides between tabs with spring animation (`stiffness: 300, damping: 30`)
- Icons: 24px, `text-muted` inactive, `accent` active
- Labels: 11px/500, below icon
- No top border — separation is achieved through the blur and subtle `border-top: 1px solid rgba(240, 236, 228, 0.05)`

### Clock Component

Not a widget. A **ritual**.

- Time: `Display LG` (48px), `text-primary`, tabular numbers (`font-variant-numeric: tabular-nums`)
- Colon separator: Pulsing opacity animation (1.0 ↔ 0.3, 1s ease)
- Date: `Body SM`, `text-secondary`, below time
- Weekday: Localized, in parentheses
- The clock is not just functional — it grounds the user in the present moment, reinforcing Claudio's "companion" identity

### Buttons

**Primary (CTA):**
- Background: `accent`, text: `text-on-accent`
- Radius: 9999px (pill), padding: 10px × 24px
- Font: 15px / 500
- Hover: `accent-hover`, `transform: translateY(-1px)`, shadow: `0 4px 12px rgba(212, 165, 116, 0.25)`
- Active: `transform: scale(0.97)`

**Secondary:**
- Background: transparent, border: 1px `border-active`, text: `accent`
- Same dimensions as primary
- Hover: `accent-glow` background

**Ghost:**
- Background: transparent, text: `text-secondary`
- Hover: `surface-elevated` background
- Used for: Cancel, dismiss, secondary actions

**Icon Button:**
- 40px circle, transparent background
- `text-secondary` default, `text-primary` hover
- Hit target: 44px (with 2px invisible padding)

### Cards

**Standard Card:**
- Background: `surface`, radius: 16px, padding: 20px
- Border: none (dark mode) / 1px `border` (light mode)
- Hover: `surface-elevated` background, `transition: 200ms ease`

**Glow Card (for featured content):**
- Same as standard, plus:
- Inner shadow: `inset 0 0 60px rgba(212, 165, 116, 0.05)`
- Used for: Now playing, daily recommendation, featured playlist

### Song List Item

- Height: 56px, horizontal layout
- Left: Album art (40px, 6px radius)
- Center: Title (`Title MD`, `text-primary`) / Artist (`Body SM`, `text-secondary`)
- Right: Duration (`Body SM`, `text-muted`) or play indicator (animated bars)
- Hover: `surface-elevated` background
- Playing state: `accent` text for title, animated music bars replace duration
- Favorite: Heart icon, `text-muted` default, `accent` when favorited, `scale(1.2)` bounce on toggle

---

## 5. Layout Principles

### Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `xxs` | 4px | Tight gaps, icon-to-text |
| `xs` | 8px | Compact spacing |
| `sm` | 12px | Card internal padding (compact) |
| `md` | 16px | Standard gap between elements |
| `lg` | 24px | Card padding, section gaps |
| `xl` | 32px | Large section padding |
| `xxl` | 48px | Major section breaks |
| `section` | 64px | Page-level vertical rhythm |

### Home Page Layout

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  ┌──────────────────────┐  ┌────────────────────┐  │
│  │                      │  │                    │  │
│  │   CLOCK              │  │   CHAT             │  │
│  │   48px time          │  │   Messages...      │  │
│  │   date + weekday     │  │                    │  │
│  │                      │  │   [Claudio recs]   │  │
│  │   ────────────────   │  │                    │  │
│  │                      │  │                    │  │
│  │   PLAYER             │  │                    │  │
│  │   ┌──────────┐       │  │                    │  │
│  │   │ Album    │       │  │                    │  │
│  │   │ Art      │       │  │                    │  │
│  │   └──────────┘       │  │                    │  │
│  │   Song - Artist      │  │                    │  │
│  │   ──●───────         │  │                    │  │
│  │   ⏮  ▶  ⏭           │  │                    │  │
│  │                      │  │                    │  │
│  └──────────────────────┘  └────────────────────┘  │
│                                                    │
│  ┌────────────────────────────────────────────────┐│
│  │   🏠 Home    ❤️ Favorites    ⚙️ Settings      ││
│  └────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────┘
```

**Desktop (≥1024px):**
- Two-column: 45% player / 55% chat
- Max width: 1200px centered
- Column gap: 32px
- Vertical padding: 48px top, 96px bottom (above navbar)

**Tablet (768-1023px):**
- Single column, stacked
- Clock + Player on top, Chat below
- Player card: full width

**Mobile (<768px):**
- Single column, full bleed
- Player card collapses: album art 160px, controls compact
- Chat takes remaining height
- Navbar: same position, tighter spacing

### Base Unit

4px. All spacing values are multiples of 4.

### Max Content Width

1200px for the main content area. The navbar and background effects extend full width.

---

## 6. Depth & Elevation

### Shadow Philosophy

Claudio uses **minimal shadows**. Depth comes from **surface color differentiation** and **the album art bleed effect**, not from drop shadows. This is borrowed from Claude's "color-block first, shadow rare" approach.

| Level | Treatment | Usage |
|---|---|---|
| **Base** | No shadow, no border | Page canvas |
| **Surface** | Background color change only | Cards, panels |
| **Elevated** | `0 4px 20px rgba(0, 0, 0, 0.2)` | Dropdown menus, hover cards |
| **Floating** | `0 8px 40px rgba(0, 0, 0, 0.3)` | Modals, the player's album art |
| **Glow** | `0 0 60px rgba(212, 165, 116, 0.1)` | Active player, accent highlights |

### Surface Hierarchy

```
Canvas (#1a1814)
  └── Surface (#222019)
        └── Surface Elevated (#2a2720)
              └── Surface Glow (#2f2b24) — only behind album art
```

Each level is a subtle warm step up, never a harsh contrast.

### The Glow Effect

The album art's dominant color creates a soft, blurred glow behind the player card. This is Claudio's **signature depth mechanism** — it replaces the heavy shadows that Spotify uses. The glow is:

- Generated from the album cover via CSS
- Blurred at 80px
- Scaled to 150% of the player card
- Positioned behind the player card at z-index -1
- Opacity: 0.3 (dark) / 0.15 (light)
- Transition: 1.5s ease on song change

---

## 7. Do's and Don'ts

### Do

- **Do** let the album art be the color source. The UI should feel tinted by the music.
- **Do** use serif for song titles and display text. This is Claudio's voice.
- **Do** keep the interface sparse. Every element should earn its place.
- **Do** use the amber accent sparingly — only for interactive elements and active states.
- **Do** make the chat feel like a conversation, not a command line. Generous padding, warm colors, slow animations.
- **Do** use `transition: 200ms ease` on most interactive state changes. Nothing should snap.
- **Do** let the clock breathe. It's a focal point, not a status bar widget.
- **Do** make the turntable rotation smooth and continuous. 20s for a full revolution.
- **Do** use film grain texture (`background-image: url("data:image/svg+xml,...")` with noise) at 2-3% opacity on dark surfaces for analog warmth.

### Don't

- **Don't** use pure black (`#000000`) anywhere. Claudio's darkest color is `#1a1814`.
- **Don't** use pure white (`#ffffff`) in dark mode. The lightest text is `#f0ece4`.
- **Don't** use Spotify green, Apple blue, or any other brand's accent color.
- **Don't** put album art in a grid. This is not a catalog.
- **Don't** use uppercase text with wide letter-spacing. That's Spotify's voice, not Claudio's.
- **Don't** add borders to cards in dark mode. Surface color differentiation is enough.
- **Don't** use geometric sans-serif for display text. That makes Claudio feel like every other app.
- **Don't** animate things bouncing or springing excessively. Claudio moves like breathing, not like a pinball.
- **Don't** pack content densely. This is a listening room, not a trading dashboard.
- **Don't** use emoji in the UI. Lucide icons only.

---

## 8. Responsive Behavior

### Breakpoints

| Name | Range | Behavior |
|---|---|---|
| Mobile | < 768px | Single column, compact player, bottom nav |
| Tablet | 768-1023px | Single column, full player, bottom nav |
| Desktop | 1024-1279px | Two-column layout, bottom nav |
| Wide | ≥ 1280px | Two-column, max-width 1200px, centered |

### Mobile Adaptations

- **Player:** Album art shrinks to 160px, controls become horizontal strip
- **Chat:** Full width below player, input fixed at bottom
- **Clock:** Smaller (32px), above player
- **Navbar:** 64px height, icons only (no labels) below 480px
- **Song list:** 48px row height, smaller album art (36px)

### Touch Targets

- Minimum: 44px × 44px for all interactive elements
- Play button: 56px (primary action, always larger)
- Navbar icons: 48px hit area
- Progress bar thumb: 24px (visual: 12px, hit area extends)

---

## 9. Agent Prompt Guide

### Quick Reference

```
Background:    #1a1814 (dark) / #f8f5f0 (light)
Surface:       #222019 (dark) / #ffffff (light)
Accent:        #d4a574 (dark) / #b8834a (light)
Text Primary:  #f0ece4 (dark) / #1a1814 (light)
Text Secondary:#a09888 (dark) / #6b6358 (light)
Font Display:  Playfair Display, serif
Font Body:     Inter, sans-serif
Radius:        16px (cards), 9999px (buttons)
```

### Ready-to-Use Prompts

**Build a player card:**
> Create a centered player card with a 240px circular album art that rotates slowly when playing, song title in serif 32px, artist in sans 15px muted, a thin progress bar with amber fill, and play/pause/skip controls. Background should be warm charcoal #222019 with a soft amber glow behind the album art.

**Build a chat interface:**
> Create a chat interface where Claudio's messages have a warm dark surface background (#222019) with serif-feeling text, and user messages have a subtle amber tint. Messages fade in from below. Include an input bar with a pill shape, warm border on focus, and an amber send button.

**Build the clock component:**
> Create a large clock display with 48px serif font showing the time with a pulsing colon separator, date below in 13px muted sans-serif. The clock should feel like a centerpiece, not a widget — generous whitespace around it.

**Build a song list:**
> Create a song list with 56px rows, each showing a small album art thumbnail (40px, rounded), song title and artist vertically stacked, and duration on the right. The currently playing song should have amber text and animated music bars. Hover shows a subtle surface elevation change.

### Design Differentiation Summary

| Aspect | Spotify | Apple Music | NetEase | **Claudio** |
|---|---|---|---|---|
| Base color | Near-black `#121212` | Pure white `#fff` | Red/white | **Warm charcoal `#1a1814`** |
| Accent | Green `#1ed760` | Blue `#0066cc` | Red `#c20c0c` | **Amber `#d4a574`** |
| Typography | All sans | All sans | All sans | **Serif display + sans body** |
| Layout | Sidebar + grid | Grid catalog | Social feed | **Player + Chat, two-column** |
| Feel | Dark theater | White gallery | Social app | **Warm listening room** |
| Content model | Browse millions | Browse millions | Social + browse | **Conversation-driven** |
| Album art role | Thumbnail in grid | Hero in catalog | Cover in feed | **Color source, bleeds into UI** |
| Animation | Functional | Minimal | Playful | **Breathing, organic** |

---

## 10. Motion Design

### Principles

1. **Breathing, not bouncing.** Animations use ease-in-out curves, not spring physics (except the navbar indicator).
2. **Slow is premium.** Most transitions are 200-300ms. Song-change color bleed is 1.5s. The turntable is 20s per revolution.
3. **Purposeful.** Every animation communicates state change. No decorative motion.

### Key Animations

| Animation | Duration | Easing | Usage |
|---|---|---|---|
| Page entrance | 400ms | ease-out | Staggered fade-in, 50ms between elements |
| State change | 200ms | ease | Button hover, card elevation |
| Album rotation | 20s | linear | Continuous when playing |
| Color bleed | 1.5s | ease | Album art glow transition |
| Chat message | 300ms | ease-out | Fade in + slide up |
| Navbar indicator | 400ms | spring (stiffness: 300, damping: 30) | Tab switch |
| Progress bar | 100ms | linear | Smooth seek |
| Music bars | 600-800ms | ease-in-out | Now-playing indicator (3 bars, staggered) |
| Colon pulse | 1000ms | ease-in-out | Clock separator opacity |
| Favorite heart | 300ms | spring | Scale bounce on toggle |

### Reduced Motion

When `prefers-reduced-motion: reduce`:
- Album rotation stops
- Color bleed transitions to instant
- Chat messages appear without animation
- Music bars become static
- All durations set to 0ms

---

## 11. Implementation Notes

### Tech Stack Alignment

This design is built for the existing Claudio stack:
- **TailwindCSS 4** — All color tokens map to CSS custom properties, usable as `bg-[var(--surface)]` etc.
- **Framer Motion** — All animations are achievable with `motion.div`, `AnimatePresence`, and `useSpring`
- **Lucide React** — All icons (no emoji, no custom SVGs needed beyond existing set)
- **Next.js App Router** — No structural changes needed

### CSS Custom Properties (for globals.css)

```css
:root {
  /* Dark mode (default) */
  --canvas: #1a1814;
  --surface: #222019;
  --surface-elevated: #2a2720;
  --surface-glow: #2f2b24;
  --accent: #d4a574;
  --accent-hover: #e0b88a;
  --accent-glow: rgba(212, 165, 116, 0.15);
  --text-primary: #f0ece4;
  --text-secondary: #a09888;
  --text-muted: #6b6358;
  --border: rgba(240, 236, 228, 0.08);
  --border-active: rgba(212, 165, 116, 0.3);
}

[data-theme="light"] {
  --canvas: #f8f5f0;
  --surface: #ffffff;
  --surface-elevated: #faf8f5;
  --surface-glow: #f0ece4;
  --accent: #b8834a;
  --accent-hover: #a07040;
  --accent-glow: rgba(184, 131, 74, 0.10);
  --text-primary: #1a1814;
  --text-secondary: #6b6358;
  --text-muted: #a09888;
  --border: rgba(26, 24, 20, 0.08);
  --border-active: rgba(184, 131, 74, 0.3);
}
```

### Film Grain Texture

```css
.surface-grain::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 1;
}
```

### Album Art Bleed

```jsx
// Behind the player card
<div
  className="absolute inset-0 -z-10"
  style={{
    backgroundImage: `url(${albumCoverUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(80px) saturate(1.2)',
    transform: 'scale(1.5)',
    opacity: 0.3,
    transition: 'background-image 1.5s ease',
  }}
/>
```
