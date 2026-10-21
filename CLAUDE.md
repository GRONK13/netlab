# NetLab

Packet Tracer-style Cisco IOS practice labs in the browser, live at https://netlab.dcism.org. See README.md for setup and the CI/CD flow.

## Layout
- `packages/sim`: IOS simulator (parser, devices, show output, ping/tracert, end-device commands, web model, grader checks, device catalog). Pure TypeScript, deterministic: no clocks or randomness, because the server replays command logs to grade.
- `packages/labs`: lab definitions and XP rules. Graded labs in `LABS`, guided practice in `PRACTICES`. Reference solutions live in `test/` so they never ship to browsers.
- `packages/modules`: learning modules (lessons, quiz pools, the subnetting trainer). Quiz answer keys live in `src/answers/`, exported only as `@netlab/modules/answers` for the server; a test fails if `apps/web` imports them.
- `apps/server`: Fastify API, plain SQL migrations in `src/db.ts` (append only). XP comes from the `xp_events` view.
- `apps/web`: React + Vite UI. Design system in `src/styles.css` ("patch panel": paper/ink, one orange accent, IBM Plex).
- `e2e/`: Playwright browser tests (CI gates deploys on them). `scripts/`: deploy, nightly backup, restore check. `specs/`: feature specs.

## Commands
- `npm run dev`: API on :3001 (PGlite) + web on :5173
- `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e` (build + browser tests)
- Prettier only on new files: much existing code isn't formatted to `.prettierrc`, so formatting folders reflows untouched lines.
- Pushing to `main` deploys to production in about a minute (CI promotes to the `deploy` branch; the server's cron pulls it). Ask before pushing.

## Rules
- GUI actions that change device state must go through a CLI command in the command log (e.g. IP Configuration sends `ipconfig ...`), so grading stays replayable.
- Never commit secrets. The server's `.env` holds `DATABASE_URL`; never print or echo its password.

## Documentation (every session)
All project documentation lives in the Obsidian vault, folder `NetLab Project/`, starting at `00 NetLab Overview`. At the end of every work session, before wrapping up, follow the checklist in that note:
1. Add a `Log/` entry from `_templates/NetLab log` (goal, did, tools used, learned, broke and fixed, evidence, next).
2. Add shipped commits to `08 Changelog`.
3. Record decisions in `07 NetLab Decisions`.
4. Update `03 Features`, `05 Roadmap`, and the overview's Quick facts (version, test count, size).
5. Add problems to `09 Problems and Fixes`, and résumé-worthy results to `06 Portfolio and Resume`.

## Progress
Detail and dates are in Obsidian `05 Roadmap`; this is the short version. Tick items here when they ship.
- [x] MVP, CI/CD with rollback, PostgreSQL, workspace redesign, sandbox, PC desktop (2026-10-20)
- [x] Phase 0 safety net: nightly verified backups, browser tests in CI (2026-10-20)
- [x] Module 1, IP Addressing and Subnetting: lesson, guided practice, trainer, quiz, challenge (2026-10-20)
- [x] Clear Submit result dialog in labs (2026-10-21)
- [x] Module 2, Switching and VLANs: lesson, guided practice, quiz, challenge (2026-10-21)
- [x] Module 3, Inter-VLAN Routing: lesson, guided practice, quiz, challenge (2026-10-21)
- [ ] Module 4, Device security
- [ ] Goals, streaks, badges, mastery per CCNA domain
- [ ] Phase 2: static routing, DHCP, ACLs, NAT

## Skills
Before starting a roadmap item, check `10 Skills Playbook` in the same folder for the skills to load. Always run `/code-review` before asking to push, and `/security-review` when a change touches sign-in, API routes or the database.
