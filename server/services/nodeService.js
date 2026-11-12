// Mesh nodes: model, firmware, update status, a check/update trigger, and a refresh of the node-side data.
import { httpError } from '../lib/httpError.js';

const STATUS = 'nodes/firmwareupdate/GetFirmwareUpdateStatus';
const UPDATE = 'nodes/firmwareupdate/UpdateFirmwareNow';
const REFRESH_COOLDOWN_MS = 60_000;

export function createNodeService({ client, getDevices, backups, now = () => Date.now() }) {
  let lastRefreshAt = 0;

  async function list() {
    const [devices, status, primary] = await Promise.all([
      getDevices(),
      client.callRaw(STATUS),
      client.callRaw('firmwareupdate/GetFirmwareUpdateStatus'),
    ]);
    const byUuid = new Map((status.output?.firmwareUpdateStatus ?? []).map((entry) => [entry.deviceUUID, entry]));
    return devices
      .filter((device) => device.isNode)
      .map((device) => {
        const entry = byUuid.get(device.deviceId);
        return {
          deviceId: device.deviceId,
          name: device.name,
          model: device.model,
          hardwareVersion: device.hardwareVersion,
          firmware: device.firmware,
          firmwareBuilt: device.firmwareDate,
          ip: device.ip,
          isOnline: device.isOnline,
          backhaul: device.backhaul,
          lastCheck:
            entry?.lastSuccessfulCheckTime ??
            (device.isNode && !entry ? primary.output?.lastSuccessfulCheckTime : '') ??
            '',
          // A node with a pending update carries extra fields beside the check time.
          availableUpdate:
            entry && Object.keys(entry).some((key) => !['deviceUUID', 'lastSuccessfulCheckTime'].includes(key))
              ? entry
              : null,
        };
      });
  }

  async function trigger(onlyCheck) {
    const response = await client.callRaw(UPDATE, { onlyCheck });
    if (response.result !== 'OK') {
      throw httpError(
        502,
        `The router did not ${onlyCheck ? 'check for' : 'start'} the update: ${response.result}${response.error ? ` - ${response.error}` : ''}`,
      );
    }
  }

  return {
    list,
    check: () => trigger(true),
    async update() {
      await backups.save({
        label: 'Node firmware update started (cannot be undone)',
        setAction: UPDATE,
        payload: { onlyCheck: false },
      });
      await trigger(false);
    },
    // The router rate-limits this itself, so we space calls out to keep it from hanging.
    async refresh() {
      if (now() - lastRefreshAt < REFRESH_COOLDOWN_MS) {
        throw httpError(429, 'Node data was refreshed a moment ago. Try again in a minute');
      }
      lastRefreshAt = now();
      const results = await Promise.all([
        client.callRaw('nodes/networkconnections/RefreshNodesWirelessNetworkConnections', {}),
        client.callRaw('nodes/diagnostics/RefreshSlaveBackhaulData', {}),
      ]);
      const failed = results.find((response) => response.result !== 'OK');
      if (failed) {
        throw httpError(502, `The router could not refresh node data: ${failed.result}`);
      }
    },
  };
}
