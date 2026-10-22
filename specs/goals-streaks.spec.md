# Feature: Goals, streaks, badges and mastery per CCNA domain

## Overview

Modules 1–4 teach and grade four CCNA topics, but nothing brings a student back tomorrow or shows how much of the CCNA they have covered. This adds a daily practice streak, a weekly goal of practice days, cosmetic badges, and a mastery meter for each of the six CCNA 200-301 domains.

Decided with the project owner on 2026-10-21:
- Any practice keeps a streak going, and one missed day a week is forgiven.
- The weekly goal is a number of practice days (2–5, default 3).
- Badges are cosmetic and give no XP, and levels are unchanged.
- Mastery is the share of each domain's content that's completed.
- Streaks and badge counts show on the leaderboard. There is no weekly board.

## Rules

- **Day.** A practice day is an Asia/Manila calendar day, measured by the database clock. Manila is UTC+8 with no daylight saving, so the day is the UTC time plus 8 hours.
- **Week.** A week runs Monday to Sunday.
- **Practice.** A day counts when the server records one of these:
  - a lab submit with at least one command;
  - a quiz or trainer round with at least one correct answer;
  - the first read of a lesson.

## Functional requirements

- **FR-001 Practice day.** When the server records practice for a student, it shall store that Manila day for the student, at most once per day.
- **FR-002 Streak.** The system shall show the student's current streak: the practice days in the current run.
  - Not having practised yet today shall not break it.
  - The first missed day in each week shall keep the run alive without adding to it.
  - A second missed day in the same week shall end the run.
- **FR-003 Longest streak.** The system shall show the longest run the student has ever had.
- **FR-004 Streak saver.** The system shall show whether this week's forgiven day has been used.
- **FR-005 Weekly goal.** When a student chooses a goal of 2 to 5 days, the server shall store it, and the system shall show this week's practice days against it.
- **FR-006 Goal met.** When a student's practice days in a week reach their goal, the server shall record that week as met, against the goal at that moment. A later goal change shall not remove it.
- **FR-007 Leaderboard streak.** The leaderboard shall show each listed student's current streak, and shall not expose user ids.
- **FR-008 Backfill.** When the streak tables are created, the server shall add practice days from work already recorded:
  - lab completions;
  - module steps;
  - trainer rounds and quizzes with at least one correct answer.
- **FR-009 Badges** (push 2). When a student meets a badge's rule, the server shall award the badge once and keep it.
- **FR-010 Mastery** (push 2). The system shall show, for each of the six CCNA domains, how many of its module steps and graded labs the student has completed. A domain with no content yet shall show "Coming soon".

## Non-functional requirements

- **Integrity.** Practice days are written only by the server, on graded events. The browser can't record one, and the server's clock decides the day.
- **Determinism.** The streak and week calculations are pure functions in `@netlab/modules`, and "today" is passed in by the server.
- **Security.** Every endpoint needs a session, and writes follow the existing JSON + same-origin rule. The goal must be a whole number from 2 to 5, checked by a schema. (Fastify coerces a numeric string such as `"3"` to 3.)
- **Performance.** `/api/me` adds two small queries, and the leaderboard adds one query for the top 20.

## Errors

| Condition | Code | Message |
|---|---|---|
| Goal missing, not a whole number, or outside 2–5 | 400 | Fastify schema message |
| No session | 401 | "Please sign in." |
| Not JSON or cross-site | 415 / 403 | Existing CSRF rule |

## Implementation TODO

### Push 1: streaks and weekly goal (shipped 2026-10-22, `b73f91d`)

- [x] `days`, `streakOf`, `weekOf` with unit tests (`packages/modules/src/progress/`)
- [x] Migration 5: `practice_days`, `goal_weeks`, `users.weekly_goal`, backfill
- [x] Record practice on lab submit, quiz submit, trainer finish and first lesson read
- [x] `/api/me` progress, `PUT /api/me/goal`, leaderboard streak
- [x] Dashboard Streak and This week stats, Progress page, leaderboard Streak column
- [x] API and browser tests

### Push 2: badges and mastery

- [ ] Shared module steps, `masteryByDomain`, `BADGES` and `earnedBadges`
- [ ] Migration 6: `badges`, award on events and on `/api/me`, `newBadges` in responses
- [ ] Badge notices, Progress page badges grid and mastery meters, leaderboard Badges column

## Out of scope

A weekly leaderboard, XP for badges, instructor views of student streaks.
