/* 第五套引导：先取得上下文，再匹配合适的任务。此处为原型预置的模拟获取结果。 */
(() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const contexts = [
    {
      id: 'wps-weekly-progress', name: '工作周报.docx', kind: 'document', extension: '.docx', purpose: 'weekly_progress', sample: false,
      text: '工作周报｜11月23日至29日\n已完成：整理30份资料，分为产品、流程、常见问题三个主题；完成首页与检索原型评审。\n待处理：12个条目的说明尚未补齐；试用人员可查看的资料范围待确认。\n下周计划：周二确认试用权限，周三补齐说明，周五邀请10人试用。',
      period: { start: '2026-11-23', end: '2026-11-29' },
      progress: {
        completed: ['整理 30 份资料，分为产品、流程、常见问题三个主题', '完成首页与检索原型评审'],
        open: ['12 个条目的说明尚未补齐', '试用人员可查看的资料范围待确认'],
        next: ['周二确认试用权限', '周三补齐条目说明', '周五邀请 10 人试用']
      }
    },
    {
      id: 'wps-feedback-log', name: '用户反馈记录.xlsx', kind: 'spreadsheet', extension: '.xlsx', purpose: 'feedback_log', sample: false,
      text: '反馈编号,记录时间,反馈内容,状态\nF01,2026-11-23 10:00,搜索结果缺少摘要，难以判断是否需要,待处理\nF02,2026-11-24 11:30,希望能按更新时间排列搜索结果,待处理\nF03,2026-11-25 09:15,操作流程说明太长，希望拆成几步,待处理\nF04,2026-11-26 15:00,搜索结果只有标题，不方便判断内容,待处理\nF05,2026-11-27 10:20,试用邀请链接已失效,待处理',
      columns: ['反馈编号', '记录时间', '反馈内容', '状态']
    },
    {
      id: 'wps-project-slides', name: '项目进展汇报.pptx', kind: 'presentation', extension: '.pptx', sample: false,
      text: '项目进展汇报\n第1页：团队知识库整理，目标是便于团队查找常用资料。\n第2页：完成30份资料分类，首页与检索原型已评审。\n第3页：12个条目说明待补齐，试用权限待确认。\n第4页：下周二确认权限、周三补齐条目、周五邀请10人试用。',
      pages: [
        { title: '项目目标', content: '整理团队常用资料，让产品、流程和常见问题更容易被查找到。' },
        { title: '阶段进展', content: '已整理 30 份资料并完成三个主题分类；首页和检索原型已经评审。' },
        { title: '当前问题', content: '还有 12 个条目的说明待补齐，试用人员可查看的资料范围尚未确认。' },
        { title: '下一步安排', content: '下周二确认权限，周三补齐条目说明，周五邀请 10 人试用。' }
      ]
    },
    {
      id: 'wps-regional-sales', name: '区域销售数据.xlsx', kind: 'spreadsheet', extension: '.xlsx', purpose: 'sales_comparison', sample: false,
      text: '区域,上周销售额_元,本周销售额_元\n华东,48000,54000\n华南,36000,32400\n华北,30000,33600',
      columns: ['区域', '上周销售额_元', '本周销售额_元'], unit: '元',
      rows: [
        { region: '华东', previous: 48000, current: 54000 },
        { region: '华南', previous: 36000, current: 32400 },
        { region: '华北', previous: 30000, current: 33600 }
      ]
    },
    {
      id: 'wps-project-meeting', name: '项目周会.ics', kind: 'calendar', extension: '.ics', sample: false,
      text: '项目周会｜2026年11月30日10:00—10:30（北京时间）\n议题：确认试用权限、条目补齐计划与试用安排。\n关联文档：工作周报.docx',
      event: {
        title: '项目周会', start: '2026-11-30T10:00:00+08:00', end: '2026-11-30T10:30:00+08:00', timezone: 'Asia/Shanghai',
        agenda: ['确认试用权限', '确认条目补齐计划', '确认试用安排'], relatedContextIds: ['wps-weekly-progress']
      }
    }
  ];

  const hasContent = c => c && typeof c.id === 'string' && typeof c.name === 'string' && (
    (typeof c.text === 'string' && c.text.trim()) || (Array.isArray(c.pages) && c.pages.length) ||
    (Array.isArray(c.rows) && c.rows.length) || c.event?.title
  );
  const extension = c => String(c.extension || c.name.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
  const isDoc = c => c.kind === 'document' || ['.docx', '.doc', '.txt', '.md'].includes(extension(c));
  const isSheet = c => c.kind === 'spreadsheet' || ['.xlsx', '.xls', '.csv'].includes(extension(c));
  const isSlides = c => c.kind === 'presentation' || ['.pptx', '.ppt'].includes(extension(c));
  const source = c => ({
    id: c.id, contextId: c.id, name: c.name, kind: c.kind, extension: extension(c),
    format: c.kind === 'calendar' ? 'ics' : isSheet(c) ? 'csv' : 'text',
    content: c.text || JSON.stringify(c.pages || c.rows || c.event), sample: !!c.sample
  });
  function task(data, used) {
    const files = used.map(c => c.name);
    return {
      ...data, templateKey: ({'guide-weekly-summary':'weekly-summary','guide-feedback-digest':'feedback-digest','guide-ppt-script':'slides-script','guide-sheet-analysis':'sheet-analysis','guide-meeting-prep':'meeting-prep'})[data.id], value: data.prompt, files, sourceIds: used.map(c => c.id), sample: used.every(c => !!c.sample),
      sampleSources: used.map(source),
      sourceText: files.join('、'),
      ...(data.configDraft ? { configDraft: { ...data.configDraft, sourceFiles: [...files], sourceIds: used.map(c => c.id) } } : {})
    };
  }
  function scheduleConfig(title, weekday, time, scope, instruction) {
    return { title, frequency: 'weekly', weekday, time, timezone: 'Asia/Shanghai', sourceScope: scope, instruction,
      delivery: '生成在灵犀任务记录中，完成后通知我。', status: 'draft', enabled: false };
  }
  function weeklyTask(c) {
    const instruction = `归纳《${c.name}》中上周的已完成事项、待处理问题和下一步计划；未写明的信息标注待确认。`;
    return task({
      id: 'guide-weekly-summary', kind: 'scheduled', label: '每周归纳这份周报里的工作进展', shortLabel: '每周归纳工作进展', icon: 'clock-3', tone: '',
      prompt: `每周一 09:30，归纳《${c.name}》中上周的工作进展，整理已完成事项、待处理问题和下一步计划。先让我确认时间与资料范围。`,
      output: '每周工作总结 · 设置草稿', outputText: '按周生成进展、问题与下一步计划。',
      detailText: '使用这份周报里的记录，不补写未出现的工作或成果。先确认安排，再创建任务。',
      schedule: { day: '周一', time: '09:30', summary: '每周一 09:30', timezone: 'Asia/Shanghai' }, requiresConfirmation: true,
      configDraft: scheduleConfig('每周工作总结', 1, '09:30', `《${c.name}》中上周一至周日的记录`, instruction),
      points: [
        '执行安排：每周一 09:30（北京时间）。当前是待确认的设置草稿，尚未创建定时任务。',
        `参考资料：《${c.name}》。归纳上周的已完成事项、待处理问题和下一步计划。`,
        '未写明的负责人或时间保留为待确认；没有新增记录时说明情况，不重复编写进展。'
      ]
    }, [c]);
  }
  function feedbackTask(c) {
    const instruction = `整理《${c.name}》的本周新增反馈，按问题归类并合并重复意见，保留原始编号，列出待核实和待跟进事项。`;
    return task({
      id: 'guide-feedback-digest', kind: 'scheduled', label: '每周更新这份反馈记录的问题清单', shortLabel: '每周整理反馈', icon: 'clock-3', tone: '',
      prompt: `每周五 17:00，整理《${c.name}》的本周新增反馈，归类重复问题并更新待跟进清单。先让我确认时间与资料范围。`,
      output: '每周反馈整理 · 设置草稿', outputText: '按问题归类的反馈摘要与待跟进清单。',
      detailText: '保留原始反馈编号，归类重复意见；不把尚未核实的反馈写成原因结论。',
      schedule: { day: '周五', time: '17:00', summary: '每周五 17:00', timezone: 'Asia/Shanghai' }, requiresConfirmation: true,
      configDraft: scheduleConfig('每周反馈整理', 5, '17:00', `《${c.name}》中本周一至执行时刻的新增记录`, instruction),
      points: [
        '执行安排：每周五 17:00（北京时间）。确认前不会创建或执行定时任务。',
        `参考资料：《${c.name}》。归类本周新增反馈，合并重复意见并保留原始编号。`,
        '输出问题摘要、待核实问题和待跟进事项；没有明确跟进人或日期的项目标注待确认。'
      ]
    }, [c]);
  }
  function slidesTask(c) {
    const pages = Array.isArray(c.pages) ? c.pages.filter(p => p && p.title && p.content) : [];
    const durations = pages.map((_, i) => Math.floor(300 / pages.length) + (i < 300 % pages.length ? 1 : 0));
    const points = pages.length ? pages.map((p, i) => `第 ${i + 1} 页 · ${p.title}（${durations[i]} 秒）：${p.content}`) : [
      `已带上《${c.name}》，按原有页面顺序准备讲稿，总时长控制在 5 分钟。`,
      '将每页的核心信息改写成口语表达，保留文件中的事实；没有依据的内容不补写。'
    ];
    return task({
      id: 'guide-ppt-script', kind: 'immediate', label: '为这份 PPT 写一份 5 分钟讲稿', shortLabel: 'PPT 生成讲稿', icon: 'presentation', tone: 'orange',
      prompt: `为《${c.name}》写一份 5 分钟讲稿，按页面顺序组织，标注每页用时，并列出可能被问到的问题。`,
      output: 'PPT 汇报 · 5 分钟讲稿', outputText: '逐页讲稿、时间分配与待准备的问题。',
      detailText: '围绕这份 PPT 的已有内容准备口语化讲稿，不把文件类型推断成用户的职业或当前工作目的。',
      points: [...points, `答疑准备：哪些结论需要进一步说明？有哪些尚未解决的问题？请结合《${c.name}》的原始内容确认。`]
    }, [c]);
  }
  const num = n => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`;
  const rate = (a, b) => a === 0 ? '不适用' : `${b - a > 0 ? '+' : b - a < 0 ? '−' : ''}${Math.abs((b - a) / a * 100).toFixed(1)}%`;
  function salesTask(c) {
    const rows = Array.isArray(c.rows) ? c.rows.filter(r => r && typeof r.region === 'string' && Number.isFinite(r.previous) && Number.isFinite(r.current)) : [];
    const totalPrevious = rows.reduce((sum, r) => sum + r.previous, 0);
    const totalCurrent = rows.reduce((sum, r) => sum + r.current, 0);
    const unit = c.unit || '元';
    const artifactHtml = rows.length ? `<h4>区域销售变化分析${c.sample ? ' <small>示例</small>' : ''}</h4>
      <p>依据《${esc(c.name)}》，比较本周与上周销售额；金额单位：${esc(unit)}。</p>
      <table><thead><tr><th>区域</th><th>上周</th><th>本周</th><th>增减额</th><th>增减幅度</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.region)}</td><td>${num(r.previous)}</td><td>${num(r.current)}</td><td>${signed(r.current-r.previous)}</td><td>${rate(r.previous,r.current)}</td></tr>`).join('')}
      <tr><th>合计</th><th>${num(totalPrevious)}</th><th>${num(totalCurrent)}</th><th>${signed(totalCurrent-totalPrevious)}</th><th>${rate(totalPrevious,totalCurrent)}</th></tr></tbody></table>
      <p><strong>整体变化：</strong>本周合计 ${num(totalCurrent)} ${esc(unit)}，较上周变动 ${signed(totalCurrent-totalPrevious)} ${esc(unit)}，变动幅度为 ${rate(totalPrevious,totalCurrent)}。</p>
      <p><strong>待核实：</strong>这张表只包含各区域两周销售额，无法确定变化原因；需要进一步核对订单量、客单价或渠道等信息。</p>` : undefined;
    return task({
      id: 'guide-sheet-analysis', kind: 'immediate', label: '看看这张销售表有哪些变化', shortLabel: '销售表找变化', icon: 'table-2', tone: 'green',
      prompt: `分析《${c.name}》，比较本周与上周销售额，算出各区域及整体的增减，单独列出需要进一步核实的问题。`,
      output: '区域销售 · 变化分析', outputText: '变化对比表、主要差异与待核实问题。',
      detailText: '以表中字段和单位为准计算差异；数据没有提供的原因不作推断。',
      ...(artifactHtml ? { artifactHtml } : { points: [`已带上《${c.name}》，先确认销售额字段、周期和单位，再计算变化。`, '无法由现有字段说明的原因保留为待核实问题。'] })
    }, [c]);
  }
  function meetingTask(c, docs) {
    const event = c.event;
    const names = docs.map(d => `《${d.name}》`).join('、');
    const minutes = Math.round((Date.parse(event.end) - Date.parse(event.start)) / 60000);
    const duration = Number.isFinite(minutes) && minutes > 0 ? `${minutes} 分钟` : '按日程时长';
    const dateLabel = new Date(event.start).toLocaleString('zh-CN', { timeZone: event.timezone || 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    const agenda = Array.isArray(event.agenda) ? event.agenda : [];
    const open = docs.flatMap(d => d.progress?.open || []);
    return task({
      id: 'guide-meeting-prep', kind: 'immediate', label: '为这场周会准备议程和待确认事项', shortLabel: '准备这场周会', icon: 'calendar-days', tone: '',
      prompt: `结合《${c.name}》中的“${event.title}”日程和${names}，准备${duration}的会议议程，列出待确认事项与会前准备。`,
      output: '项目周会 · 会前准备', outputText: '会议议程、待确认事项与会前准备清单。',
      detailText: '先使用已获取的日程，再结合日程关联文档准备内容，不从会议名称猜测个人工作。',
      points: [
        `会议安排：${event.title}，${dateLabel}（${event.timezone === 'Asia/Shanghai' ? '北京时间' : event.timezone || '北京时间'}），${duration}。`,
        agenda.length ? `议程草稿：${agenda.join('；')}。开始时先同步进展，结束前明确下一步与负责人。` : `议程草稿：先同步${names}中的工作进展，再确认待解决问题，最后记录下一步与负责人。`,
        open.length ? `待确认事项：${open.join('；')}。未写明的决策人和参会名单待确认。` : '待确认：会议需要作出哪些决定、由谁确认，以及会后每项行动的负责人和时间。',
        `会前准备：带上${names}及需要讨论的问题清单。没有依据的结论保留为待确认。`
      ]
    }, [c, ...docs]);
  }

  function buildLingxiGuideTasks(input) {
    const valid = Array.isArray(input) ? input.filter(hasContent).filter((c, i, all) => all.findIndex(x => x.id === c.id) === i) : [];
    const result = [];
    const progress = valid.find(c => isDoc(c) && (c.purpose === 'weekly_progress' || /工作周报|每周进展/.test(c.name)));
    const feedback = valid.find(c => isSheet(c) && (c.purpose === 'feedback_log' || /反馈记录/.test(c.name)));
    const slides = valid.find(isSlides);
    const sales = valid.find(c => isSheet(c) && (c.purpose === 'sales_comparison' || /销售/.test(c.name)));
    if (progress) result.push(weeklyTask(progress));
    if (feedback) result.push(feedbackTask(feedback));
    if (slides) result.push(slidesTask(slides));
    if (sales) result.push(salesTask(sales));
    const meeting = valid.find(c => {
      if (c.kind !== 'calendar' || !c.event?.title || !Number.isFinite(Date.parse(c.event.start))) return false;
      return Array.isArray(c.event.relatedContextIds) && c.event.relatedContextIds.some(id => valid.some(d => d.id === id && isDoc(d)));
    });
    if (meeting) {
      const docs = meeting.event.relatedContextIds.map(id => valid.find(c => c.id === id && isDoc(c))).filter(Boolean);
      result.push(meetingTask(meeting, docs));
    }
    return result;
  }

  window.LINGXI_GUIDE_CONTEXTS = clone(contexts);
  window.buildLingxiGuideTasks = buildLingxiGuideTasks;
  window.LINGXI_GUIDE_TASKS = buildLingxiGuideTasks(window.LINGXI_GUIDE_CONTEXTS);
  const fallbackContexts = clone(contexts);
  const fallbackName = name => name.replace(/(\.[^.]+)$/, '_示例$1');
  fallbackContexts.forEach(c => {
    c.id = `sample-${c.id}`;
    c.name = fallbackName(c.name);
    c.sample = true;
    if (c.event) {
      c.event.title += '（示例）';
      c.event.relatedContextIds = c.event.relatedContextIds.map(id => `sample-${id}`);
    }
    contexts.forEach(original => { c.text = c.text.split(original.name).join(fallbackName(original.name)); });
  });
  window.LINGXI_GUIDE_FALLBACK_CONTEXTS = fallbackContexts;
  window.LINGXI_GUIDE_FALLBACK_TASKS = buildLingxiGuideTasks(fallbackContexts);
  window.LINGXI_GUIDE_COPY = {
    welcome: '欢迎来到灵犀', title: '从手头的资料，开始一件工作。',
    intro: '这些文档和日程可以接着用。选一件工作，灵犀会带上对应资料开始。',
    scheduledHeading: '定时完成', scheduledDescription: '先确认时间与资料，再让重复的工作按时完成。',
    immediateHeading: '立即开始', immediateDescription: '围绕现有资料，选一个常见用法开始。',
    note: '开始前可以修改任务要求和参考资料。', sourceDetailLabel: '任务资料',
    materialEditHint: '可以修改任务要求，也可以更换参考资料。',
    scheduledConfirmHint: '这是一份设置草稿；确认后才创建定时任务。',
    fallbackIntro: '先用准备好的示例资料试试，之后可以换成自己的资料。',
    compactTitle: '开始使用灵犀', compactDescription: '还有哪些资料想接着处理？',
    compactExpandLabel: '展开任务建议', compactCloseLabel: '关闭任务建议',
    prototypeNote: '交互演示 · 预置模拟获取结果，未连接 WPS，不会创建真实定时任务。'
  };
})();
