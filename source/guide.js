/* Expanded onboarding guide -> docked guide. Local interaction prototype only. */
(() => {
  if (variant !== 'guide') return;
  const original = { reset, renderOverlay, closeOverlay, beginLoading, chat, launchTask, runTask, home, demoBar, executionMarkup, artifactMarkup };
  const copy = window.LINGXI_GUIDE_COPY;
  const guide = { mode: 'closed', ready: false, launched: false, editing: null, animation: null, epoch: 0, baseline: [] };
  const $ = s => document.querySelector(s);
  const root = () => document.getElementById('guide-panel-root');
  const overlay = () => document.getElementById('overlay-root');
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clone = value => JSON.parse(JSON.stringify(value));

  function prepareGuideTasks() {
    state.contexts = ['none','error'].includes(currentScenario)?[]:clone(window.LINGXI_GUIDE_CONTEXTS);
    const contextual = window.buildLingxiGuideTasks(state.contexts);
    const fallback = window.LINGXI_GUIDE_FALLBACK_TASKS;
    tasks = window.LINGXI_GUIDE_TASKS.map(slot=>clone(contextual.find(t=>t.templateKey===slot.templateKey)||fallback.find(t=>t.templateKey===slot.templateKey)));
    state.fallback = contextual.length===0;
    guide.baseline=clone(tasks);
    guide.ready = true;
  }
  function stopMorph() {
    guide.epoch++;
    guide.animation?.cancel(); guide.animation = null;
    document.querySelectorAll('.guide-morph,.guide-veil-out').forEach(e => e.remove());
  }
  function materialNames(t) { return t.files.length ? t.files.map(f => sourcePill(f, t.sample)).join('') : '<span class="no-source">开始后可补充你的资料</span>'; }
  function refreshSources(t) {
    t.sourceText=t.files.length?'附 '+t.files.map(f=>'《'+f.replace(/_示例\.[^.]+$/,'')+'》').join('、')+'（示例）':'未选择参考资料';
  }
  function sourcePill(file, sample=false) {
    const calendar=/\.ics$/i.test(file);
    return `<span class="file-pill guide-source" data-source-file="${esc(file)}" title="${esc(file)}"><span class="file-type ${calendar?'calendar':type(file)}">${calendar?I('calendar-days'):glyph(type(file))}</span><span class="filename">${esc(calendar?file.replace(/\.ics$/i,''):file)}</span>${sample&&!/示例/.test(file)?'<span class="file-origin">示例</span>':''}</span>`;
  }
  function taskSources(t) {
    return t.files.map(f=>sourcePill(f,t.sample)).join('');
  }
  function editMarkup(t, i) {
    const options = tasks.flatMap(x=>x.sampleSources).filter((x,n,all)=>all.findIndex(y=>y.name===x.name)===n);
    return `<div class="guide-editor"><label for="guide-edit-${i}">任务要求</label><textarea id="guide-edit-${i}" data-guide-editor="${i}" aria-label="修改任务要求">${esc(t.value)}</textarea><div class="guide-edit-files">${t.files.map((f,n)=>`<span class="file-pill"><span class="file-type ${type(f)}">${glyph(type(f))}</span><span class="filename">${esc(f)}</span><button data-action="guide-remove-file" data-index="${i}" data-file="${n}" aria-label="移除 ${esc(f)}">${I('x')}</button></span>`).join('')}<select aria-label="添加或更换参考资料" data-guide-material="${i}"><option value="">＋ 添加参考资料</option>${options.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}</select></div><div class="guide-edit-footer"><button class="secondary" data-action="guide-edit-done">收起</button><button class="primary" data-action="guide-start" data-index="${i}">开始${I('arrow-up-right')}</button></div></div>`;
  }
  function guideTask(t, i) {
    return `<article class="guide-task ${guide.editing===i?'is-editing':''}" data-guide-task="${i}"><button class="guide-task-main" data-action="guide-start" data-index="${i}" aria-label="开始：${esc(t.label)}"><span class="guide-task-body"><span class="guide-task-files">${taskSources(t)}</span><span class="guide-task-title">${esc(t.label)}</span></span>${t.schedule?`<span class="guide-frequency">${I('clock-3')}${esc(t.schedule.summary)}</span>`:''}<span class="guide-task-arrow">${I('arrow-up-right')}</span></button><button class="guide-edit-button" data-action="guide-edit" data-index="${i}" aria-label="修改：${esc(t.label)}" title="修改要求与资料">${I('pencil-line')}</button>${guide.editing===i?editMarkup(t,i):''}</article>`;
  }
  function guideMarkup() {
    return `<div class="guide-content"><header class="guide-header"><div class="guide-brand">${logo()}<b>开始使用灵犀</b></div><div class="guide-heading"><h2>${state.fallback?'带上这组示例资料，试试灵犀':'这些资料，可以交给灵犀接着做'}</h2></div></header>
      <section class="guide-section"><div class="guide-section-head"><h3>定时完成</h3><span class="section-line"></span></div>${tasks.slice(0,2).map(guideTask).join('')}</section>
      <section class="guide-section"><div class="guide-section-head"><h3>立即开始</h3><span class="section-line"></span></div>${tasks.slice(2).map((t,i)=>guideTask(t,i+2)).join('')}</section>
      <footer class="guide-footer"><button data-action="guide-self-input">我想自己输入${I('arrow-right')}</button></footer></div>`;
  }
  function bindGuideEditors() {
    document.querySelectorAll('[data-guide-editor]').forEach(el=>el.addEventListener('input',()=>{
      const t=tasks[+el.dataset.guideEditor];t.value=el.value;
      el.closest('.guide-editor').querySelector('[data-action="guide-start"]').disabled=!el.value.trim();
    }));
    document.querySelectorAll('[data-guide-material]').forEach(el=>el.addEventListener('change',()=>{
      if (!el.value) return;
      const t=tasks[+el.dataset.guideMaterial];
      if (!t.files.includes(el.value)) t.files.push(el.value);
      refreshSources(t);
      refreshGuide();
    }));
  }
  function refreshGuide() {
    const dialog=$('.guide-dialog');if(!dialog)return;
    const scroll=dialog.scrollTop;
    dialog.querySelector('.guide-content').outerHTML=guideMarkup();icons();bindGuideEditors();dialog.scrollTop=scroll;
  }
  function showGuide(restoring=false) {
    stopMorph();
    if(!guide.ready)prepareGuideTasks();
    guide.mode='large';guide.editing=null;
    if(state.phase!=='chat')state.phase='guide';
    root().innerHTML='';
    overlay().innerHTML=`<div class="overlay guide-overlay"><section class="dialog guide-dialog ${restoring?'guide-restoring':''}" role="dialog" aria-modal="true" aria-label="开始使用灵犀"><button class="close-dialog" data-action="guide-close" aria-label="${guide.launched&&state.phase==='chat'?'收起新手指南':'关闭新手指南'}">${I('x')}</button>${guideMarkup()}</section></div>`;
    document.getElementById('app').inert=true;icons();bindGuideEditors();
    if(!staticMode)$('.guide-dialog .close-dialog')?.focus({preventScroll:true});
  }
  function miniMarkup() {
    return `<aside class="guide-mini" aria-label="新手指南"><header class="guide-mini-head">${logo()}<strong>新手指南</strong><button data-action="guide-expand" title="展开完整指南" aria-label="展开完整指南">${I('expand')}</button><button data-action="guide-dismiss" title="关闭新手指南" aria-label="关闭新手指南">${I('x')}</button></header><div class="guide-mini-list">${tasks.map((t,i)=>`<button class="guide-mini-task ${state.selected?.id===t.id?'active':''}" data-action="guide-start" data-index="${i}" title="${esc(t.files.join('、')+' · '+t.label)}"><span class="icon">${I(t.icon)}</span><span>${esc(t.shortLabel)}</span><span class="mini-indicator">${I(state.selected?.id===t.id?'check':'arrow-up-right')}</span></button>`).join('')}</div></aside>`;
  }
  function renderMini(hidden=false) {
    if(guide.mode!=='mini'){root().innerHTML='';return;}
    root().innerHTML=miniMarkup();
    if(hidden)$('.guide-mini').style.visibility='hidden';
    icons();
  }
  function collapseWithMotion(startRect, content) {
    guide.mode='mini';renderMini(!!startRect&&!reducedMotion());
    if(!startRect||reducedMotion())return;
    const epoch=guide.epoch,target=$('.guide-mini').getBoundingClientRect();
    const morph=document.createElement('div');morph.className='guide-morph';morph.setAttribute('aria-hidden','true');morph.innerHTML=content;
    Object.assign(morph.style,{left:startRect.left+'px',top:startRect.top+'px',width:startRect.width+'px',height:startRect.height+'px'});
    morph.querySelector('.guide-content').style.width=startRect.width+'px';
    document.body.append(morph);
    const veil=document.createElement('div');veil.className='guide-veil-out';document.body.append(veil);
    veil.animate([{opacity:1},{opacity:0}],{duration:290,easing:'ease-out',fill:'forwards'}).finished.then(()=>veil.remove());
    morph.querySelector('.guide-content').animate([{opacity:1},{opacity:0}],{duration:150,easing:'ease-out',fill:'forwards'});
    guide.animation=morph.animate([
      {left:startRect.left+'px',top:startRect.top+'px',width:startRect.width+'px',height:startRect.height+'px',borderRadius:'20px'},
      {left:target.left+'px',top:target.top+'px',width:target.width+'px',height:target.height+'px',borderRadius:'15px'}
    ],{duration:600,easing:'cubic-bezier(.26,.76,.22,1)',fill:'forwards'});
    guide.animation.finished.then(()=>{
      morph.remove();if(epoch!==guide.epoch)return;
      guide.animation=null;const mini=$('.guide-mini');if(mini){mini.style.visibility='';mini.animate([{opacity:0},{opacity:1}],{duration:160});}
    }).catch(()=>morph.remove());
  }
  function closeGuide() {
    const dialog=$('.guide-dialog'),rect=dialog?.getBoundingClientRect(),html=dialog?.innerHTML;
    stopMorph();overlay().innerHTML='';document.getElementById('app').inert=false;guide.editing=null;
    if(guide.launched&&state.phase==='chat'){
      collapseWithMotion(rect,html);document.querySelector('#chat-input')?.focus({preventScroll:true});
    }else{
      guide.mode='closed';root().innerHTML='';state.phase='home';renderShell();$('#home-input')?.focus({preventScroll:true});
    }
  }
  function dismissGuide() {
    stopMorph();guide.mode='closed';root().innerHTML='';
    // Guide dismissal is deliberately independent of conversation execution timers.
    $('#chat-input')?.focus({preventScroll:true});
  }
  function startGuideTask(i) {
    if(!tasks[i]||!tasks[i].value.trim())return;
    const dialog=$('.guide-dialog'),rect=dialog?.getBoundingClientRect(),html=dialog?.innerHTML;
    stopMorph();guide.launched=true;guide.mode='mini';guide.editing=null;
    const t=clone(tasks[i]);
    const baseline=guide.baseline.find(item=>item.id===t.id);
    const changedPrompt=t.value!==baseline.prompt,changedFiles=JSON.stringify(t.files)!==JSON.stringify(baseline.files);
    t.customized=changedPrompt||changedFiles;
    state.scheduleConfirmed=false;
    if(t.kind==='scheduled'){
      state.scheduleDraft={...clone(t.configDraft),sourceFiles:[...t.files]};
      if(changedPrompt)state.scheduleDraft.instruction=t.value;
      if(changedFiles)state.scheduleDraft.sourceScope=t.files.length?'当前选定的参考资料，按任务要求读取。':'尚未选择参考资料。';
    }else if(t.customized){
      t.output=t.shortLabel+' · 新任务';
      t.artifactHtml=`<h4>任务要求已带入</h4><p>${esc(t.value)}</p><h4 style="margin-top:14px">参考资料</h4><p>${t.files.length?t.files.map(f=>esc(f)).join('、'):'可以继续在会话中补充资料。'}</p><p style="margin-top:14px;color:#9a8da5">演示说明：这里展示修改后的任务承接，未生成新的分析成果。</p>`;
    }
    original.launchTask(t);
    if(t.kind==='scheduled'){
      const scroll=$('.chat-scroll');
      if(scroll)scroll.scrollTo({top:scroll.scrollHeight,behavior:'instant'});
    }
    collapseWithMotion(rect,html);
    if(!staticMode)$('#chat-input')?.focus({preventScroll:true});
  }

  function scheduleChat() {
    const t=state.selected,d=state.scheduleDraft;
    return `<div class="chat-scroll"><section class="chat"><div class="chat-top"><button data-action="guide-expand">${I('arrow-left')}新手指南</button></div><div class="user-message">${esc(t.value)}<div class="task-attachments">${materialNames(t)}</div></div><div class="assistant-head">${logo('small')}灵犀</div><p class="assistant-copy">已准备好定时任务的设置，确认时间和资料后就可以创建。</p><div id="execution-region">${state.scheduleConfirmed?scheduleCreated():scheduleDraftMarkup(d,t)}</div></section></div><div class="chat-compose-wrap">${composer(true)}</div>`;
  }
  function scheduleDraftMarkup(d,t) {
    return `<section class="schedule-draft"><header class="schedule-draft-head">${I('clock-3')}<strong>${esc(t.shortLabel)}</strong><span>待确认</span></header><div class="schedule-fields"><div class="schedule-field"><label for="guide-schedule-day">执行时间</label><div class="schedule-time"><select id="guide-schedule-day" aria-label="执行星期">${['周日','周一','周二','周三','周四','周五','周六'].map((v,i)=>`<option value="${i}" ${d.weekday===i?'selected':''}>每${v}</option>`).join('')}</select><input id="guide-schedule-time" aria-label="执行时间" type="time" value="${esc(d.time)}"><span>北京时间</span></div></div><div class="schedule-field"><span>参考资料</span><div class="schedule-source-list">${materialNames(t)}</div></div><div class="schedule-field"><span>读取范围</span><div>${esc(d.sourceScope)}</div></div><div class="schedule-field"><label for="guide-schedule-instruction">输出要求</label><textarea id="guide-schedule-instruction" aria-label="定时任务要求">${esc(d.instruction)}</textarea></div><div class="schedule-field"><span>完成后</span><div>在任务记录中生成结果，并通知我</div></div></div><footer class="schedule-draft-footer"><span>确认前不会自动执行<br>创建后仍可调整时间与资料</span><button class="primary" data-action="guide-confirm-schedule">确认创建${I('check')}</button></footer></section>`;
  }
  function scheduleCreated() {
    const d=state.scheduleDraft,day=['周日','周一','周二','周三','周四','周五','周六'][d.weekday];
    return `<div class="schedule-created"><div class="schedule-created-heading">${I('circle-check')}<strong>定时任务已创建</strong></div><p>每${day} ${esc(d.time)}，按你确认的资料与要求生成结果。</p><p>完成后，你可以在任务记录中查看，并收到通知。</p><button data-action="guide-edit-schedule">调整任务设置${I('arrow-up-right')}</button></div>`;
  }
  function saveScheduleDraft() {
    if(state.selected?.kind!=='scheduled'||state.scheduleConfirmed)return;
    const d=state.scheduleDraft;
    if($('#guide-schedule-day'))d.weekday=Number($('#guide-schedule-day').value);
    if($('#guide-schedule-time'))d.time=$('#guide-schedule-time').value;
    if($('#guide-schedule-instruction'))d.instruction=$('#guide-schedule-instruction').value;
  }
  function confirmSchedule() {
    saveScheduleDraft();
    if(!state.scheduleDraft.time||!state.scheduleDraft.instruction.trim()){announce('请补充执行时间和任务要求');return;}
    if(!state.selected.files.length){announce('请先在新手指南中选择参考资料');showGuide(true);guide.editing=tasks.findIndex(t=>t.id===state.selected.id);refreshGuide();return;}
    state.scheduleConfirmed=true;state.runDone=true;
    state.scheduleDraft.status='enabled';state.scheduleDraft.enabled=true;
    $('#execution-region').innerHTML=scheduleCreated();icons();
  }

  home=function(){
    return original.home().replace('data-action="open-intro"','data-action="'+(guide.ready?'guide-expand':'open-intro')+'"').replace('用 WPS 资料开始','查看新手指南');
  };
  chat=function(){
    if(state.selected?.kind==='scheduled')return scheduleChat();
    let html=original.chat().replace(/<button data-action="back-tasks">[\s\S]*?<\/button>/,`<button data-action="guide-expand">${I('arrow-left')}新手指南</button>`);
    html=html.replace(/<div class="task-attachments">[\s\S]*?<\/div>/,`<div class="task-attachments">${materialNames(state.selected)}</div>`);
    if(state.selected.customized)html=html.replace(/<p class="assistant-copy">[\s\S]*?<\/p>/,`<p class="assistant-copy">${state.selected.files.length?'已带上你修改后的要求和资料。':'已保留你的任务要求，可以继续补充参考资料。'}</p>`);
    return html;
  };
  executionMarkup=function(){return state.selected?.customized&&state.selected.kind!=='scheduled'?`<div class="execution"><div class="execution-top"><span>修改后的任务已传入会话</span><span class="run-status">${I('check')}已接收</span></div></div>`:original.executionMarkup();};
  artifactMarkup=function(){const html=original.artifactMarkup();return state.selected?.customized?html.replace('<small>已生成</small>','<small>演示承接</small>'):html;};
  runTask=function(){
    if(state.selected?.kind==='scheduled')return;
    if(state.selected?.customized){state.runDone=true;$('#execution-region').innerHTML=executionMarkup()+artifactMarkup();icons();return;}
    original.runTask();
  };
  renderOverlay=function(phase){if(phase==='recommend'||phase==='guide'){showGuide();return;}original.renderOverlay(phase);};
  closeOverlay=function(){
    if($('.guide-dialog')){closeGuide();return;}
    if(state.phase==='chat'){
      overlay().innerHTML='';document.getElementById('app').inert=false;return;
    }
    guide.mode='closed';original.closeOverlay();
  };
  beginLoading=function(){
    cancelFlow();prepareGuideTasks();guide.mode='closed';root().innerHTML='';
    transitionTo('loading',()=>{
      const token=generation;
      function step(n,title,desc){
        if(token!==generation||!$('#load-title'))return;
        $('#load-title').textContent=title;$('#load-description').textContent=desc;$('#load-progress').style.width=[20,64,97][n]+'%';
        document.querySelectorAll('[data-step]').forEach((el,i)=>{
          el.className=i<n?'done':i===n?'active':'';
          el.innerHTML=(i<n?I('check-circle-2'):'<b class="step-dot"></b>')+['获取近期文件','读取文件与日程','准备对应任务'][i];
        });icons();
      }
      step(0,'正在获取你最近的 WPS 文件','也会带上相关的日程。');
      later(()=>{
        step(1,state.fallback?'先为你备好一组示例资料':'正在读取这些文件和日程','');
        if($('#loading-source'))$('#loading-source').innerHTML=tasks.map(t=>sourcePill(t.files[0],t.sample)).join('');
      },850);
      later(()=>step(2,'正在为这些资料准备任务',''),1650);
      later(()=>transitionTo('guide'),2350);
    });
  };
  demoBar=function(){
    original.demoBar();
    const select=$('#scenario-select');
    if(select)select.innerHTML=[['full','已获取 WPS 文件'],['none','无可用资料 · 示例兜底'],['error','获取异常 · 示例兜底']].map(([v,label])=>`<option value="${v}" ${v===currentScenario?'selected':''}>${label}</option>`).join('');
  };
  reset=function(){
    stopMorph();cancelFlow();guide.mode='closed';guide.ready=false;guide.launched=false;guide.editing=null;root().innerHTML='';
    state={phase:'intro',selected:null,runStep:0,runDone:false,drawer:false,drawerReady:false,role:null,fallback:false};
    tasks=clone(window.LINGXI_GUIDE_TASKS);overlay().innerHTML='';document.getElementById('app').inert=false;renderShell();original.renderOverlay('intro');
  };

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b)return;
    const a=b.dataset.action,i=+b.dataset.index;
    if(a==='guide-start')startGuideTask(i);
    if(a==='guide-expand'){saveScheduleDraft();showGuide(true);}
    if(a==='guide-close')closeGuide();
    if(a==='guide-dismiss')dismissGuide();
    if(a==='guide-self-input'){
      if(state.phase==='chat')closeGuide();
      else{guide.launched=true;guide.mode='mini';overlay().innerHTML='';document.getElementById('app').inert=false;state.phase='home';renderShell();renderMini();$('#home-input')?.focus();}
    }
    if(a==='guide-edit'){guide.editing=guide.editing===i?null:i;refreshGuide();$('[data-guide-editor]')?.focus({preventScroll:true});$('[data-guide-editor]')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
    if(a==='guide-edit-done'){guide.editing=null;refreshGuide();}
    if(a==='guide-remove-file'){tasks[i].files.splice(+b.dataset.file,1);refreshSources(tasks[i]);refreshGuide();}
    if(a==='guide-confirm-schedule')confirmSchedule();
    if(a==='guide-edit-schedule'){state.scheduleConfirmed=false;state.runDone=false;$('#execution-region').innerHTML=scheduleDraftMarkup(state.scheduleDraft,state.selected);icons();}
    if(a==='home'&&guide.mode==='mini')renderMini();
  });
  // The scheduling controls stay mounted while the guide is expanded; preserve edits as they happen.
  document.addEventListener('input',e=>{if(e.target.closest('.schedule-draft'))saveScheduleDraft();});
  document.addEventListener('change',e=>{if(e.target.closest('.schedule-draft'))saveScheduleDraft();});
  if(!['full','none','error'].includes(currentScenario))currentScenario='full';
  demoBar();reset();icons();
  if(staticMode){
    const phase=params.get('state');
    cancelFlow();prepareGuideTasks();
    if(phase==='home')closeOverlay();
    else if(phase==='recommend'||phase==='guide')showGuide();
    else if(['chat','result','mini','schedule'].includes(phase)){
      showGuide();startGuideTask(phase==='schedule'?0:2);stopMorph();renderMini();
      if(phase==='result'){state.runDone=true;renderShell();}
    }else if(phase==='loading')original.renderOverlay('loading');
  }
})();
