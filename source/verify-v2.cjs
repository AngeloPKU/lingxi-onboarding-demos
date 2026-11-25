/* Regression checks for the four onboarding demonstrations. No application writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('/Users/wsq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const routes = [
  { file: '01-modal-three.html', kind: 'three' },
  { file: '02-modal-single.html', kind: 'single' },
  { file: '03-home-drawer.html', kind: 'drawer' },
  { file: '04-role-tasks.html', kind: 'role' },
];
const badEmptyCopy = /暂时没有找到(?:任何|合适的)?任务|没有可推荐的任务|暂无(?:合适的)?任务|无法为你推荐任务/;
const results = [];
let currentCase = '';
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length);

function url(file, scenario = 'full', extras = {}) {
  const u = new URL(pathToFileURL(path.join(root, file)));
  u.searchParams.set('scenario', scenario);
  for (const [key, value] of Object.entries(extras)) u.searchParams.set(key, value);
  return u.href;
}

async function check(name, fn) {
  if (only && !only.split('|').some(part => name.includes(part))) return;
  currentCase = name;
  const start = Date.now();
  try {
    const detail = await fn();
    results.push({ name, status: 'passed', durationMs: Date.now() - start, ...detail });
    console.log('PASS:', name);
  } catch (error) {
    results.push({ name, status: 'failed', durationMs: Date.now() - start, error: error.message });
    throw error;
  }
}

async function waitForTasks(page, { settled = true } = {}) {
  await page.locator('.task-row:visible').first().waitFor({ timeout: 14000 });
  if (settled) {
    await page.waitForFunction(() => {
      const rows = [...document.querySelectorAll('.task-row')].filter(el => el.offsetWidth && el.offsetHeight);
      return rows.length > 0 && rows.every(row => {
        const editor = row.querySelector('[data-editor]');
        return editor && editor.value.trim() && !row.classList.contains('waiting') && !row.classList.contains('streaming');
      });
    }, null, { timeout: 14000 });
  }
}

async function enterRecommendations(page, route, scenario, { settled = true } = {}) {
  await page.goto(url(route.file, scenario));
  if (route.kind === 'drawer') {
    await page.locator('[data-action="toggle-drawer"]').click();
  } else if (route.kind === 'role') {
    await page.locator('[data-action="pick-role"][data-role="product"]').click();
    await page.locator('[data-action="role-next"]').click();
  } else {
    await page.locator('[data-action="get-tasks"]').click();
  }
  await waitForTasks(page, { settled });
}

async function launchFirst(page) {
  const row = page.locator('.task-row:visible').first();
  const prompt = await row.locator('[data-editor]').inputValue();
  const fileNames = await row.locator('.filename').allTextContents();
  await page.locator('[data-action="start"][data-index="0"]:visible').last().click();
  await page.locator('.user-message').first().waitFor();
  const message = await page.locator('.user-message').first().innerText();
  assert(message.includes(prompt), 'Started conversation must retain the actual task prompt');
  for (const name of fileNames) assert(message.includes(name), 'Missing launched attachment: ' + name);
  assert.equal(await page.locator('.overlay').count(), 0, 'Task launch must leave onboarding overlay');
  await page.locator('.artifact').waitFor({ timeout: 10000 });
  return { prompt, fileNames };
}

async function geometry(page) {
  return page.locator('#home-input').evaluate(el => {
    const r = el.closest('.composer').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(10000);
  const runtimeErrors = [];
  const missingResources = [];
  page.on('pageerror', error => runtimeErrors.push({ test: currentCase, message: error.message }));
  page.on('requestfailed', req => {
    if (req.url().startsWith('file:') && req.failure()?.errorText !== 'net::ERR_ABORTED') {
      missingResources.push({ test: currentCase, url: req.url(), failure: req.failure()?.errorText });
    }
  });
  try {
    const scenarios = process.argv.includes('--quick') ? ['full', 'none'] : ['full', 'two', 'one', 'none', 'error'];
    for (const route of routes) {
      const routeScenarios = scenarios;
      for (const scenario of routeScenarios) {
        await check(`${route.kind}: ${scenario} recommendations → conversation → result`, async () => {
          await enterRecommendations(page, route, scenario);
          const count = await page.locator('.task-row:visible').count();
          const expected = route.kind === 'single' ? 1 : ({ full: 3, two: 2, one: 1, none: 1, error: 1 })[scenario];
          if (expected !== null) assert.equal(count, expected, 'Unexpected task count');
          else assert(count >= 1 && count <= 3, 'Role flow must provide usable preset tasks');
          const productCopy = await page.locator('#app').innerText() + await page.locator('#overlay-root').innerText();
          assert(!badEmptyCopy.test(productCopy), 'No-task dead end must be replaced by actionable generic task');
          if (['none', 'error'].includes(scenario)) {
            const fallback = page.locator('.task-row:visible').first();
            assert((await fallback.innerText()).includes('示例'), 'Fallback task must disclose sample material');
            assert((await fallback.locator('.filename').count()) > 0, 'Fallback must be executable with supplied material');
            assert(!(await fallback.innerText()).includes('产品例会纪要.docx'), 'Fallback must not pretend to use personal files');
          }
          const launched = await launchFirst(page);
          if (['none', 'error'].includes(scenario)) {
            assert(/报价|对比/.test(await page.locator('.artifact').innerText()), 'Fallback result should match quote comparison task');
            assert((await page.locator('.user-message').innerText()).includes('示例'), 'Sample label must remain in conversation');
          }
          return { count, attachmentCount: launched.fileNames.length };
        });
      }
    }

    await check('Streaming generation preserves user edits, empty prompt disables start, and back retains edits', async () => {
      const route = routes[0];
      await enterRecommendations(page, route, 'full', { settled: false });
      await page.locator('.task-row.streaming').first().waitFor({ timeout: 10000 });
      const editor = page.locator('[data-editor="0"]');
      const edited = '只保留本周需要完成的三项待办，并列出负责人。';
      await editor.fill(edited);
      await page.waitForTimeout(3100);
      assert.equal(await editor.inputValue(), edited, 'Stream must not overwrite user input');
      await editor.fill('');
      assert(await page.locator('[data-action="start"][data-index="0"]:visible').last().isDisabled(), 'Empty task must disable launch');
      await editor.fill(edited);
      await launchFirst(page);
      await page.locator('[data-action="back-tasks"]').click();
      assert.equal(await page.locator('[data-editor="0"]').inputValue(), edited, 'Back should retain edited task');
      await page.locator('[data-action="replay"]').click();
      assert.equal(await page.locator('[data-action="get-tasks"]:visible').count(), 1, 'Replay returns to onboarding');
    });

    await check('Closing while loading prevents background reappearance', async () => {
      await page.goto(url(routes[0].file, 'none'));
      await page.locator('[data-action="get-tasks"]').click();
      await page.locator('.loading-panel').waitFor();
      await page.locator('[data-action="close"]').click();
      await page.waitForTimeout(4200);
      assert.equal(await page.locator('.overlay').count(), 0);
      assert.equal(await page.locator('#home-input').count(), 1);
      assert.equal(await page.locator('#app').getAttribute('inert'), null);
    });

    await check('Drawer stays attached, keeps composer geometry/input/focus, and collapses/reopens', async () => {
      await page.goto(url(routes[2].file, 'full'));
      const before = await geometry(page);
      assert.equal(await page.locator('.overlay').count(), 0);
      await page.locator('[data-action="toggle-drawer"]').click();
      const input = page.locator('#home-input');
      await input.fill('我也可以直接输入自己的任务');
      await waitForTasks(page);
      assert.equal(await input.inputValue(), '我也可以直接输入自己的任务');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'home-input', 'Recommendation completion must not steal LUI focus');
      assert.deepEqual(await geometry(page), before, 'Drawer must not move or resize input area');
      assert(await page.locator('#drawer-body').evaluate(el => !!el.closest('.composer-shell')), 'Drawer must be part of LUI shell');
      await page.locator('[data-action="toggle-drawer"]').click();
      assert.equal(await page.locator('[aria-controls="drawer-body"]').getAttribute('aria-expanded'), 'false');
      await page.locator('[data-action="toggle-drawer"]').click();
      await waitForTasks(page);
      const third = page.locator('[data-editor="2"]');
      const edited = '根据这份 PPT，准备一份三分钟讲稿。';
      await third.fill(edited);
      await page.locator('[data-action="start"][data-index="2"]:visible').click();
      assert((await page.locator('.user-message').innerText()).includes('项目进展汇报.pptx'));
      await page.locator('.artifact').waitFor();
      await page.locator('[data-action="back-tasks"]').click();
      assert.equal(await page.locator('.overlay').count(), 0);
      assert.equal(await page.locator('[data-editor="2"]').inputValue(), edited);
    });

    for (const scenario of ['none', 'error']) {
      await check(`Selected product role: ${scenario} falls back to executable sample task`, async () => {
        await page.goto(url(routes[3].file, scenario));
        await page.locator('[data-action="pick-role"][data-role="product"]').click();
        await page.locator('[data-action="role-next"]').click();
        await waitForTasks(page);
        const row = page.locator('.task-row:visible');
        assert.equal(await row.count(), 1, 'Selected role with unavailable catalog must retain a usable task');
        const taskCopy = await row.innerText();
        assert(!badEmptyCopy.test(await page.locator('#app').innerText()));
        assert(taskCopy.includes('示例'), 'Role fallback must disclose sample materials');
        assert(/报价/.test(taskCopy), 'Role fallback must offer quote comparison sample');
        assert.equal(await row.locator('.filename').count(), 3, 'Role fallback requires all three sample quotes');
        const launched = await launchFirst(page);
        assert((await page.locator('.user-message').innerText()).includes('示例'));
        assert(/报价|对比/.test(await page.locator('.artifact').innerText()));
        return { selectedRole: 'product', attachmentCount: launched.fileNames.length };
      });
    }

    await check('Role selection changes catalog and skipping still offers generic tasks', async () => {
      await page.goto(url(routes[3].file));
      await page.locator('[data-action="skip-role"]').click();
      await waitForTasks(page);
      assert((await page.locator('.task-row:visible').count()) >= 1);
      await page.locator('[data-action="change-role"]').click();
      await page.locator('[data-role="student"]').click();
      await page.locator('[data-action="role-next"]').click();
      await waitForTasks(page);
      assert((await page.locator('.role-task-grid').innerText()).includes('阅读材料'));
      await launchFirst(page);
      assert((await page.locator('.artifact').innerText()).includes('笔记'));
    });

    for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        for (const scenario of ['full', 'none']) {
          await check(`${route.kind}: ${scenario} layout at ${viewport.width}×${viewport.height}`, async () => {
            await page.goto(url(route.file, scenario, { state: 'recommend' }));
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(500);
            const info = await page.evaluate(() => {
              const dialog = document.querySelector('.dialog');
              return {
                documentWidth: document.documentElement.scrollWidth,
                actions: [...document.querySelectorAll('[data-action="start"]')].filter(el => el.offsetWidth && el.offsetHeight).map(el => {
                  const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, right: r.right };
                }),
                dialog: dialog ? { height: dialog.clientHeight, scrollHeight: dialog.scrollHeight } : null,
              };
            });
            assert(info.documentWidth <= viewport.width, 'Horizontal document overflow');
            assert(info.actions.length >= 1, 'A visible start action is required');
            assert(info.actions.every(a => a.top >= 0 && a.bottom <= viewport.height && a.right <= viewport.width), 'Start action should fit desktop viewport');
            if (info.dialog) assert(info.dialog.scrollHeight <= info.dialog.height + 2, 'Recommendation modal should fit without internal overflow');
            return info;
          });
        }
      }
    }
    assert.equal(runtimeErrors.length, 0, JSON.stringify(runtimeErrors, null, 2));
    assert.equal(missingResources.length, 0, JSON.stringify(missingResources, null, 2));
    console.log(`PASS: ${results.length} regression cases; no runtime errors or missing local resources.`);
  } finally {
    const reportName = only ? 'verification-results-' + only.replace(/[^a-z0-9]+/gi, '-').slice(0, 100) + '.json' : 'verification-results.json';
    fs.writeFileSync(path.join(__dirname, reportName), JSON.stringify({ completedAt: new Date().toISOString(), results, runtimeErrors, missingResources }, null, 2));
    await browser.close();
  }
})().catch(error => { console.error('FAIL:', currentCase, error); process.exit(1); });
