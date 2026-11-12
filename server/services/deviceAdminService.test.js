import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deleteDevices, renameDevice, validateName } from './deviceAdminService.js';
import { createMockBackups, createMockRouter } from './mockRouter.js';

const device = (id, name, extra = {}) => ({
  deviceID: id,
  friendlyName: name,
  knownInterfaces: [{ macAddress: `AA:00:00:00:00:0${id}` }],
  connections: [],
  properties: [],
  model: {},
  ...extra,
});

function createRouter() {
  return createMockRouter({
    'devicelist/GetDevices3': {
      devices: [
        device('1', 'old-phone'),
        device('2', 'old-tv', { properties: [{ name: 'userDeviceName', value: 'Den TV' }] }),
        device('3', 'live-laptop', { connections: [{ ipAddress: '192.168.1.9' }] }),
        device('4', 'LINKSYS1', { isAuthority: false, model: { deviceType: 'Infrastructure' } }),
      ],
    },
  });
}

test('validateName trims and rejects empty, long or control-character names', () => {
  assert.equal(validateName('  Kitchen TV '), 'Kitchen TV');
  assert.throws(() => validateName('   '), { status: 400 });
  assert.throws(() => validateName('x'.repeat(33)), { status: 400 });
  assert.throws(() => validateName('bad\u0007name'), { status: 400 });
});

test('renameDevice writes the new name, verifies it, and backs up the previous custom name', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  let changed = 0;
  const result = await renameDevice(router, backups, '2', 'Living Room TV', () => (changed += 1));
  assert.equal(result.name, 'Living Room TV');
  assert.equal(backups.saved[0].payload.propertiesToModify[0].value, 'Den TV');
  assert.equal(changed, 1, 'the device cache is told to refresh');
});

test('renameDevice of an unnamed device backs up its hostname so undo has something to restore', async () => {
  const backups = createMockBackups();
  await renameDevice(createRouter(), backups, '1', 'Spare phone');
  assert.equal(backups.saved[0].payload.propertiesToModify[0].value, 'old-phone');
});

test('renameDevice for an unknown device writes nothing', async () => {
  const router = createRouter();
  await assert.rejects(renameDevice(router, createMockBackups(), '99', 'x'), { status: 404 });
  assert.equal(router.writes.length, 0);
});

test('deleteDevices removes offline entries one by one and keeps a record of who was removed', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  const result = await deleteDevices(router, backups, ['1', '2']);
  assert.deepEqual([result.deleted, result.failed], [2, 0]);
  assert.deepEqual(
    backups.saved[0].payload.devices.map((item) => item.name),
    ['old-phone', 'Den TV'],
  );
  assert.equal(router.state['devicelist/GetDevices3'].devices.length, 2);
});

test('deleteDevices refuses the whole request if any chosen device is connected or a mesh node', async () => {
  const router = createRouter();
  await assert.rejects(deleteDevices(router, createMockBackups(), ['1', '3']), /live-laptop/);
  await assert.rejects(deleteDevices(router, createMockBackups(), ['1', '4']), { status: 409 });
  assert.equal(router.writes.length, 0, 'nothing is deleted when part of the request is refused');
});

test('deleteDevices rejects an empty list, too many ids, and ids that no longer exist', async () => {
  const router = createRouter();
  await assert.rejects(deleteDevices(router, createMockBackups(), []), { status: 400 });
  await assert.rejects(
    deleteDevices(
      router,
      createMockBackups(),
      Array.from({ length: 201 }, (_, index) => String(index)),
    ),
    { status: 400 },
  );
  await assert.rejects(deleteDevices(router, createMockBackups(), ['1', 'gone']), { status: 404 });
  assert.equal(router.writes.length, 0);
});
