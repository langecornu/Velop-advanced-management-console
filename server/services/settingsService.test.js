import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockBackups, createMockRouter } from './mockRouter.js';
import { getSchedules, setFirmwarePolicy, setScheduledReboot, setTimeZone } from './settingsService.js';

function createRouter() {
  return createMockRouter({
    'diagnostics/GetScheduledRebootSettings': { isScheduledRebootEnabled: true, rebootInterval: 'Weekly' },
    'firmwareupdate/GetFirmwareUpdateSettings': {
      updatePolicy: 'AutomaticallyCheckAndInstall',
      autoUpdateWindow: { startMinute: 0, durationMinutes: 240 },
    },
    'locale/GetTimeSettings': {
      timeZoneID: 'PST8',
      autoAdjustForDST: true,
      currentTime: '2026-11-12T10:00:00Z',
      supportedTimeZones: [
        { timeZoneID: 'PST8', description: 'Pacific' },
        { timeZoneID: 'EST5', description: 'Eastern' },
      ],
    },
  });
}

test('getSchedules gathers reboot, firmware and time settings in a friendly shape', async () => {
  const schedules = await getSchedules(createRouter());
  assert.equal(schedules.reboot.interval, 'Weekly');
  assert.equal(schedules.firmware.durationMinutes, 240);
  assert.deepEqual(
    schedules.time.zones.map((zone) => zone.id),
    ['PST8', 'EST5'],
  );
});

test('setScheduledReboot changes the schedule, with a backup of the old one', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  const result = await setScheduledReboot(router, backups, { isEnabled: false, interval: 'Monthly' });
  assert.equal(result.reboot.isEnabled, false);
  assert.equal(result.reboot.interval, 'Monthly');
  assert.equal(backups.saved[0].payload.rebootInterval, 'Weekly');
});

test('setScheduledReboot rejects an unknown interval and writes nothing', async () => {
  const router = createRouter();
  await assert.rejects(setScheduledReboot(router, createMockBackups(), { isEnabled: true, interval: 'Hourly' }), {
    status: 400,
  });
  assert.equal(router.writes.length, 0);
});

test('setFirmwarePolicy validates the policy and the update window before writing', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  await assert.rejects(
    setFirmwarePolicy(router, backups, { policy: 'Sometimes', startMinute: 0, durationMinutes: 240 }),
    { status: 400 },
  );
  await assert.rejects(
    setFirmwarePolicy(router, backups, { policy: 'Manual', startMinute: 2000, durationMinutes: 240 }),
    { status: 400 },
  );
  await assert.rejects(setFirmwarePolicy(router, backups, { policy: 'Manual', startMinute: 0, durationMinutes: 5 }), {
    status: 400,
  });
  assert.equal(router.writes.length, 0);
  const result = await setFirmwarePolicy(router, backups, { policy: 'Manual', startMinute: 120, durationMinutes: 180 });
  assert.equal(result.firmware.policy, 'Manual');
  assert.equal(result.firmware.startMinute, 120);
});

test('setTimeZone only accepts a zone the router lists, and refuses others before any backup', async () => {
  const router = createRouter();
  const backups = createMockBackups();
  await assert.rejects(setTimeZone(router, backups, { timeZoneId: 'MARS1', autoAdjustForDst: false }), { status: 400 });
  assert.equal(backups.saved.length, 0);
  const result = await setTimeZone(router, backups, { timeZoneId: 'EST5', autoAdjustForDst: false });
  assert.equal(result.time.timeZoneId, 'EST5');
});
