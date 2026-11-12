// Network administration: on/off switches, restart, and undo. Every change is read -> backup -> write -> read back.
import { httpError } from '../lib/httpError.js';
import { sendSet } from './routerWrite.js';
import { changeSettings } from './settingsWrite.js';

function setField(field) {
  return (settings, value) => {
    settings[field] = value;
  };
}

function control(id, group, label, about, getAction, setAction, field, options = {}) {
  return { id, group, label, about, getAction, setAction, field, risk: 'low', apply: setField(field), ...options };
}

// Turning guest Wi-Fi on must also switch its radios on, otherwise the master flag changes but nothing broadcasts.
function applyGuest(settings, value) {
  settings.isGuestNetworkEnabled = value;
  if (value) {
    settings.radios?.forEach((radio) => {
      if (radio.canEnableRadio !== false) {
        radio.isEnabled = true;
        radio.broadcastGuestSSID = true;
      }
    });
  }
}

export const CONTROLS = [
  control(
    'guest',
    'Wi-Fi',
    'Guest network',
    'A separate Wi-Fi network for visitors.',
    'guestnetwork/GetGuestRadioSettings',
    'guestnetwork/SetGuestRadioSettings',
    'isGuestNetworkEnabled',
    { apply: applyGuest },
  ),
  control(
    'upnp',
    'Network',
    'UPnP',
    'Lets devices open router ports on their own. Convenient, but a security trade-off.',
    'routerupnp/GetUPnPSettings',
    'routerupnp/SetUPnPSettings',
    'isUPnPEnabled',
  ),
  control(
    'express',
    'Network',
    'Express forwarding',
    'Hardware acceleration for routing. Turn off if a device misbehaves.',
    'router/GetExpressForwardingSettings',
    'router/SetExpressForwardingSettings',
    'isExpressForwardingEnabled',
  ),
  control(
    'leds',
    'Hardware',
    'Switch-port LEDs',
    'The status lights on the router ports.',
    'routerleds/GetRouterLEDSettings',
    'routerleds/SetRouterLEDSettings',
    'isSwitchportLEDEnabled',
  ),
  control(
    'logging',
    'Hardware',
    'Router logging',
    'Keeps a log on the router.',
    'routerlog/GetLogSettings',
    'routerlog/SetLogSettings',
    'isLoggingEnabled',
  ),
  control(
    'parental',
    'Access',
    'Parental controls',
    'Master switch for the per-device rules and schedules.',
    'parentalcontrol/GetParentalControlSettings',
    'parentalcontrol/SetParentalControlSettings',
    'isParentalControlEnabled',
  ),
  control(
    'fw4',
    'Firewall',
    'IPv4 firewall',
    'Blocks unsolicited inbound IPv4 traffic.',
    'firewall/GetFirewallSettings',
    'firewall/SetFirewallSettings',
    'isIPv4FirewallEnabled',
    { risk: 'high' },
  ),
  control(
    'fw6',
    'Firewall',
    'IPv6 firewall',
    'Blocks unsolicited inbound IPv6 traffic.',
    'firewall/GetFirewallSettings',
    'firewall/SetFirewallSettings',
    'isIPv6FirewallEnabled',
    { risk: 'high' },
  ),
  control(
    'anon',
    'Firewall',
    'Block anonymous internet requests',
    'Makes the router harder to discover by probes.',
    'firewall/GetFirewallSettings',
    'firewall/SetFirewallSettings',
    'blockAnonymousRequests',
  ),
  control(
    'ident',
    'Firewall',
    'Block IDENT',
    'Blocks the legacy IDENT (port 113) lookup.',
    'firewall/GetFirewallSettings',
    'firewall/SetFirewallSettings',
    'blockIDENT',
  ),
  control(
    'multicast',
    'Firewall',
    'Block multicast',
    'Stops multicast traffic. Can break casting and some smart-home devices.',
    'firewall/GetFirewallSettings',
    'firewall/SetFirewallSettings',
    'blockMulticast',
  ),
  control(
    'natredirect',
    'Firewall',
    'Block NAT redirection',
    'Stops devices reaching each other through the public address.',
    'firewall/GetFirewallSettings',
    'firewall/SetFirewallSettings',
    'blockNATRedirection',
  ),
  control(
    'alg',
    'Network',
    'SIP ALG',
    'Helps SIP phone calls cross the router. Turn it off if calls drop or have one-way audio.',
    'firewall/GetALGSettings',
    'firewall/SetALGSettings',
    'isSIPEnabled',
  ),
  control(
    'wps',
    'Wi-Fi',
    'WPS button join',
    'Lets devices join Wi-Fi with a button press. A known weak spot, so off is the safer choice.',
    'wirelessap/GetWPSServerSettings',
    'wirelessap/SetWPSServerSettings',
    'enabled',
  ),
  control(
    'steering',
    'Mesh',
    'Client steering',
    'Nudges devices toward the best node. Some devices handle this badly.',
    'nodes/topologyoptimization/GetTopologyOptimizationSettings',
    'nodes/topologyoptimization/SetTopologyOptimizationSettings',
    'isClientSteeringEnabled',
  ),
  control(
    'homekit',
    'Mesh',
    'Apple HomeKit',
    'Lets the router be added to Apple Home.',
    'homekit/GetHomeKitSettings',
    'homekit/SetHomeKitSettings',
    'isEnabled',
  ),
  control(
    'remote',
    'Access',
    'Remote management',
    'Lets the router be managed from outside your home network.',
    'ui/GetRemoteSetting',
    'ui/SetRemoteSetting',
    'isEnabled',
    { risk: 'high' },
  ),
];

