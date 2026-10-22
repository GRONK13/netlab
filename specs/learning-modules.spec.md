# Feature: Learning modules (Phase 1) and Module 1, IP addressing and subnetting

## Overview

Students can practice in NetLab but nothing teaches them first. A learning module walks a student through one CCNA topic in five steps (lesson, guided practice, speed trainer, checkpoint quiz, challenge lab), each graded so XP can't be faked. Module 1 covers IPv4 addressing and subnetting, the topic CCNA students find hardest.

Decided with the project owner on 2026-10-20: quizzes allow unlimited retries with a fresh draw and award XP on the first pass; the trainer awards XP once at its target and then tracks a personal best; nothing is locked; lesson content is written from the CCNA 200-301 exam topics and reviewed by the owner before release.

## Module 1 steps

| Step                                              | Graded by                                | XP             |
| ------------------------------------------------- | ---------------------------------------- | -------------- |
| Lesson (7 sections, interactive subnet explorer)  | Server records "read"                    | 0              |
| Guided practice "Same subnet or not?"             | Command-log replay                       | 50             |
| Subnetting trainer: 8/10 correct within 5 minutes | Server re-grades from its seed and clock | 50, once       |
| Checkpoint quiz: 10 drawn from ~20, pass 8/10     | Server-only answer keys                  | 75, first pass |
| Challenge "Address the branch office"             | Command-log replay                       | 150            |

## Functional requirements

- **FR-001 Module overview.** When a signed-in student opens a module, the system shall show its five steps with each step's completion state, and shall not lock any step.
- **FR-002 Lesson read.** When a student reaches the end of a lesson, the system shall record the lesson as read for that student and module, at most once.
- **FR-003 Quiz start.** When a student starts a quiz, the server shall draw 10 distinct questions at random from the module's pool, store the attempt, and return the questions without answers.
- **FR-004 Quiz grading.** When a student submits a quiz attempt, the server shall grade every answer with answer keys that exist only on the server.
- **FR-005 Quiz pass.** If a submitted attempt has at least 8 correct answers, the server shall award the quiz XP the first time for that student and module, and return the explanation for each question.
- **FR-006 Quiz fail.** If a submitted attempt has fewer than 8 correct answers, the server shall return which questions were wrong and shall not reveal any correct answer.
- **FR-007 Quiz attempt rules.** The server shall accept one submission per attempt, only from the student who started it, within 2 hours of its start.
- **FR-008 Trainer round.** When a student starts a trainer round, the server shall choose a random seed, store it with the start time, and return the round's 10 problems.
- **FR-009 Trainer grading.** When a student finishes a trainer round, the server shall regenerate the problems from the stored seed, grade the answers, and measure the duration from its own clock.
- **FR-010 Trainer reward.** If a finished round has at least 8 correct answers within 5 minutes, the server shall award the trainer XP the first time for that student, and shall report the student's personal best (most correct, then fastest).
- **FR-011 XP sources.** The system shall compute total XP, level and leaderboard position from every XP source: labs, guided practice, quizzes and the trainer.
- **FR-012 Guided practice.** While a lab is guided, the system shall show only the current objective and the met ones, and shall show each met objective's explanation.
- **FR-013 Ordering.** The system shall suggest the next unfinished step of the first unfinished module on the dashboard.

## Non-functional requirements

- **Integrity.** Answer keys never ship in the web bundle; a test fails if any file under `apps/web/src` imports them. Trainer timing and grading use server state only.
- **Security.** Every endpoint needs a session; writes follow the existing JSON + same-origin rule; quiz answer payloads are schema-validated (at most 20 answers, each at most 100 characters); quiz and trainer starts are rate-limited per session.
- **Determinism.** Subnet math and the trainer generator are pure functions; the same seed always gives the same problems.
- **Performance.** API responses under 100 ms on the school server; no new runtime dependencies.
- **Accessibility and layout.** Lessons, quiz and trainer work by keyboard and at phone width (16 px gutters, no horizontal scroll).

## Acceptance criteria

