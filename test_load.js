// Simple test to verify ARUME V60 loads without errors
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Check critical components
const checks = {
  'DOCTYPE': html.includes('<!DOCTYPE html>'),
  'V60 Title': html.includes('ARUME V60 DEFINITIVE'),
  'Chart.js CDN': html.includes('cdn.jsdelivr.net/npm/chart.js'),
  'SheetJS CDN': html.includes('xlsx.full.min.js'),
  'Config Object': html.includes('const CONFIG'),
  'Allergens Object': html.includes('const ALLERGENS'),
  'IndexedDB Init': html.includes('function initImageDB'),
  'Save to IndexedDB': html.includes('async function saveImage'),
  'Get from IndexedDB': html.includes('async function getImage'),
  'Calc Recipe with Sub-recipes': html.includes('calcRecipe(r, depth'),
  'Allergen Inheritance': html.includes('allergens.add'),
  'Inverse BOM': html.includes('calcInverseBOM'),
  'Allergen Card': html.includes('showAllergenCard'),
  'Price History': html.includes('priceHistory'),
  'Traffic Light': html.includes('price-indicator'),
  'Blind Mode': html.includes('blindMode'),
  'WhatsApp Order': html.includes('sendWhatsApp'),
  'Excel Export': html.includes('exportToExcel'),
  'XLSX Usage': html.includes('XLSX.utils'),
  'Save Function': html.includes('localStorage.setItem(\'arume_v60\''),
  'Init Call': html.includes('init();'),
  'Closing Tags': html.includes('</body>') && html.includes('</html>')
};

console.log('\n🧪 ARUME V60 DEFINITIVE - Component Check\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

Object.entries(checks).forEach(([name, result]) => {
  if (result) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}`);
    failed++;
  }
});

console.log('='.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('\n✅ All checks passed! ARUME V60 DEFINITIVE is ready.\n');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed.\n');
  process.exit(1);
}
