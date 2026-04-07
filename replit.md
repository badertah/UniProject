# EduQuest — Gamified Educational App

## Overview
Full-stack gamified educational web app with a dark futuristic cyberpunk aesthetic.

## Stack
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Node.js/Express (tsx, same port)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Custom JWT (localStorage key: `eduquest_token`)
- **Animations**: Framer Motion
- **UI**: shadcn/ui + Tailwind CSS

## Architecture
- `client/src/` — React frontend
- `server/` — Express backend (index.ts, routes.ts, storage.ts, db.ts, seed.ts)
- `shared/schema.ts` — Drizzle schema + Zod validators

## Key Features
1. **JWT Auth** — register/login without email, streak bonuses on daily login
2. **XP/Level system** — level = floor(xp/150)+1
3. **Tier system** — Rookie (0) → Scholar (500) → Expert (1500) → Master (3500) → Legend (7000)
4. **6 Topics** — all freely selectable, no locking; System Analysis, Programming, Data Structures, Database, Networks, Software Engineering
5. **6 Mini-games per topic** (3 original + 3 new):
   - Wordle: 5-letter keyword guesser (6 attempts, keyboard + on-screen)
   - Matcher: click-to-pair terms and definitions (shuffle mechanic)
   - Emoji Cipher: multiple choice 4-option clue decoder
   - Speed Blitz: rapid-fire quiz with 9-second countdown timer (SVG circle), score based on speed
   - Bubble Pop: floating term bubbles in a dark arena — pop the right one for the definition shown at top
   - Memory Flip: 4×4 card grid (8 pairs), 3D flip animation, match terms to definitions
6. **Cosmetics Shop** — 14 items (avatars, frames, themes), purchase/equip with EduCoins; emoji avatar previews, frame corner accents, swatch grids for themes; rarity shimmer effects; detail modal
7. **Badges System** — 20 badges across 5 categories (XP milestones, streaks, levels completed, game type achievements); auto-awarded on progress save and login; `/badges` page with filter, progress bar, tooltip previews
8. **Global Leaderboard** — top 20, podium display for top 3
9. **Profile Page** — tier progression, stats, equipped cosmetics
10. **Admin Panel** — full 4-tab panel: Question Editor (browse topic→level→questions inline, edit/delete each question or level), Create Content (new topics/levels with all 6 game types), Users (view/edit all users, promote to admin), Badges overview
11. **Farm Tycoon 2.5D Isometric** — immersive full-viewport isometric farm game (`/farm`): isometric diamond-tile layout (4 cols × 3 rows) with `isoPos(col,row)` projection; diamond ground plots colored by category (crops=brown, livestock=green, buildings=grey, equipment=blue-grey); dirt road connectors between adjacent tiles; parallax sky with animated clouds, sun, birds; decorative trees/bushes/flowers around landscape; animated farm life (chickens walking, cows grazing, windmill spinning, tractor driving) gated by ownership; buildings rendered directly on terrain (no card borders) with floating name labels; hover effect lifts tiles with brightness boost; depth-sorted rendering by (col+row); game-style HUD with backdrop blur; bottom-sheet modal for building interaction; 30s passive income ticks; farm bank → Harvest → EduCoins (capped 500/harvest); offline income catch-up (max 20 ticks); state in localStorage `farm_v2_state`; SVG buildings use React `useId()` for unique gradient/filter IDs; `/api/farm/harvest` endpoint; responsive scaling via boardScale transform
12. **Display Settings** — (`/settings`) users can toggle visibility of: sidebar stats card, XP bar, streak, EduCoins, dashboard stats cards, leaderboard preview, quick play card, farm tab nav item. Stored in localStorage.

## Design
- Dark futuristic cyberpunk with neon purple + electric blue
- Glassmorphism panels, neon glow utilities
- Oxanium font (headings), Fira Code (monospace)
- Forced dark mode via `html { @apply dark; }`
- Custom CSS: `.glass`, `.glass-strong`, `.neon-purple`, `.neon-blue`, `.cyber-grid`, `.wordle-*`, `.tier-*`, `.rarity-*`

## Pages
- `/auth` — Login/Register (cyberpunk terminal aesthetic)
- `/dashboard` — Overview, stats, course preview, leaderboard preview (settings-responsive)
- `/courses` — All 6 topic cards with progress (all freely selectable)
- `/courses/:id` — Topic detail with 3 levels (all unlocked)
- `/game/:id` — Game play (detects game type, renders correct mini-game)
- `/leaderboard` — Full leaderboard with podium
- `/shop` — Cosmetics grid with preview modal
- `/profile` — Tier progression, stats, achievements
- `/badges` — Badge collection with filter (all/earned/locked, by rarity), progress bar, hover tooltips, and rarity shimmer
- `/admin` — Admin panel: Question Editor, Create Content, Users manager, Badges overview
- `/farm` — Farm Tycoon: narrative story with 12 XP-gated chapters + visual farm
- `/settings` — Display settings: toggle sidebar/dashboard elements, farm tab

## API Routes
- `POST /api/auth/register|login` — JWT auth
- `GET /api/auth/me` — Current user
- `GET /api/topics` — All topics
- `GET /api/topics/:id` — Topic with levels
- `GET /api/levels/:id` — Level with questions
- `POST /api/progress` — Save game progress (XP/coin rewards)
- `GET /api/progress` — User's progress records
- `GET /api/leaderboard` — Top 20 users
- `GET /api/cosmetics` — All cosmetics (with owned flag)
- `POST /api/cosmetics/purchase/:id` — Buy item
- `POST /api/cosmetics/equip/:id` — Equip item
- `POST /api/cosmetics/unequip` — Unequip item type
- `GET /api/badges` — All badges with earned status for current user
- `POST /api/badges/check` — Run badge check for current user
- `PUT|DELETE /api/questions/:id` — Edit or delete a question (admin)
- `PUT|DELETE /api/levels/:id` — Edit or delete a level (admin)
- `GET /api/admin/users` — All users (admin)
- `PUT /api/admin/users/:id` — Update user XP/coins/isAdmin (admin)
- `POST /api/topics|levels|questions` — Create content (admin)

## Seed Data
- Admin user: `admin` / `admin123`
- 6 topics × 6 levels = 36 levels (all game types covered)
- 20 badges (XP milestones, streaks, level completion, game type achievements)
- 14 cosmetics (common/rare/epic/legendary avatars/frames/themes)
- Seed guards: all seeders skip if data already exists

## Run
```bash
npm run dev  # starts Express + Vite on port 5000
```
