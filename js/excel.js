/**
 * excel.js - Excel 导入导出模块
 * 依赖 SheetJS (xlsx.full.min.js)
 */
(function (global) {

  const HEADERS = {
    p3:  ['期号', '开奖日期', '百位', '十位', '个位'],
    p5:  ['期号', '开奖日期', '万位', '千位', '百位', '十位', '个位'],
    dlt: ['期号', '开奖日期', '前区1', '前区2', '前区3', '前区4', '前区5', '后区1', '后区2'],
    ssq: ['期号', '开奖日期', '红球1', '红球2', '红球3', '红球4', '红球5', '红球6', '蓝球'],
  };

  const FILE_NAMES = {
    p3: '排列3历史数据.xlsx',
    p5: '排列5历史数据.xlsx',
    dlt: '大乐透历史数据.xlsx',
    ssq: '双色球历史数据.xlsx',
  };

  /** 记录转行数据 */
  function recordToRow(type, r) {
    if (type === 'p3')  return [r.period, r.date, r.bai, r.shi, r.ge];
    if (type === 'p5')  return [r.period, r.date, r.w1, r.w2, r.w3, r.w4, r.w5];
    if (type === 'dlt') return [r.period, r.date, ...r.front, ...r.back];
    if (type === 'ssq') return [r.period, r.date, ...r.red, r.blue];
    return [];
  }

  /** 行数据转记录 */
  function rowToRecord(type, row) {
    const period = String(row[0] || '').trim();
    if (!period) return null;
    const date = String(row[1] || '').trim();
    if (type === 'p3') {
      return {
        period, date,
        bai: parseInt(row[2], 10) || 0,
        shi: parseInt(row[3], 10) || 0,
        ge:  parseInt(row[4], 10) || 0,
      };
    }
    if (type === 'p5') {
      return {
        period, date,
        w1: parseInt(row[2], 10) || 0,
        w2: parseInt(row[3], 10) || 0,
        w3: parseInt(row[4], 10) || 0,
        w4: parseInt(row[5], 10) || 0,
        w5: parseInt(row[6], 10) || 0,
      };
    }
    if (type === 'dlt') {
      return {
        period, date,
        front: [row[2], row[3], row[4], row[5], row[6]].map((n) => String(n).padStart(2, '0')),
        back:  [row[7], row[8]].map((n) => String(n).padStart(2, '0')),
      };
    }
    if (type === 'ssq') {
      return {
        period, date,
        red:  [row[2], row[3], row[4], row[5], row[6], row[7]].map((n) => String(n).padStart(2, '0')),
        blue: String(row[8] || '').padStart(2, '0'),
      };
    }
    return null;
  }

  /** 导出 */
  async function exportData(type) {
    const data = await DB.all(type);
    if (!data.length) throw new Error('没有可导出的数据');
    const rows = [HEADERS[type], ...data.map((r) => recordToRow(type, r))];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = HEADERS[type].map((h) => ({ wch: h.length > 4 ? 14 : 10 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type.toUpperCase());
    XLSX.writeFile(wb, FILE_NAMES[type]);
    return data.length;
  }

  /** 导入 */
  function importData(type, file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (rows.length < 2) throw new Error('Excel 文件没有数据');

          // 检查表头，跳过第1行
          const records = [];
          for (let i = 1; i < rows.length; i++) {
            const rec = rowToRecord(type, rows[i]);
            if (rec) records.push(rec);
          }
          if (!records.length) throw new Error('未解析到有效记录');

          const n = await DB.bulkPut(type, records);
          resolve(n);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  global.ExcelIO = { exportData, importData, HEADERS, FILE_NAMES };
})(window);
