// Port forwarding (single-port rules), plus a read-only view of the other rule types and the DMZ.
// Opening a port exposes a device to the internet, so every change needs explicit confirmation upstream.
import { httpError } from '../lib/httpError.js';
import { isInSubnet, isPrivateIpv4 } from '../lib/network.js';
import { changeSettings } from './settingsWrite.js';

const GET = 'firewall/GetSinglePortForwardingRules';
const SET = 'firewall/SetSinglePortForwardingRules';
export const PROTOCOLS = ['TCP', 'UDP', 'Both'];
const DESCRIPTION = /^[\w .-]*$/;

export function describeRule(rule, index) {
  return {
    index,
    isEnabled: Boolean(rule.isEnabled),
    externalPort: rule.externalPort,
    protocol: rule.protocol,
    internalIp: rule.internalServerIPAddress,
    internalPort: rule.internalPort,
    description: rule.description ?? '',
  };
}

const isPort = (value) => Number.isInteger(value) && value >= 1 && value <= 65535;
const overlaps = (a, b) => a === 'Both' || b === 'Both' || a === b;

export function validateRule(rule, { lan, rules, ignoreIndex, maxDescriptionLength }) {
  if (!isPort(rule.externalPort) || !isPort(rule.internalPort)) {
    throw httpError(400, 'Ports must be whole numbers from 1 to 65535');
  }
  if (!PROTOCOLS.includes(rule.protocol)) {
    throw httpError(400, `protocol must be one of ${PROTOCOLS.join(', ')}`);
  }
  if (
    !isPrivateIpv4(rule.internalIp) ||
    !isInSubnet(rule.internalIp, lan.ipAddress, lan.networkPrefixLength) ||
    rule.internalIp === lan.ipAddress
  ) {
    throw httpError(400, 'The internal address must be a device on your LAN, not the router itself');
  }
  if (rule.description.length > (maxDescriptionLength ?? 32) || !DESCRIPTION.test(rule.description)) {
    throw httpError(
      400,
      `The description may use letters, digits, spaces, dots, dashes and underscores, up to ${maxDescriptionLength ?? 32} characters`,
    );
  }
  const clash = rules.find(
    (other, index) =>
      index !== ignoreIndex && other.externalPort === rule.externalPort && overlaps(other.protocol, rule.protocol),
  );
  if (clash) {
    throw httpError(409, `External port ${rule.externalPort} is already forwarded to ${clash.internalServerIPAddress}`);
  }
}

function toRouterRule(rule) {
  return {
    isEnabled: rule.isEnabled,
    externalPort: rule.externalPort,
    protocol: rule.protocol,
    internalServerIPAddress: rule.internalIp,
    internalPort: rule.internalPort,
    description: rule.description,
  };
}

export async function getPortForwarding(client) {
  const [single, range, trigger, ipv6, dmz] = await Promise.all([
    client.callRaw(GET),
    client.callRaw('firewall/GetPortRangeForwardingRules'),
    client.callRaw('firewall/GetPortRangeTriggeringRules'),
    client.callRaw('firewall/GetIPv6FirewallRules'),
    client.callRaw('firewall/GetDMZSettings'),
  ]);
  return {
    rules: (single.output?.rules ?? []).map(describeRule),
    maxRules: single.output?.maxRules,
    maxDescriptionLength: single.output?.maxDescriptionLength,
    others: {
      rangeForwarding: range.output?.rules?.length ?? 0,
      rangeTriggering: trigger.output?.rules?.length ?? 0,
      ipv6Firewall: ipv6.output?.rules?.length ?? 0,
      isDmzEnabled: Boolean(dmz.output?.isDMZEnabled),
    },
  };
}

async function editRules(client, backups, label, edit) {
  const lan = await client.call('router/GetLANSettings');
  await changeSettings({
    client,
    backups,
    label,
    getAction: GET,
    setAction: SET,
    change: (next, current) => {
      const rules = next.rules ?? [];
      edit(rules, { lan, maxDescriptionLength: current.maxDescriptionLength, maxRules: current.maxRules });
      next.rules = rules;
    },
  });
  return getPortForwarding(client);
}

export function addRule(client, backups, rule) {
  return editRules(client, backups, `Port forward ${rule.externalPort} added`, (rules, limits) => {
    if (limits.maxRules && rules.length >= limits.maxRules) {
      throw httpError(409, `The router holds at most ${limits.maxRules} forwarding rules`);
    }
    validateRule(rule, { ...limits, rules });
    rules.push(toRouterRule(rule));
  });
}

export function updateRule(client, backups, index, rule) {
  return editRules(client, backups, `Port forward ${rule.externalPort} changed`, (rules, limits) => {
    if (!Number.isInteger(index) || index < 0 || index >= rules.length) {
      throw httpError(404, 'No such rule');
    }
    validateRule(rule, { ...limits, rules, ignoreIndex: index });
    rules[index] = toRouterRule(rule);
  });
}

export function deleteRule(client, backups, index) {
  return editRules(client, backups, `Port forward rule ${index + 1} removed`, (rules) => {
    if (!Number.isInteger(index) || index < 0 || index >= rules.length) {
      throw httpError(404, 'No such rule');
    }
    rules.splice(index, 1);
  });
}
