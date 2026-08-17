#!/usr/bin/env node
/**
 * quests.json の整合性チェック。
 * 使い方: node validate.js quests.json
 * コミット前や git push 前に手動で(または pre-commit hook で)実行する想定。
 */
const fs = require('fs');

const file = process.argv[2] || 'quests.json';
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

const errors = [];
const lineCodes = new Set(data.lines.map(l => l.code));
const questIds = new Set();

// 1. 必須フィールド & id重複チェック
data.quests.forEach((q, i) => {
  const where = `quests[${i}] (id: ${q.id || '??'})`;

  ['id', 'line', 'order', 'title', 'chapter', 'desc'].forEach(field => {
    if (q[field] === undefined) errors.push(`${where}: 必須フィールド "${field}" がありません`);
  });

  if (questIds.has(q.id)) errors.push(`${where}: id が重複しています`);
  questIds.add(q.id);

  if (q.line && !lineCodes.has(q.line)) {
    errors.push(`${where}: line "${q.line}" は lines に存在しません`);
  }

  if (!Array.isArray(q.prereqs)) {
    errors.push(`${where}: prereqs は配列である必要があります(無い場合は空配列 [])`);
  }
});

// 2. 参照整合性チェック(2周目。全idが出揃った後にチェックする必要があるため)
data.quests.forEach((q, i) => {
  const where = `quests[${i}] (id: ${q.id})`;

  (q.prereqs || []).forEach(p => {
    if (!questIds.has(p.id)) {
      errors.push(`${where}: prereqs の参照先 "${p.id}" が存在しません`);
    }
    if (!p.reason || !p.reason.trim()) {
      errors.push(`${where}: prereqs "${p.id}" に reason がありません`);
    }
    if (p.type !== undefined && !['story', 'warning', 'unlock', 'optional'].includes(p.type)) {
      errors.push(`${where}: prereqs "${p.id}" の type "${p.type}" は "story" か "warning" である必要があります`);
    }
  });

  if (q.branchRow !== undefined && typeof q.branchRow !== 'number') {
    errors.push(`${where}: branchRow は数値である必要があります`);
  }

  if (q.permanentNow !== undefined && typeof q.permanentNow !== 'boolean') {
    errors.push(`${where}: permanentNow は true/false である必要があります`);
  }

  if (q.summaryOf && !questIds.has(q.summaryOf)) {
    errors.push(`${where}: summaryOf の参照先 "${q.summaryOf}" が存在しません`);
  }

  if (q.availableUntil && isNaN(Date.parse(q.availableUntil))) {
    errors.push(`${where}: availableUntil "${q.availableUntil}" が日付として解釈できません`);
  }

  if (q.availableFrom) {
    if (isNaN(Date.parse(q.availableFrom))) {
      errors.push(`${where}: availableFrom "${q.availableFrom}" が日付として解釈できません`);
    } else if (q.availableUntil && q.availableFrom > q.availableUntil) {
      errors.push(`${where}: availableFrom(${q.availableFrom})がavailableUntil(${q.availableUntil})より後になっています`);
    }
  }

  if (q.version && !/^\d+\.\d+$/.test(q.version)) {
    errors.push(`${where}: version "${q.version}" の形式が不正です(例: "5.3")`);
  }

  if (q.videoUrls !== undefined) {
    if (!Array.isArray(q.videoUrls)) {
      errors.push(`${where}: videoUrls は配列である必要があります`);
    } else {
      q.videoUrls.forEach((v, vi) => {
        if (!v.title || !v.title.trim()) errors.push(`${where}: videoUrls[${vi}] に title がありません`);
        if (!v.url || !/^https?:\/\//.test(v.url)) errors.push(`${where}: videoUrls[${vi}] の url が不正です("${v.url}")`);
      });
    }
  }
});

// 結果表示
if (errors.length) {
  console.error(`❌ ${errors.length} 件のエラーが見つかりました:\n`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log(`✅ ${data.quests.length} 件のクエストを検証しました。問題ありません。`);
}
