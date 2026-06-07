const fs = require('fs');

const filePath = 'f:\\BlitzFomo World Cup 2026 Edition\\web\\index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Simple string replacement for French
content = content.split("ruleLast: 'Pas de règle de dernier acheteur'").join("ruleLast: 'Règles de Road Key'");

fs.writeFileSync(filePath, content, 'utf8');
console.log('I18N cleanup completed');

// Verify
const checkContent = fs.readFileSync(filePath, 'utf8');
const badPatterns = ['dernier acheteur', 'último comprador', 'last buyer', 'Winner wall', 'Final whistle', 'reset clock'];
badPatterns.forEach(pattern => {
  if (checkContent.toLowerCase().includes(pattern.toLowerCase())) {
    console.log(`WARNING: Found '${pattern}'`);
  }
});
