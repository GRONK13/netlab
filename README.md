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
npm run e2e        # build, then browser smoke tests (first time: npx playwright install chromium)
```

Open http://localhost:5173 and create an account. Locally, email sign-up stays open (any email, unless `ALLOWED_EMAIL_DOMAIN` is set), so you don't need Google or GitHub keys to develop.

## Add a lab

1. Create `packages/labs/src/labs/<name>.ts` (copy an existing lab): topology, briefing, objectives, 3 hints.
2. Add it to `LABS` in `packages/labs/src/index.ts`.
3. Add a reference solution to `packages/labs/test/solutions.ts`. The tests check that it passes every objective and that a fresh lab doesn't.

Available checks are in `packages/sim/src/checks.ts`. New IOS commands go in `packages/sim/src/ios.ts`.

## CI/CD

```
push to main ──► GitHub Actions: typecheck, test, build, browser smoke tests ──► green? push commit to `deploy` branch
                                                                   │
netlab.dcism.org: cron runs scripts/deploy.sh every 2 min ◄────────┘
  fetch `deploy` → npm ci (if lockfile changed) → build → pm2 restart → health check → roll back on failure
```

- **Ship a change:** push to `main` (or merge a pull request). It's live about 2 minutes after CI passes.
- **Pull requests** run the same checks but never deploy.
- **A failed deploy** rolls back to the last good commit and isn't retried. Push a fix, or run `scripts/deploy.sh --force` on the server.
- **Deploy log:** `tail -f ~/netlab.dcism.org/.data/deploy.log`
- The server pulls with a read-only deploy key (`~/.ssh/netlab_deploy`, host alias `github-netlab`), so GitHub never holds credentials for the server.

## Deploy to netlab.dcism.org

First-time setup on the school server (no root needed). After this, CI/CD handles updates.

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

Migrations run automatically when the server starts.

Then add the cron jobs (auto-deploy, and pm2 restart after a server reboot):

```bash
(crontab -l 2>/dev/null; echo "*/2 * * * * $HOME/netlab.dcism.org/scripts/deploy.sh"; echo "@reboot $(command -v pm2) resurrect") | crontab -
```

## Sign in with Google and GitHub

New accounts sign up with Google or GitHub; existing email-and-password accounts keep working. A provider appears on the sign-in page once both of its values are in `.env`, and email sign-up closes at the same time (NetLab can't send verification or password-reset emails).

**Google** ([Google Cloud Console](https://console.cloud.google.com/)):
1. Create a project, then open **APIs & Services → OAuth consent screen**. Choose **External**, app name "NetLab", your support email, and only the `openid`, `email` and `profile` scopes. Publish the app.
2. **Credentials → Create credentials → OAuth client ID → Web application**, with the authorized redirect URI `https://netlab.dcism.org/api/auth/google/callback`.
3. Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**GitHub** (**Settings → Developer settings → OAuth Apps → New OAuth App**):
1. Homepage URL `https://netlab.dcism.org`, authorization callback URL `https://netlab.dcism.org/api/auth/github/callback`.
2. Generate a client secret, and put both values in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

Then restart: `pm2 restart netlab --update-env`. Secrets live only in the server's `.env`, never in git.

## Moderation

Students can rename themselves and delete their accounts from the Progress page. To deal with a rude or impersonating name, run on the server:

```bash
node scripts/admin.ts find <text>              # accounts whose email or name contains text
node scripts/admin.ts rename <email|id> <name> # change a display name
node scripts/admin.ts hide <email|id>          # keep an account off the leaderboard
node scripts/admin.ts unhide <email|id>
```

## Backups

`scripts/backup.ts` dumps the database nightly to `~/backups/netlab/netlab-YYYY-MM-DD.sql.gz` (owner-only permissions, newest 14 kept). Every Sunday `scripts/restore-check.ts` loads the newest backup into a throwaway in-memory database and counts every table's rows, so a broken backup gets noticed. Both log to `.data/backup.log`.

```bash
(crontab -l; echo "30 2 * * * cd $HOME/netlab.dcism.org && node scripts/backup.ts >> .data/backup.log 2>&1"; echo "45 2 * * 0 cd $HOME/netlab.dcism.org && node scripts/restore-check.ts >> .data/backup.log 2>&1") | crontab -
```

Restore into an empty Postgres database. psql asks for the password, which keeps it out of the process list on the shared server:

```bash
gunzip -c ~/backups/netlab/netlab-YYYY-MM-DD.sql.gz | psql -h 127.0.0.1 -U <db-user> -d <db-name>
```

Keep a copy off the server, from your own computer: `scp 'ver:backups/netlab/*.sql.gz' .`
