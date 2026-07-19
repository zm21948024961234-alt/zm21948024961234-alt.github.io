/**
 * db.js - IndexedDB 数据库封装层
 * 存储四种彩票的历史开奖数据
 *
 * Store 结构:
 *   p3   : { period, date, bai, shi, ge }              排列3
 *   p5   : { period, date, w1, w2, w3, w4, w5 }        排列5
 *   dlt  : { period, date, front:[5], back:[2] }       大乐透
 *   ssq  : { period, date, red:[6], blue }             双色球
 *   meta : { key, value }                               元信息(最后更新时间等)
 */
(function (global) {
  const DB_NAME = 'lottery_ai_db';
  const DB_VERSION = 1;
  const STORES = ['p3', 'p5', 'dlt', 'ssq', 'meta'];

  let dbInstance = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'period' });
          }
        });
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(db, store, mode) {
    return db.transaction(store, mode).objectStore(store);
  }

  /** 新增或更新一条记录（按 period 主键去重） */
  async function put(storeName, record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = tx(db, storeName, 'readwrite').put(record);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  /** 批量写入 */
  async function bulkPut(storeName, records) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      records.forEach((r) => store.put(r));
      transaction.oncomplete = () => resolve(records.length);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /** 获取单条 */
  async function get(storeName, period) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = tx(db, storeName, 'readonly').get(period);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  /** 删除单条 */
  async function del(storeName, period) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = tx(db, storeName, 'readwrite').delete(period);
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  /** 获取全部记录（按期号降序） */
  async function all(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = tx(db, storeName, 'readonly').getAll();
      r.onsuccess = () => {
        const data = r.result || [];
        data.sort((a, b) => String(b.period).localeCompare(String(a.period)));
        resolve(data);
      };
      r.onerror = () => reject(r.error);
    });
  }

  /** 分页查询（按期号降序） */
  async function page(storeName, pageNum = 1, pageSize = 20) {
    const data = await all(storeName);
    const total = data.length;
    const start = (pageNum - 1) * pageSize;
    const list = data.slice(start, start + pageSize);
    return { list, total, pageNum, pageSize, pages: Math.ceil(total / pageSize) };
  }

  /** 记录总数 */
  async function count(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = tx(db, storeName, 'readonly').count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  /** 清空某 store */
  async function clear(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = tx(db, storeName, 'readwrite').clear();
      r.onsuccess = () => resolve(true);
      r.onerror = () => reject(r.error);
    });
  }

  /** 获取最新一期（期号最大） */
  async function latest(storeName) {
    const data = await all(storeName);
    return data[0] || null;
  }

  /** meta 读写 */
  async function metaGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const r = tx(db, 'meta', 'readonly').get(key);
      r.onsuccess = () => resolve(r.result ? r.result.value : null);
      r.onerror = () => reject(r.error);
    });
  }
  async function metaSet(key, value) {
    return put('meta', { key, value });
  }

  /** 各彩种统计 */
  async function stats() {
    const [p3, p5, dlt, ssq] = await Promise.all([
      count('p3'), count('p5'), count('dlt'), count('ssq')
    ]);
    const lastUpdate = await metaGet('lastUpdate');
    return {
      p3, p5, dlt, ssq,
      total: p3 + p5 + dlt + ssq,
      lastUpdate
    };
  }

  global.DB = {
    openDB, put, bulkPut, get, del, all, page, count, clear, latest,
    metaGet, metaSet, stats
  };
})(window);
