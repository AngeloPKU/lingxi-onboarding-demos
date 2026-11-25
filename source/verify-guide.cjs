/* Independent regression for the fifth, expandable Lingxi guide demo. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('/Users/wsq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname,'..');
const only = process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
const results=[];
let currentCase='';
const routes=['01-modal-three.html','02-modal-single.html','03-home-drawer.html','04-role-tasks.html','05-guide-panel.html'];
function url(file='05-guide-panel.html',extras={}) {
  const u=new URL(pathToFileURL(path.join(root,file)));
  for(const [key,value] of Object.entries(extras))u.searchParams.set(key,value);
  return u.href;
}
async function check(name,fn) {
  if(only&&!only.split('|').some(part=>name.includes(part)))return;
  currentCase=name;const at=Date.now();
  try{const detail=await fn();results.push({name,status:'passed',durationMs:Date.now()-at,...detail});console.log('PASS:',name);}
  catch(error){results.push({name,status:'failed',durationMs:Date.now()-at,error:error.message});throw error;}
}
const guide=page=>page.locator('.guide-dialog:visible');
async function enterGuide(page) {
  await page.goto(url());
  await page.locator('.intro-dialog').waitFor();
  await page.locator('[data-action="get-tasks"]').click();
  await page.locator('.loading-panel').waitFor();
  await guide(page).waitFor({timeout:15000});
  assert.equal(await guide(page).locator('.guide-task').count(),5,'Guide must offer two scheduled and three immediate tasks');
  assert.equal(await guide(page).locator('[data-action="guide-start"]').count(),5,'Every guide row needs a start action');
}
async function startGuideTask(page,index) {
  await guide(page).locator(`[data-action="guide-start"][data-index="${index}"]`).click();
  await page.locator('.user-message').first().waitFor();
  await page.locator('.guide-mini:visible').waitFor();
  await page.locator('.guide-dialog').waitFor({state:'hidden'});
  const text=await page.locator('.user-message').first().innerText();
  assert(text.trim(),'Starting a guide task must create a conversation');
  return text;
}
async function confirmedSchedule(page) {
  await page.locator('[data-action="guide-confirm-schedule"]').click();
  await page.waitForFunction(()=>/已创建|已开启|设置成功/.test(document.querySelector('.chat')?.innerText||''),null,{timeout:10000});
}
async function snapshot(page) {
  return page.evaluate(()=>({message:document.querySelector('.user-message')?.innerText,selected:typeof state!=='undefined'?state.selected?.id:null,step:typeof state!=='undefined'?state.runStep:null,done:typeof state!=='undefined'?state.runDone:null,draft:document.querySelector('#chat-input')?.value}));
}
async function assertFits(page,selector) {
  const info=await page.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,viewportWidth:innerWidth,viewportHeight:innerHeight,pageWidth:document.documentElement.scrollWidth};
  });
  assert(info.x>=-1&&info.y>=-1&&info.right<=info.viewportWidth+1&&info.bottom<=info.viewportHeight+1,selector+' must fit viewport');
  assert(info.pageWidth<=info.viewportWidth,'No horizontal page overflow');
  return info;
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.setDefaultTimeout(10000);
  const runtimeErrors=[],missingResources=[];
  page.on('pageerror',e=>runtimeErrors.push({test:currentCase,message:e.message}));
  page.on('requestfailed',r=>{if(r.url().startsWith('file:')&&r.failure()?.errorText!=='net::ERR_ABORTED')missingResources.push({test:currentCase,url:r.url(),failure:r.failure()?.errorText});});
  try {
    await check('Guide first entry shows five tasks; closing returns to home',async()=>{
      await enterGuide(page);
      const labels=await guide(page).locator('.guide-task').allTextContents();
      assert(labels.every(x=>x.trim()),'All five tasks must be labeled');
      await guide(page).locator('[data-action="guide-close"]').click();
      await page.locator('.guide-dialog').waitFor({state:'hidden'});
      assert.equal(await page.locator('#home-input').count(),1);
      assert.equal(await page.locator('.user-message').count(),0,'Closing first guide must not start a task');
      assert.equal(await page.locator('#app').getAttribute('inert'),null);
      return{labels};
    });
    for(let index=0;index<5;index++) {
      await check(`Guide task ${index+1}: launch and complete its intended flow`,async()=>{
        await enterGuide(page);
        const prompt=await startGuideTask(page,index);
        if(index<2) {
          await page.locator('[data-action="guide-confirm-schedule"]').waitFor();
          await page.waitForTimeout(1100);
          assert.equal(await page.locator('[data-action="guide-confirm-schedule"]:visible').count(),1,'Schedule must await explicit confirmation');
          assert(!/已创建|已开启|设置成功/.test(await page.locator('.chat').innerText()),'Scheduled task must not be created before confirmation');
          await confirmedSchedule(page);
        } else {
          assert.equal(await page.locator('[data-action="guide-confirm-schedule"]').count(),0,'Immediate task must not enter schedule configuration');
          await page.locator('.artifact').waitFor({timeout:10000});
        }
        assert((await page.locator('.user-message').first().innerText()).includes(prompt),'Task prompt must survive completion');
        return{kind:index<2?'scheduled':'immediate',prompt};
      });
    }
    await check('Guide mini dismiss closes only the guide while immediate execution completes',async()=>{
      await enterGuide(page);
      const prompt=await startGuideTask(page,2);
      await page.locator('.guide-mini [data-action="guide-dismiss"]').click();
      await page.locator('.guide-mini').waitFor({state:'hidden'});
      assert.equal(await page.locator('.guide-dialog:visible').count(),0);
      assert.equal(await page.locator('.user-message').first().innerText(),prompt);
      await page.locator('.artifact').waitFor({timeout:10000});
      assert.equal(await page.locator('.guide-mini:visible').count(),0,'Dismissed mini must not resurrect on completion');
      assert.equal(await page.locator('#chat-input').count(),1);
    });
    await check('Guide expand and collapse preserve conversation, draft and running progress',async()=>{
      await enterGuide(page);
      await startGuideTask(page,3);
      await page.locator('#chat-input').fill('请保留这条尚未发送的补充要求。');
      const before=await snapshot(page);
      await page.locator('.guide-mini [data-action="guide-expand"]').click();
      await guide(page).waitFor();
      assert.equal(await guide(page).locator('.guide-task').count(),5);
      await guide(page).locator('[data-action="guide-close"]').click();
      await page.locator('.guide-dialog').waitFor({state:'hidden'});
      await page.locator('.guide-mini:visible').waitFor();
      const after=await snapshot(page);
      assert.equal(after.message,before.message);
      assert.equal(after.selected,before.selected,'Expanding guide must not replace the selected task');
      assert.equal(after.draft,before.draft,'Expanding guide must preserve the unsent draft');
      if(typeof before.step==='number')assert(after.step>=before.step,'Guide actions must not reset execution progress');
      await page.locator('.artifact').waitFor({timeout:10000});
      const artifact=await page.locator('.artifact').innerText();
      await page.locator('.guide-mini [data-action="guide-expand"]').click();
      await guide(page).waitFor();
      await guide(page).locator('[data-action="guide-close"]').click();
      await page.locator('.guide-dialog').waitFor({state:'hidden'});
      assert.equal(await page.locator('.artifact').innerText(),artifact,'Completed result must remain unchanged');
    });
    await check('Immediate task completes while guide remains expanded',async()=>{
      await enterGuide(page);
      const prompt=await startGuideTask(page,4);
      await page.locator('.guide-mini [data-action="guide-expand"]').click();
      await guide(page).waitFor();
      await page.locator('.artifact').waitFor({state:'attached',timeout:10000});
      assert.equal(await guide(page).count(),1,'Guide must still be expanded when execution completes');
      assert.equal(await page.locator('.user-message').first().innerText(),prompt);
      const result=await page.locator('.artifact').innerText();
      await guide(page).locator('[data-action="guide-close"]').click();
      await page.locator('.guide-dialog').waitFor({state:'hidden'});
      await page.locator('.guide-mini:visible').waitFor();
      assert.equal(await page.locator('.artifact').innerText(),result,'Collapsing completed guide must not restart the task');
    });
    await check('Schedule configuration survives guide expand, close and mini dismissal before confirmation',async()=>{
      await enterGuide(page);
      await startGuideTask(page,0);
      await page.locator('[data-action="guide-confirm-schedule"]').waitFor();
      await page.locator('.guide-mini [data-action="guide-expand"]').click();
      await guide(page).waitFor();
      await guide(page).locator('[data-action="guide-close"]').click();
      await page.locator('.guide-dialog').waitFor({state:'hidden'});
      assert.equal(await page.locator('[data-action="guide-confirm-schedule"]:visible').count(),1);
      await page.locator('.guide-mini [data-action="guide-dismiss"]').click();
      await page.locator('.guide-mini').waitFor({state:'hidden'});
      assert.equal(await page.locator('[data-action="guide-confirm-schedule"]:visible').count(),1);
      await confirmedSchedule(page);
      assert.equal(await page.locator('.guide-mini:visible').count(),0);
    });
    for(const stage of ['intro','loading']) {
      await check(`Guide close during ${stage} prevents later reappearance`,async()=>{
        await page.goto(url());
        if(stage==='loading') {
          await page.locator('[data-action="get-tasks"]').click();
          await page.locator('.loading-panel').waitFor();
        }
        await page.locator('[data-action="close"]:visible').click();
        await page.waitForTimeout(4700);
        assert.equal(await page.locator('.overlay:visible,.guide-dialog:visible,.guide-mini:visible').count(),0);
        assert.equal(await page.locator('#home-input').count(),1);
        assert.equal(await page.locator('#app').getAttribute('inert'),null);
      });
    }
    for(const viewport of [{width:1280,height:800},{width:1440,height:900}]) {
      await check(`Guide large and mini layouts fit ${viewport.width}×${viewport.height}`,async()=>{
        await page.setViewportSize(viewport);
        await enterGuide(page);
        await page.waitForTimeout(450);
        const large=await assertFits(page,'.guide-dialog');
        const rows=await guide(page).locator('.guide-task').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return{y:r.y,bottom:r.bottom};}));
        assert(rows.every(r=>r.y>=0&&r.bottom<=viewport.height),'All five guide rows must be visible');
        await startGuideTask(page,4);
        await page.waitForTimeout(450);
        const mini=await assertFits(page,'.guide-mini');
        assert(mini.x<viewport.width/2&&mini.y>viewport.height*0.45,'Mini guide must sit in the lower-left region');
        assert(mini.width<large.width&&mini.height<large.height,'Mini must be materially smaller than guide dialog');
        return{large,mini};
      });
    }
    for(const [index,file] of routes.slice(0,4).entries()) {
      await check(`Existing demo ${index+1}: smoke plus working fifth navigation entry`,async()=>{
        await page.goto(url(file));
        const nav=page.locator('.demo-tabs a[href*="05-guide-panel.html"]');
        assert.equal(await nav.count(),1,'Existing page must expose the fifth demo navigation');
        if(index===3) {
          await page.locator('[data-action="pick-role"][data-role="product"]').click();
          await page.locator('[data-action="role-next"]').click();
          await page.locator('.role-task-line').first().waitFor();
        } else {
          await page.locator('[data-action="get-tasks"]').click();
          await page.locator('.task-row:visible').first().waitFor({timeout:15000});
          await page.waitForFunction(()=>[...document.querySelectorAll('.task-row')].some(e=>e.offsetWidth&&!e.classList.contains('streaming')&&!e.classList.contains('waiting')&&e.querySelector('[data-editor]')?.value.trim()),null,{timeout:15000});
        }
        await page.locator('[data-action="start"][data-index="0"]:visible').last().click();
        await page.locator('.user-message').waitFor();
        await page.locator('.artifact').waitFor({timeout:10000});
        assert.equal(await page.locator('.guide-mini:visible').count(),0,'Fifth demo must not leak into earlier demos');
        await nav.click();
        assert(new URL(page.url()).pathname.endsWith('/05-guide-panel.html'));
        await page.locator('.intro-dialog').waitFor();
      });
    }
    assert.equal(runtimeErrors.length,0,JSON.stringify(runtimeErrors));
    assert.equal(missingResources.length,0,JSON.stringify(missingResources));
    console.log(`PASS: ${results.length} guide checks; no runtime errors or missing local resources.`);
  } finally {
    const suffix=only?'-'+only.replace(/[^a-z0-9]+/gi,'-').slice(0,100):'';
    fs.writeFileSync(path.join(__dirname,`verification-guide${suffix}.json`),JSON.stringify({completedAt:new Date().toISOString(),results,runtimeErrors,missingResources},null,2));
    await browser.close();
  }
})().catch(error=>{console.error('FAIL:',currentCase,error);process.exit(1);});