// Actions whose effect cannot be replayed backwards (a restart, a deleted device list entry, a firmware update).
export const ONE_WAY_ACTIONS = new Set([
  'core/Reboot',
  'devicelist/DeleteDevice',
  'nodes/firmwareupdate/UpdateFirmwareNow',
]);

const BY_ID = new Map(CONTROLS.map((item) => [item.id, item]));

export async function listControls(client) {
  const actions = [...new Set(CONTROLS.map((item) => item.getAction))];
  const responses = new Map(await Promise.all(actions.map(async (action) => [action, await client.callRaw(action)])));
  return CONTROLS.map(({ id, group, label, about, risk, field, getAction }) => {
    const response = responses.get(getAction);
    const value = response.result === 'OK' ? response.output?.[field] : undefined;
    return { id, group, label, about, risk, value, isSupported: typeof value === 'boolean' };
  });
}

export async function setControl(client, backups, id, value, isConfirmed) {
  const item = BY_ID.get(id);
  if (!item) {
    throw httpError(404, 'No such control');
  }
  if (item.risk === 'high' && !isConfirmed) {
    throw httpError(409, 'This is a security setting. Resend with confirm set to true to proceed');
  }
  const { backup, removedFields, current } = await changeSettings({
    client,
    backups,
    label: `${item.label} ${value ? 'on' : 'off'}`,
    getAction: item.getAction,
    setAction: item.setAction,
    change: (next, before) => {
      if (typeof before[item.field] !== 'boolean') {
        throw httpError(409, 'The router does not report this setting, so it cannot be changed here');
      }
      item.apply(next, value);
    },
    verify: (confirmed) => confirmed[item.field] === value,
  });
  return { id, value: current[item.field], backup, removedFields };
}

export async function reboot(client, backups) {
  await backups.save({ label: 'Restart router (no settings changed)', setAction: 'core/Reboot', payload: {} });
  const response = await client.callRaw('core/Reboot');
  if (response.result !== 'OK') {
    throw httpError(502, `The router refused to restart: ${response.result}`);
  }
}

// Undo: send a saved snapshot back through the same safe write path.
export async function restoreBackup(client, backups, file) {
  const snapshot = await backups.read(file);
  if (ONE_WAY_ACTIONS.has(snapshot.setAction)) {
    throw httpError(400, 'This kind of change cannot be undone');
  }
  const { removed } = await sendSet(client, snapshot.setAction, snapshot.payload);
  return { restored: snapshot.label, removedFields: removed };
}
