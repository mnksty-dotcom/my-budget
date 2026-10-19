/**
 * 家計簿アプリ メインアプリケーション制御 (app.js)
 */

import { db, MAJOR_CATEGORIES } from './db.js';
import {
  formatCurrency,
  formatDateJP,
  filterTransactionsByPeriod,
  calculatePeriodSummary,
  renderTrendChart,
  renderCategoryDonutChart
} from './charts.js';

// アプリケーション状態
const state = {
  currentTab: 'input', // 'input' | 'history' | 'charts' | 'settings'
  chartPeriod: 'month', // 'day' | 'week' | 'month' | 'year'
  chartDate: new Date(),
  inputForm: {
    type: 'expense',
    majorId: 'major_variable',
    mediumId: '',
    minorName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  },
  editingTxId: null,
  historyFilter: {
    type: 'all',
    month: new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  }
};

// LucideアイコンSVGマッピング（CDN不要で超高速に描画）
const ICONS = {
  plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  pie: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
  list: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  chevronLeft: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  chevronRight: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  alertCircle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

/**
 * 初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  // 初回起動時、取引が0件の場合はサンプルデータの投入を提案できる（初期データがない場合でも使える）
  if (db.getAllTransactions().length === 0) {
    db.seedSampleData(); // すぐにグラフの迫力を体験できるように初期サンプルを生成
  }

  setupEventListeners();
  renderInputCategories();
  renderHistoryView();
  renderChartsView();
  renderSettingsCategories();

  // PWAサービスワーカーの登録
  registerServiceWorker();
});

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  // ナビゲーションタブ
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', (e) => {
      const tab = e.currentTarget.dataset.tab;
      switchTab(tab);
    });
  });

  // 収支トグル（支出 / 収入）
  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.dataset.type;
      setType(type);
    });
  });

  // 金額入力クイックプラスボタン (+1000, +5000, etc.)
  document.querySelectorAll('.quick-amount-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const add = Number(e.currentTarget.dataset.add);
      const input = document.getElementById('input-amount');
      const cur = Number(input.value) || 0;
      input.value = cur + add;
      state.inputForm.amount = input.value;
    });
  });

  // 日付クイック選択（今日、昨日）
  document.getElementById('btn-date-today')?.addEventListener('click', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('input-date').value = today;
    state.inputForm.date = today;
  });

  document.getElementById('btn-date-yesterday')?.addEventListener('click', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];
    document.getElementById('input-date').value = yesterday;
    state.inputForm.date = yesterday;
  });

  // 保存ボタン
  document.getElementById('btn-save-transaction')?.addEventListener('click', handleSaveTransaction);

  // グラフ期間切り替えタブ
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.chartPeriod = e.currentTarget.dataset.period;
      renderChartsView();
    });
  });

  // グラフ期間ナビゲーション（前へ、次へ）
  document.getElementById('btn-period-prev')?.addEventListener('click', () => navigatePeriod(-1));
  document.getElementById('btn-period-next')?.addEventListener('click', () => navigatePeriod(1));
  document.getElementById('btn-period-current')?.addEventListener('click', () => {
    state.chartDate = new Date();
    renderChartsView();
  });

  // 明細フィルター
  document.getElementById('history-type-filter')?.addEventListener('change', (e) => {
    state.historyFilter.type = e.target.value;
    renderHistoryView();
  });
  document.getElementById('history-month-filter')?.addEventListener('change', (e) => {
    state.historyFilter.month = e.target.value;
    renderHistoryView();
  });

  // サンプルデータ再生成ボタン
  document.getElementById('btn-seed-sample')?.addEventListener('click', () => {
    if (confirm('サンプルの家計簿データ（過去2ヶ月分）を再生成しますか？')) {
      db.seedSampleData();
      showToast('サンプルデータを生成しました！');
      renderHistoryView();
      renderChartsView();
    }
  });

  // 全データ消去ボタン
  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (confirm('【警告】すべての取引データを削除します。よろしいですか？')) {
      db.clearAllData();
      showToast('全データを削除しました');
      renderHistoryView();
      renderChartsView();
    }
  });

  // バックアップ書き出し（JSON）
  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    const jsonStr = db.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kakeibo_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('バックアップファイルを保存しました');
  });

  // バックアップ読み込み（JSON）
  document.getElementById('input-import-json')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const ok = db.importJSON(event.target.result);
      if (ok) {
        showToast('データを復元しました！');
        renderHistoryView();
        renderChartsView();
        renderSettingsCategories();
      } else {
        alert('ファイルの読み込みに失敗しました。形式をご確認ください。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // 中項目追加モーダル関連
  document.getElementById('btn-open-add-medium')?.addEventListener('click', () => {
    openMediumModal();
  });
  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-save-medium-modal')?.addEventListener('click', handleSaveMediumCategory);

  // 取引編集モーダル関連
  document.getElementById('btn-close-edit-tx-modal')?.addEventListener('click', closeEditTxModal);
  document.getElementById('btn-update-tx')?.addEventListener('click', handleUpdateTx);
  document.getElementById('btn-delete-tx')?.addEventListener('click', handleDeleteTx);
}

/**
 * タブ切り替え
 */
function switchTab(tabName) {
  state.currentTab = tabName;
  document.querySelectorAll('.view-screen').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(`view-${tabName}`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  if (tabName === 'charts') {
    renderChartsView();
  } else if (tabName === 'history') {
    renderHistoryView();
  } else if (tabName === 'settings') {
    renderSettingsCategories();
  }
}

/**
 * 収支タイプの切り替え (expense / income)
 */
function setType(type) {
  state.inputForm.type = type;
  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // デフォルト大項目設定
  state.inputForm.majorId = type === 'expense' ? 'major_variable' : 'major_income_regular';
  renderInputCategories();
}

/**
 * 入力画面のカテゴリ選択UI（大項目・中項目・小項目）のレンダリング
 */
function renderInputCategories() {
  const container = document.getElementById('input-categories-wrapper');
  if (!container) return;

  const currentType = state.inputForm.type;
  const majorList = MAJOR_CATEGORIES[currentType];

  let html = `
    <!-- 大項目選択カード -->
    <div class="category-block">
      <label class="form-label">大項目（必須区分）</label>
      <div class="major-cards-grid">
        ${majorList.map(major => `
          <div class="major-card ${state.inputForm.majorId === major.id ? 'selected' : ''}" 
               data-major-id="${major.id}">
            <div class="major-card-badge" style="background-color: ${major.color}22; color: ${major.color};">
              ${major.badge}
            </div>
            <div class="major-card-title">${major.shortName}</div>
            <div class="major-card-desc">${major.description}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 現在選択中の大項目に属する中項目
  const mediumList = db.categories[state.inputForm.majorId] || [];
  if (!state.inputForm.mediumId || !mediumList.some(m => m.id === state.inputForm.mediumId)) {
    state.inputForm.mediumId = mediumList.length > 0 ? mediumList[0].id : '';
  }

  html += `
    <!-- 中項目選択チップ -->
    <div class="category-block">
      <div class="label-with-action">
        <label class="form-label">中項目（用途・目的）</label>
        <button type="button" class="btn-text-action" id="btn-quick-add-medium">＋中項目を追加</button>
      </div>
      <div class="chips-flex">
        ${mediumList.map(med => `
          <button type="button" 
                  class="category-chip ${state.inputForm.mediumId === med.id ? 'selected' : ''} ${med.isOptional ? 'chip-optional' : ''}" 
                  data-medium-id="${med.id}">
            ${med.isOptional ? '<span class="optional-tag">裁量・嗜好</span>' : ''}
            <span>${med.name}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  // 選択中の中項目に紐づく小項目リスト
  const selectedMed = db.getMediumCategory(state.inputForm.majorId, state.inputForm.mediumId);
  const minorList = selectedMed?.minorList || [];

  html += `
    <!-- 小項目選択または入力 -->
    <div class="category-block">
      <label class="form-label">小項目（具体的な購入物・品目）</label>
      <div class="minor-input-wrapper">
        <input type="text" 
               id="input-minor-name" 
               class="input-box" 
               placeholder="例: スタバ新作、スーパー食材、本など" 
               value="${state.inputForm.minorName || ''}">
      </div>
      ${minorList.length > 0 ? `
        <div class="minor-suggestions-flex">
          <span class="minor-hint">候補からタップ:</span>
          ${minorList.map(minor => `
            <button type="button" class="minor-chip-btn" data-minor="${minor}">${minor}</button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = html;

  // 大項目クリックイベント
  container.querySelectorAll('.major-card').forEach(card => {
    card.addEventListener('click', () => {
      state.inputForm.majorId = card.dataset.majorId;
      state.inputForm.mediumId = '';
      state.inputForm.minorName = '';
      renderInputCategories();
    });
  });

  // 中項目クリックイベント
  container.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.inputForm.mediumId = chip.dataset.mediumId;
      state.inputForm.minorName = '';
      renderInputCategories();
    });
  });

  // クイック追加ボタン
  document.getElementById('btn-quick-add-medium')?.addEventListener('click', () => {
    openMediumModal(state.inputForm.majorId);
  });

  // 小項目チップクリックイベント
  container.querySelectorAll('.minor-chip-btn').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const val = e.currentTarget.dataset.minor;
      state.inputForm.minorName = val;
      const input = document.getElementById('input-minor-name');
      if (input) input.value = val;
    });
  });

  // 小項目テキスト入力の同期
  const minorInput = document.getElementById('input-minor-name');
  if (minorInput) {
    minorInput.addEventListener('input', (e) => {
      state.inputForm.minorName = e.target.value;
    });
  }
}

/**
 * 収支取引の保存
 */
function handleSaveTransaction() {
  const amountInput = document.getElementById('input-amount');
  const dateInput = document.getElementById('input-date');
  const noteInput = document.getElementById('input-note');
  const minorInput = document.getElementById('input-minor-name');

  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) {
    alert('正しい金額を入力してください');
    amountInput.focus();
    return;
  }

  if (!state.inputForm.mediumId) {
    alert('中項目（用途・目的）を選択してください');
    return;
  }

  const minorName = minorInput ? minorInput.value.trim() : '';

  // 新しい小項目が入力されていたら自動的に中項目へ登録して次回サジェスト可能にする
  if (minorName) {
    db.addMinorCategory(state.inputForm.majorId, state.inputForm.mediumId, minorName);
  }

  const newTx = db.addTransaction({
    type: state.inputForm.type,
    amount: amount,
    date: dateInput.value || new Date().toISOString().split('T')[0],
    majorId: state.inputForm.majorId,
    mediumId: state.inputForm.mediumId,
    minorName: minorName,
    note: noteInput ? noteInput.value : ''
  });

  // フォームクリア
  amountInput.value = '';
  if (noteInput) noteInput.value = '';
  if (minorInput) minorInput.value = '';
  state.inputForm.amount = '';
  state.inputForm.note = '';
  state.inputForm.minorName = '';

  showToast(`${state.inputForm.type === 'expense' ? '支出' : '収入'} ${formatCurrency(amount)} を記録しました！`);

  // 他の画面の更新
  renderHistoryView();
  renderChartsView();
  renderInputCategories(); // 小項目候補が更新されるため再描画
}

/**
 * グラフ・レポート画面のレンダリング
 */
function renderChartsView() {
  const transactions = db.getAllTransactions();
  const period = state.chartPeriod;
  const targetDate = state.chartDate;

  // 期間表示ラベルの更新
  const labelEl = document.getElementById('period-display-label');
  if (labelEl) {
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth() + 1;
    const d = targetDate.getDate();

    if (period === 'day') {
      labelEl.textContent = `${y}年${m}月${d}日 (${['日','月','火','水','木','金','土'][targetDate.getDay()]})`;
    } else if (period === 'week') {
      labelEl.textContent = `${y}年 ${m}月 第${Math.ceil(d / 7)}週`;
    } else if (period === 'month') {
      labelEl.textContent = `${y}年 ${m}月`;
    } else if (period === 'year') {
      labelEl.textContent = `${y}年 年間`;
    }
  }

  // 期間集計
  const periodTx = filterTransactionsByPeriod(transactions, period, targetDate);
  const summary = calculatePeriodSummary(periodTx);

  // サマリーカードの更新
  document.getElementById('stat-total-expense').textContent = formatCurrency(summary.totalExpense);
  document.getElementById('stat-total-income').textContent = formatCurrency(summary.totalIncome);
  const balanceEl = document.getElementById('stat-balance');
  balanceEl.textContent = formatCurrency(summary.balance);
  balanceEl.className = 'stat-value ' + (summary.balance >= 0 ? 'text-success' : 'text-danger');

  // 「買わなくてもよかった出費（裁量・嗜好）」ハイライトカード
  document.getElementById('stat-optional-amount').textContent = formatCurrency(summary.optionalExpense);
  document.getElementById('stat-optional-rate').textContent = `${summary.optionalRate}%`;
  const optionalBar = document.getElementById('stat-optional-bar');
  if (optionalBar) {
    optionalBar.style.width = `${Math.min(100, summary.optionalRate)}%`;
  }

  // 大項目比率（固定費 vs 変動費）バー
  const fixedRate = summary.totalExpense > 0 ? Math.round((summary.fixedExpense / summary.totalExpense) * 100) : 50;
  const variableRate = 100 - fixedRate;
  document.getElementById('stat-fixed-amount').textContent = formatCurrency(summary.fixedExpense);
  document.getElementById('stat-variable-amount').textContent = formatCurrency(summary.variableExpense);
  document.getElementById('stat-fixed-pct').textContent = `${fixedRate}%`;
  document.getElementById('stat-variable-pct').textContent = `${variableRate}%`;
  const ratioBar = document.getElementById('ratio-fixed-bar');
  if (ratioBar) {
    ratioBar.style.width = `${fixedRate}%`;
  }

  // グラフ描画（Chart.js）
  renderTrendChart('chart-trend-canvas', period, targetDate, transactions);
  renderCategoryDonutChart('chart-donut-canvas', summary);

  // 用途・中項目ランキング一覧の描画
  renderRankingList(summary.mediumRanking, summary.totalExpense);
}

/**
 * 目的別ランキングリストの描画
 */
function renderRankingList(ranking, totalExpense) {
  const container = document.getElementById('charts-ranking-container');
  if (!container) return;

  if (ranking.length === 0) {
    container.innerHTML = '<div class="empty-state-text">この期間の支出データはありません</div>';
    return;
  }

  container.innerHTML = ranking.map((item, idx) => {
    const pct = totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0;
    return `
      <div class="ranking-item">
        <div class="ranking-rank">${idx + 1}</div>
        <div class="ranking-info">
          <div class="ranking-header">
            <span class="ranking-name">
              ${item.name}
              ${item.isOptional ? '<span class="badge-optional-small">買わなくてもよい出費</span>' : ''}
            </span>
            <span class="ranking-amount">${formatCurrency(item.amount)}</span>
          </div>
          <div class="ranking-bar-bg">
            <div class="ranking-bar-fill" style="width: ${pct}%; background-color: ${item.isOptional ? '#f59e0b' : '#3b82f6'};"></div>
          </div>
        </div>
        <div class="ranking-pct">${pct}%</div>
      </div>
    `;
  }).join('');
}

/**
 * 期間の前へ・次へナビゲーション
 */
function navigatePeriod(direction) {
  const cur = new Date(state.chartDate);
  const p = state.chartPeriod;

  if (p === 'day') {
    cur.setDate(cur.getDate() + direction);
  } else if (p === 'week') {
    cur.setDate(cur.getDate() + (direction * 7));
  } else if (p === 'month') {
    cur.setMonth(cur.getMonth() + direction);
  } else if (p === 'year') {
    cur.setFullYear(cur.getFullYear() + direction);
  }

  state.chartDate = cur;
  renderChartsView();
}

/**
 * 明細・履歴画面のレンダリング
 */
function renderHistoryView() {
  const container = document.getElementById('history-list-container');
  if (!container) return;

  const allTx = db.getAllTransactions();
  const filterType = state.historyFilter.type;
  const filterMonth = state.historyFilter.month;

  // 月フィルターのセレクト肢を自動生成
  const monthFilterSelect = document.getElementById('history-month-filter');
  if (monthFilterSelect && monthFilterSelect.options.length <= 1) {
    const monthsSet = new Set();
    allTx.forEach(t => monthsSet.add(t.date.slice(0, 7)));
    monthsSet.add(new Date().toISOString().slice(0, 7));
    const sortedMonths = Array.from(monthsSet).sort().reverse();

    monthFilterSelect.innerHTML = `
      <option value="all">全期間</option>
      ${sortedMonths.map(m => `<option value="${m}" ${m === filterMonth ? 'selected' : ''}>${m.replace('-', '年')}月</option>`).join('')}
    `;
  }

  let filtered = allTx;
  if (filterType !== 'all') {
    filtered = filtered.filter(t => t.type === filterType);
  }
  if (filterMonth !== 'all' && filterMonth) {
    filtered = filtered.filter(t => t.date.startsWith(filterMonth));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state-card"><p>該当する明細がありません</p></div>';
    return;
  }

  // 日付ごとにグループ化
  const grouped = {};
  filtered.forEach(tx => {
    if (!grouped[tx.date]) grouped[tx.date] = [];
    grouped[tx.date].push(tx);
  });

  const sortedDates = Object.keys(grouped).sort().reverse();

  let html = '';
  sortedDates.forEach(dateStr => {
    const dayItems = grouped[dateStr];
    const dayTotalExpense = dayItems.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    html += `
      <div class="history-date-group">
        <div class="history-date-header">
          <span class="date-title">${formatDateJP(dateStr)}</span>
          <span class="date-total">${dayTotalExpense > 0 ? '支出: ' + formatCurrency(dayTotalExpense) : ''}</span>
        </div>
        <div class="history-items-card">
          ${dayItems.map(tx => {
            const med = db.getMediumCategory(tx.majorId, tx.mediumId);
            const isExpense = tx.type === 'expense';
            return `
              <div class="history-item-row" data-id="${tx.id}">
                <div class="history-item-left">
                  <div class="history-item-title">
                    <span class="med-name">${med ? med.name : '項目なし'}</span>
                    ${tx.minorName ? `<span class="minor-tag">${tx.minorName}</span>` : ''}
                    ${med && med.isOptional ? '<span class="badge-optional-pill">買わなくてもよい出費</span>' : ''}
                  </div>
                  ${tx.note ? `<div class="history-item-note">${tx.note}</div>` : ''}
                </div>
                <div class="history-item-right">
                  <span class="history-amount ${isExpense ? 'amount-expense' : 'amount-income'}">
                    ${isExpense ? '-' : '+'}${formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // 明細タップで編集モーダルを開く
  container.querySelectorAll('.history-item-row').forEach(row => {
    row.addEventListener('click', () => {
      openEditTxModal(row.dataset.id);
    });
  });
}

/**
 * 明細編集・削除モーダル
 */
function openEditTxModal(txId) {
  const tx = db.getAllTransactions().find(t => t.id === txId);
  if (!tx) return;

  state.editingTxId = txId;
  const modal = document.getElementById('edit-tx-modal');
  const amountInput = document.getElementById('edit-tx-amount');
  const dateInput = document.getElementById('edit-tx-date');
  const noteInput = document.getElementById('edit-tx-note');
  const minorInput = document.getElementById('edit-tx-minor');
  const infoEl = document.getElementById('edit-tx-category-info');

  const med = db.getMediumCategory(tx.majorId, tx.mediumId);
  infoEl.textContent = `${tx.type === 'expense' ? '【支出】' : '【収入】'} ${med ? med.name : ''}`;

  amountInput.value = tx.amount;
  dateInput.value = tx.date;
  noteInput.value = tx.note || '';
  minorInput.value = tx.minorName || '';

  modal.classList.add('active');
}

function closeEditTxModal() {
  document.getElementById('edit-tx-modal')?.classList.remove('active');
  state.editingTxId = null;
}

function handleUpdateTx() {
  if (!state.editingTxId) return;

  const amount = Number(document.getElementById('edit-tx-amount').value);
  const date = document.getElementById('edit-tx-date').value;
  const note = document.getElementById('edit-tx-note').value;
  const minorName = document.getElementById('edit-tx-minor').value;

  if (!amount || amount <= 0) {
    alert('正しい金額を入力してください');
    return;
  }

  db.updateTransaction(state.editingTxId, {
    amount,
    date,
    note,
    minorName
  });

  closeEditTxModal();
  showToast('明細を更新しました');
  renderHistoryView();
  renderChartsView();
}

function handleDeleteTx() {
  if (!state.editingTxId) return;
  if (confirm('この明細を削除しますか？')) {
    db.deleteTransaction(state.editingTxId);
    closeEditTxModal();
    showToast('明細を削除しました');
    renderHistoryView();
    renderChartsView();
  }
}

/**
 * 設定画面：カテゴリ管理の描画
 */
function renderSettingsCategories() {
  const container = document.getElementById('settings-categories-list');
  if (!container) return;

  let html = '';

  ['expense', 'income'].forEach(type => {
    const majors = MAJOR_CATEGORIES[type];
    html += `<h3 class="settings-section-title">${type === 'expense' ? '支出カテゴリ（用途別）' : '収入カテゴリ'}</h3>`;

    majors.forEach(major => {
      const mediums = db.categories[major.id] || [];
      html += `
        <div class="settings-major-card">
          <div class="settings-major-header">
            <span class="major-badge" style="background-color: ${major.color}; color: #fff;">${major.badge}</span>
            <div class="major-name-wrap">
              <span class="major-name">${major.name}</span>
              <span class="major-desc">${major.description}</span>
            </div>
            <button type="button" class="btn-small-add" data-add-major="${major.id}">＋中項目を追加</button>
          </div>
          <div class="settings-medium-list">
            ${mediums.map(med => `
              <div class="settings-medium-item" data-major-id="${major.id}" data-medium-id="${med.id}">
                <div class="med-info">
                  <span class="med-name">${med.name}</span>
                  ${major.id === 'major_variable' ? `
                    <label class="toggle-optional-label" title="買わなくてもよい嗜好・裁量出費として自動集計します">
                      <input type="checkbox" class="chk-optional" ${med.isOptional ? 'checked' : ''} data-major="${major.id}" data-med="${med.id}">
                      <span>買わなくてもよい出費としてマーク</span>
                    </label>
                  ` : ''}
                  <div class="minor-tags-wrap">
                    ${(med.minorList || []).map(minor => `
                      <span class="tag-minor">
                        ${minor}
                        <button type="button" class="btn-del-minor" data-major="${major.id}" data-med="${med.id}" data-minor="${minor}">×</button>
                      </span>
                    `).join('')}
                    <button type="button" class="btn-add-minor-tag" data-major="${major.id}" data-med="${med.id}">＋小項目</button>
                  </div>
                </div>
                <div class="med-actions">
                  <button type="button" class="btn-icon-danger btn-delete-med" data-major="${major.id}" data-med="${med.id}" title="削除">
                    ${ICONS.trash}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = html;

  // 中項目追加ボタン
  container.querySelectorAll('[data-add-major]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openMediumModal(e.currentTarget.dataset.addMajor);
    });
  });

  // 中項目削除ボタン
  container.querySelectorAll('.btn-delete-med').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const majorId = e.currentTarget.dataset.major;
      const mediumId = e.currentTarget.dataset.med;
      if (confirm('この中項目を削除しますか？')) {
        db.deleteMediumCategory(majorId, mediumId);
        renderSettingsCategories();
        renderInputCategories();
        showToast('中項目を削除しました');
      }
    });
  });

  // 買わなくてもよい出費フラグの切り替え
  container.querySelectorAll('.chk-optional').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const majorId = e.target.dataset.major;
      const medId = e.target.dataset.med;
      db.updateMediumCategory(majorId, medId, { isOptional: e.target.checked });
      renderChartsView();
      renderInputCategories();
      showToast('カテゴリ設定を更新しました');
    });
  });

  // 小項目の追加ボタン
  container.querySelectorAll('.btn-add-minor-tag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const majorId = e.currentTarget.dataset.major;
      const medId = e.currentTarget.dataset.med;
      const minorName = prompt('追加する小項目名を入力してください（例: コーヒー、漫画など）:');
      if (minorName && minorName.trim()) {
        db.addMinorCategory(majorId, medId, minorName.trim());
        renderSettingsCategories();
        renderInputCategories();
        showToast(`小項目「${minorName.trim()}」を追加しました`);
      }
    });
  });

  // 小項目の削除ボタン
  container.querySelectorAll('.btn-del-minor').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const majorId = e.currentTarget.dataset.major;
      const medId = e.currentTarget.dataset.med;
      const minor = e.currentTarget.dataset.minor;
      db.deleteMinorCategory(majorId, medId, minor);
      renderSettingsCategories();
      renderInputCategories();
    });
  });
}

/**
 * 中項目追加モーダル
 */
let targetMajorForModal = 'major_variable';

function openMediumModal(majorId = 'major_variable') {
  targetMajorForModal = majorId;
  const modal = document.getElementById('add-medium-modal');
  const nameInput = document.getElementById('modal-medium-name');
  const optionalCheckbox = document.getElementById('modal-is-optional');

  nameInput.value = '';
  optionalCheckbox.checked = majorId === 'major_variable';
  document.getElementById('modal-major-name').textContent = db.getMajorCategory(majorId)?.name || '';

  modal.classList.add('active');
  nameInput.focus();
}

function closeModal() {
  document.getElementById('add-medium-modal')?.classList.remove('active');
}

function handleSaveMediumCategory() {
  const nameInput = document.getElementById('modal-medium-name');
  const isOptional = document.getElementById('modal-is-optional').checked;
  const name = nameInput.value.trim();

  if (!name) {
    alert('中項目名を入力してください');
    return;
  }

  db.addMediumCategory(targetMajorForModal, name, 'tag', isOptional);
  closeModal();
  renderInputCategories();
  renderSettingsCategories();
  showToast(`中項目「${name}」を作成しました！`);
}

/**
 * トースト通知
 */
function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

/**
 * PWA Service Worker 登録
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(
        reg => console.log('ServiceWorker registered:', reg.scope),
        err => console.log('ServiceWorker error:', err)
      );
    });
  }
}
