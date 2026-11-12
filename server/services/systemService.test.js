import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATALOG, getCatalog, runProbe } from './systemService.js';
import { classifyAction } from './explorerService.js';

const ALL_PROBES = CATALOG.flatMap((category) => category.probes);

test('every probe id is unique so a probe can be addressed by id alone', () => {
  const ids = ALL_PROBES.map((probe) => probe.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every probe in the catalog is a read-only action', () => {
  for (const probe of ALL_PROBES) {
    assert.equal(classifyAction(probe.action), 'read', `${probe.action} must be read-only`);
  }
});

test('runProbe runs the cataloged action and returns its output', async () => {
  const seen = [];
  const MockClient = {
    async callRaw(action) {
      seen.push(action);
      return { result: 'OK', output: { uptimeSeconds: 42 } };
    },
  };
  const result = await runProbe(MockClient, 'stats');
  assert.deepEqual(seen, ['diagnostics/GetSystemStats']);
  assert.equal(result.output.uptimeSeconds, 42);
  assert.equal(result.result, 'OK');
});

test('runProbe reports an unsupported action without throwing or inventing output', async () => {
  const MockClient = { callRaw: async () => ({ result: '_ErrorUnknownAction' }) };
  const result = await runProbe(MockClient, 'stats');
  assert.equal(result.result, '_ErrorUnknownAction');
  assert.equal(result.output, undefined);
});

test('runProbe refuses any id that is not in the catalog and never contacts the router', async () => {
  let calls = 0;
  const MockClient = {
    async callRaw() {
      calls += 1;
      return { result: 'OK' };
    },
  };
  await assert.rejects(runProbe(MockClient, 'core/Reboot'), { status: 404 });
  assert.equal(calls, 0);
});

test('getCatalog exposes labels and descriptions for the UI', () => {
  const catalog = getCatalog();
  assert.ok(catalog.length >= 4);
  assert.ok(catalog.every((category) => category.probes.every((probe) => probe.label && probe.about)));
});
