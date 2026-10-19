/**
 * 家計簿アプリ グラフ・集計描画モジュール (charts.js)
 * 年別・月別・週別・日別の切り替え、用途別（大・中・小項目）の分析グラフを描画します。
 */

import { db, MAJOR_CATEGORIES } from './db.js';

// 美しく調和のとれたカラーパレット
const PALETTE = [
  '#f43f5e', // ローズ
  '#8b5cf6', // バイオレット
  '#06b6d4', // シアン
  '#f59e0b', // アンバー
  '#10b981', // エメラルド
  '#ec4899', // ピンク
  '#3b82f6', // ブルー
  '#14b8a6', // ティール
  '#eab308', // イエロー
  '#a855f7', // パープル
  '#64748b'  // スレート
];

let mainTrendChartInstance = null;
let categoryDonutChartInstance = null;

// 金額フォーマット関数
export function formatCurrency(amount) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(amount);
}

// 日付ヘルパー
export function formatDateJP(dateStr) {
  const d = new Date(dateStr);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
}

/**
 * 期間ごとの取引データをフィルタリング
 * @param {string} mode 'day' | 'week' | 'month' | 'year'
 * @param {Date} targetDate 基準日
 */
export function filterTransactionsByPeriod(transactions, mode, targetDate) {
  const target = new Date(targetDate);
  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth(); // 0-indexed
  const targetDateNum = target.getDate();

  return transactions.filter(tx => {
    const txDate = new Date(tx.date);
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();
    const txDateNum = txDate.getDate();

    if (mode === 'day') {
      return txYear === targetYear && txMonth === targetMonth && txDateNum === targetDateNum;
    }

    if (mode === 'week') {
      // 基準日を含む週（月曜日始まり〜日曜日終わり）
      const dayOfWeek = target.getDay(); // 0(日)〜6(土)
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const startOfWeek = new Date(target);
      startOfWeek.setDate(target.getDate() + diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return txDate >= startOfWeek && txDate <= endOfWeek;
    }

    if (mode === 'month') {
      return txYear === targetYear && txMonth === targetMonth;
    }

    if (mode === 'year') {
      return txYear === targetYear;
    }

    return true;
  });
}

/**
 * 集計サマリー（収入・支出・収支・買わなくてもよかった出費など）を計算
 */
export function calculatePeriodSummary(filteredTx) {
  let totalIncome = 0;
  let totalExpense = 0;
  let fixedExpense = 0;
  let variableExpense = 0;
  let optionalExpense = 0; // 買わなくてもよかった出費（嗜好・浪費）

  // 中項目ごとの集計マップ
  const mediumMap = {};
  // 大項目ごとの集計マップ
  const majorMap = {};

  filteredTx.forEach(tx => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount;

      // 大項目別
      if (!majorMap[tx.majorId]) {
        majorMap[tx.majorId] = 0;
      }
      majorMap[tx.majorId] += tx.amount;

      if (tx.majorId === 'major_fixed') {
        fixedExpense += tx.amount;
      } else if (tx.majorId === 'major_variable') {
        variableExpense += tx.amount;
      }

      // 中項目別
      const med = db.getMediumCategory(tx.majorId, tx.mediumId);
      const medName = med ? med.name : 'その他';
      if (!mediumMap[medName]) {
        mediumMap[medName] = {
          name: medName,
          amount: 0,
          isOptional: med ? med.isOptional : false,
          majorId: tx.majorId
        };
      }
      mediumMap[medName].amount += tx.amount;

      // 買わなくてもよかった出費のカウント
      if (med && med.isOptional) {
        optionalExpense += tx.amount;
      }
    }
  });

  const balance = totalIncome - totalExpense;
  const optionalRate = totalExpense > 0 ? Math.round((optionalExpense / totalExpense) * 100) : 0;
  const variableRate = totalExpense > 0 ? Math.round((variableExpense / totalExpense) * 100) : 0;

  return {
    totalIncome,
    totalExpense,
    balance,
    fixedExpense,
    variableExpense,
    optionalExpense,
    optionalRate,
    variableRate,
    mediumRanking: Object.values(mediumMap).sort((a, b) => b.amount - a.amount),
    majorMap
  };
}

/**
 * メイン推移グラフ（日別・週別・月別・年別）を描画
 */
