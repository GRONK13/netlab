# NetLab

Packet Tracer-style Cisco IOS practice labs in the browser, live at https://netlab.dcism.org. See README.md for setup and the CI/CD flow.

## Layout
- `packages/sim`: IOS simulator (parser, devices, show output, ping/tracert, end-device commands, web model, grader checks, device catalog). Pure TypeScript, deterministic: no clocks or randomness, because the server replays command logs to grade.
- `packages/labs`: lab definitions and XP rules. Reference solutions live in `test/` so they never ship to browsers.
- `apps/server`: Fastify API, plain SQL migrations in `src/db.ts` (append only).
- `apps/web`: React + Vite UI. Design system in `src/styles.css` ("patch panel": paper/ink, one orange accent, IBM Plex).

## Commands
- `npm run dev`: API on :3001 (PGlite) + web on :5173
- `npm test`, `npm run typecheck`, `npm run build`
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
