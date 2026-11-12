// Access control: MAC filter and parental-control rules.
import { httpError } from '../lib/httpError.js';
import { isValidMac, normalizeMac } from '../lib/network.js';
import { sendSet } from './routerWrite.js';

const MAC_FILTER_GET = 'macfilter/GetMACFilterSettings';
const MAC_FILTER_SET = 'macfilter/SetMACFilterSettings';
const PARENTAL_GET = 'parentalcontrol/GetParentalControlSettings';
const PARENTAL_SET = 'parentalcontrol/SetParentalControlSettings';
export const MAC_FILTER_MODES = ['Disabled', 'Allow', 'Deny'];

export async function getAccess(client) {
  const [filter, parental] = await Promise.all([client.callRaw(MAC_FILTER_GET), client.callRaw(PARENTAL_GET)]);
  const rules = parental.output?.rules ?? [];
  return {
    macFilter: {
      mode: filter.output?.macFilterMode,
      macAddresses: filter.output?.macAddresses ?? [],
      maxMacAddresses: filter.output?.maxMACAddresses,
    },
    parental: {
      isEnabled: parental.output?.isParentalControlEnabled,
      maxRules: parental.output?.maxRules,
      rules: rules.map((rule, index) => ({
        index,
        description: rule.description,
        isEnabled: rule.isEnabled,
        macAddresses: rule.macAddresses ?? [],
        blockedUrls: rule.blockedURLs ?? [],
        isScheduled: Object.values(rule.wanSchedule ?? {}).some((day) => /1/.test(day)),
      })),
    },
  };
}

export function validateMacFilter({ mode, macAddresses }, max) {
  if (!MAC_FILTER_MODES.includes(mode)) {
    throw httpError(400, `mode must be one of ${MAC_FILTER_MODES.join(', ')}`);
  }
  const bad = macAddresses.find((mac) => !isValidMac(mac));
  if (bad) {
    throw httpError(400, `"${bad}" is not a valid MAC address`);
  }
  const normalized = [...new Set(macAddresses.map(normalizeMac))];
  if (max && normalized.length > max) {
    throw httpError(400, `The router holds at most ${max} MAC addresses`);
  }
  if (mode === 'Allow' && normalized.length === 0) {
    throw httpError(409, 'An allow list with no devices would block every device, including this one');
  }
  return normalized;
}

export async function setMacFilter(client, backups, request) {
  const current = await client.call(MAC_FILTER_GET);
  const macAddresses = validateMacFilter(request, current.maxMACAddresses);
  const backup = await backups.save({
    label: `MAC filter ${request.mode}`,
    setAction: MAC_FILTER_SET,
    payload: current,
  });
  const { removed } = await sendSet(client, MAC_FILTER_SET, { ...current, macFilterMode: request.mode, macAddresses });
  const confirmed = await client.call(MAC_FILTER_GET);
  if (confirmed.macFilterMode !== request.mode) {
    throw httpError(502, 'The router accepted the change but still reports the old mode');
  }
  return { backup, removedFields: removed, ...(await getAccess(client)) };
}

export async function removeParentalRule(client, backups, index) {
  const current = await client.call(PARENTAL_GET);
  const rules = current.rules ?? [];
  if (!Number.isInteger(index) || index < 0 || index >= rules.length) {
    throw httpError(404, 'No such rule');
  }
  const backup = await backups.save({
    label: `Remove parental rule "${rules[index].description}"`,
    setAction: PARENTAL_SET,
    payload: current,
  });
  const next = { ...current, rules: rules.filter((rule, position) => position !== index) };
  const { removed } = await sendSet(client, PARENTAL_SET, next);
  const confirmed = await client.call(PARENTAL_GET);
  if ((confirmed.rules ?? []).length !== next.rules.length) {
    throw httpError(502, 'The router accepted the change but the rule is still there');
  }
  return { backup, removedFields: removed, ...(await getAccess(client)) };
}
