/**
 * fetcher.js - 自动采集模块
 * 从官方接口拉取最新开奖数据，存入数据库
 *
 * 数据来源:
 *   体彩(排列3/5/大乐透): https://webapi.sporttery.cn/
 *   福彩(双色球):         https://www.cwl.gov.cn/
 *
 * 由于浏览器 CORS 限制，使用公共代理转发。
 */
(function (global) {

  // 多个 CORS 代理，按顺序尝试
  const PROXIES = [
    (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
    (url) => 'https://thingproxy.freeboard.io/fetch/' + url,
  ];

  async function fetchWithProxy(targetUrl) {
    let lastErr;
    for (const wrap of PROXIES) {
      try {
        const resp = await fetch(wrap(targetUrl), {
          headers: { 'Accept': 'application/json, text/plain, */*' },
          timeout: 15000
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        if (!text) throw new Error('空响应');
        return JSON.parse(text);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('所有代理均失败');
  }

  // 体彩接口配置
  // gameNo: 35=排列3, 350=排列5, 85=大乐透
  const SPORTTERY = {
    p3:  { gameNo: '35',  store: 'p3'  },
    p5:  { gameNo: '350', store: 'p5'  },
    dlt: { gameNo: '85',  store: 'dlt' },
  };

  function sportteryUrl(gameNo, pageSize = 100) {
    return 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry'
      + '?gameNo=' + gameNo
      + '&provinceId=0&pageSize=' + pageSize
      + '&isVerify=1&pageNo=1';
  }

  // 解析体彩返回数据，统一成我们的记录格式
  function parseSporttery(json, type) {
    const list = (json && json.value && json.value.list) || [];
    return list.map((item) => {
      const period = String(item.lotteryDrawNum || '');
      const date = (item.lotteryDrawTime || '').slice(0, 10);
      const result = String(item.lotteryDrawResult || '').trim();
      const nums = result.split(/[+\s]+/).filter(Boolean).map((n) => n.padStart(2, '0'));

      if (type === 'p3') {
        return {
          period,
          date,
          bai: parseInt(nums[0], 10),
          shi: parseInt(nums[1], 10),
          ge:  parseInt(nums[2], 10),
        };
      }
      if (type === 'p5') {
        return {
          period,
          date,
          w1: parseInt(nums[0], 10),
          w2: parseInt(nums[1], 10),
          w3: parseInt(nums[2], 10),
          w4: parseInt(nums[3], 10),
          w5: parseInt(nums[4], 10),
        };
      }
      if (type === 'dlt') {
        // 大乐透: 前5后2，用 + 分隔
        const parts = result.split('+').map((s) => s.trim());
        const front = parts[0] ? parts[0].split(/\s+/).map((n) => n.padStart(2, '0')) : [];
        const back  = parts[1] ? parts[1].split(/\s+/).map((n) => n.padStart(2, '0')) : [];
        return { period, date, front, back };
      }
      return null;
    }).filter(Boolean);
  }

  // 福彩双色球
  function ssqUrl(count = 100) {
    return 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice'
      + '?name=ssq&issueCount=' + count;
  }

  function parseSSQ(json) {
    const list = (json && json.result) || [];
    return list.map((item) => ({
      period: String(item.code || ''),
      date: (item.date || '').split('(')[0],
      red: (item.red || '').split(',').map((n) => n.padStart(2, '0')),
      blue: (item.blue || '').padStart(2, '0'),
    }));
  }

  /**
   * 采集单个彩种
   * @param {string} type  p3|p5|dlt|ssq
   * @param {function} onLog  日志回调
   */
  async function fetchOne(type, onLog) {
    const log = (msg, level = 'info') => onLog && onLog(msg, level);
    log('开始采集 ' + type.toUpperCase() + ' ...');

    try {
      let records;
      if (type === 'ssq') {
        const json = await fetchWithProxy(ssqUrl(100));
        records = parseSSQ(json);
      } else {
        const cfg = SPORTTERY[type];
        const json = await fetchWithProxy(sportteryUrl(cfg.gameNo, 100));
        records = parseSporttery(json, type);
      }

      if (!records.length) {
        log(type.toUpperCase() + ' 未取到数据', 'err');
        return { type, ok: false, count: 0 };
      }

      const n = await DB.bulkPut(type, records);
      log(type.toUpperCase() + ' 成功保存 ' + n + ' 条', 'ok');
      return { type, ok: true, count: n };
    } catch (e) {
      log(type.toUpperCase() + ' 采集失败: ' + e.message, 'err');
      return { type, ok: false, count: 0, error: e.message };
    }
  }

  /**
   * 采集全部彩种
   */
  async function fetchAll(onLog) {
    const types = ['p3', 'p5', 'dlt', 'ssq'];
    const results = [];
    for (const t of types) {
      results.push(await fetchOne(t, onLog));
    }
    const okCount = results.filter((r) => r.ok).length;
    if (okCount > 0) {
      const now = new Date();
      const ts = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0');
      await DB.metaSet('lastUpdate', ts);
    }
    return results;
  }

  global.Fetcher = { fetchOne, fetchAll, fetchWithProxy };
})(window);
