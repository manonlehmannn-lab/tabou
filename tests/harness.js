// Mini-harnais de tests sans dépendance : fonctionne dans jsc (macOS) et dans un navigateur.
const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(cond, msg = 'assertion échouée') {
  if (!cond) throw new Error(msg);
}

export function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} attendu ${e}, obtenu ${a}`);
}

export function throws(fn, msg = 'une erreur était attendue') {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(msg);
}

export async function run(log = globalThis.print || ((s) => globalThis.console.log(s))) {
  let failed = 0;
  const results = [];
  for (const t of tests) {
    try {
      await t.fn();
      results.push({ name: t.name, ok: true });
      log(`  ✓ ${t.name}`);
    } catch (e) {
      failed++;
      results.push({ name: t.name, ok: false, error: e.message });
      log(`  ✗ ${t.name}\n      ${e.message}`);
    }
  }
  log(`\n${tests.length - failed}/${tests.length} tests réussis.`);
  return { total: tests.length, failed, results };
}
