---
name: architecture-review
description: Advanced engineering and architecture guidance for the voidtree Express/MySQL/Tauri social network. Use when designing a new feature, refactoring, reviewing structure, deciding on patterns, addressing scalability/maintainability/tech-debt, or when the user asks for "architecture", "best practices", or "how should I build X". Focuses on this project's real layout.
---

# Architecture & Engineering — voidtree

Guidance for evolving this codebase (Express 5 + `mysql` + JWT + vanilla-JS frontend + Tauri shell) without accumulating debt. Give concrete, project-specific advice with trade-offs and a recommendation — not a generic survey.

## Current architecture (baseline)
- **Backend:** `app.js` wires Express; `routes/*` → thin handlers; `models/user.js` → data access; `middleware/*` → cross-cutting (auth, rbac, csrf, upload); `config/*` → db, crypto, mailer, logger.
- **Frontend:** multi-page vanilla JS in `public/` (one `*.js` per `*.html`), `i18n.js` for localization, `navbar.js`/`csrf.js` shared.
- **Desktop:** Tauri (`client/src-tauri`) wrapping the web app.
- **DB:** MySQL via callback-style `mysql` driver; schema in `initDb.js` + `migrations.sql`.

## Review lenses (apply in order)

### 1. Layering & separation of concerns
- Routes should stay thin: validate input → call a model/service → shape response. Push SQL and business rules down.
- Only `models/` exists today. As logic grows, introduce a `services/` layer so routes don't embed multi-step business logic. Flag routes that query the DB directly or contain branching business rules.
- Keep a single source of truth for DB access; avoid scattering `db.query` across route files.

### 2. Data layer health
- The `mysql` package is callback-based and unmaintained. For new work, standardize on a pooled, Promise-based client (`mysql2/promise`) to enable `async/await`, prevent connection exhaustion, and simplify error handling. Recommend migrating incrementally, model by model.
- Enforce parameterized queries everywhere (also a security invariant — see [[security-audit]]).
- Centralize schema evolution: every change goes through a numbered migration in `migrations.sql`, never manual DB edits, so `initDb.js` and prod stay in sync.

### 3. Error handling & resilience
- Express 5 supports async error propagation — use a single error-handling middleware instead of ad-hoc try/catch responses.
- Distinguish operational errors (return 4xx) from programmer errors (log + generic 500). Route all logging through `config/logger.js`; no stray `console.log`.
- `main.js` hard-exits on `uncaughtException`. For a server, prefer graceful shutdown (drain connections, flush logs) and a process manager (`pm2` is already in scripts) for restarts.

### 4. API design & consistency
- Consistent REST resource naming, status codes, and a uniform JSON envelope (`{ data }` / `{ error }`).
- Validate and normalize input at the boundary with a schema (e.g. a lightweight validator) rather than per-field manual checks.
- Version the API (`/api/v1`) before external clients depend on it.

### 5. Frontend structure
- The per-page vanilla-JS approach is fine at this size. Watch for duplicated fetch/auth/error logic across `public/*.js` — extract a shared `api.js` helper (base URL, CSRF header, 401 handling) to kill repetition.
- Keep `i18n.js` keys centralized; verify every user-facing string is localized (recent commits fixed localization bugs — make it a checklist item, not a recurring fix).

### 6. Configuration & secrets
- All environment-specific values via `.env` (already present) with `.env.example` kept in sync. No config in code.
- Separate dev/prod config; never ship dev CORS/CSP/rate-limit settings to prod.

### 7. Scalability & performance
- Add DB indexes for every column used in `WHERE`/`JOIN`/`ORDER BY` (friends lookups, message threads, user search). Verify before assuming.
- Paginate any list endpoint (messages, friends, search) — never return unbounded result sets.
- Use a connection pool sized to the DB's limits; avoid per-request connections.
- For chat/messaging, evaluate whether polling should become WebSockets as load grows (trade-off: complexity vs. latency/cost).

### 8. Testing & CI
- `npm test` is currently a stub. Add at least integration tests for auth, authz/IDOR, and upload paths — the highest-risk areas.
- A minimal CI that runs lint + tests + `npm audit` on each change prevents regressions and catches vulnerable deps.

### 9. Dependency & supply-chain hygiene
- Run `npm audit` periodically; keep security-relevant deps (`helmet`, `jsonwebtoken`, `bcryptjs`, `sharp`) current.
- Prefer maintained libraries; note `mysql` and `nodemailer` versions and plan upgrades.

## How to deliver a review
1. State the current state factually (cite `file:line`).
2. Identify the top 3–5 issues by impact, with the trade-off for each.
3. Give a recommended direction and a low-risk, incremental migration path — not a big-bang rewrite.
4. Note what to measure/verify before committing (indexes, query plans, load).

Related: security concerns → [[security-audit]]; doing this cheaply → [[token-optimization]].
