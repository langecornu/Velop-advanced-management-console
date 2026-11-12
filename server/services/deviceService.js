// Builds one flat device list from the router's device list, DHCP leases and reservations, and searches it.
import { isValidIpv4, stripMac, normalizeMac } from '../lib/network.js';

function readProperty(device, name) {
  return device.properties?.find((property) => property.name === name)?.value;
}

export function normalizeDevices({ devices = [], leases = [], reservations = [], backhaul = [] }) {
  const reservationByMac = new Map(reservations.map((item) => [stripMac(item.macAddress), item]));
  const leaseByMac = new Map(leases.map((item) => [stripMac(item.macAddress), item]));
  const backhaulById = new Map(backhaul.map((item) => [item.deviceUUID, item]));
  const seen = new Set();

  const rows = devices.map((device) => {
    const macs = (device.knownInterfaces ?? []).map((item) => ({
      mac: normalizeMac(item.macAddress),
      type: item.interfaceType,
    }));
    const connection = device.connections?.[0];
    const mac = connection?.macAddress ?? device.knownInterfaces?.[0]?.macAddress ?? '';
    const reservation = macs.map((item) => reservationByMac.get(stripMac(item.mac))).find(Boolean);
    macs.forEach((item) => seen.add(stripMac(item.mac)));
    // A device the router lists as disconnected can still hold an active DHCP lease; use it so the IP is findable.
    const lease = macs.map((item) => leaseByMac.get(stripMac(item.mac))).find(Boolean);
    const link = backhaulById.get(device.deviceID);
    const liveIp = connection?.ipAddress || link?.ipAddress || '';
    return {
      deviceId: device.deviceID,
      name: readProperty(device, 'userDeviceName') || device.friendlyName || '(unnamed)',
      hostname: device.friendlyName ?? '',
      location: readProperty(device, 'userDeviceLocation') ?? '',
      firmware: device.unit?.firmwareVersion ?? '',
      backhaul: link ? `${link.connectionType ?? 'Link'} · ${Math.round(Number(link.speedMbps) || 0)} Mbps` : '',
      manufacturer: device.model?.manufacturer || readProperty(device, 'userDeviceManufacturer') || '',
      model: device.model?.modelNumber || readProperty(device, 'userDeviceModelNumber') || '',
      hardwareVersion: device.model?.hardwareVersion ?? '',
      firmwareDate: device.unit?.firmwareDate ?? '',
      type: device.model?.deviceType ?? '',
      mac: normalizeMac(mac),
      macs,
      ip: liveIp || lease?.ipAddress || '',
      ipSource: liveIp ? 'connection' : lease ? 'dhcp-lease' : '',
      hostName: lease?.hostName ?? '',
      ipv6: connection?.ipv6Address ?? '',
      parentDeviceId: connection?.parentDeviceID ?? '',
      isGuest: Boolean(connection?.isGuest),
      isOnline: Boolean(connection) || Boolean(link),
      isNode: Boolean(device.isAuthority) || /infrastructure/i.test(device.model?.deviceType ?? ''),
      reservedIp: reservation?.ipAddress ?? '',
      source: 'device-list',
    };
  });

  // Leases for clients the device list does not know about (stale or hidden clients).
  for (const lease of leases) {
    if (seen.has(stripMac(lease.macAddress))) {
      continue;
    }
    const reservation = reservationByMac.get(stripMac(lease.macAddress));
    rows.push({
      deviceId: '',
      name: lease.hostName || '(lease only)',
      hostname: lease.hostName ?? '',
      location: '',
      firmware: '',
      backhaul: '',
      manufacturer: '',
      model: '',
      type: '',
      mac: normalizeMac(lease.macAddress),
      macs: [{ mac: normalizeMac(lease.macAddress), type: '' }],
      ip: lease.ipAddress ?? '',
      ipSource: 'dhcp-lease',
      hostName: lease.hostName ?? '',
      ipv6: '',
      parentDeviceId: '',
      isGuest: false,
      isOnline: false,
      isNode: false,
      reservedIp: reservation?.ipAddress ?? '',
      source: 'dhcp-lease',
    });
  }
  return rows;
}

// Matches partial MACs (any separator style), partial IPs and name/manufacturer/model text.
export function searchDevices(devices, query) {
  const text = String(query ?? '')
    .trim()
    .toLowerCase();
  if (!text) {
    return devices;
  }
  const hex = stripMac(text);
  const looksLikeMac = hex.length >= 2 && /^[0-9a-f:.-]+$/.test(text) && !isValidIpv4(text) && !/^\d+\.\d*$/.test(text);
  const looksLikeIp = /^[\d.]+$/.test(text);
  return devices.filter((device) => {
    if (looksLikeIp && (device.ip.includes(text) || device.reservedIp.includes(text))) {
      return true;
    }
    if (looksLikeMac && device.macs.some((item) => stripMac(item.mac).includes(hex))) {
      return true;
    }
    return [
      device.name,
      device.hostname,
      device.hostName,
      device.location,
      device.manufacturer,
      device.model,
      device.type,
    ].some((field) => field.toLowerCase().includes(text));
  });
}

export async function listDevices(client) {
  // Backhaul data (node link speed, node IPs) is a bonus: if the firmware lacks it, the device list still works.
  const [[deviceResponse, leaseResponse, lanResponse], backhaulResponse] = await Promise.all([
    client.transaction([
      { action: 'devicelist/GetDevices3' },
      { action: 'router/GetDHCPClientLeases' },
      { action: 'router/GetLANSettings' },
    ]),
    client.callRaw('nodes/diagnostics/GetBackhaulInfo').catch(() => null),
  ]);
  return normalizeDevices({
    devices: deviceResponse.output.devices,
    leases: leaseResponse.output.leases,
    reservations: lanResponse.output.dhcpSettings?.reservations,
    backhaul: backhaulResponse?.output?.backhaulDevices,
  });
}

// Network-wide totals shown on the dashboard cards (independent of the current search).
export function summarize(devices) {
  return {
    total: devices.length,
    connected: devices.filter((device) => device.isOnline).length,
    reserved: devices.filter((device) => device.reservedIp).length,
    nodes: devices.filter((device) => device.isNode).length,
  };
}

const DEVICE_CACHE_TTL_MS = 15_000;

// The router needs 5-10 s to list ~150 devices, so keep the answer for a few seconds and share one in-flight
// request between callers. Searching and filtering then never touch the router.
export function createDeviceCache(client, { now = () => Date.now(), ttlMs = DEVICE_CACHE_TTL_MS } = {}) {
  let cached = null;
  let pending = null;
  return {
    invalidate() {
      cached = null;
    },
    async get(forceRefresh = false) {
      if (!forceRefresh && cached && now() - cached.at < ttlMs) {
        return cached.devices;
      }
      pending ??= listDevices(client)
        .then((devices) => {
          cached = { at: now(), devices };
          return devices;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}