export function renderTrendChart(canvasId, mode, targetDate, transactions) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  if (mainTrendChartInstance) {
    mainTrendChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const target = new Date(targetDate);

  let labels = [];
  let expenseData = [];
  let incomeData = [];
  let optionalData = [];

  if (mode === 'day') {
    // 日別: 時間帯別ではなく、大項目別の内訳棒グラフ
    labels = ['固定費・必需', '変動費・裁量'];
    const dayTx = filterTransactionsByPeriod(transactions, 'day', targetDate);
    const sum = calculatePeriodSummary(dayTx);
    expenseData = [sum.fixedExpense, sum.variableExpense];

    mainTrendChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '支出金額',
          data: expenseData,
          backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(244, 63, 94, 0.8)'],
          borderColor: ['#3b82f6', '#f43f5e'],
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: getCommonChartOptions('支出金額')
    });
    return;
  }

  if (mode === 'week') {
    // 週別: 月曜〜日曜の7日間推移
    const dayOfWeek = target.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const startOfWeek = new Date(target);
    startOfWeek.setDate(target.getDate() + diffToMonday);

    const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
    labels = weekdays.map((wd, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
    });

    expenseData = new Array(7).fill(0);
    incomeData = new Array(7).fill(0);
    optionalData = new Array(7).fill(0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dayTx = filterTransactionsByPeriod(transactions, 'day', d);
      const sum = calculatePeriodSummary(dayTx);
      expenseData[i] = sum.totalExpense;
      incomeData[i] = sum.totalIncome;
      optionalData[i] = sum.optionalExpense;
    }
  } else if (mode === 'month') {
    // 月別: 1日〜月末日までの推移
    const year = target.getFullYear();
    const month = target.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`);
    expenseData = new Array(daysInMonth).fill(0);
    incomeData = new Array(daysInMonth).fill(0);
    optionalData = new Array(daysInMonth).fill(0);

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dayTx = filterTransactionsByPeriod(transactions, 'day', d);
      const sum = calculatePeriodSummary(dayTx);
      expenseData[i - 1] = sum.totalExpense;
      incomeData[i - 1] = sum.totalIncome;
      optionalData[i - 1] = sum.optionalExpense;
    }
  } else if (mode === 'year') {
    // 年別: 1月〜12月の推移
    const year = target.getFullYear();
    labels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
    expenseData = new Array(12).fill(0);
    incomeData = new Array(12).fill(0);
    optionalData = new Array(12).fill(0);

    for (let i = 0; i < 12; i++) {
      const d = new Date(year, i, 1);
      const monthTx = filterTransactionsByPeriod(transactions, 'month', d);
      const sum = calculatePeriodSummary(monthTx);
      expenseData[i] = sum.totalExpense;
      incomeData[i] = sum.totalIncome;
      optionalData[i] = sum.optionalExpense;
    }
  }

  // グラフ生成
  mainTrendChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '支出（全体）',
          data: expenseData,
          backgroundColor: 'rgba(244, 63, 94, 0.75)',
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2
        },
        {
          label: 'うち嗜好・買わなくてもよかった出費',
          data: optionalData,
          backgroundColor: 'rgba(245, 158, 11, 0.85)',
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          borderRadius: 6,
          order: 1
        },
        {
          label: '収入',
          data: incomeData,
          type: 'line',
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: false,
          tension: 0.3,
          borderWidth: 2.5,
          pointBackgroundColor: '#10b981',
          order: 0
        }
      ]
    },
    options: getCommonChartOptions('収支推移')
  });
}

/**
 * カテゴリ別内訳（ドーナツ/円グラフ）を描画
 */
export function renderCategoryDonutChart(canvasId, summary) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  if (categoryDonutChartInstance) {
    categoryDonutChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  const items = summary.mediumRanking.slice(0, 7); // 上位7項目＋その他

  if (items.length === 0) {
    // データがない場合の空グラフ
    categoryDonutChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['支出データなし'],
        datasets: [{
          data: [1],
          backgroundColor: ['rgba(255, 255, 255, 0.08)'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        cutout: '72%'
      }
    });
    return;
  }

  const labels = items.map(it => it.name);
  const data = items.map(it => it.amount);
  const colors = PALETTE.slice(0, items.length);

  categoryDonutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: '#0f172a',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: "'Noto Sans JP', sans-serif", size: 11 },
            boxWidth: 12,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

// グラフ共通オプション
function getCommonChartOptions(titleText) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: "'Noto Sans JP', sans-serif", size: 11 },
          boxWidth: 12,
          padding: 10
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context) {
            return ` ${context.dataset.label}: ${formatCurrency(context.raw || 0)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          callback: function(val) {
            if (val >= 10000) {
              return (val / 10000) + '万';
            }
            return val;
          }
        }
      }
    }
  };
}
