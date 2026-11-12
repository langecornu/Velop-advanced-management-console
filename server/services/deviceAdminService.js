// Device list housekeeping: rename a device (as the Linksys app does) and remove stale offline entries.
import { httpError } from '../lib/httpError.js';
import { sendSet } from './routerWrite.js';

const GET_DEVICES = 'devicelist/GetDevices3';
const SET_PROPERTIES = 'devicelist/SetDeviceProperties';
const DELETE = 'devicelist/DeleteDevice';
const MAX_DELETE = 200;

const customName = (device) => device.properties?.find((property) => property.name === 'userDeviceName')?.value;
const isNode = (device) => Boolean(device.isAuthority) || /infrastructure/i.test(device.model?.deviceType ?? '');

export function validateName(value) {
  const name = String(value ?? '').trim();
  if (
    name.length < 1 ||
    name.length > 32 ||
    [...name].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  ) {
    throw httpError(400, 'The name must be 1 to 32 characters with no control characters');
  }
  return name;
}

export async function renameDevice(client, backups, deviceId, rawName, afterChange = () => {}) {
  const name = validateName(rawName);
  const { devices } = await client.call(GET_DEVICES);
  const device = devices.find((item) => item.deviceID === deviceId);
  if (!device) {
    throw httpError(404, 'No such device');
  }
  const previous = customName(device) ?? device.friendlyName ?? '';
  const backup = await backups.save({
    label: `Rename "${previous}" to "${name}"`,
    setAction: SET_PROPERTIES,
    payload: { deviceID: deviceId, propertiesToModify: [{ name: 'userDeviceName', value: previous }] },
  });
  await sendSet(client, SET_PROPERTIES, {
    deviceID: deviceId,
    propertiesToModify: [{ name: 'userDeviceName', value: name }],
  });
  const confirmed = (await client.call(GET_DEVICES)).devices.find((item) => item.deviceID === deviceId);
  if (!confirmed || customName(confirmed) !== name) {
    throw httpError(502, 'The router accepted the rename but still shows the old name');
  }
  afterChange();
  return { deviceId, name, backup };
}

// Only entries with no live connection can go, and never a mesh node: deleting those would break the mesh.
export async function deleteDevices(client, backups, deviceIds, afterChange = () => {}) {
  const ids = [...new Set(deviceIds)];
  if (ids.length === 0 || ids.length > MAX_DELETE) {
    throw httpError(400, `Choose between 1 and ${MAX_DELETE} devices`);
  }
  const { devices } = await client.call(GET_DEVICES);
  const byId = new Map(devices.map((device) => [device.deviceID, device]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw httpError(404, `${missing.length} of the chosen devices no longer exist. Refresh and try again`);
  }
  const refused = ids
    .map((id) => byId.get(id))
    .filter((device) => isNode(device) || (device.connections ?? []).length > 0);
  if (refused.length) {
    throw httpError(
      409,
      `Not removed, because they are mesh nodes or currently connected: ${refused.map((device) => customName(device) ?? device.friendlyName).join(', ')}`,
    );
  }
  const snapshot = ids.map((id) => ({
    deviceID: id,
    name: customName(byId.get(id)) ?? byId.get(id).friendlyName,
    macs: (byId.get(id).knownInterfaces ?? []).map((item) => item.macAddress),
  }));
  const backup = await backups.save({
    label: `Removed ${ids.length} offline device${ids.length === 1 ? '' : 's'}`,
    setAction: DELETE,
    payload: { devices: snapshot },
  });
  const results = await client.transaction(ids.map((id) => ({ action: DELETE, request: { deviceID: id } })));
  const failed = results.filter((item) => item.result !== 'OK').length;
  afterChange();
  return { deleted: ids.length - failed, failed, backup };
}
