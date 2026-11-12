// Decides what status to show for a device by combining the router's flag (which goes stale) with a live ping.
const STATES = {
  online: { key: 'online', label: 'Online', tone: 'ok', isUp: true },
  verified: {
    key: 'verified',
    label: 'Online',
    tone: 'ok',
    isUp: true,
    hint: 'The router lists this device as offline, but it answers ping, so it is up.',
  },
  silent: {
    key: 'silent',
    label: 'Connected',
    tone: 'info',
    isUp: true,
    hint: 'The router sees it connected but it ignores ping (common for phones and IoT devices).',
  },
  offline: { key: 'offline', label: 'Offline', tone: 'muted', isUp: false },
};

// probe is undefined while the check is still running (or the device has no IP to check).
export function deriveStatus(device, probe) {
  if (!device.ip || probe === undefined) {
    return { ...(device.isOnline ? STATES.online : STATES.offline), isChecking: Boolean(device.ip) };
  }
  if (probe.reachable) {
    return device.isOnline ? STATES.online : STATES.verified;
  }
  return device.isOnline ? STATES.silent : STATES.offline;
}
