// The "hidden menu": every JNAP action the firmware advertises, plus a guarded raw-call console.
import { httpError } from '../lib/httpError.js';

const READ_ONLY_PATTERN = /\/(Get|Check|Is)\w*$/;
const BLOCKED_PATTERN = /(FactoryReset|ResetToFactory|SetAdminPassword|RestoreConfiguration|DeleteAdmin)/i;

export const PRESETS = [
  { label: 'Device info (no login needed)', action: 'core/GetDeviceInfo', request: {} },
  { label: 'LAN and DHCP settings', action: 'router/GetLANSettings', request: {} },
  { label: 'DHCP leases', action: 'router/GetDHCPClientLeases', request: {} },
  { label: 'All devices', action: 'devicelist/GetDevices3', request: {} },
  { label: 'WAN status', action: 'router/GetWANStatus3', request: {} },
  { label: 'Log settings', action: 'routerlog/GetLogSettings', request: {} },
  { label: 'System info', action: 'diagnostics/GetSysinfoData', request: {} },
  { label: 'Node backhaul', action: 'nodes/diagnostics/GetBackhaulInfo', request: {} },
  {
    label: 'Node wireless clients',
    action: 'nodes/networkconnections/GetNodesWirelessNetworkConnections',
    request: {},
  },
  { label: 'MAC filter', action: 'macfilter/GetMACFilterSettings', request: {} },
  { label: 'Ping status', action: 'diagnostics/GetPingStatus', request: {} },
  { label: 'Traceroute status', action: 'diagnostics/GetTracerouteStatus', request: {} },
  { label: 'Management settings', action: 'routermanagement/GetManagementSettings', request: {} },
  { label: 'Port forwarding', action: 'firewall/GetSinglePortForwardingRules', request: {} },
  { label: 'Speed test results', action: 'healthcheck/GetHealthCheckResults', request: { includeModuleResults: true } },
  { label: 'Node firmware status', action: 'nodes/firmwareupdate/GetFirmwareUpdateStatus', request: {} },
  { label: 'Update settings', action: 'firmwareupdate/GetFirmwareUpdateSettings', request: {} },
  { label: 'Scheduled reboot', action: 'diagnostics/GetScheduledRebootSettings', request: {} },
  { label: 'Time settings', action: 'locale/GetTimeSettings', request: {} },
  { label: 'Ethernet ports', action: 'router/GetEthernetPortConnections', request: {} },
];

export function classifyAction(action) {
  if (BLOCKED_PATTERN.test(action)) {
    return 'blocked';
  }
  return READ_ONLY_PATTERN.test(action) ? 'read' : 'write';
}

export async function listActions(client) {
  const info = await client.callRaw('core/GetDeviceInfo');
  const services = info.output?.services ?? [];
  return { device: { ...info.output, services: undefined }, services, presets: PRESETS };
}

export async function runAction(client, { action, request, confirmWrite }) {
  const kind = classifyAction(action);
  if (kind === 'blocked') {
    throw httpError(403, 'That action is blocked because it is destructive and cannot be undone');
  }
  if (kind === 'write' && !confirmWrite) {
    throw httpError(409, 'This action may change the router. Resend with confirmWrite set to true to proceed');
  }
  return { kind, response: await client.callRaw(action, request) };
}

// ---- "What can I send?" helper ------------------------------------------------------------------------------
// JNAP publishes no parameter schemas, but a router that is sent the wrong input names the fields it wants
// ("unexpected count (0) of child element X"). So we learn an action's input by sending it {} - but only for
// read-only actions, and never for ones that take too long to be worth running as a probe.
const SLOW_ACTIONS = new Set(['diagnostics/GetSysinfoData']);
const DESCRIBE_TTL_MS = 5 * 60_000;
const MAX_FIELDS = 60;

export function parseRequiredElements(errorText) {
  return [...new Set([...String(errorText ?? '').matchAll(/child element "([^"]+)"/g)].map((match) => match[1]))];
}

export function describeShape(output) {
  return Object.entries(output ?? {})
    .slice(0, MAX_FIELDS)
    .map(([name, value]) => ({
      name,
      type: Array.isArray(value)
        ? `list (${value.length})`
        : value === null
          ? 'empty'
          : typeof value === 'object'
            ? 'group'
            : typeof value,
    }));
}

function shortName(action) {
  return action.replace('http://linksys.com/jnap/', '');
}

export function createActionDescriber(client, { now = () => Date.now() } = {}) {
  const cache = new Map();

  async function probeRead(action) {
    const response = await client.callRaw(action, {});
    if (response.result === 'OK') {
      return { isSupported: true, requiredInput: [], returns: describeShape(response.output) };
    }
    if (response.result === '_ErrorUnknownAction') {
      return { isSupported: false, requiredInput: [], returns: [] };
    }
    return {
      isSupported: true,
      requiredInput: parseRequiredElements(response.error),
      returns: [],
      routerMessage: response.error ?? response.result,
    };
  }

  async function describe(rawAction) {
    const action = shortName(rawAction);
    const kind = classifyAction(action);
    if (kind === 'blocked') {
      return { action, kind, note: 'Blocked: this action is destructive and cannot be run from here.' };
    }
    if (kind === 'write') {
      // Never sent to the router. Its matching Get action shows which settings it probably takes.
      const sibling = /\/Set(?=[A-Z])/.test(action) ? action.replace(/\/Set(?=[A-Z])/, '/Get') : null;
      return {
        action,
        kind,
        note: 'This action may change the router, so it is not probed. Send the settings you want to change.',
        sibling,
        siblingFields: sibling ? (await probeRead(sibling)).returns : [],
      };
    }
    if (SLOW_ACTIONS.has(action)) {
      return {
        action,
        kind,
        isSlow: true,
        note: 'Takes about 35 seconds to answer, so it is not probed. It accepts no parameters.',
      };
    }
    return { action, kind, ...(await probeRead(action)) };
  }

  return async function describeCached(rawAction) {
    const key = shortName(rawAction);
    const hit = cache.get(key);
    if (hit && now() - hit.at < DESCRIBE_TTL_MS) {
      return hit.value;
    }
    const value = await describe(rawAction);
    cache.set(key, { at: now(), value });
    return value;
  };
}
