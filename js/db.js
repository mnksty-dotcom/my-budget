/**
 * 家計簿アプリ データ管理モジュール (db.js)
 * LocalStorageを使用したデータの永続化、カテゴリ管理、集計機能を提供します。
 */

// ストレージキー定数
const STORAGE_KEYS = {
  TRANSACTIONS: 'kakeibo_transactions_v1',
  CATEGORIES: 'kakeibo_categories_v1',
  SETTINGS: 'kakeibo_settings_v1'
};

// 初期大項目定義（大項目は固定）
export const MAJOR_CATEGORIES = {
  expense: [
    {
      id: 'major_fixed',
      name: '絶対に必要な出費（固定費・必需費）',
      shortName: '固定費・必需費',
      description: '生活に不可欠な家賃、光熱費、定期代など',
      color: '#3b82f6', // ブルー系
      badge: '必須'
    },
    {
      id: 'major_variable',
      name: 'その月で変動する出費（変動費・裁量費）',
      shortName: '変動費・裁量費',
      description: '外食、趣味、買わなくてもよい嗜好品など',
      color: '#f43f5e', // ローズ/ピンク系
      badge: '変動'
    }
  ],
  income: [
    {
      id: 'major_income_regular',
      name: '定期収入（給与・事業など）',
      shortName: '給与・本業',
      description: '毎月の安定した収入',
      color: '#10b981', // エメラルドグリーン
      badge: '定例'
    },
    {
      id: 'major_income_extra',
      name: '臨時収入（副業・ボーナス・返還など）',
      shortName: '臨時・その他',
      description: '一時的な臨時収入や還付金など',
      color: '#8b5cf6', // パープル
      badge: '臨時'
    }
  ]
};

// デフォルトの中項目・小項目のマスターデータ
const DEFAULT_CATEGORIES = {
  major_fixed: [
    {
      id: 'med_rent',
      name: '住居費（家賃・共益費）',
      icon: 'home',
      isOptional: false,
      minorList: ['家賃', '管理費・共益費', '更新料']
    },
    {
      id: 'med_utilities',
      name: '水道・光熱費',
      icon: 'zap',
      isOptional: false,
      minorList: ['電気代', 'ガス代', '水道代']
    },
    {
      id: 'med_communication',
      name: '通信費・定期サービス',
      icon: 'wifi',
      isOptional: false,
      minorList: ['スマホ通信料', '自宅Wi-Fi', '必須サブスク']
    },
    {
      id: 'med_insurance_tax',
      name: '保険・税金',
      icon: 'shield',
      isOptional: false,
      minorList: ['健康保険・年金', '生命保険', '住民税']
    },
    {
      id: 'med_transport_regular',
      name: '定期券・交通必需',
      icon: 'train',
      isOptional: false,
      minorList: ['通勤通学定期代', '駐輪場代']
    }
  ],
  major_variable: [
    {
      id: 'med_food_essential',
      name: '食費（自炊・生活必需）',
      icon: 'shopping-cart',
      isOptional: false, // 生活に必要な自炊
      minorList: ['スーパー食材', '調味料・米', '弁当食材']
    },
    {
      id: 'med_food_optional',
      name: '食費（買わなくてもよいもの・外食・カフェ）',
      icon: 'coffee',
      isOptional: true, // 買わなくてもよかった出費フラグ
      minorList: ['カフェ・スタバ', '外食・ランチ', 'コンビニ・お菓子・ジュース', 'デリバリー']
    },
    {
      id: 'med_hobbies',
      name: '趣味・娯楽・レジャー',
      icon: 'gamepad-2',
      isOptional: true,
      minorList: ['ゲーム・課金', '本・漫画・書籍', '映画・ライブチケット', '旅行・お出かけ']
    },
    {
      id: 'med_daily_goods',
      name: '日用品・生活雑貨',
      icon: 'package',
      isOptional: false,
      minorList: ['洗剤・トイレットペーパー', 'キッチン消耗品', '薬・衛生用品']
    },
    {
      id: 'med_fashion_beauty',
      name: '衣服・美容・ケア',
      icon: 'sparkles',
      isOptional: true,
      minorList: ['洋服・靴', '美容室・コスメ', 'スキンケア']
    },
    {
      id: 'med_social',
      name: '交際費・プレゼント',
      icon: 'gift',
      isOptional: true,
      minorList: ['友人との飲み会', 'プレゼント・お祝い', '冠婚葬祭']
    },
    {
      id: 'med_other_var',
      name: 'その他・予備費',
      icon: 'more-horizontal',
      isOptional: false,
      minorList: ['突発的な出費', '雑費']
    }
  ],
  major_income_regular: [
    {
      id: 'med_inc_salary',
      name: '給与手取り',
      icon: 'dollar-sign',
      isOptional: false,
      minorList: ['本業給与', '役員報酬']
    }
  ],
  major_income_extra: [
    {
      id: 'med_inc_bonus',
      name: '賞与・ボーナス',
      icon: 'award',
      isOptional: false,
      minorList: ['夏季賞与', '冬季賞与']
    },
    {
      id: 'med_inc_side',
      name: '副業・雑収入',
      icon: 'trending-up',
      isOptional: false,
      minorList: ['フリマ売上', '副業案件', 'ポイント・キャッシュバック']
    }
  ]
};

