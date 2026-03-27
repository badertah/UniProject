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
4. **6 Topics** — System Analysis, Programming, Data Structures, Database, Networks, Software Engineering
5. **3 Mini-games per topic**:
   - Wordle-style keyword guesser (5-letter words, 6 attempts)
   - Definition Matcher (click-to-pair, shuffle mechanic)
   - Emoji Cipher (multiple choice, 4 options, hint system)
6. **Cosmetics Shop** — 14 items (avatars, frames, themes), purchase/equip with EduCoins
7. **Global Leaderboard** — top 20, podium display for top 3
8. **Profile Page** — tier progression, stats, equipped cosmetics
9. **Admin Panel** — create topics/levels/questions (admin/admin123)

## Design
- Dark futuristic cyberpunk with neon purple + electric blue
- Glassmorphism panels, neon glow utilities
- Oxanium font (headings), Fira Code (monospace)
- Forced dark mode via `html { @apply dark; }`
- Custom CSS: `.glass`, `.glass-strong`, `.neon-purple`, `.neon-blue`, `.cyber-grid`, `.wordle-*`, `.tier-*`, `.rarity-*`

## Pages
- `/auth` — Login/Register (cyberpunk terminal aesthetic)
- `/dashboard` — Overview, stats, course preview, leaderboard preview
- `/courses` — All 6 topic cards with progress
- `/courses/:id` — Topic detail with 3 levels
- `/game/:id` — Game play (detects game type, renders correct mini-game)
- `/leaderboard` — Full leaderboard with podium
- `/shop` — Cosmetics grid with preview modal
- `/profile` — Tier progression, stats, achievements
- `/admin` — Admin panel (topic/level/question creation)

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
- Admin: `POST /api/topics|levels|questions`

## Seed Data
- Admin user: `admin` / `admin123`
- 8 seeded leaderboard players
- 6 topics × 3 levels × questions for all game types
- 14 cosmetics (common/rare/epic/legendary)

## Run
```bash
npm run dev  # starts Express + Vite on port 5000
```
