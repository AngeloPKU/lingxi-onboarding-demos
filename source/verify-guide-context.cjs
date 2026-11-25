/* Focused regression: context -> suitable task -> matching material in the conversation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL}=require('node:url');
const {chromium}=require('/Users/wsq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const results=[];
let currentCase='';
const clone=x=>JSON.parse(JSON.stringify(x));
const stem=name=>name.replace(/\.[^.]+$/,'');
function url(scenario='full') {
  const u=new URL(pathToFileURL(path.join(root,'05-guide-panel.html')));
  u.searchParams.set('scenario',scenario);return u.href;
}
async function check(name,fn) {
  if(only&&!only.split('|').some(x=>name.includes(x)))return;
  currentCase=name;const start=Date.now();
  try{const detail=await fn();results.push({name,status:'passed',durationMs:Date.now()-start,...detail});console.log('PASS:',name);}
  catch(error){results.push({name,status:'failed',durationMs:Date.now()-start,error:error.message});throw error;}
}
function loadFixture() {
  const sandbox={window:{},console};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'guide-data.js'),'utf8'),sandbox,{filename:'guide-data.js'});
  const data=sandbox.window;
  assert(Array.isArray(data.LINGXI_GUIDE_CONTEXTS),'Fixture must expose contexts as the input');
  assert.equal(typeof data.buildLingxiGuideTasks,'function','Fixture must expose the context-to-task builder');
  return data;
}
function assertSources(taskList,contexts) {
  const byId=new Map(contexts.map(c=>[c.id,c]));
  for(const task of taskList) {
    assert(task.sourceIds?.length,'Every recommendation needs a source identity: '+task.id);
    const sourceNames=task.sourceIds.map(id=>{assert(byId.has(id),'Unknown source: '+id);return byId.get(id).name;});
    assert.deepEqual([...task.files].sort(),sourceNames.sort(),'Task files must match referenced contexts: '+task.id);
    assert(task.prompt?.trim()&&task.value?.trim(),'Task requires usable prompt');
    assert(sourceNames.some(name=>task.prompt.includes(name)||task.prompt.includes(stem(name))),'Prompt should identify the actual source material: '+task.id);
  }
}
const dialog=page=>page.locator('.guide-dialog:visible');
async function enter(page,scenario='full',contexts=null) {
  await page.goto(url(scenario));
  if(contexts)await page.evaluate(value=>{window.LINGXI_GUIDE_CONTEXTS=value;},contexts);
  await page.locator('[data-action="get-tasks"]').click();
  await dialog(page).waitFor({timeout:15000});
  await page.waitForTimeout(500);
}
async function browserTasks(page) {
  return page.evaluate(()=>tasks.map(t=>({id:t.id,kind:t.kind,files:[...t.files],sourceIds:[...t.sourceIds],prompt:t.value,sample:t.sample})));
}
async function assertRowSources(page,list) {
  assert.equal(await dialog(page).locator('.guide-task').count(),list.length);
  for(let index=0;index<list.length;index++) {
    const row=dialog(page).locator(`[data-guide-task="${index}"]`);
    const text=await row.innerText();
    assert(list[index].files.length>0,'Every visible task must have source material');
    const elements=await row.locator('.guide-task-files .guide-source[data-source-file]').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('data-source-file')));
    assert.deepEqual(elements,list[index].files,'Each source needs its own matching file/calendar element');
    for(const name of list[index].files)assert(text.includes(name)||text.includes(stem(name)),'Visible recommendation must identify source '+name);
  }
}
async function launchAndCheck(page,index,expected) {
  await dialog(page).locator(`[data-action="guide-start"][data-index="${index}"]`).click();
  await page.locator('.user-message').first().waitFor();
  await page.locator('.guide-mini:visible').waitFor();
  await page.locator('.guide-dialog').waitFor({state:'hidden'});
  const actual=await page.evaluate(()=>({files:[...state.selected.files],prompt:state.selected.value}));
  assert.deepEqual(actual.files,expected.files,'Launch must preserve exact source files');
  assert.equal(actual.prompt,expected.prompt,'Launch must preserve the generated prompt');
  const message=await page.locator('.user-message').first().innerText();
  for(const name of expected.files)assert(message.includes(name),'Conversation must carry source '+name);
  return actual;
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.setDefaultTimeout(10000);
  const runtimeErrors=[],missingResources=[];
  page.on('pageerror',e=>runtimeErrors.push({test:currentCase,message:e.message}));
  page.on('requestfailed',r=>{if(r.url().startsWith('file:')&&r.failure()?.errorText!=='net::ERR_ABORTED')missingResources.push({test:currentCase,url:r.url(),error:r.failure()?.errorText});});
  try {
    await check('Data: normal contexts produce two scheduled and three immediate source-backed tasks',async()=>{
      const data=loadFixture(),contexts=clone(data.LINGXI_GUIDE_CONTEXTS),list=clone(data.buildLingxiGuideTasks(contexts));
      assert.equal(list.filter(t=>t.kind==='scheduled').length,2);
      assert.equal(list.filter(t=>t.kind==='immediate').length,3);
      assertSources(list,contexts);
      assert(list.every(t=>t.sample===false),'Normal context recommendations must not be presented as fallback samples');
      return{contexts:contexts.length,tasks:list.length};
    });
    await check('Data: removing presentation context removes the PPT recommendation',async()=>{
      const data=loadFixture(),contexts=clone(data.LINGXI_GUIDE_CONTEXTS);
      const presentation=contexts.find(c=>c.kind==='presentation');
      assert(presentation,'Baseline fixture needs a presentation for this test');
      const reduced=contexts.filter(c=>c.id!==presentation.id),list=clone(data.buildLingxiGuideTasks(reduced));
      assert.equal(list.length,4,'Without PPT, four supported tasks should remain');
      assertSources(list,reduced);
      assert(list.every(t=>!t.sourceIds.includes(presentation.id)&&!t.files.includes(presentation.name)));
      assert(!list.some(t=>/PPT|\.pptx?\b|演示文稿/i.test(t.label+' '+t.prompt)),'Builder must not fabricate a PPT recommendation');
    });
    await check('Data: renaming a file updates task files and prompt; missing related document suppresses meeting task',async()=>{
      const data=loadFixture(),contexts=clone(data.LINGXI_GUIDE_CONTEXTS);
      const presentation=contexts.find(c=>c.kind==='presentation'),oldName=presentation.name;
      presentation.name='季度经营汇报_联动验证.pptx';
      const renamed=clone(data.buildLingxiGuideTasks(contexts));
      assertSources(renamed,contexts);
      const task=renamed.find(t=>t.sourceIds.includes(presentation.id));
      assert(task&&task.files.includes(presentation.name));
      assert(task.prompt.includes(presentation.name)||task.prompt.includes(stem(presentation.name)));
      assert(!task.prompt.includes(oldName),'Renamed prompt must not retain the previous filename');
      const calendar=contexts.find(c=>c.kind==='calendar');
      assert(calendar?.event?.relatedContextIds?.length);
      const reduced=contexts.filter(c=>!calendar.event.relatedContextIds.includes(c.id));
      const unlinked=clone(data.buildLingxiGuideTasks(reduced));
      assert(!unlinked.some(t=>t.sourceIds.includes(calendar.id)),'Meeting recommendation requires its related document');
      assert.deepEqual(clone(data.buildLingxiGuideTasks([])),[],'No source contexts must not create fabricated personalized tasks');
    });
    await check('UI: five source-linked rows remain while explanatory clutter is removed',async()=>{
      await enter(page);
      const list=await browserTasks(page);
      assert.equal(list.filter(t=>t.kind==='scheduled').length,2);
      assert.equal(list.filter(t=>t.kind==='immediate').length,3);
      await assertRowSources(page,list);
      assert.equal(await dialog(page).locator('.guide-context:visible').count(),0);
      assert.equal(await dialog(page).locator('.guide-heading p:visible').count(),0,'Remove the two explanatory lines under the title');
      assert.equal(await dialog(page).locator('.guide-section-head p:visible').count(),0,'Remove descriptions beside section headings');
      assert.equal(await dialog(page).locator('.guide-footer p:visible').count(),0,'Remove explanatory footer copy');
      const copy=await dialog(page).innerText();
      assert(!/当前使用示例资料|按资料类型提供常见任务|这里有几个常见用法|开始任务前.{0,15}编辑图标/.test(copy),'Normal guide retains redundant explanation');
    });
    await check('UI: all five recommendations launch with their same materials and mini guide',async()=>{
      await enter(page);
      const list=await browserTasks(page);
      for(let index=0;index<list.length;index++) {
        await launchAndCheck(page,index,list[index]);
        if(index<list.length-1) {
          await page.locator('.guide-mini [data-action="guide-expand"]').click();
          await dialog(page).waitFor();
        }
      }
    });
    await check('UI: changing context filename updates recommendation and launched attachment',async()=>{
      const data=loadFixture(),contexts=clone(data.LINGXI_GUIDE_CONTEXTS);
      const presentation=contexts.find(c=>c.kind==='presentation'),oldName=presentation.name;
      presentation.name='季度经营汇报_界面验证.pptx';
      await enter(page,'full',contexts);
      const list=await browserTasks(page),index=list.findIndex(t=>t.sourceIds.includes(presentation.id));
      assert(index>=0);
      assert(list[index].files.includes(presentation.name),'UI must rebuild from changed contexts');
      assert(list[index].prompt.includes(presentation.name)||list[index].prompt.includes(stem(presentation.name)));
      const visible=await dialog(page).locator(`[data-guide-task="${index}"]`).innerText();
      assert(visible.includes(presentation.name)||visible.includes(stem(presentation.name)));
      assert(!visible.includes(oldName),'UI source label must not retain old name');
      await launchAndCheck(page,index,list[index]);
    });
    await check('UI: missing PPT never claims the original file; any replacement is clearly a sample',async()=>{
      const data=loadFixture(),all=clone(data.LINGXI_GUIDE_CONTEXTS),removed=all.find(c=>c.kind==='presentation');
      const contexts=all.filter(c=>c.kind!=='presentation');
      await enter(page,'full',contexts);
      const list=await browserTasks(page);
      assert(list.length>=4&&list.length<=5,'Only supported recommendations and an optional explicit sample should remain');
      await assertRowSources(page,list);
      assert(!list.some(t=>t.files.includes(removed.name)||t.prompt.includes(removed.name)),'Removed personal PPT must not survive in recommendations');
      const presentationTasks=list.filter(t=>/PPT|\.pptx?\b|演示文稿/i.test(t.prompt+' '+t.files.join(' ')));
      assert(presentationTasks.every(t=>t.sample===true&&t.files.some(name=>name.includes('示例'))),'A replacement PPT must use clearly identified sample material');
      if(list.length===5)assert(presentationTasks.length>0,'The extra task must disclose its sample source');
    });
    for(const scenario of ['none','error']) {
      await check(`Fallback ${scenario}: executable tasks with clearly identified sample materials`,async()=>{
        await enter(page,scenario);
        const list=await browserTasks(page);
        assert(list.length>0,'Fallback must remain actionable');
        assert(list.every(t=>t.sample===true),'Fallback tasks must be identified as samples');
        await assertRowSources(page,list);
        assert((await dialog(page).innerText()).includes('示例'),'Fallback material identity must be visible');
        const index=list.findIndex(t=>t.kind==='immediate');
        assert(index>=0);await launchAndCheck(page,index,list[index]);
        assert((await page.locator('.user-message').first().innerText()).includes('示例'),'Sample disclosure must carry into conversation');
        await page.locator('.artifact').waitFor({timeout:10000});
      });
    }
    for(const viewport of [{width:1280,height:800},{width:1440,height:900}]) {
      await check(`Layout: source-linked guide fits ${viewport.width}×${viewport.height}`,async()=>{
        await page.setViewportSize(viewport);await enter(page);
        const info=await dialog(page).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,rows:[...el.querySelectorAll('.guide-task')].map(e=>{const b=e.getBoundingClientRect();return{top:b.top,bottom:b.bottom,right:b.right};})};});
        assert(info.x>=0&&info.y>=0&&info.right<=info.width&&info.bottom<=info.height,'Dialog must fit viewport');
        assert(info.pageWidth<=info.width);
        assert(info.rows.every(r=>r.top>=0&&r.bottom<=info.height&&r.right<=info.width),'All five recommendation rows must fit viewport');
        return info;
      });
    }
    assert.equal(runtimeErrors.length,0,JSON.stringify(runtimeErrors));
    assert.equal(missingResources.length,0,JSON.stringify(missingResources));
    console.log(`PASS: ${results.length} focused context checks; no runtime errors or missing resources.`);
  } finally {
    const suffix=only?'-'+only.replace(/[^a-z0-9]+/gi,'-').slice(0,100):'';
    fs.writeFileSync(path.join(__dirname,`verification-guide-context${suffix}.json`),JSON.stringify({completedAt:new Date().toISOString(),results,runtimeErrors,missingResources},null,2));
    await browser.close();
  }
})().catch(error=>{console.error('FAIL:',currentCase,error);process.exit(1);});
