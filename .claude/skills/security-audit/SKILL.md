---
name: security-audit
description: Advanced defensive security audit of the voidtree codebase — finding vulnerabilities in the user's own Express/MySQL/JWT/Tauri app. Use when the user asks to find security holes, audit auth, check for injection/XSS/CSRF/IDOR, review file uploads, harden the API, or review a security-sensitive change. This is authorized review of the owner's own system.
---

# Security Audit — voidtree (authorized, owner's own system)

This is a defensive audit of the project owner's own application. Goal: find real, exploitable weaknesses and propose concrete fixes with `file:line` references. Report findings ranked by severity (Critical → High → Medium → Low), each with: what, where, how it's exploited, and the fix.

## How to run an audit
1. Scope the pass (full audit vs. one area vs. current diff).
2. Grep-driven sweep per category below — don't read whole files, target the risky patterns.
3. For each hit, confirm it's reachable (traced from a route) before flagging. Distinguish CONFIRMED (traced end-to-end) from PLAUSIBLE (pattern match, unverified).
4. Deliver a ranked report; offer to fix the top items.

## Stack-specific checklist

### 1. SQL injection (uses `mysql` driver — string concat is the main risk)
- Grep: `query\(` `\.query`  and look for `+`, template literals `${`, or `.replace` building SQL.
- Confirm every query uses `?` placeholders / parameterized values. The `mysql` lib does NOT auto-escape interpolated strings.
- Check `models/user.js`, all `routes/*.js`, `initDb.js` dynamic queries.

### 2. AuthN / JWT (`jsonwebtoken`, `middleware/auth.js`)
- Verify `jwt.verify` is used (not `decode`), with an explicit algorithm allowlist (guard against `alg:none` / algorithm confusion).
- Secret sourced from env, not hardcoded; check `.env`/`config` for a weak/default `JWT_SECRET`.
- Token in httpOnly + Secure + SameSite cookie (commits mention https/webview2 cookie work — verify flags).
- Expiry set and enforced; no accepting expired tokens.

### 3. AuthZ / IDOR (`middleware/rbac.js`)
- For every route that reads/writes a resource by id (messages, friends, profiles, admin), confirm ownership/role is checked — not just "is logged in".
- `routes/adminRoutes.js`: confirm admin gate is applied to every handler, not just some.
- Classic bug: `GET /messages/:id` returning another user's data because only auth (not ownership) is checked.

### 4. CSRF (`middleware/csrf.js`, `public/csrf.js`)
- Confirm state-changing routes (POST/PUT/DELETE) require the CSRF token and that it's validated server-side, not just issued.
- Check SameSite cookie interplay so protection isn't silently bypassed in the Tauri/webview2 context.

### 5. XSS (frontend `public/*.js`, `sanitize-html`)
- Grep frontend for `innerHTML`, `insertAdjacentHTML`, `document.write` — user content rendered without escaping.
- Confirm `sanitize-html` is applied to stored user content (profile, messages, chat) on input or output, with a strict allowlist.

### 6. File upload (`middleware/fileUpload.js`, `multer`, `file-type`, `sharp`, `public/uploads/`)
- Validate real content type with `file-type` (magic bytes), not just extension / `mimetype` header.
- Enforce size limits and a strict extension allowlist; randomize stored filenames (no path traversal via original name).
- Ensure `public/uploads/` cannot serve executable/HTML content inline (content-type + `X-Content-Type-Options: nosniff`).
- Re-encode images via `sharp` to strip embedded payloads.

### 7. Password & crypto (`bcryptjs`, `config/crypto.js`)
- bcrypt cost factor >= 10; passwords never logged.
- Review the email encryption/hashing migration (recent commits) — confirm keys come from env, IVs are random per-record, and no ECB mode.
- No secrets committed: check `.env` isn't tracked (`.gitignore`), scan for hardcoded keys.

### 8. Transport & headers (`helmet`)
- Confirm `helmet()` is actually mounted in `app.js` before routes, with a sensible CSP.
- CORS (`cors`): check origin is an allowlist, not `*` with credentials.

### 9. Rate limiting & abuse (`express-rate-limit`)
- Login, register, password-reset, and email endpoints must be rate-limited (brute-force / enumeration).
- Check user-enumeration: login/reset should not reveal whether an account exists.

### 10. Info leakage & error handling
- `uncaughtException` in `main.js` writes stack to `crash.log` — ensure such files aren't web-served and don't leak to clients.
- Errors returned to clients must be generic; stack traces stay server-side (`config/logger.js`).
- Check `db-error.log`, `crash.log` are gitignored and outside `public/`.

## Reporting format
For each finding:
- **[Severity] Title** — `file.js:line`
- **Impact:** what an attacker gains.
- **Exploit:** concrete steps/input.
- **Fix:** minimal, specific change.

## Boundaries
Defensive review only. Do not build live attack tooling against third parties, add backdoors, or write malware. Findings and remediation for the owner's own app are in scope; anything targeting systems the user doesn't own is not.