class DBManager {
  constructor() {
    this.categories = this.loadCategories();
    this.transactions = this.loadTransactions();
  }

  // カテゴリの読み込み（なければデフォルトを保存）
  loadCategories() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('カテゴリ読み込みエラー:', e);
    }
    this.saveCategories(DEFAULT_CATEGORIES);
    return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  }

  saveCategories(categories) {
    this.categories = categories;
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }

  // 取引データの読み込み
  loadTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('取引データ読み込みエラー:', e);
    }
    return [];
  }

  saveTransactions(transactions) {
    this.transactions = transactions;
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  // 取引の追加
  addTransaction(item) {
    const newItem = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type: item.type, // 'expense' | 'income'
      amount: Math.round(Number(item.amount)),
      date: item.date, // 'YYYY-MM-DD'
      majorId: item.majorId,
      mediumId: item.mediumId,
      minorName: (item.minorName || '').trim(),
      note: (item.note || '').trim(),
      createdAt: new Date().toISOString()
    };
    this.transactions.unshift(newItem);
    this.saveTransactions(this.transactions);
    return newItem;
  }

  // 取引の更新
  updateTransaction(id, updatedFields) {
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;

    this.transactions[idx] = {
      ...this.transactions[idx],
      ...updatedFields,
      amount: Math.round(Number(updatedFields.amount ?? this.transactions[idx].amount)),
      updatedAt: new Date().toISOString()
    };
    this.saveTransactions(this.transactions);
    return this.transactions[idx];
  }

  // 取引の削除
  deleteTransaction(id) {
    this.transactions = this.transactions.filter(t => t.id !== id);
    this.saveTransactions(this.transactions);
  }

  // すべての取引取得
  getAllTransactions() {
    return [...this.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // カテゴリ検索ヘルパー
  getMediumCategory(majorId, mediumId) {
    const list = this.categories[majorId] || [];
    return list.find(m => m.id === mediumId) || null;
  }

  getMajorCategory(majorId) {
    for (const type of ['expense', 'income']) {
      const found = MAJOR_CATEGORIES[type].find(m => m.id === majorId);
      if (found) return { ...found, type };
    }
    return null;
  }

  // 中項目の追加
  addMediumCategory(majorId, name, icon = 'tag', isOptional = false) {
    if (!this.categories[majorId]) {
      this.categories[majorId] = [];
    }
    const newMed = {
      id: 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      icon: icon || 'tag',
      isOptional: Boolean(isOptional),
      minorList: []
    };
    this.categories[majorId].push(newMed);
    this.saveCategories(this.categories);
    return newMed;
  }

  // 中項目の更新
  updateMediumCategory(majorId, mediumId, fields) {
    const list = this.categories[majorId];
    if (!list) return false;
    const item = list.find(m => m.id === mediumId);
    if (!item) return false;

    if (fields.name !== undefined) item.name = fields.name.trim();
    if (fields.icon !== undefined) item.icon = fields.icon;
    if (fields.isOptional !== undefined) item.isOptional = Boolean(fields.isOptional);

    this.saveCategories(this.categories);
    return true;
  }

  // 中項目の削除
  deleteMediumCategory(majorId, mediumId) {
    if (!this.categories[majorId]) return false;
    this.categories[majorId] = this.categories[majorId].filter(m => m.id !== mediumId);
    this.saveCategories(this.categories);
    return true;
  }

  // 小項目の追加
  addMinorCategory(majorId, mediumId, minorName) {
    const name = minorName.trim();
    if (!name) return false;
    const med = this.getMediumCategory(majorId, mediumId);
    if (!med) return false;

    if (!med.minorList) med.minorList = [];
    if (!med.minorList.includes(name)) {
      med.minorList.push(name);
      this.saveCategories(this.categories);
    }
    return true;
  }

  // 小項目の削除
  deleteMinorCategory(majorId, mediumId, minorName) {
    const med = this.getMediumCategory(majorId, mediumId);
    if (!med || !med.minorList) return false;
    med.minorList = med.minorList.filter(n => n !== minorName);
    this.saveCategories(this.categories);
    return true;
  }

  // カテゴリ初期化（リセット）
  resetCategories() {
    this.saveCategories(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));
    return this.categories;
  }

  // サンプルデータを投入（グラフをすぐに体験できるように）
  seedSampleData() {
    const sampleItems = [];
    const today = new Date();

    // 過去60日分のリアルなサンプル支出・収入を生成
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfMonth = d.getDate();
      const dayOfWeek = d.getDay();

      // 給与（毎月25日）
      if (dayOfMonth === 25) {
        sampleItems.push({
          id: 'tx_seed_' + sampleItems.length,
          type: 'income',
          amount: 285000,
          date: dateStr,
          majorId: 'major_income_regular',
          mediumId: 'med_inc_salary',
          minorName: '本業給与',
          note: '手取り給与振込'
        });
        // 家賃（25日に引落し）
        sampleItems.push({
          id: 'tx_seed_' + sampleItems.length,
          type: 'expense',
          amount: 72000,
          date: dateStr,
          majorId: 'major_fixed',
          mediumId: 'med_rent',
          minorName: '家賃',
          note: '口座自動引落'
        });
      }

      // 水道光熱費（毎月15日）
      if (dayOfMonth === 15) {
        sampleItems.push({
          id: 'tx_seed_' + sampleItems.length,
          type: 'expense',
          amount: 9800,
          date: dateStr,
          majorId: 'major_fixed',
          mediumId: 'med_utilities',
          minorName: '電気代',
          note: '前月分'
        });
        sampleItems.push({
          id: 'tx_seed_' + sampleItems.length,
          type: 'expense',
          amount: 4200,
          date: dateStr,
          majorId: 'major_fixed',
          mediumId: 'med_communication',
          minorName: 'スマホ通信料',
          note: '格安SIM＋サブスク'
        });
      }

      // 日常の自炊食材（3〜4日に1回）
      if (i % 3 === 0) {
        sampleItems.push({
          id: 'tx_seed_' + sampleItems.length,
          type: 'expense',
          amount: Math.floor(Math.random() * 2500) + 1800,
          date: dateStr,
          majorId: 'major_variable',
          mediumId: 'med_food_essential',
          minorName: 'スーパー食材',
          note: '今週の食材買い出し'
        });
      }

      // カフェ・スタバ・コンビニ（買わなくてもよかった出費：週に2〜3回）
      if (i % 2 === 0 && Math.random() > 0.3) {
        const cafeList = [
          { name: 'カフェ・スタバ', min: 580, max: 780, note: '新作フラペチーノ' },
          { name: 'コンビニ・お菓子・ジュース', min: 320, max: 650, note: '休憩用のスイーツ' },
          { name: '外食・ランチ', min: 1100, max: 1500, note: '同僚と外食ランチ' }
        ];
        const chosen = cafeList[Math.floor(Math.random() * cafeList.length)];
        sampleItems.push({
          id: 'tx_seed_' + sampleItems.length,
          type: 'expense',
          amount: Math.floor(Math.random() * (chosen.max - chosen.min)) + chosen.min,
          date: dateStr,
          majorId: 'major_variable',
          mediumId: 'med_food_optional',
          minorName: chosen.name,
          note: chosen.note
        });
      }

      // 週末の趣味・娯楽（土日）
      if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() > 0.4) {
        const hobbyList = [
          { med: 'med_hobbies', minor: '本・漫画・書籍', min: 1200, max: 2800, note: '気になっていた本' },
          { med: 'med_hobbies', minor: 'ゲーム・課金', min: 2000, max: 4500, note: 'Steamゲーム購入' },
          { med: 'med_social', minor: '友人との飲み会', min: 4000, max: 6500, note: '週末飲み' },
          { med: 'med_daily_goods', minor: '日用消耗品', min: 1500, max: 3000, note: 'ドラッグストアまとめ買い' }
        ];
        const chosen = hobbyList[Math.floor(Math.random() * hobbyList.length)];
        sampleItems.push({
          id: 'tx_seed_' + sampleItems.length,
          type: 'expense',
          amount: Math.floor(Math.random() * (chosen.max - chosen.min)) + chosen.min,
          date: dateStr,
          majorId: 'major_variable',
          mediumId: chosen.med,
          minorName: chosen.minor,
          note: chosen.note
        });
      }
    }

    this.transactions = sampleItems;
    this.saveTransactions(this.transactions);
    return this.transactions;
  }

  // 全データ消去
  clearAllData() {
    this.transactions = [];
    this.saveTransactions([]);
  }

  // エクスポート（JSON）
  exportJSON() {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: this.categories,
      transactions: this.transactions
    }, null, 2);
  }

  // インポート（JSON）
  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
        throw new Error('取引データの形式が正しくありません');
      }
      if (parsed.categories) {
        this.saveCategories(parsed.categories);
      }
      this.saveTransactions(parsed.transactions);
      return true;
    } catch (e) {
      console.error('インポートエラー:', e);
      return false;
    }
  }
}

export const db = new DBManager();
