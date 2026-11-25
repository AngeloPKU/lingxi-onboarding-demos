/* Shared, self-contained onboarding example. All companies and quotations are fictional. */
(function () {
  'use strict';

  const prompt = '对比这三份供应商报价，整理含税总价、交付周期、保修和付款条件，标出价格差异与需要注意的条款。';

  window.LINGXI_FALLBACK_TASK = {
    id: 'sample-supplier-quotes',
    label: '对比三家供应商报价',
    icon: 'table-2',
    tone: 'green',
    files: ['青禾报价_示例.csv', '远川报价_示例.csv', '星桥报价_示例.csv'],
    prompt,
    value: prompt,
    output: '三家供应商 · 报价对比',
    format: 'xlsx',
    sample: true,
    visual: 'chart',
    artifactHtml: `<h4>30 台办公显示器 · 报价对比（示例）</h4>
      <p>统一规格：27 英寸、2K、IPS、HDMI＋DP。金额单位为人民币元；总价含税、含运费；交期均为自然日。</p>
      <table>
        <thead><tr><th>供应商</th><th>含税总价</th><th>交期</th><th>保修</th><th>付款条件</th></tr></thead>
        <tbody>
          <tr><td>青禾</td><td>18,600 元</td><td>7 天</td><td>3 年，原厂送修</td><td>50% 预付，50% 验收后付</td></tr>
          <tr><td>远川</td><td>17,900 元</td><td>10 天</td><td>1 年，送修运费由买方承担</td><td>100% 预付</td></tr>
          <tr><td>星桥</td><td>19,200 元</td><td>5 天</td><td>3 年，上门保修</td><td>30% 预付，70% 验收后付</td></tr>
        </tbody>
      </table>
      <p><strong>价格：</strong>远川最低，含税货款 17,400 元＋运费 500 元＝17,900 元；青禾比远川贵 700 元，星桥贵 1,300 元。</p>
      <p><strong>交付：</strong>星桥最快，比青禾早 2 天、比远川早 5 天；相对青禾增加 600 元。</p>
      <p><strong>注意：</strong>三家均不含上门安装。远川要求全额预付且保修期更短；付款条件、送修费用与安装安排需在下单前确认。</p>
      <p>以上为预置示例资料的对比结果。</p>`
  };

  window.LINGXI_FALLBACK_ASSETS = [
    { name: '青禾报价_示例.csv', path: 'assets/samples/青禾报价_示例.csv' },
    { name: '远川报价_示例.csv', path: 'assets/samples/远川报价_示例.csv' },
    { name: '星桥报价_示例.csv', path: 'assets/samples/星桥报价_示例.csv' }
  ];

  window.LINGXI_FALLBACK_COPY = {
    title: '先从一件常见工作开始',
    description: '三份报价示例已经备好，选这个任务就能开始。',
    sourceLabel: '示例资料',
    readinessLabel: '示例已备好'
  };
})();
