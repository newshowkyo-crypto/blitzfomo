
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'web', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 需要替换的旧文案关键词
const replacements = [
  // 关键词 -> 替换为空或者移除
  ['Last buyer', ''],
  ['last buyer', ''],
  ['Winner wall', ''],
  ['winner wall', ''],
  ['reset clock', ''],
  ['Final whistle', ''],
  ['final whistle', ''],
  ['Último comprador', ''], // 西语
  ['último comprador', ''],
  ['Muro de ganadores', ''],
  ['muro de ganadores', ''],
  ['silbato final', ''],
  ['reloj de reinicio', ''],
  ['O último comprador', ''], // 葡语
  ['o último comprador', ''],
  ['Muro dos vencedores', ''],
  ['muro dos vencedores', ''],
  ['apito final', ''],
  ['relógio de reinício', ''],
  ['Le dernier acheteur', ''], // 法语
  ['le dernier acheteur', ''],
  ['Mur des gagnants', ''],
  ['mur des gagnants', ''],
  ['sifflet final', ''],
  ['horloge de réinitialisation', ''],
  ['آخر مشتر', ''], // 阿语
  ['آخر مشتري', ''],
  ['جدار الفائزين', ''],
  ['الصافرة النهائية', ''],
  ['إعادة ضبط المؤقت', ''],
  ['最后买家', ''], // 中文
  ['赢家墙', ''],
  ['最终哨声', ''],
  ['重置时钟', ''],
];

// 执行替换
for (let [oldStr, newStr] of replacements) {
  html = html.split(oldStr).join(newStr);
}

// 写回文件
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✅ web/index.html 旧玩法文案已清理');
