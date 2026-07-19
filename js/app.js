/**
 * app.js - 主应用
 * 单页应用，hash 路由
 */
(function () {

  const TITLES = {
    home: 'AI彩票分析系统',
    'lottery/p3': '排列3',
    'lottery/p5': '排列5',
    'lottery/dlt': '大乐透',
    'lottery/ssq': '双色球',
    fetch: '数据采集',
    data: '历史数据库',
    ai: 'AI分析',
  };

  const LOTTERY_META = {
    p3:  { name: '排列3', cls: 'p3',  color: 'blue',   icon: 'P3', sub: '体彩·每日开' },
    p5:  { name: '排列5', cls: 'p5',  color: 'green',  icon: 'P5', sub: '体彩·每日开' },
    dlt: { name: '大乐透', cls: 'dlt', color: 'orange', icon: 'DL', sub: '体彩·周一三六' },
    ssq: { name: '双色球', cls: 'ssq', color: 'red',    icon: 'SS', sub: '福彩·二四日' },
  };

  // ============ 工具函数 ============
  function $(sel) { return document.querySelector(sel); }
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
        else e.setAttribute(k, attrs[k]);
      }
    }
    children.flat().forEach((c) => {
      if (c == null) return;
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }
  function toast(msg) {
    let t = $('#toast');
    if (!t) {
      t = el('div', { id: 'toast', class: 'toast' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  // 号码球渲染
  function balls(type, record) {
    const wrap = el('div', { class: 'balls' });
    const mk = (n, color) => el('span', { class: 'ball ' + color }, String(n));
    if (type === 'p3') {
      wrap.appendChild(mk(record.bai, 'blue'));
      wrap.appendChild(mk(record.shi, 'blue'));
      wrap.appendChild(mk(record.ge, 'blue'));
    } else if (type === 'p5') {
      [record.w1, record.w2, record.w3, record.w4, record.w5].forEach((n) =>
        wrap.appendChild(mk(n, 'green')));
    } else if (type === 'dlt') {
      record.front.forEach((n) => wrap.appendChild(mk(n, 'orange')));
      wrap.appendChild(el('span', { style: 'color:#9ca3af;font-size:12px;' }, '+'));
      record.back.forEach((n) => wrap.appendChild(mk(n, 'blue')));
    } else if (type === 'ssq') {
      record.red.forEach((n) => wrap.appendChild(mk(n, 'red')));
      wrap.appendChild(el('span', { style: 'color:#9ca3af;font-size:12px;' }, '+'));
      wrap.appendChild(mk(record.blue, 'blue'));
    }
    return wrap;
  }

  // ============ 首页 ============
  function renderHome() {
    const meta = LOTTERY_META;
    const card = (route, cls, icon, label, sub) => el('button',
      { class: 'menu-card ' + cls, onclick: () => go(route) },
      el('div', { class: 'icon' }, icon),
      el('div', { class: 'text-wrap' },
        el('div', { class: 'label' }, label),
        el('div', { class: 'sub' }, sub)
      )
    );

    const grid = el('div', { class: 'menu-grid' },
      card('lottery/dlt', 'dlt', meta.dlt.icon, meta.dlt.name, meta.dlt.sub),
      card('lottery/ssq', 'ssq', meta.ssq.icon, meta.ssq.name, meta.ssq.sub),
      card('lottery/p3',  'p3',  meta.p3.icon,  meta.p3.name,  meta.p3.sub),
      card('lottery/p5',  'p5',  meta.p5.icon,  meta.p5.name,  meta.p5.sub)
    );

    const toolGrid = el('div', { class: 'menu-grid' },
      el('button', { class: 'menu-card fetch full', onclick: () => go('fetch') },
        el('div', { class: 'icon' }, '⤓'),
        el('div', { class: 'text-wrap' },
          el('div', { class: 'label' }, '数据采集'),
          el('div', { class: 'sub' }, '自动获取最新开奖')
        )
      ),
      el('button', { class: 'menu-card data full', onclick: () => go('data') },
        el('div', { class: 'icon' }, '⊞'),
        el('div', { class: 'text-wrap' },
          el('div', { class: 'label' }, '历史数据库'),
          el('div', { class: 'sub' }, '管理与统计')
        )
      ),
      el('button', { class: 'menu-card ai full', onclick: () => go('ai') },
        el('div', { class: 'icon' }, '✦'),
        el('div', { class: 'text-wrap' },
          el('div', { class: 'label' }, 'AI分析'),
          el('div', { class: 'sub' }, '号码冷热·遗漏·趋势')
        )
      )
    );

    const hero = el('div', { class: 'home-hero' },
      el('div', { class: 'logo' }, 'AI'),
      el('h1', {}, 'AI彩票分析系统'),
      el('p', {}, '历史数据 · 自动采集 · 智能分析')
    );

    const disclaimer = el('div', { class: 'disclaimer' },
      '⚠️ 本系统仅提供历史数据分析功能，不预测中奖，不售卖彩票。彩票为公益娱乐，请理性购彩，量力而行。'
    );

    $('#pageContainer').innerHTML = '';
    $('#pageContainer').append(hero, grid, toolGrid, disclaimer);
  }

  // ============ 彩种页面 ============
  let currentPage = { type: null, page: 1 };

  async function renderLottery(type) {
    currentPage = { type, page: 1 };
    $('#pageContainer').innerHTML = '';
    const container = $('#pageContainer');

    // 操作按钮区
    const actionBar = el('div', { class: 'card' },
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn btn-primary', onclick: () => showAddForm(type) }, '＋ 录入'),
        el('button', { class: 'btn btn-ghost', onclick: () => doExport(type) }, '↓ 导出'),
        el('button', { class: 'btn btn-outline', onclick: () => showImport(type) }, '↑ 导入')
      )
    );

    const listWrap = el('div', { id: 'listWrap' });
    container.append(actionBar, listWrap);
    await loadList(type, 1);
  }

  async function loadList(type, pageNum) {
    const wrap = $('#listWrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="loading"><span class="spinner"></span>加载中...</div>';

    const { list, total, pages } = await DB.page(type, pageNum, 20);
    if (!list.length) {
      wrap.innerHTML = '';
      wrap.appendChild(el('div', { class: 'empty-state' },
        el('div', { class: 'emoji' }, '📭'),
        el('p', {}, '暂无数据，点击上方"录入"或"导入"添加')
      ));
      return;
    }

    const listEl = el('div', { class: 'data-list' });
    list.forEach((r) => {
      const row = el('div', { class: 'data-row' },
        el('div', {},
          el('div', { class: 'period' }, r.period),
          el('div', { class: 'date' }, r.date || '')
        ),
        balls(type, r),
        el('div', { class: 'actions' },
          el('button', { class: 'icon-btn', onclick: () => showAddForm(type, r) }, '✎'),
          el('button', { class: 'icon-btn danger', onclick: () => delRecord(type, r) }, '✕')
        )
      );
      listEl.appendChild(row);
    });

    // 分页
    const pager = el('div', { class: 'pagination' },
      el('button', { disabled: pageNum <= 1, onclick: () => loadList(type, pageNum - 1) }, '上一页'),
      el('span', { class: 'page-info' }, pageNum + ' / ' + pages + ' （共' + total + '期）'),
      el('button', { disabled: pageNum >= pages, onclick: () => loadList(type, pageNum + 1) }, '下一页')
    );

    wrap.innerHTML = '';
    wrap.append(listEl, pager);
  }

  // 录入/编辑表单
  function showAddForm(type, record) {
    const isEdit = !!record;
    const overlay = el('div', { id: 'modalOverlay', style: 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:50;display:flex;align-items:flex-end;' });
    const modal = el('div', { style: 'background:#fff;width:100%;max-width:480px;margin:0 auto;border-radius:16px 16px 0 0;padding:20px;max-height:90vh;overflow-y:auto;' });

    modal.appendChild(el('h3', { style: 'margin-bottom:16px;font-size:17px;' },
      isEdit ? '编辑 ' + LOTTERY_META[type].name : '录入 ' + LOTTERY_META[type].name));

    const fields = buildFormFields(type, record);
    fields.forEach((f) => modal.appendChild(f));

    const btns = el('div', { class: 'btn-row' },
      el('button', { class: 'btn btn-outline', onclick: () => overlay.remove() }, '取消'),
      el('button', { class: 'btn btn-primary', onclick: () => saveForm(type, isEdit) }, '保存')
    );
    modal.appendChild(btns);
    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function buildFormFields(type, r) {
    const f = [];
    const period = r ? r.period : '';
    const date = r ? (r.date || todayStr()) : todayStr();

    f.push(field('期号', 'period', period, 'text', '如 20260719'));
    f.push(field('开奖日期', 'date', date, 'date'));

    if (type === 'p3') {
      f.push(numField3('百位', 'shi_ten', r ? r.bai : '', 0, 9));
      f.push(numField3('十位', 'shi_mid', r ? r.shi : '', 0, 9));
      f.push(numField3('个位', 'shi_unit', r ? r.ge : '', 0, 9));
    } else if (type === 'p5') {
      ['万位', '千位', '百位', '十位', '个位'].forEach((label, i) => {
        const v = r ? [r.w1, r.w2, r.w3, r.w4, r.w5][i] : '';
        f.push(numField3(label, 'p5_' + i, v, 0, 9));
      });
    } else if (type === 'dlt') {
      const front = r ? r.front : ['', '', '', '', ''];
      ['前区1', '前区2', '前区3', '前区4', '前区5'].forEach((label, i) => {
        f.push(numField3(label, 'dlt_f' + i, front[i], 1, 35));
      });
      const back = r ? r.back : ['', ''];
      ['后区1', '后区2'].forEach((label, i) => {
        f.push(numField3(label, 'dlt_b' + i, back[i], 1, 12));
      });
    } else if (type === 'ssq') {
      const red = r ? r.red : ['', '', '', '', '', ''];
      ['红球1', '红球2', '红球3', '红球4', '红球5', '红球6'].forEach((label, i) => {
        f.push(numField3(label, 'ssq_r' + i, red[i], 1, 33));
      });
      f.push(numField3('蓝球', 'ssq_blue', r ? r.blue : '', 1, 16));
    }
    return f;
  }

  function field(label, name, value, type, placeholder) {
    const g = el('div', { class: 'form-group' },
      el('label', { class: 'form-label' }, label),
      el('input', { class: 'form-input', id: 'f_' + name, type, value: value || '', placeholder: placeholder || '' })
    );
    return g;
  }
  function numField3(label, name, value, min, max) {
    const g = el('div', { class: 'form-group' },
      el('label', { class: 'form-label' }, label + ' (' + min + '-' + max + ')'),
      el('input', { class: 'form-input', id: 'f_' + name, type: 'number', min, max,
        value: value !== undefined && value !== null ? value : '', placeholder: String(min) + '-' + String(max) })
    );
    return g;
  }

  function getVal(name) {
    const e = $('#f_' + name);
    return e ? e.value.trim() : '';
  }

  function saveForm(type, isEdit) {
    const period = getVal('period');
    const date = getVal('date');
    if (!period) return toast('请输入期号');
    if (!date) return toast('请选择日期');

    let record = { period, date };
    if (type === 'p3') {
      record.bai = parseInt(getVal('shi_ten'), 10);
      record.shi = parseInt(getVal('shi_mid'), 10);
      record.ge = parseInt(getVal('shi_unit'), 10);
      if ([record.bai, record.shi, record.ge].some((n) => isNaN(n) || n < 0 || n > 9))
        return toast('排列3每位为 0-9');
    } else if (type === 'p5') {
      ['p5_0','p5_1','p5_2','p5_3','p5_4'].forEach((k, i) => record['w' + (i + 1)] = parseInt(getVal(k), 10));
      if (Object.values({w1:record.w1,w2:record.w2,w3:record.w3,w4:record.w4,w5:record.w5}).some((n) => isNaN(n) || n < 0 || n > 9))
        return toast('排列5每位为 0-9');
    } else if (type === 'dlt') {
      record.front = ['dlt_f0','dlt_f1','dlt_f2','dlt_f3','dlt_f4'].map((k) =>
        String(parseInt(getVal(k), 10) || 0).padStart(2, '0'));
      record.back = ['dlt_b0','dlt_b1'].map((k) =>
        String(parseInt(getVal(k), 10) || 0).padStart(2, '0'));
      if (record.front.some((n) => parseInt(n) < 1 || parseInt(n) > 35))
        return toast('前区号码 1-35');
      if (record.back.some((n) => parseInt(n) < 1 || parseInt(n) > 12))
        return toast('后区号码 1-12');
    } else if (type === 'ssq') {
      record.red = ['ssq_r0','ssq_r1','ssq_r2','ssq_r3','ssq_r4','ssq_r5'].map((k) =>
        String(parseInt(getVal(k), 10) || 0).padStart(2, '0'));
      record.blue = String(parseInt(getVal('ssq_blue'), 10) || 0).padStart(2, '0');
      if (record.red.some((n) => parseInt(n) < 1 || parseInt(n) > 33))
        return toast('红球 1-33');
      if (parseInt(record.blue) < 1 || parseInt(record.blue) > 16)
        return toast('蓝球 1-16');
    }

    DB.put(type, record).then(() => {
      $('#modalOverlay').remove();
      toast(isEdit ? '已更新' : '已保存');
      loadList(type, currentPage.page || 1);
      updateSyncStatus();
    }).catch((e) => toast('保存失败: ' + e.message));
  }

  async function delRecord(type, r) {
    if (!confirm('确定删除期号 ' + r.period + ' 吗？')) return;
    await DB.del(type, r.period);
    toast('已删除');
    loadList(type, currentPage.page || 1);
    updateSyncStatus();
  }

  function showImport(type) {
    const input = el('input', { type: 'file', accept: '.xlsx,.xls', style: 'display:none;' });
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      toast('导入中...');
      try {
        const n = await ExcelIO.importData(type, file);
        toast('成功导入 ' + n + ' 条');
        loadList(type, currentPage.page || 1);
        updateSyncStatus();
      } catch (e) {
        toast('导入失败: ' + e.message);
      }
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  }

  async function doExport(type) {
    toast('导出中...');
    try {
      const n = await ExcelIO.exportData(type);
      toast('已导出 ' + n + ' 条');
    } catch (e) {
      toast('导出失败: ' + e.message);
    }
  }

  // ============ 数据采集页面 ============
  function renderFetch() {
    const container = $('#pageContainer');
    container.innerHTML = '';

    const card = el('div', { class: 'card' },
      el('div', { class: 'section-title', style: 'margin-top:0;' }, '立即更新'),
      el('p', { style: 'font-size:13px;color:var(--text-light);margin-bottom:12px;' },
        '从官方接口拉取最新开奖数据，自动去重保存到本地数据库。'),
      el('button', { class: 'btn btn-primary', id: 'btnFetchAll', onclick: () => doFetchAll() }, '⤓ 一键采集全部'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn btn-ghost', onclick: () => doFetchOne('p3') }, '排列3'),
        el('button', { class: 'btn btn-ghost', onclick: () => doFetchOne('p5') }, '排列5'),
        el('button', { class: 'btn btn-ghost', onclick: () => doFetchOne('dlt') }, '大乐透'),
        el('button', { class: 'btn btn-ghost', onclick: () => doFetchOne('ssq') }, '双色球')
      )
    );

    const tipCard = el('div', { class: 'card' },
      el('div', { class: 'section-title', style: 'margin-top:0;' }, '采集日志'),
      el('div', { class: 'log-box', id: 'logBox' },
        el('div', { class: 'log-line log-info' }, '等待开始采集...')
      )
    );

    const note = el('div', { class: 'disclaimer' },
      '提示：首次采集会拉取最近 100 期数据。如遇网络问题，可能是 CORS 代理不可用，请稍后重试或手动录入。'
    );

    container.append(card, tipCard, note);
    updateSyncStatus();
  }

  function log(msg, level = 'info') {
    const box = $('#logBox');
    if (!box) return;
    const line = el('div', { class: 'log-line log-' + level }, '[' + nowTime() + '] ' + msg);
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  async function doFetchAll() {
    $('#btnFetchAll').disabled = true;
    log('开始一键采集全部彩种...', 'info');
    try {
      await Fetcher.fetchAll(log);
      toast('采集完成');
    } catch (e) {
      log('采集出错: ' + e.message, 'err');
      toast('采集失败');
    }
    $('#btnFetchAll').disabled = false;
    updateSyncStatus();
  }

  async function doFetchOne(type) {
    log('手动采集 ' + type.toUpperCase(), 'info');
    try {
      const r = await Fetcher.fetchOne(type, log);
      toast(r.ok ? type.toUpperCase() + ' 采集成功' : '采集失败');
    } catch (e) {
      log('出错: ' + e.message, 'err');
      toast('采集失败');
    }
    updateSyncStatus();
  }

  // ============ 历史数据库页面 ============
  async function renderData() {
    const container = $('#pageContainer');
    container.innerHTML = '<div class="loading"><span class="spinner"></span>统计中...</div>';

    const s = await DB.stats();
    container.innerHTML = '';

    const meta = LOTTERY_META;
    const statCard = (cls, name, count, unit) => el('div', { class: 'stat-card ' + cls },
      el('div', { class: 'stat-label' }, name),
      el('div', { class: 'stat-value' }, count, el('span', { class: 'stat-unit' }, ' ' + unit))
    );

    const grid = el('div', { class: 'stat-grid' },
      statCard('dlt', '大乐透', s.dlt, '期'),
      statCard('ssq', '双色球', s.ssq, '期'),
      statCard('p3',  '排列3',  s.p3,  '期'),
      statCard('p5',  '排列5',  s.p5,  '期')
    );

    const totalCard = el('div', { class: 'card' },
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;' },
        el('div', {},
          el('div', { style: 'font-size:13px;color:var(--text-light);' }, '数据总量'),
          el('div', { style: 'font-size:22px;font-weight:700;' }, s.total, el('span', { style: 'font-size:12px;color:var(--text-light);font-weight:400;' }, ' 条'))
        ),
        el('div', { style: 'text-align:right;' },
          el('div', { style: 'font-size:13px;color:var(--text-light);' }, '最后更新'),
          el('div', { style: 'font-size:14px;font-weight:600;' }, s.lastUpdate || '未采集')
        )
      )
    );

    const actionCard = el('div', { class: 'card' },
      el('div', { class: 'section-title', style: 'margin-top:0;' }, '快捷操作'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn btn-primary', onclick: () => go('fetch') }, '⤓ 立即采集'),
        el('button', { class: 'btn btn-ghost', onclick: () => exportAll() }, '↓ 全部导出')
      ),
      el('div', { class: 'btn-row', style: 'margin-top:8px;' },
        el('button', { class: 'btn btn-outline', onclick: () => clearAllConfirm() }, '清空数据库')
      )
    );

    const disclaimer = el('div', { class: 'disclaimer' },
      '数据存储于浏览器本地(IndexedDB)。更换浏览器或清除浏览数据会导致数据丢失，请定期用"全部导出"备份。'
    );

    container.append(grid, totalCard, actionCard, disclaimer);
  }

  async function exportAll() {
    toast('逐个导出中...');
    for (const t of ['p3', 'p5', 'dlt', 'ssq']) {
      try {
        const data = await DB.all(t);
        if (data.length === 0) continue;
        await ExcelIO.exportData(t);
      } catch (e) { /* 忽略单项失败 */ }
    }
    toast('导出完成');
  }

  async function clearAllConfirm() {
    if (!confirm('确定清空所有彩种数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：清空后无法找回，建议先导出备份。继续？')) return;
    for (const t of ['p3', 'p5', 'dlt', 'ssq']) await DB.clear(t);
    await DB.metaSet('lastUpdate', null);
    toast('已清空');
    renderData();
    updateSyncStatus();
  }

  // ============ AI 分析页面（预留） ============
  function renderAI() {
    const container = $('#pageContainer');
    container.innerHTML = '';

    const features = [
      { icon: '🔥', name: '冷热分析', desc: '近N期号码出现频次' },
      { icon: '⏰', name: '遗漏分析', desc: '号码未出现期数' },
      { icon: '⚖️', name: '奇偶分析', desc: '奇偶比例分布' },
      { icon: '📏', name: '大小分析', desc: '大小号分布' },
      { icon: '📈', name: '历史趋势', desc: '号码走势图' },
      { icon: '🎯', name: '组合筛选', desc: '按条件过滤组合' },
    ];

    const grid = el('div', { class: 'ai-feature-grid' });
    features.forEach((f) => {
      const card = el('div', { class: 'ai-feature', onclick: () => toast('该功能正在开发中，敬请期待') },
        el('div', { class: 'coming-soon' }, '待开发'),
        el('div', { class: 'ai-icon' }, f.icon),
        el('div', { class: 'ai-name' }, f.name),
        el('div', { class: 'ai-desc' }, f.desc)
      );
      grid.appendChild(card);
    });

    const intro = el('div', { class: 'card' },
      el('div', { class: 'section-title', style: 'margin-top:0;' }, 'AI 分析模块'),
      el('p', { style: 'font-size:13px;color:var(--text-light);line-height:1.7;' },
        '本模块基于已采集的历史开奖数据，提供统计分析功能，帮助您了解号码分布规律。'),
      el('p', { style: 'font-size:13px;color:var(--text-light);line-height:1.7;margin-top:8px;' },
        '当前为预留入口，第二阶段将逐步上线各项分析功能。')
    );

    const disclaimer = el('div', { class: 'disclaimer' },
      '⚠️ 重要声明：彩票开奖为独立随机事件，历史数据不代表未来走势。本系统所有分析仅为统计参考，',
      '不构成任何投注建议，不预测中奖号码，不售卖彩票。请理性购彩，量力而行，勿沉迷。'
    );

    container.append(intro, grid, disclaimer);
  }

  // ============ 路由 ============
  function go(route) {
    location.hash = '#/' + route;
  }

  function handleRoute() {
    const hash = location.hash.replace(/^#\/?/, '') || 'home';
    const parts = hash.split('/');
    const route = parts[0] + (parts[1] ? '/' + parts[1] : '');

    $('#pageTitle').textContent = TITLES[route] || 'AI彩票分析系统';
    const backBtn = $('#backBtn');
    if (route === 'home' || !route) {
      backBtn.classList.remove('show');
    } else {
      backBtn.classList.add('show');
    }

    if (route === 'home' || !route) renderHome();
    else if (route.startsWith('lottery/')) renderLottery(parts[1]);
    else if (route === 'fetch') renderFetch();
    else if (route === 'data') renderData();
    else if (route === 'ai') renderAI();
    else renderHome();

    window.scrollTo(0, 0);
  }

  // ============ 工具 ============
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0');
  }
  async function updateSyncStatus() {
    try {
      const s = await DB.stats();
      const el = $('#syncStatus');
      if (el) {
        el.textContent = s.lastUpdate
          ? '共 ' + s.total + ' 条 · 更新于 ' + s.lastUpdate
          : '共 ' + s.total + ' 条 · 本地存储';
      }
    } catch (e) { /* ignore */ }
  }

  // ============ 初始化 ============
  function init() {
    $('#backBtn').addEventListener('click', () => {
      if (location.hash !== '#/home' && location.hash !== '') {
        history.back();
      }
    });
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
    updateSyncStatus();

    // 每天首次打开自动采集（仅当超过6小时未更新）
    (async () => {
      try {
        const last = await DB.metaGet('lastUpdate');
        if (!last) return; // 首次使用不自动采集，等用户主动触发
        const lastTime = new Date(last.replace(/-/g, '/'));
        if (Date.now() - lastTime.getTime() > 6 * 3600 * 1000) {
          // 静默后台采集
          Fetcher.fetchAll().then(() => updateSyncStatus()).catch(() => {});
        }
      } catch (e) { /* ignore */ }
    })();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
