/* Behavioral regression for the revised drawer and attachment-free role flows. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('/Users/wsq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const results = [];
let currentCase = '';
const files = { three:'01-modal-three.html', single:'02-modal-single.html', drawer:'03-home-drawer.html', role:'04-role-tasks.html' };
const badEmptyCopy = /暂时没有找到(?:任何|合适的)?任务|没有可推荐的任务|暂无(?:合适的)?任务|无法为你推荐任务/;
const materialClaims = /(?:资料|附件|素材)(?:已经|已)?(?:准备好|备好|就绪)|示例资料|无需准备资料|开始时.{0,8}带上.{0,4}文件/;
const visibleStarts = page => page.locator('[data-action="start"]:visible');

function url(kind, scenario='full', extras={}) {
  const u = new URL(pathToFileURL(path.join(root, files[kind])));
  u.searchParams.set('scenario',scenario);
  for (const [key,value] of Object.entries(extras)) u.searchParams.set(key,value);
  return u.href;
}
async function check(name, fn) {
  if (only && !only.split('|').some(part=>name.includes(part))) return;
  currentCase=name; const at=Date.now();
  try { const detail=await fn(); results.push({name,status:'passed',durationMs:Date.now()-at,...detail}); console.log('PASS:',name); }
  catch(error) { results.push({name,status:'failed',durationMs:Date.now()-at,error:error.message}); throw error; }
}
async function settledTasks(page) {
  await page.locator('.task-row:visible').first().waitFor({timeout:16000});
  await page.waitForFunction(()=>{
    const rows=[...document.querySelectorAll('.task-row')].filter(e=>e.offsetWidth&&e.offsetHeight);
    return rows.length&&rows.every(row=>row.querySelector('[data-editor]')?.value.trim()&&!row.classList.contains('streaming')&&!row.classList.contains('waiting'));
  },null,{timeout:16000});
}
async function openDrawerViaIntro(page, scenario='full', settle=true) {
  await page.goto(url('drawer',scenario));
  await page.locator('.intro-dialog').waitFor();
  assert.equal(await page.locator('[data-action="get-tasks"]:visible').count(),1,'Drawer entry must show the introduction');
  assert.equal(await page.locator('[data-action="close"]:visible').count(),1,'Introduction must have a close control');
  assert.equal(await page.locator('[data-action="toggle-drawer"]').getAttribute('aria-expanded'),'false');
  await page.locator('[data-action="get-tasks"]').click();
  await page.locator('.loading-panel').waitFor();
  await page.waitForFunction(()=>!document.querySelector('.overlay'),null,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('[data-action="toggle-drawer"]')?.getAttribute('aria-expanded')==='true',null,{timeout:5000});
  assert.equal(await page.locator('.overlay').count(),0,'Recommendations must open on the home page');
  if(settle) await settledTasks(page);
}
async function openRole(page, scenario='full', role='product', skip=false) {
  await page.goto(url('role',scenario));
  if(skip) await page.locator('[data-action="skip-role"]').click();
  else {
    await page.locator(`[data-action="pick-role"][data-role="${role}"]`).click();
    await page.locator('[data-action="role-next"]').click();
  }
  await page.locator('.role-task-line:visible').first().waitFor();
}
async function assertRoleClean(page, count) {
  assert.equal(await page.locator('.role-task-line:visible').count(),count);
  assert.equal(await page.locator('.file-pill:visible').count(),0,'Role suggestions must not carry attachments');
  assert.equal(await page.locator('.role-task-card:visible,.role-thumb:visible').count(),0,'Role suggestions must be a flat list');
  const copy=await page.locator('#app').innerText();
  assert(!materialClaims.test(copy),'Role flow must not claim material readiness');
  assert(!badEmptyCopy.test(copy),'Role fallback must remain actionable');
  const taskData=await page.evaluate(()=>tasks.map(t=>({files:t.files,sample:t.sample,prompt:t.value})));
  assert(taskData.every(t=>Array.isArray(t.files)&&t.files.length===0&&t.sample===false),'Every role task must explicitly have files=[] and sample=false');
  assert(taskData.every(t=>t.prompt.trim()),'Every role task needs a usable prompt');
  return taskData;
}
async function launch(page,index=0,{role=false}={}) {
  const task=await page.evaluate(i=>({prompt:tasks[i].value,files:[...tasks[i].files]}),index);
  await page.locator(`[data-action="start"][data-index="${index}"]:visible`).last().click();
  await page.locator('.user-message').waitFor();
  const copy=await page.locator('.user-message').innerText();
  assert(copy.includes(task.prompt),'Conversation must preserve the chosen prompt');
  for(const file of task.files) assert(copy.includes(file),'Conversation lost attachment '+file);
  assert.equal(await page.locator('.overlay').count(),0);
  if(role) {
    assert.equal(await page.locator('.file-pill:visible').count(),0,'Role task conversation must stay attachment-free');
    assert(!materialClaims.test(await page.locator('.chat').innerText()),'Conversation must not invent prepared materials');
  }
  await page.locator('.artifact').waitFor({timeout:10000});
  if(role) assert.equal(await page.locator('.file-pill:visible').count(),0);
  return {attachmentCount:task.files.length,prompt:task.prompt};
}
async function inputRect(page) {
  return page.locator('#home-input').evaluate(el=>{const r=el.closest('.composer').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
}
async function assertLayout(page,{role=false}={}) {
  const info=await page.evaluate(role=>{
    const rows=[...document.querySelectorAll(role?'.role-task-line':'.drawer-task-grid .task-row')];
    const visible=e=>e.offsetWidth&&e.offsetHeight;
    return {width:document.documentElement.scrollWidth,viewport:innerWidth,height:innerHeight,rows:rows.filter(visible).map(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,radius:parseFloat(s.borderRadius),bottom:r.bottom};}),actions:[...document.querySelectorAll('[data-action="start"]')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom};})};
  },role);
  assert(info.width<=info.viewport,'Page must not overflow horizontally');
  assert(info.rows.length>0,'Recommendations must be visible');
  assert(info.actions.every(r=>r.x>=0&&r.right<=info.viewport&&r.top>=0&&r.bottom<=info.height),'Start controls must fit viewport');
  assert(info.rows.every(r=>r.height<=105),'Recommendations must be compact rows, not giant cards');
  assert(info.rows.every(r=>Math.abs(r.x-info.rows[0].x)<=1&&Math.abs(r.width-info.rows[0].width)<=1),'All recommendations must align in a vertical list');
  assert(info.rows.every((r,i)=>i===0||r.y>=info.rows[i-1].bottom-1),'Rows must not overlap or form columns');
  return info;
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.setDefaultTimeout(10000);
  const runtimeErrors=[],missingResources=[];
  page.on('pageerror',error=>runtimeErrors.push({test:currentCase,message:error.message}));
  page.on('requestfailed',req=>{if(req.url().startsWith('file:')&&req.failure()?.errorText!=='net::ERR_ABORTED')missingResources.push({test:currentCase,url:req.url(),failure:req.failure()?.errorText});});
  try {
    for(const scenario of ['full','two','one','none','error']) {
      await check(`Drawer ${scenario}: intro → loading → home auto expansion → task → result`,async()=>{
        await openDrawerViaIntro(page,scenario);
        const count=await page.locator('.task-row:visible').count();
        assert.equal(count,({full:3,two:2,one:1,none:1,error:1})[scenario]);
        assert(await page.locator('#drawer-body').evaluate(el=>!!el.closest('.composer-shell')),'Drawer must be attached to the LUI');
        assert(!(await page.locator('#drawer-inner').innerText()).includes('现在做'),'Remove redundant 现在做 label');
        assert(!badEmptyCopy.test(await page.locator('#app').innerText()));
        await assertLayout(page);
        if(['none','error'].includes(scenario)) assert((await page.locator('#drawer-inner').innerText()).includes('示例'));
        return {count,...await launch(page)};
      });
    }
    for(const when of ['intro','loading']) {
      await check(`Drawer close during ${when}: remains on home with collapsed drawer`,async()=>{
        await page.goto(url('drawer'));
        if(when==='loading') {
          await page.locator('[data-action="get-tasks"]').click();
          await page.locator('.loading-panel').waitFor();
        }
        await page.locator('[data-action="close"]').click();
        await page.waitForTimeout(4600);
        assert.equal(await page.locator('.overlay').count(),0,'Cancelled overlay must not resurrect');
        assert.equal(await page.locator('[data-action="toggle-drawer"]').getAttribute('aria-expanded'),'false','Cancelled loading must not open drawer later');
        assert.equal(await page.locator('#home-input').count(),1);
        assert.equal(await page.locator('#app').getAttribute('inert'),null);
        await page.locator('[data-action="toggle-drawer"]').click();
        await settledTasks(page);
        assert.equal(await page.locator('[data-action="toggle-drawer"]').getAttribute('aria-expanded'),'true','Manual drawer access must remain available');
      });
    }
    await check('Drawer expansion preserves composer geometry/focus; edits survive streaming and return',async()=>{
      await page.goto(url('drawer'));
      await page.locator('[data-action="get-tasks"]').click();
      await page.waitForFunction(()=>!document.querySelector('.overlay'));
      await page.locator('.home').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
      const before=await inputRect(page);
      const input=page.locator('#home-input');
      await input.fill('直接输入我的工作');
      await page.waitForFunction(()=>document.querySelector('[data-action="toggle-drawer"]')?.getAttribute('aria-expanded')==='true');
      await settledTasks(page);
      assert.deepEqual(await inputRect(page),before,'Opening drawer must not move or resize composer');
      assert.equal(await input.inputValue(),'直接输入我的工作');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'home-input','Drawer must not steal input focus');
      const expansion=await page.locator('#drawer-body').evaluate(el=>getComputedStyle(el).transitionDuration.split(',').map(x=>x.trim().endsWith('ms')?parseFloat(x)/1000:parseFloat(x)));
      assert(Math.max(...expansion)>=0.4,'Drawer opening should have a visible gradual transition');
      await page.locator('[data-action="toggle-drawer"]').click();
      assert.equal(await page.locator('[aria-controls="drawer-body"]').getAttribute('aria-expanded'),'false');
      await page.locator('[data-action="toggle-drawer"]').click();
      await settledTasks(page);
      const edited='根据这份 PPT，准备一份三分钟讲稿。';
      await page.locator('[data-editor="2"]').fill(edited);
      await launch(page,2);
      await page.locator('[data-action="back-tasks"]').click();
      assert.equal(await page.locator('[data-editor="2"]').inputValue(),edited);
      assert.equal(await page.locator('.overlay').count(),0);
      await page.locator('[data-action="replay"]').click();
      await page.locator('.intro-dialog').waitFor();
      await page.locator('[data-action="get-tasks"]').click();
      await page.locator('.task-row.streaming').first().waitFor({timeout:15000});
      await page.locator('[data-editor="0"]').fill('只整理负责人和截止时间。');
      await page.waitForTimeout(3000);
      assert.equal(await page.locator('[data-editor="0"]').inputValue(),'只整理负责人和截止时间。','Streaming must not replace manual edits');
    });
    for(const scenario of ['full','two','one','none','error']) {
      await check(`Role ${scenario}: selected role → plain rows → attachment-free conversation`,async()=>{
        await openRole(page,scenario);
        const count=({full:3,two:2,one:1,none:3,error:3})[scenario];
        await assertRoleClean(page,count);
        await assertLayout(page,{role:true});
        const launched=await launch(page,0,{role:true});
        await page.locator('[data-action="back-tasks"]').click();
        await assertRoleClean(page,count);
        return {count,...launched};
      });
    }
    await check('Role skip produces three generic tasks; each row launches without attachments',async()=>{
      await openRole(page,'full','product',true);
      const data=await assertRoleClean(page,3);
      for(let i=0;i<3;i++) {
        await launch(page,i,{role:true});
        await page.locator('[data-action="back-tasks"]').click();
        assert.deepEqual(await assertRoleClean(page,3),data,'Returning must preserve all role task prompts');
      }
    });
    await check('Role can change from product to student and retain attachment-free prompts',async()=>{
      await openRole(page);
      const before=(await assertRoleClean(page,3)).map(t=>t.prompt);
      await page.locator('[data-action="change-role"]').click();
      await page.locator('[data-action="pick-role"][data-role="student"]').click();
      await page.locator('[data-action="role-next"]').click();
      await page.locator('.role-task-line').first().waitFor();
      const after=(await assertRoleClean(page,3)).map(t=>t.prompt);
      assert.notDeepEqual(after,before,'Selecting another occupation must change suggestions');
      await launch(page,1,{role:true});
    });
    await check('Modal streaming edit preserves replacement text',async()=>{
      await page.goto(url('three'));
      await page.locator('[data-action="get-tasks"]').click();
      await page.locator('.task-row.streaming').first().waitFor({timeout:15000});
      const edited='只整理负责人和截止时间。';
      await page.locator('[data-editor="0"]').fill(edited);
      await page.waitForTimeout(3000);
      assert.equal(await page.locator('[data-editor="0"]').inputValue(),edited);
      const result=await launch(page);
      assert.equal(result.prompt,edited);
    });
    for(const kind of ['three','single']) {
      for(const scenario of ['full','none']) {
        await check(`Modal smoke ${kind}/${scenario}: introduction → recommendation → result`,async()=>{
          await page.goto(url(kind,scenario));
          await page.locator('[data-action="get-tasks"]').click();
          await settledTasks(page);
          assert.equal(await page.locator('.task-row:visible').count(),kind==='three'&&scenario==='full'?3:1);
          return await launch(page);
        });
      }
    }
    for(const kind of ['drawer','role']) {
      for(const scenario of ['full','none']) {
        await check(`Layout ${kind}/${scenario} at 1280×800`,async()=>{
          await page.goto(url(kind,scenario,{state:'recommend'}));
          await page.evaluate(()=>document.fonts.ready);
          await page.waitForTimeout(1000);
          return await assertLayout(page,{role:kind==='role'});
        });
      }
    }
    assert.equal(runtimeErrors.length,0,JSON.stringify(runtimeErrors));
    assert.equal(missingResources.length,0,JSON.stringify(missingResources));
    console.log(`PASS: ${results.length} cases; no runtime errors or missing local resources.`);
  } finally {
    const suffix=only?'-'+only.replace(/[^a-z0-9]+/gi,'-').slice(0,100):'';
    fs.writeFileSync(path.join(__dirname,`verification-v3${suffix}.json`),JSON.stringify({completedAt:new Date().toISOString(),results,runtimeErrors,missingResources},null,2));
    await browser.close();
  }
})().catch(error=>{console.error('FAIL:',currentCase,error);process.exit(1);});
