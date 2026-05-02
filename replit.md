# IKUGAMES — Gamified Learning for COM4061

## Overview
Full-stack gamified learning platform for **COM4061 — System Analysis & Design** at Istanbul Kültür University. Dark futuristic cyberpunk aesthetic. **Have fun · Learn · Play.**

## Focus Mode (current)
The platform is currently focused exclusively on the **System Analysis & Design** course. Other topics remain in the database but are filtered out of the public API (`/api/topics` + `/api/topics/:id`). The 6 levels are now **genuinely fun arcade-style mini-games** (not quizzes) — no prior knowledge required. Each level shows a brief definition + how-to-play card, then drops the player into the game.

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
4. **1 Focus Topic (public)** — System Analysis & Design only. (Other 5 topics still exist in DB, hidden via API filter `isSADTopic` in `server/routes.ts`.)
5. **Arcade-Style SAD Games — Per-Question Mini-Stages** (all in `client/src/components/sad-games.tsx`, dispatched via `SADGameRunner`). Each seeded question is now its own playable mini-stage with its own card / score / XP / checkpoint. URL routing: `/game/:id?stage=N`. Difficulty ramps within each game via `difficulty = stageIndex / (totalStages - 1)` (0..1) → EASY / NORMAL / HARD / EXPERT pill (`difficultyLabel(d)`). Each game scales spawn rate, speed, hit window, hearts, and timer with `difficulty`. Topic page shows 4-up stage chips per SAD level with shimmer-on-completed and primary-border-on-next-up. Backend stores one row per (`userId`, `levelId`, `stageIndex`) — see Per-Stage Progress below. Each game binds directly to seeded question data (`q.content`, `q.answer`, `q.options`) — no random hardcoded content. All games share a small infra layer:
   - `useGameLoop(cb, active)` — single rAF, stable callback ref (no restart on every state change), dt-clamped on tab-switch.
   - `useHowTo(key)` — first-run tutorial overlay, dismissed once and persisted to localStorage (`eduquest_howto_<gametype>`).
   - `usePause(enabled)` — Esc key toggles a `<PauseOverlay>` with Resume / Skip-round buttons.
   - `<RoundHeader>`, `<RoundSummary>` (correct/wrong + `options.explanation` + Next), `<JuiceBurst>` (8-particle pulse on correct hits), `<ScreenShake>` (on wrong hits / damage).
   - `<HowToOverlay>` shows goal + control hints + "Got it" before round 1.
   - **Phase Runner** (`sdlc_sorter`) — Lane runner. Lane count = `options.phases.length` (4–6). Each spawned deliverable is labeled with the phase of its lane; player switches into the matching lane to collect. Bugs cost a heart AND missed deliverables also cost a heart (5 hearts on easy → 3 on expert). On timer-end, deliverables still on-screen are subtracted from target so they don't count as missed. Win at ≥80% caught.
   - **Spec Highway** (`req_sorter`) — 3D-perspective neon highway (`RequirementHighway`). Requirement cards spawn far back and travel toward the camera via CSS perspective + `translate3d(z)`. Player slams each into matching bin: ←/A = Functional ⚙️, →/D = Non-Functional 📊 (also tap left/right side). Closest un-decided card gets the verdict. 5 hearts (3 on expert); wrong sort OR card hitting camera = -1 heart. Combo bonus +5 every 3 in a row. Win at ≥60% sorted correctly.
   - **Use Case Defense** (`usecase_builder`) — Pre-game lineup screen lists `options.actors` and which `options.useCases[]` each handles. Then a finite wave: one enemy per use case (shuffled), labeled with the use-case text, marching toward the base. Player selects an actor in the toolbar and taps the enemy. Combo system; base HP = 2.
   - **ER City Builder** (`erd_doctor`) — One round per question. Two entity buildings (`options.left`/`options.right`) on a road. Tap 1:1 / 1:N / N:N then Connect. Correct answer triggers a traffic animation matching the cardinality (1 car for 1:1, multiple one-way for 1:N, both ways for N:N). Two attempts before reveal.
   - **Data Flow Plumber** (`dfd_detective`) — Renders `options.nodes` in 4 columns by `type` (source / process / store / sink) with `options.existingFlows` as labeled gray arrows. Player taps FROM-node then TO-node to draw the missing flow (`options.missingLabel`); validated against `correctFrom`/`correctTo`. Two tries then answer reveals.
   - **Sequence Rhythm** (`sequence_stacker`) — Lanes = `options.objects` (3–4). Each `options.steps[]` entry becomes a falling note routed to the lane of the step's last-mentioned actor (parsed via word-boundary regex, e.g. "AuthService asks Database…" → Database lane). Hit window: ~18% (Perfect inside 6%). Keys D/F/J/K + arrow keys + tap. Combo doubles bonus; win at 70% notes hit.
   - Each game still shows the host intro card (definition `SAD_GAMES[type].short`, did-you-know `detail`, how-to-play `howTo`) before play, and the in-game `<HowToOverlay>` once.
   - Legacy quiz games (Wordle, Matcher, Emoji Cipher, Speed Blitz, Bubble Pop, Memory Flip) are kept in `game.tsx` for back-compat. SAD-side allowlist (`SAD_VISIBLE_GAMES` in `server/routes.ts`) hides `bubble_pop` and `speed_blitz` levels from `/api/topics` and `/api/topics/:id`, but keeps `memory_flip` and `wordle` (`SAD Memory Flip` L6, `SAD Vocab Wordle` L7) — both kept by user request. The Next Stage button in `game.tsx` `goToStage()` uses `window.history.pushState` + direct state reset because wouter's `useLocation` only watches the pathname, not the `?stage=` query string.
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
- **System Analysis & Design** topic with 6 play-to-learn levels (seeded by `seedSADPlayToLearn()` in `server/seed.ts`, idempotent via gameType count check). The seeder also wipes any legacy quiz-style SAD levels (and their questions + user_progress rows) on first run.
- Other 5 topics still exist in the DB (Programming, Data Structures, Database, Networks, Software Engineering) but are hidden by the public API filter.
- 20 badges, 14 cosmetics — unchanged.
- Seed guards: all seeders skip if data already exists.

