import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSysinfoService, parseSections, searchLines } from './sysinfoService.js';

const SAMPLE = [
  'preamble line',
  '===== Wi-Fi Info =====',
  'channel 36',
  'dhcp lease ok',
  '= TR69 Log =',
  'nothing',
  '==========',
].join('\n');

function createMockClient() {
  const state = { calls: 0 };
  return {
    state,
    async call() {
      state.calls += 1;
      return { sysinfo: SAMPLE };
    },
  };
}

test('parseSections splits on headings and ignores bare rulers', () => {
  const { sections } = parseSections(SAMPLE);
  assert.deepEqual(
    sections.map((item) => item.name),
    ['Wi-Fi Info', 'TR69 Log'],
  );
  assert.equal(sections[0].lineCount, 2);
});

test('searchLines reports the section and 1-based line number of each match', () => {
  const hits = searchLines(parseSections(SAMPLE), 'DHCP');
  assert.deepEqual(hits, [{ section: 'Wi-Fi Info', line: 4, text: 'dhcp lease ok' }]);
});

test('the service fetches once and serves later calls from cache', async () => {
  const client = createMockClient();
  const service = createSysinfoService(client);
  await service.getSections();
  await service.getSection('Wi-Fi Info');
  await service.search('channel');
  assert.equal(client.state.calls, 1);
});

test('concurrent callers share a single router fetch', async () => {
  const client = createMockClient();
  const service = createSysinfoService(client);
  await Promise.all([service.getSections(), service.getSections(), service.getSections()]);
  assert.equal(client.state.calls, 1);
});

test('getSection returns 404 for an unknown name and search rejects tiny queries', async () => {
  const service = createSysinfoService(createMockClient());
  await assert.rejects(service.getSection('nope'), { status: 404 });
  await assert.rejects(service.search('a'), { status: 400 });
});
