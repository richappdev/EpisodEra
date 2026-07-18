# Cinema Memory Design Handoff

Last updated: 2026-07-18  
Shipped tip: `fb5cd08`  
Live app: https://episodera.web.app

## Purpose

This document is the **GitHub design handoff** for syncing Figma (interaction SoT) and Canva (stakeholder summaries) after Cinema Memory phases **D0–D3**.

Until the Figma file is updated and verified against the live app, treat:

1. **GitHub implementation** (`web/src/styles.css`, routes, pages) as visual authority for shipped UI.
2. **This document** as the Figma rebuild brief.
3. **Notion Resource Alignment** for cross-resource status language.

Figma must not invent product capabilities. Canva must not contradict shipped status.

## Direction name

**Cinema Memory** — single dark cinema UI across the product.

| Canvas | Mood | Routes |
| --- | --- | --- |
| `cinema` | Dark discovery / immersion | All product routes (`/`, search, detail, watchlist, timeline, profile, settings, social, privacy, auth, franchises, `/landing`) |

Routing helper: `canvasFromPath` in `web/src/routes/paths.ts` (always `"cinema"`).  
Attribute: `document.documentElement.dataset.canvas="cinema"`.

## Design tokens

Source: `:root` in `web/src/styles.css` (one token set for every page).

### Cinema (product-wide)

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#0B0E12` | Void |
| `--color-surface` | `#141A22` | Panels |
| `--color-surface-muted` | `#1C2430` | Muted chrome |
| `--color-border` | `#2A3340` | Hairlines |
| `--color-text` | `#F2F5F7` | Primary ink |
| `--color-text-soft` | `#C5CDD6` | Secondary ink |
| `--color-muted` | `#8B95A3` | Meta |
| `--color-primary` | `#3EC9D6` | Accent / CTA |
| `--color-on-primary` | `#06242A` | Text on cyan |
| `--color-action` | `#E8913A` | Warm secondary action |
| `--color-danger` | `#D87C7C` | Errors |

### Typography

| Role | Family |
| --- | --- |
| Display / brand / figures | Sora |
| UI body | Source Sans 3 |
| CJK | Noto Sans TC (+ system CJK fallbacks) |

Loaded in `web/index.html` via Google Fonts.

## Motions (intentional)

1. Auth / recap atmosphere — soft radial glows on dark voids (not decorative noise).
2. Cyan accent edge — auth panel and Year Recap top rule.
3. Check bloom — episode watched toggle scale pulse (`check-bloom`).

## Screen briefs for Figma

Rebuild or update frames to match shipped behavior. Breakpoints: desktop ≥1024, tablet 768–1023, mobile ≤767. Content max ~1180px. Tap targets ≥44px.

### Auth (`/login`, `/signup`) — cinema

- Full-bleed atmospheric dark ground.
- Brand eyebrow `Episodera`.
- Translucent panel, **2px cyan top rule**, no heavy card chrome.
- Underline inputs; solid cyan primary CTA.
- One job: sign in / sign up.

### Landing (`/landing`) — cinema

- Marketing surface; product TopBar hidden (`data-chrome="landing"`).
- Full-bleed poster plane + cinema veil as the hero visual.
- Brand `Episodera` is the dominant first-viewport signal; one headline, one support line, CTA pair.
- Below fold: Track / Remember / Discover sections (one job each), then close CTA.
- Motions: poster fade-in, slow poster drift, section rise (respect `prefers-reduced-motion`).

### Home (`/`) — cinema

- First content band: **Continue Watching** poster rail only (when signed-in entries exist).
- Poster tile: title, episode code `S# E#`, progress bar, full-width **Watched**.
- Below fold: Smart discovery mood chips + horizontal suggestion rails, then trending grid.
- Dense poster grids (~128px columns).

### Title detail (`/movie/:id`, `/tv/:id`) — cinema

- Full-bleed backdrop hero (edge-to-edge, no inset radius).
- Show progress: cyan **ring** + copy.
- Icon rail: TV Planned / Watching / Completed / Dropped (+ Remove); Movie Watched toggle.
- Season list: ring per season, cyan expanded accent edge.
- Episode rows: one-tap Mark watched / Watched with cyan active state.