## Run
```bash
npm run dev  # starts Express + Vite on port 5000
```

## Per-Stage Progress (race-safe)
- `user_progress` is keyed by composite **unique index** `(user_id, level_id, stage_index)` (`shared/schema.ts`). Drizzle-kit push applied.
- `storage.saveProgress` uses atomic `INSERT … ON CONFLICT DO UPDATE` with `GREATEST(score, EXCLUDED.score)`, `completed OR EXCLUDED.completed`, and `COALESCE(completedAt, EXCLUDED.completedAt)` so score is monotonic, completion is sticky-true, and the first-completion timestamp is preserved on replays.
- `storage.runWithProgressLock(userId, levelId, fn)` wraps `fn` in a Postgres transaction with a transaction-scoped advisory lock keyed on `hashtextextended(userId|levelId, 0)`. `/api/progress` runs the entire pre-read → save → reward → user-XP/coin update inside this lock, so concurrent submits for the same user+level cannot both classify themselves as the first completion (no double XP/coin) or both fire the level-clear bonus.
- `/api/progress` server-side **clamps** incoming `stageIndex` to `[0, totalStages-1]` (defense in depth — `game.tsx` also clamps before submitting), preventing fabricated out-of-range rows.
- `/api/topics` and `/api/topics/:id` now expose per-level `questionCount`. `topic.tsx` / `dashboard.tsx` / `courses.tsx` use it to compute "level fully completed" as `distinct completed stage indexes >= questionCount`, not raw row count.
- Reward math (`/api/progress`): `stageXp = ceil(level.xpReward / totalStages)`, `stageCoins = ceil(level.coinReward / totalStages)`. First completion of a stage → full stage reward. Replay → 25% of stage reward. Level-clear (every stage cleared for the first time) → +25% of full level reward as bonus. Response shape: `{ progress, xpGained, coinsGained, stageIndex, totalStages, isFirstStageCompletion, isLevelFullyCompleted, justFinishedLevel, user, newBadges }`.
