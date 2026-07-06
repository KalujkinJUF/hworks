---
name: token-optimization
description: Workflow for working on the voidtree project with minimal token usage. Use when a task touches many files, when context is getting long, when reading large files (package-lock.json, migrations.sql, logs, uploads), or whenever the user asks to work "efficiently", "cheaply", or "save tokens". Applies to this Express/MySQL/Tauri repo specifically.
---

# Token-Efficient Work on voidtree

Goal: get the same result while reading and emitting far fewer tokens. Follow these rules in order of impact.

## 1. Never read whole large files
These files are big and rarely need full reads — target them:
- `package-lock.json` (~80 KB) — never Read it. Use `Grep` for a package name, or `npm ls <pkg>`.
- `migrations.sql`, `initDb.js` — Grep for the table/column instead of reading top-to-bottom.
- `db-error.log`, `crash.log`, `public/uploads/*` — Grep/tail for the relevant line; never dump.
- `public/*.js` frontend bundles — read only the function you need with `offset`/`limit`.

Rule of thumb: if you only need one symbol, `Grep` for it with `-n` and read a ±20 line window, not the file.

## 2. Search before reading
- Use `Grep` (ripgrep) with `glob`/`type` filters to locate code, then open only the matched region.
- Use `Glob` to find files by name instead of `ls`-walking directories.
- For "where is X handled" questions, one `Grep` across `routes/ models/ middleware/` beats reading each route file.

## 3. Batch independent tool calls
Send parallel `Read`/`Grep`/`Bash` calls in a single message when they don't depend on each other (e.g. reading `auth.js` + `csrf.js` + `rbac.js` at once). This is faster and avoids re-establishing context per round-trip.

## 4. Prefer targeted edits over rewrites
- Use `Edit` with a minimal unique `old_string`; never re-Write a whole file to change a few lines.
- Don't re-read a file right after editing it — the harness already confirmed the change.

## 5. Delegate big fan-out searches to a subagent
Only when the user asks, or the search spans the whole tree and you need just the conclusion: spawn the `Explore` agent. It reads excerpts and returns findings, keeping bulky file dumps out of the main context.

## 6. Keep responses lean, not cryptic
- Answer the question first, then supporting detail. Drop options you won't pursue.
- Don't paste large code blocks back to the user — reference `file_path:line` instead.
- Skip narrating routine steps; report load-bearing findings only.

## 7. Context hygiene
- Don't re-derive facts already established earlier in the session.
- When exploring an unknown area, form a hypothesis and verify with one query rather than reading broadly "to be safe".

## Quick reference — where things live
| Concern | File(s) |
|---|---|
| App entry / server | `app.js`, `main.js` |
| Routes | `routes/{admin,friend,message,user}Routes.js` |
| Data model | `models/user.js` |
| Auth / security middleware | `middleware/{auth,csrf,rbac,fileUpload}.js` |
| Crypto, DB, mail, logging | `config/{crypto,db,mailer,logger}.js` |
| DB schema | `initDb.js`, `migrations.sql` |
| Frontend pages | `public/*.html` + matching `public/*.js` |
| Desktop shell | `client/src-tauri/` |
