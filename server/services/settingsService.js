// Schedules and updates: scheduled reboot, firmware auto-update policy, and the router's time zone.
import { httpError } from '../lib/httpError.js';
import { changeSettings } from './settingsWrite.js';

const REBOOT_GET = 'diagnostics/GetScheduledRebootSettings';
const REBOOT_SET = 'diagnostics/SetScheduledRebootSettings';
const FIRMWARE_GET = 'firmwareupdate/GetFirmwareUpdateSettings';
const FIRMWARE_SET = 'firmwareupdate/SetFirmwareUpdateSettings';
const TIME_GET = 'locale/GetTimeSettings';
const TIME_SET = 'locale/SetTimeSettings';
export const REBOOT_INTERVALS = ['Weekly', 'Monthly'];
export const FIRMWARE_POLICIES = ['AutomaticallyCheckAndInstall', 'Manual'];

export async function getSchedules(client) {
  const [reboot, firmware, time] = await Promise.all([
    client.call(REBOOT_GET),
    client.call(FIRMWARE_GET),
    client.call(TIME_GET),
  ]);
  return {
    reboot: {
      isEnabled: reboot.isScheduledRebootEnabled,
      interval: reboot.rebootInterval,
      intervals: REBOOT_INTERVALS,
    },
    firmware: {
      policy: firmware.updatePolicy,
      policies: FIRMWARE_POLICIES,
      startMinute: firmware.autoUpdateWindow?.startMinute,
      durationMinutes: firmware.autoUpdateWindow?.durationMinutes,
    },
    time: {
      timeZoneId: time.timeZoneID,
      autoAdjustForDst: time.autoAdjustForDST,
      currentTime: time.currentTime,
      zones: (time.supportedTimeZones ?? []).map((zone) => ({
        id: zone.timeZoneID,
        label: zone.description,
        observesDst: zone.observesDST,
      })),
    },
  };
}

export async function setScheduledReboot(client, backups, { isEnabled, interval }) {
  if (!REBOOT_INTERVALS.includes(interval)) {
    throw httpError(400, `interval must be one of ${REBOOT_INTERVALS.join(', ')}`);
  }
  await changeSettings({
    client,
    backups,
    label: `Scheduled reboot ${isEnabled ? interval : 'off'}`,
    getAction: REBOOT_GET,
    setAction: REBOOT_SET,
    change: (next) => {
      next.isScheduledRebootEnabled = isEnabled;
      next.rebootInterval = interval;
    },
    verify: (confirmed) => confirmed.isScheduledRebootEnabled === isEnabled && confirmed.rebootInterval === interval,
  });
  return getSchedules(client);
}

export async function setFirmwarePolicy(client, backups, { policy, startMinute, durationMinutes }) {
  if (!FIRMWARE_POLICIES.includes(policy)) {
    throw httpError(400, `policy must be one of ${FIRMWARE_POLICIES.join(', ')}`);
  }
  if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute > 1439) {
    throw httpError(400, 'startMinute must be a whole number from 0 to 1439 (minutes after midnight)');
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 1440) {
    throw httpError(400, 'durationMinutes must be a whole number from 30 to 1440');
  }
  await changeSettings({
    client,
    backups,
    label: `Firmware updates: ${policy === 'Manual' ? 'manual' : 'automatic'}`,
    getAction: FIRMWARE_GET,
    setAction: FIRMWARE_SET,
    change: (next) => {
      next.updatePolicy = policy;
      next.autoUpdateWindow = { startMinute, durationMinutes };
    },
    verify: (confirmed) => confirmed.updatePolicy === policy,
  });
  return getSchedules(client);
}

export async function setTimeZone(client, backups, { timeZoneId, autoAdjustForDst }) {
  await changeSettings({
    client,
    backups,
    label: `Time zone ${timeZoneId}`,
    getAction: TIME_GET,
    setAction: TIME_SET,
    change: (next, current) => {
      if (!(current.supportedTimeZones ?? []).some((zone) => zone.timeZoneID === timeZoneId)) {
        throw httpError(400, 'That time zone is not supported by the router');
      }
      next.timeZoneID = timeZoneId;
      next.autoAdjustForDST = autoAdjustForDst;
    },
    verify: (confirmed) => confirmed.timeZoneID === timeZoneId,
  });
  return getSchedules(client);
}
