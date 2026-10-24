// Headless test runner to verify all 14 acceptance test conditions in Node.js
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

import { initializeDatabase, getDatabase } from '../src/services/storageService.js';
import { AcceptanceTestsService } from '../src/services/acceptanceTestsService.js';

async function main() {
  console.log('=== STARTING NEXBILL ERP CORE ACCEPTANCE TESTS ===\n');
  initializeDatabase(true);

  const results = await AcceptanceTestsService.runAllTests((idx, res) => {
    console.log(`[Test ${idx}/14] ${res.title}`);
    console.log(`  Status: ${res.passed ? 'PASSED ✓' : 'FAILED ✗'}`);
    res.logs.forEach(l => console.log(`    - ${l}`));
    console.log('');
  });

  const passed = results.filter(r => r.passed).length;
  console.log(`===============================================`);
  console.log(`FINAL RESULT: ${passed} / 14 TESTS PASSED.`);
  if (passed === 14) {
    console.log('ALL CONDITIONS STRICTLY SATISFIED!');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