- **AC-001.** Given a student has finished nothing, when they open Module 1, then they see five unlocked steps and none is marked done.
- **AC-002.** Given a quiz attempt was started, when the response is inspected, then it contains question text and choices but no answers.
- **AC-003.** Given a student answers 8 of 10 correctly, when they submit, then they receive 75 XP and the explanations; when they pass again later, they receive 0 XP.
- **AC-004.** Given a student answers 5 of 10 correctly, when they submit, then they see which 5 were wrong and no correct answers.
- **AC-005.** Given an attempt was already submitted, when it is submitted again, then the server answers 409.
- **AC-006.** Given another student's attempt id, when a student submits it, then the server answers 404.
- **AC-007.** Given a trainer round started more than 5 minutes ago, when the student finishes it with 10/10, then the score and time are recorded but no XP is awarded.
- **AC-008.** Given a student earned trainer XP and lab XP, when the leaderboard loads, then their XP is the sum of both and "Labs" counts only graded labs.

## Error handling

| Condition                                     | HTTP | Message                                    |
| --------------------------------------------- | ---- | ------------------------------------------ |
| Unknown module or trainer kind                | 404  | "No such module." / "No such trainer."     |
| Attempt or round not found, or someone else's | 404  | "No such quiz attempt." / "No such round." |
| Already submitted or finished                 | 409  | "This attempt was already submitted."      |
| Quiz attempt older than 2 hours               | 410  | "This attempt expired. Start a new one."   |
| Too many starts                               | 429  | Rate-limit message                         |
| Malformed body                                | 400  | Schema error                               |
| Not signed in                                 | 401  | "Sign in first."                           |

## Implementation TODO

### Push 1: Subnetting trainer (shipped 2026-10-20, `1e83078`)

- [x] `packages/sim/src/ipv4.ts` subnet math + tests
- [x] `packages/modules`: seeded PRNG, trainer generator and solver + tests
- [x] Migration 3: `module_steps`, `trainer_rounds`, view `xp_events`; XP totals and leaderboard read the view (`quiz_attempts` came in migration 4, with the quiz)
- [x] Trainer endpoints + API tests
- [x] Trainer page, nav item, browser test

### Push 2: Module framework, lesson, quiz (shipped 2026-10-20, `ca257c5`, `8528723`)

- [x] Module types, Module 1 lesson and quiz pool, server-only answer keys + guard test
- [x] Markdown renderer + `SubnetExplorer`
- [x] Module, lesson and quiz pages; quiz endpoints + API tests; dashboard Modules section; browser test

### Push 3: Guided practice and challenge (shipped 2026-10-20, `60da2e8`, `8de27e6`)

- [x] `address` and `gateway` checks (plus `all`, and `ping` to a PC by device id)
- [x] Guided mode in the lab page; `ip-practice` and `address-the-office` labs with reference solutions
- [x] "Up next" across modules and labs

### Module 2: Switching and VLANs (shipped 2026-10-21)

- [x] Lesson (switch forwarding, MAC table, broadcast domains, VLANs, access ports, trunks and 802.1Q, verification) and quiz pool with answer keys
- [x] Guided practice on one switch: create VLANs, assign access ports, see which PCs can still talk
- [x] Wire Module 2 with "Separate the Departments" as its challenge

### Module 3: Inter-VLAN Routing (shipped 2026-10-21)

- [x] Lesson (why VLANs need a router, one port per VLAN, router on a stick, the switch side, following a packet, troubleshooting) and quiz pool with answer keys
- [x] Guided practice: route two VLANs with one router port each
- [x] Wire Module 3 with "Router on a Stick" as its challenge

### Module 4: Device Security (shipped 2026-10-21)

- [x] Lesson (access paths, enable secret vs password, console and VTY lines, encryption, SSH, banners and unused ports, saving) and quiz pool with answer keys
- [x] Guided practice: lock down a new switch step by step (new `shutdown` check)
- [x] Wire Module 4 with "Switch Basics" as its challenge

## Out of scope

Instructor views. (Streaks, goals, badges and mastery: `specs/goals-streaks.spec.md`.)
