# NetLab

Packet Tracer-style Cisco IOS practice labs in the browser, with graded objectives, XP, levels and a leaderboard. Built for CCNA prep and hosted at **netlab.dcism.org**.

Students type real IOS commands (`conf t`, `int range fa0/1 - 4`, `sw acc vl 10`, `?`, Tab) into a simulated switch, router or PC. Objectives tick live as they work. When they submit, the server replays their command log through the same simulator and awards XP only if every objective passes.

## How it works

```
packages/sim     IOS simulator in TypeScript: command parser, devices, show output, ping engine, grader checks
packages/labs    Lab definitions (topology, briefing, objectives, hints) and XP/level rules
apps/web         React + Vite UI: dashboard, lab page (topology + xterm.js consoles), leaderboard
apps/server      Fastify API: accounts, sessions, attempts, server-side grading, XP, leaderboard
```

- The simulator runs **in the browser**, so typing is instant and the shared server barely works.
- Grading is **replayed on the server** from the command log, so editing browser code can't fake a pass.
- Each hint costs 10% of the lab's XP. XP is awarded once per lab.

## Develop

Needs Node 24+.

```bash
npm install
npm run dev        # API on :3001 (embedded PGlite database in .data/) + web on :5173
npm test           # simulator, labs and API tests
npm run typecheck
```

Open http://localhost:5173 and create an account. Locally, any email can register unless `ALLOWED_EMAIL_DOMAIN` is set.

## Add a lab

1. Create `packages/labs/src/labs/<name>.ts` (copy an existing lab): topology, briefing, objectives, 3 hints.
2. Add it to `LABS` in `packages/labs/src/index.ts`.
3. Add a reference solution to `packages/labs/test/solutions.ts`. The tests check that it passes every objective and that a fresh lab doesn't.

Available checks are in `packages/sim/src/checks.ts`. New IOS commands go in `packages/sim/src/ios.ts`.

## Deploy to netlab.dcism.org

On the school server (no root needed):

```bash
git clone <repo-url> ~/netlab.dcism.org
cd ~/netlab.dcism.org
cp .env.example .env && chmod 600 .env   # fill in PORT, DATABASE_URL, ALLOWED_EMAIL_DOMAIN
npm ci
npm run build
npm run db:migrate -w @netlab/server
pm2 start ecosystem.config.cjs
pm2 save
```

Check it:

```bash
curl -s http://127.0.0.1:$PORT/api/health
curl -sI https://netlab.dcism.org
```

Update later with `git pull && npm ci && npm run build && pm2 restart netlab`. Migrations also run automatically when the server starts.

Make pm2 restart after a server reboot (once per account):

```bash
(crontab -l 2>/dev/null; echo "@reboot $(command -v pm2) resurrect") | crontab -
```
