// Smoke tests: the paths a student takes on day one, in a real browser. If any of
// these fail, CI doesn't promote the commit, so it never reaches netlab.dcism.org.

import { getLab } from '@netlab/labs';
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

  await page.getByRole('tab', { name: 'SW1' }).click();
  await page.getByLabel('SW1 console').click();
  for (const { line } of SOLUTIONS[lab.id]!) {
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
  }
  const total = lab.objectives.length;
  await expect(page.getByTitle(`${total} of ${total} objectives met`)).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(`Lab complete! +${lab.xp} XP`)).toBeVisible();

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
