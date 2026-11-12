// DHCP reservations. The router stores them inside the LAN settings, so every change is read-modify-write
// of the whole LAN settings object; we validate first so a bad request never reaches the router.
import { httpError } from '../lib/httpError.js';
import { isInSubnet, isValidIpv4, isValidMac, normalizeMac, stripMac } from '../lib/network.js';

// Read-only fields the router reports that its setter does not accept.
const READ_ONLY_LAN_FIELDS = [
  'minNetworkPrefixLength',
  'maxNetworkPrefixLength',
  'computedNetworkPrefixLength',
  'minAllowedDHCPLeaseMinutes',
  'maxAllowedDHCPLeaseMinutes',
  'maxDHCPReservationDescriptionLength',
];

// The router rejects reservation descriptions with spaces or punctuation (ErrorReservationDescriptionInvalid);
// every description it already stores is letters and digits only, so we reduce to that and respect its length limit.
export function sanitizeDescription(value, maxLength = 63) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, maxLength);
}

export function toSetPayload(lanSettings, reservations) {
  const payload = structuredClone(lanSettings);
  READ_ONLY_LAN_FIELDS.forEach((field) => delete payload[field]);
  payload.dhcpSettings = { ...payload.dhcpSettings, reservations };
  return payload;
}

export function validateReservation(lanSettings, { macAddress, ipAddress, description }, existing) {
  if (!isValidMac(macAddress)) {
    throw httpError(400, 'macAddress is not a valid MAC address');
  }
  if (!isValidIpv4(ipAddress)) {
    throw httpError(400, 'ipAddress is not a valid IPv4 address');
  }
  if (!isInSubnet(ipAddress, lanSettings.ipAddress, lanSettings.networkPrefixLength)) {
    throw httpError(
      400,
      `ipAddress is outside the LAN subnet ${lanSettings.ipAddress}/${lanSettings.networkPrefixLength}`,
    );
  }
  if (ipAddress === lanSettings.ipAddress) {
    throw httpError(409, 'ipAddress is the router itself');
  }
  const mac = stripMac(macAddress);
  const clash = existing.find((item) => item.ipAddress === ipAddress && stripMac(item.macAddress) !== mac);
  if (clash) {
    throw httpError(409, `ipAddress is already reserved for ${normalizeMac(clash.macAddress)}`);
  }
  return {
    macAddress: normalizeMac(macAddress),
    ipAddress,
    description: sanitizeDescription(description, lanSettings.maxDHCPReservationDescriptionLength),
  };
}

export async function getDhcp(client) {
  const [lan, leases] = await client.transaction([
    { action: 'router/GetLANSettings' },
    { action: 'router/GetDHCPClientLeases' },
  ]);
  const { dhcpSettings = {}, ...network } = lan.output;
  return {
    network: {
      ipAddress: network.ipAddress,
      networkPrefixLength: network.networkPrefixLength,
      isDHCPEnabled: network.isDHCPEnabled,
    },
    dhcpSettings: { ...dhcpSettings, reservations: undefined },
    reservations: dhcpSettings.reservations ?? [],
    leases: leases.output.leases ?? [],
  };
}

export async function addReservation(client, request) {
  const lan = await client.call('router/GetLANSettings');
  const existing = lan.dhcpSettings?.reservations ?? [];
  const reservation = validateReservation(lan, request, existing);
  const others = existing.filter((item) => stripMac(item.macAddress) !== stripMac(reservation.macAddress));
  await client.call('router/SetLANSettings', toSetPayload(lan, [...others, reservation]));
  return reservation;
}

export async function removeReservation(client, macAddress) {
  if (!isValidMac(macAddress)) {
    throw httpError(400, 'macAddress is not a valid MAC address');
  }
  const lan = await client.call('router/GetLANSettings');
  const existing = lan.dhcpSettings?.reservations ?? [];
  const remaining = existing.filter((item) => stripMac(item.macAddress) !== stripMac(macAddress));
  if (remaining.length === existing.length) {
    throw httpError(404, 'No reservation exists for that MAC address');
  }
  await client.call('router/SetLANSettings', toSetPayload(lan, remaining));
}
