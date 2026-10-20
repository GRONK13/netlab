// Smoke tests: the paths a student takes on day one, in a real browser. If any of
// these fail, CI doesn't promote the commit, so it never reaches netlab.dcism.org.

import { getLab } from '@netlab/labs';
import { solve, type Problem, type Question } from '@netlab/modules';
import { ANSWERS, answerText } from '@netlab/modules/answers';
import { expect, test, type Page } from '@playwright/test';
import { SOLUTIONS } from '../packages/labs/test/solutions.ts';

// Each run registers fresh accounts, so reruns against the same database don't collide.
const stamp = Date.now().toString(36);

async function register(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('School email').fill(`${name.toLowerCase()}@usc.edu.ph`);
  await page.getByLabel('Password').fill(`e2e-password-${stamp}`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: `Hello, ${name}.` })).toBeVisible();
}

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });

test('health check responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
});

test('a student completes Switch Basics, earns XP and reaches the leaderboard', async ({
  page,
}) => {
  const lab = getLab('switch-basics')!;
  const student = `Student${stamp}`;
  await register(page, student);

  await page.getByRole('link', { name: lab.title }).first().click();
  await expect(page.getByRole('heading', { name: lab.title })).toBeVisible();

  // Submitting early says what's missing, and Keep working returns to the objectives.
  await page.getByRole('button', { name: 'Submit' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Not finished yet' })).toBeVisible();
  await expect(dialog.getByText('(not met)')).toHaveCount(lab.objectives.length);
  await dialog.getByRole('button', { name: 'Keep working' }).click();
  await expect(page.getByRole('tab', { name: /Objectives/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('tab', { name: 'SW1' }).click();
  await page.getByLabel('SW1 console').click();
  for (const { line } of SOLUTIONS[lab.id]!) {
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
  }
  const total = lab.objectives.length;
  await expect(page.getByTitle(`${total} of ${total} objectives met`)).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(dialog.getByRole('heading', { name: `Lab complete! +${lab.xp} XP` })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Next lab/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay in the lab' }).click();

  await nav(page, 'Leaderboard').click();
  await expect(page.getByRole('cell', { name: student })).toBeVisible();
});

test('the sandbox saves a PC, and its desktop runs commands', async ({ page }) => {
  await register(page, `Builder${stamp}`);
  await nav(page, 'Sandbox').click();

  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/sandbox') && r.request().method() === 'PUT' && r.ok(),
  );
  await page.getByTitle(/^PC: /).click();
  const pc = page.getByRole('button', { name: /, pc\. Press Enter to open\./ });
  await expect(pc).toBeVisible();
  await saved;

  await pc.press('Enter');
  const desktop = page.getByRole('dialog');
  await desktop.getByRole('button', { name: 'Command Prompt' }).dblclick();
  await desktop.locator('.console-host').click();
  await page.keyboard.type('ipconfig');
  await page.keyboard.press('Enter');
  await expect(desktop.locator('.xterm-rows')).toContainText(/IPv4.Address/);

  await page.reload();
  await expect(pc).toBeVisible();
});

test('the subnetting trainer grades a round and awards XP once', async ({ page }) => {
  await register(page, `Trainee${stamp}`);
  await nav(page, 'Trainer').click();

  const started = page.waitForResponse((r) => r.url().endsWith('/api/trainer/subnetting/start'));
  await page.getByRole('button', { name: 'Start a round' }).click();
  const { problems } = (await (await started).json()) as { problems: Problem[] };
  const answer = page.getByRole('textbox', { name: /^Answer/ });

  // One wrong answer: the right one is shown until Enter moves on.
  await answer.fill('1.1.1.1');
  await answer.press('Enter');
  await expect(page.getByText(`The answer is ${solve(problems[0]!)}`)).toBeVisible();
  await answer.press('Enter');

  for (const p of problems.slice(1)) {
    await answer.fill(solve(p));
    await answer.press('Enter');
  }
  await expect(page.getByText(/^9\/10 in \d+:\d\d\. Target hit: \+50 XP!/)).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).locator('..').getByText('50 XP'),
  ).toBeVisible();
});

test('a student reads the Module 1 lesson and passes the checkpoint quiz', async ({ page }) => {
  await register(page, `Learner${stamp}`);
  await page.getByRole('link', { name: /Start module/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Lesson: IP Addressing and Subnetting' }),
  ).toBeVisible();
  await expect(page.getByLabel('Address in binary').first()).toBeVisible();
  await page.getByRole('button', { name: 'Finish lesson' }).click();
  await expect(page.getByText("You've finished this lesson.")).toBeVisible();

  await page.goto('/#/learn/ip-addressing/quiz');
  const started = page.waitForResponse((r) => r.url().endsWith('/api/modules/ip-addressing/quiz'));
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  const { questions } = (await (await started).json()) as { questions: Question[] };
  const keys = ANSWERS['ip-addressing']!;
  const items = page.locator('.quiz > li');
  for (const [i, q] of questions.entries()) {
    const answer = answerText(q, keys[q.id]!);
    if (q.kind === 'choice')
      await items.nth(i).getByRole('radio', { name: answer, exact: true }).check();
    else await items.nth(i).getByRole('textbox').fill(answer);
  }
  await page.getByRole('button', { name: 'Submit answers' }).click();
  await expect(page.getByText('10/10 correct. Passed: +75 XP!')).toBeVisible();

  await page.getByRole('link', { name: 'Back to the module' }).click();
  await expect(page.getByText('2/5 steps')).toBeVisible();
});

test('guided practice reveals one step at a time and explains each', async ({ page }) => {
  await register(page, `Guided${stamp}`);
  await page.goto('/#/lab/ip-practice');
  const steps = page.locator('.objectives.steps li');
  await expect(steps).toHaveCount(1);

  // Type a command into a PC's Command Prompt, the way a student would.
  const onPc = async (pc: string, line: string) => {
    await page.getByRole('button', { name: `${pc}, pc. Press Enter to open.` }).press('Enter');
    const desktop = page.getByRole('dialog', { name: pc });
    await desktop.getByRole('button', { name: 'Command Prompt' }).dblclick();
    await desktop.locator('.console-host').click();
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
    await desktop.getByRole('button', { name: `Close ${pc}` }).click();
  };

  await onPc('PC1', 'ipconfig 192.168.1.10 255.255.255.0');
  await expect(steps).toHaveCount(2);
  await expect(steps.first()).toContainText('makes the first three octets the network');

  for (const { device, line } of SOLUTIONS['ip-practice']!.filter((e) => e.device !== 'PC1')) {
    await onPc(device, line);
  }
  await expect(page.getByTitle('7 of 7 objectives met')).toBeVisible();
  await expect(steps).toHaveCount(7);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Lab complete! +50 XP')).toBeVisible();
});
