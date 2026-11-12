import assert from 'node:assert/strict';
import { test } from 'node:test';

import { listControls, reboot, restoreBackup, setControl } from './adminService.js';
import { createMockBackups, createMockRouter } from './mockRouter.js';

const FIREWALL = {
  isIPv4FirewallEnabled: true,
  isIPv6FirewallEnabled: true,
  blockMulticast: false,
  blockNATRedirection: false,
  blockIDENT: true,
  blockAnonymousRequests: true,
  blockIPSec: false,
  blockPPTP: false,
  blockL2TP: false,
};

function createRouter() {
  return createMockRouter({
    'routerleds/GetRouterLEDSettings': { isSwitchportLEDEnabled: false },
    'firewall/GetFirewallSettings': { ...FIREWALL },
  });
}

test('listControls reports each switch and marks unsupported ones', async () => {
  const controls = await listControls(createRouter());
  assert.equal(controls.find((item) => item.id === 'leds').value, false);
  assert.equal(controls.find((item) => item.id === 'fw4').value, true);
  assert.equal(controls.find((item) => item.id === 'upnp').isSupported, false, 'unknown to the mock router');
});

test('setControl backs up first, writes, then verifies by reading back', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  const result = await setControl(router, backups, 'leds', true, false);
  assert.equal(result.value, true);
  assert.deepEqual(
    backups.saved[0].payload,
    { isSwitchportLEDEnabled: false },
    'the backup holds the value before the change',
  );
  assert.equal(router.writes.length, 1);
});

test('setControl on a firewall switch refuses without confirmation and writes nothing', async () => {
  const router = createRouter();
  await assert.rejects(setControl(router, createMockBackups(), 'fw4', false, false), { status: 409 });
  assert.equal(router.writes.length, 0);
});

test('setControl with confirmation changes only the one firewall field', async () => {
  const router = createRouter();
  await setControl(router, createMockBackups(), 'fw4', false, true);
  assert.equal(router.state['firewall/GetFirewallSettings'].isIPv4FirewallEnabled, false);
  assert.equal(router.state['firewall/GetFirewallSettings'].isIPv6FirewallEnabled, true);
});

test('setControl refuses an unknown control and a setting the router does not report', async () => {
  const router = createRouter();
  await assert.rejects(setControl(router, createMockBackups(), 'core/Reboot', true, true), { status: 404 });
  await assert.rejects(setControl(router, createMockBackups(), 'upnp', true, true), /UnknownAction|cannot be changed/);
  assert.equal(router.writes.length, 0);
});

test('restoreBackup puts the saved snapshot back', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  await setControl(router, backups, 'leds', true, false);
  await restoreBackup(router, backups, 'backup-1.json');
  assert.equal(router.state['routerleds/GetRouterLEDSettings'].isSwitchportLEDEnabled, false);
});

test('a restart is recorded but can never be "restored"', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  await reboot(router, backups);
  assert.equal(router.writes.at(-1).action, 'core/Reboot');
  await assert.rejects(restoreBackup(router, backups, 'backup-1.json'), { status: 400 });
});

test('the extra switches (SIP ALG, WPS, client steering, HomeKit, remote management) are in the catalog', async () => {
  const ids = (await listControls(createRouter())).map((item) => item.id);
  for (const id of ['alg', 'wps', 'steering', 'homekit', 'remote']) {
    assert.ok(ids.includes(id), id);
  }
});

test('changes that cannot be reversed are never replayed from a backup', async () => {
  for (const setAction of ['devicelist/DeleteDevice', 'nodes/firmwareupdate/UpdateFirmwareNow', 'core/Reboot']) {
    const backups = { read: async () => ({ setAction, payload: {}, label: 'x' }) };
    await assert.rejects(restoreBackup(createRouter(), backups, 'x.json'), { status: 400 }, setAction);
  }
});

test('turning on remote management needs explicit confirmation', async () => {
  const router = createMockRouter({ 'ui/GetRemoteSetting': { isEnabled: false } });
  await assert.rejects(setControl(router, createMockBackups(), 'remote', true, false), { status: 409 });
  assert.equal(router.writes.length, 0);
  assert.equal((await setControl(router, createMockBackups(), 'remote', true, true)).value, true);
});
