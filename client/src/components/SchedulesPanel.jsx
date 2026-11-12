// Schedules and updates: automatic reboot, firmware auto-update policy and window, and the router's time zone.
import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import { minutesToTime, timeToMinutes } from '../lib/format.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import State from './State.jsx';
import ToggleSwitch from './ToggleSwitch.jsx';

const DURATIONS = [60, 120, 180, 240, 360, 480, 720];

export default function SchedulesPanel() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.adminSchedules(signal), []);
  const [reboot, setReboot] = useState(null);
  const [firmware, setFirmware] = useState(null);
  const [zone, setZone] = useState(null);
  const [busy, setBusy] = useState('');
  const [askManual, setAskManual] = useState(false);

  useEffect(() => {
    if (data) {
      setReboot({ isEnabled: data.reboot.isEnabled, interval: data.reboot.interval });
      setFirmware({
        policy: data.firmware.policy,
        start: minutesToTime(data.firmware.startMinute),
        duration: data.firmware.durationMinutes,
      });
      setZone({ timeZoneId: data.time.timeZoneId, autoAdjustForDst: data.time.autoAdjustForDst });
    }
  }, [data]);

  if ((isLoading && !data) || !reboot) {
    return error ? <State error={error} onRetry={reload} /> : <State isLoading rows={3} />;
  }

  async function save(name, action, success) {
    setBusy(name);
    try {
      await action();
      toast('ok', success);
      reload();
    } catch (saveError) {
      toast('error', saveError.message);
    } finally {
      setBusy('');
      setAskManual(false);
    }
  }
  const sendFirmware = (confirm) =>
    api.setFirmware({
      policy: firmware.policy,
      startMinute: timeToMinutes(firmware.start),
      durationMinutes: firmware.duration,
      confirm,
    });
  const durations = [...new Set([...DURATIONS, firmware.duration])].sort((a, b) => a - b);
  const isAuto = data.firmware.policy === 'AutomaticallyCheckAndInstall';

  return (
    <div className="stack">
      <section className="card pad">
        <h2>Scheduled restart</h2>
        <p className="muted">
          The router can restart itself on a schedule to stay healthy.{' '}
          {data.reboot.isEnabled
            ? `It is set to restart ${data.reboot.interval.toLowerCase()}.`
            : 'It is switched off.'}
        </p>
        <div className="inline-row">
          <ToggleSwitch
            checked={reboot.isEnabled}
            label="Scheduled restart"
            onChange={(value) => setReboot({ ...reboot, isEnabled: value })}
          />
          <label className="inline-field">
            <span>Repeat</span>
            <select
              value={reboot.interval}
              onChange={(event) => setReboot({ ...reboot, interval: event.target.value })}
            >
              {data.reboot.intervals.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              busy === 'reboot' ||
              (reboot.isEnabled === data.reboot.isEnabled && reboot.interval === data.reboot.interval)
            }
            onClick={() => save('reboot', () => api.setReboot(reboot), 'Restart schedule saved')}
          >
            Save
          </button>
        </div>
      </section>

      <section className="card pad">
        <h2>Firmware updates</h2>
        <p className="muted">
          {isAuto
            ? 'Automatic updates are on. When Linksys publishes a new version the router installs it during the window below, then restarts.'
            : 'Automatic updates are OFF. The router will not patch itself, so check for updates yourself from Mesh nodes.'}
        </p>
        <div className="inline-row">
          <label className="inline-field">
            <span>Policy</span>
            <select
              value={firmware.policy}
              onChange={(event) => setFirmware({ ...firmware, policy: event.target.value })}
            >
              {data.firmware.policies.map((item) => (
                <option key={item} value={item}>
                  {item === 'Manual' ? 'Manual (I will update)' : 'Automatic (check and install)'}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Window starts</span>
            <input
              type="time"
              value={firmware.start}
              onChange={(event) => setFirmware({ ...firmware, start: event.target.value })}
            />
          </label>
          <label className="inline-field">
            <span>Lasts</span>
            <select
              value={firmware.duration}
              onChange={(event) => setFirmware({ ...firmware, duration: Number(event.target.value) })}
            >
              {durations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes / 60} hour{minutes === 60 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy === 'firmware'}
            onClick={() =>
              firmware.policy === 'Manual'
                ? setAskManual(true)
                : save('firmware', () => sendFirmware(false), 'Update settings saved')
            }
          >
            Save
          </button>
        </div>
        <p className="muted">Times use the router clock ({data.time.timeZoneId}).</p>
      </section>

      <section className="card pad">
        <h2>Time zone</h2>
        <p className="muted">
          Router time is {new Date(data.time.currentTime).toLocaleString()}. Restarts, update windows and parental
          schedules follow this clock.
        </p>
        <div className="inline-row">
          <label className="inline-field grow-field">
            <span>Zone</span>
            <select value={zone.timeZoneId} onChange={(event) => setZone({ ...zone, timeZoneId: event.target.value })}>
              {data.time.zones.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={zone.autoAdjustForDst}
              onChange={(event) => setZone({ ...zone, autoAdjustForDst: event.target.checked })}
            />
            <span>Adjust for daylight saving</span>
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              busy === 'time' ||
              (zone.timeZoneId === data.time.timeZoneId && zone.autoAdjustForDst === data.time.autoAdjustForDst)
            }
            onClick={() => save('time', () => api.setTimeZone(zone), 'Time zone saved')}
          >
            Save
          </button>
        </div>
      </section>

      {askManual && (
        <ConfirmDialog
          title="Turn automatic updates off?"
          message="The router will stop installing security fixes on its own until you turn this back on. Your previous setting is backed up first."
          confirmLabel="Turn off automatic updates"
          isDanger
          isBusy={busy === 'firmware'}
          onConfirm={() => save('firmware', () => sendFirmware(true), 'Update settings saved')}
          onClose={() => setAskManual(false)}
        />
      )}
    </div>
  );
}
