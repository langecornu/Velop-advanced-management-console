// Router-side diagnostics: system info, log settings, node backhaul and on-router ping.
import { httpError } from '../lib/httpError.js';
import { isValidHost } from '../lib/network.js';

const OVERVIEW_ACTIONS = [
  'router/GetWANStatus3',
  'diagnostics/GetSystemStats',
  'routerlog/GetLogSettings',
  'nodes/diagnostics/GetBackhaulInfo',
];

// Each probe is its own call: a batch fails as a whole if one action is unsupported, and one bad probe must
// not hide the rest.
export async function getOverview(client) {
  const results = await Promise.all(
    OVERVIEW_ACTIONS.map(async (action) => {
      const response = await client.callRaw(action);
      return [action, { result: response.result, output: response.output ?? {} }];
    }),
  );
  return Object.fromEntries(results);
}

export async function startPing(client, { host, count }) {
  if (!isValidHost(host)) {
    throw httpError(400, 'host must be an IPv4 address or a hostname');
  }
  await client.call('diagnostics/StartPing', { host, pingCount: count });
}

export async function getPingStatus(client) {
  return client.call('diagnostics/GetPingStatus');
}
