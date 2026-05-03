# Threat Model

## Project Overview

IKUGAMES is a full-stack gamified learning platform for COM4061 System Analysis & Design. The production stack is React 18/TypeScript/Vite on the client, Node.js/Express on the backend, PostgreSQL via Drizzle ORM, and custom JWT authentication stored by the browser in `localStorage` under `eduquest_token`. Users can register/login, play course mini-games, earn XP/EduCoins/badges, buy/equip cosmetics, appear on leaderboards, and use a farm mini-game. Admin users can manage course content and users.

Production assumes `NODE_ENV=production`; the Vite dev server, mockup sandbox behavior, and development-only tooling are out of scope unless proven reachable in production. Replit deployment provides TLS for client/server traffic.

## Assets

- **User accounts and JWTs** -- usernames, password hashes, JWT bearer tokens, admin status, streaks, XP, EduCoins, badges, cosmetics, and progress records. Compromise allows impersonation, privilege escalation, or manipulation of gamified learning state.
- **Admin privileges and course content** -- admin APIs can create/update/delete topics, levels, questions, and alter user balances/admin flags. These actions must be restricted to legitimate admins.
- **Game economy and progress integrity** -- XP, EduCoins, badge awards, level completion, farm rewards, and minigame rewards are business-critical state. The server must not trust client-supplied reward amounts or completion claims without validation.
- **Database contents and application secrets** -- PostgreSQL data, `DATABASE_URL`, JWT signing secret (`SESSION_SECRET`), password hashes, and deployment environment variables.
- **Public learning content and leaderboard data** -- content and leaderboard responses are public by design, but should not leak secrets, password hashes, tokens, or unnecessary private metadata.

## Trust Boundaries

- **Browser to Express API** -- all API input from the browser is untrusted. The server must authenticate, authorize, validate, and constrain every state-changing request.
- **Authenticated user to admin boundary** -- `/api/admin/*`, content creation/update/delete routes, and user management routes require server-side admin authorization.
- **Express API to PostgreSQL** -- database access is trusted only through server code. SQL must be parameterized; schema migrations/seeders should not introduce production credentials or destructive startup behavior.
- **Client game logic to server rewards** -- minigame, farm, progress, and badge endpoints cross from fully user-controlled client state into persistent economy/progress state.
- **Server logs and operational visibility** -- API request/response logging can cross from sensitive runtime data into logs; tokens, password hashes, and credentials must not be logged.
- **Production vs development** -- Vite development middleware, Replit dev banners, and mock/experimental assets are out of production scope unless exposed with `NODE_ENV=production`.

## Scan Anchors

- Production entry points: `server/index.ts`, `server/routes.ts`, `server/storage.ts`, `server/static.ts`, `shared/schema.ts`, `client/src/lib/queryClient.ts`, `client/src/hooks/use-auth.tsx`.
- Highest-risk routes: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/progress`, `/api/minigame/reward`, `/api/farm/harvest`, `/api/coins/spend`, `/api/cosmetics/*`, `/api/admin/*`, and content CRUD routes in `server/routes.ts`.
- Public surfaces: `/api/topics`, `/api/topics/:id`, `/api/leaderboard`, static React app assets.
- Authenticated surfaces: levels, progress, badges, cosmetics, farm/minigame economy endpoints.
- Admin surfaces: topic/level/question CRUD and `/api/admin/users*`; admin UI in `client/src/pages/admin.tsx` is only a convenience layer and is not a security boundary.
- Dev-only areas usually ignored: Vite middleware in `server/vite.ts`, development scripts, Replit plugins, mockup/experimental sandbox assumptions, and `node_modules` implementation internals.

## Threat Categories

### Spoofing

JWT authentication protects user and admin APIs. The application must use a high-entropy production-only JWT signing secret, reject forged/expired tokens, and avoid default credentials. Login and registration should resist brute force and credential stuffing. Admin status must come only from trusted database state, not client-controlled claims.

### Tampering

Client-side game state, farm state, scores, completion flags, XP, coin amounts, and admin form inputs are all attacker-controlled. The server must compute rewards and enforce upper/lower bounds, ownership checks, uniqueness, and race safety. Server-side validation must protect content CRUD and user-management APIs from invalid or abusive values.

### Repudiation

Admin actions and economy-changing operations materially affect learning state. Sensitive operations should be logged in a way that identifies the acting user and action without recording secrets such as JWTs or password hashes. Logs should support investigation while avoiding token leakage.

### Information Disclosure

API responses and logs must not expose passwords, bearer tokens, environment secrets, stack traces, or unnecessary private account metadata. Public endpoints should return only intended public profile/leaderboard fields. Operational logs must not capture full auth responses containing JWTs.

### Denial of Service

Authentication, reward, farm, and public listing endpoints should resist automated abuse. Request body sizes, expensive database operations, and endpoints that can be called in tight loops need appropriate limits, validation, and rate limiting.

### Elevation of Privilege

Admin routes must enforce server-side authorization on every request. Hardcoded/default JWT secrets or seeded default admin credentials would allow attackers to become admins. SQL injection, unsafe raw SQL, and insecure startup seeders/migrations could also undermine database integrity or privileges.