### Timeline (`/timeline`) — cinema

- Same dark cinema tokens as Home.
- Display header “Timeline”.
- Diary spine (left rule + cyan date dots).
- Borderless entry rows; rewatch badge when applicable.
- Filters remain interactive controls (search, media, group, rewatches).

### Profile (`/profile`) — cinema

- Quiet **figures** (no dashboard cards).
- Secondary stats with cyan left rule.
- Open lists for top shows/movies/genres.
- Recent history as borderless archive rows.

### Year Recap (on Profile) — cinema

- Full-bleed dark band consistent with the page.
- Cyan top rule on share surface.
- Display typography for headline stats.
- Copy / Share actions.

### Watchlist / Settings / Social / Privacy — cinema

- Same cinema tokens and chrome as discovery surfaces; keep existing IA.

## Required UI states (unchanged contracts)

Figma must still cover ResourceAlignment states:

- General: loading, empty, error, retry, signed-out, offline
- Progress writes: idle, pending, success, failure+rollback, duplicate blocked, partial batch, retry
- Episode gap / previous-episode choice behavior

## Figma sync checklist

Use this as the definition of “Figma reflects final behavior” for Cinema Memory:

- [ ] Tokens page: cinema color styles named to match CSS variables
- [ ] Text styles: Sora display + Source Sans 3 body (+ CJK note)
- [ ] Auth frames (desktop + mobile) match underline/cyan-panel treatment
- [ ] Home: CW first band; discovery below fold
- [ ] Detail: bleed hero, icon rail, progress rings
- [ ] Timeline: spine diary rows
- [ ] Profile: quiet figures + cinematic Year Recap band
- [ ] Dual-canvas documented on a cover / system page
- [ ] Reliability states still present (loading / error / pending)
- [ ] Diff reviewed against live https://episodera.web.app at tip `fb5cd08` (or later)

**Blocker:** Figma MCP write access may be unavailable (Starter plan limits). Manual designer update is the expected path; this file is the brief.

## Canva stakeholder talking points

Safe factual language for decks:

- Visual system **Cinema Memory** shipped on web MVP (D0–D3); all routes share one dark cinema canvas.
- Live at https://episodera.web.app.
- Core tracking, Continue Watching, timeline, profile, and Year Recap remain implemented.
- TV Time Import **code** shipped; Phase 1 **acceptance** still open — do not claim import is accepted or beta-complete.
- Tip-matched hosted Production Smoke for import closeout remains open unless a newer PASS is recorded.

Avoid: fabricated metrics, “TV Time clone”, unsupported revenue/adoption claims, presenting native apps as current scope.

## Implementation map

| Concern | Code |
| --- | --- |
| Tokens (single canvas) | `web/src/styles.css` |
| Canvas routing | `web/src/routes/paths.ts` (`canvasFromPath` → cinema), `web/src/App.tsx` |
| Fonts | `web/index.html` |
| Auth | `web/src/pages/AuthPage.tsx` |
| Landing | `web/src/pages/LandingPage.tsx`, `web/src/types/landing.ts` |
| Home / CW | `web/src/pages/DiscoveryPage.tsx`, `ContinueWatchingSection.tsx` |
| Detail | `web/src/pages/DetailPage.tsx`, `ProgressRing.tsx` |
| Timeline | `web/src/pages/TimelinePage.tsx` |
| Profile / Recap | `web/src/pages/ProfilePage.tsx`, `YearRecapCard.tsx` |

## Phase log

| Phase | Tip | Summary |
| --- | --- | --- |
| D0 | `2a8275d` | Tokens, fonts, dual canvas, cinematic auth |
| D1 | `3d939a6` | Home CW poster rail + denser discovery |
| D2 | `23fff70` | Detail bleed hero, icon rail, cyan rings |
| D3 | `fb5cd08` | Memory archive + cinematic Year Recap |
| D4 | (this doc) | Figma/Canva sync brief + alignment updates |
