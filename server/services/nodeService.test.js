import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockBackups, createMockRouter } from './mockRouter.js';
import { createNodeService } from './nodeService.js';

const DEVICES = [
  {
    deviceId: 'n1',
    name: 'Kitchen',
    model: 'WHW01',
    hardwareVersion: '1',
    firmware: '1.1.13',
    firmwareDate: '2020-09-05',
    ip: '192.168.1.76',
    isOnline: true,
    isNode: true,
    backhaul: 'Wireless · 140 Mbps',
  },
  {
    deviceId: 'n2',
    name: 'Garage',
    model: 'WHW01',
    hardwareVersion: '1',
    firmware: '1.1.13',
    firmwareDate: '',
    ip: '',
    isOnline: false,
    isNode: true,
    backhaul: '',
  },
  { deviceId: 'd1', name: 'Phone', isNode: false },
];

function createFixture(now = () => 1_000_000) {
  const router = createMockRouter({
    'nodes/firmwareupdate/GetFirmwareUpdateStatus': {
      firmwareUpdateStatus: [
        { deviceUUID: 'n1', lastSuccessfulCheckTime: '2026-11-12T18:00:00Z' },
        { deviceUUID: 'n2', lastSuccessfulCheckTime: '2026-11-12T18:00:00Z', availableUpdate: { version: '1.1.14' } },
      ],
    },
    'firmwareupdate/GetFirmwareUpdateStatus': { lastSuccessfulCheckTime: '2026-11-12T18:01:00Z' },
  });
  const backups = createMockBackups();
  return {
    router,
    backups,
    service: createNodeService({ client: router, getDevices: async () => DEVICES, backups, now }),
  };
}

test('list returns only mesh nodes, flagging a pending update and showing the last check', async () => {
  const nodes = await createFixture().service.list();
  assert.deepEqual(
    nodes.map((node) => node.name),
    ['Kitchen', 'Garage'],
  );
  assert.equal(nodes[0].availableUpdate, null);
  assert.deepEqual(nodes[1].availableUpdate, {
    deviceUUID: 'n2',
    lastSuccessfulCheckTime: '2026-11-12T18:00:00Z',
    availableUpdate: { version: '1.1.14' },
  });
  assert.equal(nodes[0].lastCheck, '2026-11-12T18:00:00Z');
});

test('check asks the router to check only, without installing', async () => {
  const { router, service } = createFixture();
  await service.check();
  assert.deepEqual(router.writes.at(-1), {
    action: 'nodes/firmwareupdate/UpdateFirmwareNow',
    request: { onlyCheck: true },
  });
});

test('update records a one-way entry first, then asks the router to install', async () => {
  const { router, backups, service } = createFixture();
  await service.update();
  assert.match(backups.saved[0].label, /cannot be undone/);
  assert.deepEqual(router.writes.at(-1).request, { onlyCheck: false });
});

test('refresh is rate limited so the router is not asked again within a minute', async () => {
  let clock = 1_000_000;
  const { router, service } = createFixture(() => clock);
  await service.refresh();
  assert.equal(router.writes.length, 2, 'both refresh actions are sent');
  clock += 10_000;
  await assert.rejects(service.refresh(), { status: 429 });
  clock += 60_000;
  await service.refresh();
  assert.equal(router.writes.length, 4);
});
