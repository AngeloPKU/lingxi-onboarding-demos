function fileMark(kind='word'){return `<span class="file-mark ${kind}">${kind==='sheet'?'S':kind==='slides'?'P':'W'}</span>`}
function intro(){return `<section class="intro compare-welcome">

 <header class="comparison-heading"><div class="mini-brand">${logo()}<span>灵犀 × <b>WPS</b></span></div><h2>手头的资料，交给灵犀接着做</h2><p>不用重复找文件、上传附件。WPS 里的资料，说一句就能用。</p></header>
 <div class="comparison-layout">
  <div class="before-block"><div class="scene-heading"><span class="scene-label">以前</span><h3>自己找文件，逐个上传</h3></div>
   <div class="before-scene"><div class="manual-composer"><div class="manual-label">${I('paperclip')}添加任务需要的资料</div>
   <div class="manual-files">
   <div class="manual-file">${fileMark()}<div><b>项目周报.docx</b><small>已上传</small></div>${I('x')}</div>
   <div class="manual-file">${fileMark('sheet')}<div><b>上线排期.xlsx</b><small>已上传</small></div>${I('x')}</div>
   <div class="manual-file uploading">${fileMark()}<div><b>例会纪要.docx</b><small>${I('loader-circle')}上传中 · 65%</small></div>${I('x')}<span class="upload-track"><span></span></span></div>
   </div>
   <div class="manual-input"><p>梳理最近的项目进展，<br>告诉我重点和下一步。</p><span class="manual-send">${I('arrow-up')}</span></div>
   </div><div class="manual-caption">找齐资料，再把任务交给灵犀</div></div>
  </div>
  <div class="compare-arrow">${I('arrow-right')}</div>
  <div class="after-block"><div class="scene-heading"><span class="scene-label now">现在</span><h3>直接用 WPS 里的资料开始</h3><span class="example-mark">用法示意</span></div>
  <div class="after-scene">
  <div class="paper-stack">
   <div class="source-paper paper-word"><div class="paper-top">${fileMark()}<span>项目周报</span></div><strong>本周项目进展</strong><div class="paper-rule long"></div><div class="paper-rule"></div><div class="paper-rule short"></div><div class="paper-rule long"></div><div class="paper-rule"></div></div>
   <div class="source-paper paper-sheet"><div class="paper-top">${fileMark('sheet')}<span>上线排期</span></div><div class="mini-sheet"><div>阶段</div><div>计划</div><div>状态</div><span>联调</span><span>11.20</span><span>完成</span><span>验收</span><span>11.22</span><span>进行中</span><span>试用</span><span>11.25</span><span>待启动</span></div></div>
   <div class="source-paper paper-notes"><div class="paper-top">${fileMark()}<span>例会纪要</span></div><strong>会议记录</strong><div class="paper-check">${I('check')}确认上线时间</div><div class="paper-check">${I('check')}完成首轮联调</div><div class="paper-check">${I('check')}跟进试用反馈</div></div>
  </div>
  <div class="demo-request"><div class="request-source">${I('paperclip')}已带上 3 份相关资料</div><div class="request-text">梳理最近的项目进展，告诉我重点和下一步。<span class="request-send">${I('arrow-up')}</span></div></div>
  <div class="output-stage"><div class="paper-behind"></div><div class="output-paper">
   <div class="output-meta"><span>${logo()}灵犀已整理</span><span>${I('check')}完成</span></div>
   <h3>项目进展，一目了然</h3>
   <p class="output-subtitle">把分散的信息，整理成可用的结论</p>
   <div class="brief-row"><span class="status-dot done"></span><div><b>进展</b><p>首轮联调已完成，核心流程验证通过</p></div></div>
   <div class="brief-row"><span class="status-dot next"></span><div><b>下一步</b><p>补齐验收用例，确认本周试用安排</p></div></div>
   <div class="output-bottom"><span>${I('files')}参考了 3 份 WPS 云文档</span>${I('arrow-up-right')}</div>
  </div></div>
  </div></div>
 </div>
 <footer class="comparison-footer"><button class="primary intro-cta" data-action="get-tasks">用我的 WPS 文档试试 ${I('arrow-right')}</button></footer>
 </section>`}
