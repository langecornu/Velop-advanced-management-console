// Dev helper: asks the router which read-only (Get*) JNAP actions exist and answer for this account.
// Usage: npm run probe -- routerlog/GetFoo diagnostics/GetBar   (or no args to use the built-in candidate list)
import { loadConfigFromDisk } from '../server/config.js';
import { createJnapClient } from '../server/clients/jnapClient.js';

const CANDIDATES = [
  'routerlog/GetRouterLogSettings',
  'routerlog/GetRouterLogSettings2',
  'routerlog/GetRouterLogs',
  'routerlog/GetLogEntries',
  'routerlog/GetRouterLogEntries',
  'routerlog/GetLogSettings',
  'routerlog/GetSyslogSettings',
  'routerlog/GetRemoteLogSettings',
  'routerlog/GetRouterLog',
  'routerlog/GetLog',
  'routerlog/DownloadLogs',
  'routerlog/GetRouterLogInfo',
  'diagnostics/GetSysinfoData',
  'diagnostics/GetSystemStats',
  'diagnostics/GetTracerouteStatus',
  'diagnostics/GetPingStatus',
  'diagnostics/GetActiveRouterLogs',
  'diagnostics/GetDeviceLogs',
  'diagnostics/GetLogs',
  'diagnostics/GetRouterLogs',
  'nodes/diagnostics/GetBackhaulInfo',
  'nodes/diagnostics/GetNodesDiagnostics',
  'nodes/diagnostics/GetSysinfo',
  'nodes/networkconnections/GetNodesWirelessNetworkConnections',
  'nodes/setup/GetBlueprint',
  'nodes/smartmode/GetDeviceMode',
  'router/GetLANSettings',
  'router/GetDHCPClientLeases',
  'router/GetWANStatus3',
  'router/GetRoutingSettings',
  'router/GetIPv6Settings',
  'router/GetStateTable',
  'router/GetPortForwardingRules',
  'router/GetSinglePortForwardingRules',
  'router/GetPortRangeForwardingRules',
  'router/GetPortRangeTriggeringRules',
  'router/GetExpressForwardingSettings',
  'routerstatus/GetRouterStatus',
  'routermanagement/GetManagementSettings',
  'routermanagement/GetManagementSettings2',
  'routermanagement/GetManagementSettings3',
  'macfilter/GetMACFilterSettings',
  'firewall/GetFirewallSettings',
  'firmwareupdate/GetFirmwareUpdateSettings',
  'wirelessap/GetRadioInfo',
  'wirelessap/GetRadioInfo2',
  'guestnetwork/GetGuestRadioSettings',
  'parentalcontrol/GetParentalControlSettings',
  'qos/GetQoSSettings',
  'routerupnp/GetUPnPSettings',
  'ddns/GetDDNSSettings',
  'diagnostics/GetScheduledReboot',
  'core/GetAdminPasswordHint',
  'devicelist/GetDevices3',
  'devicelist/GetDevices4',
  'devicelist/GetDevices5',
  'devicelist/GetDevices6',
  'devicelist/GetDevices7',
  'networkconnections/GetNetworkConnections3',
  'healthcheck/GetHealthCheckResults',
  'diagnostics/GetReliabilityStatus',
  'routerleds/GetRouterLEDSettings',
];

const config = loadConfigFromDisk();
const client = createJnapClient({
  host: config.routerHost,
  user: config.routerUser,
  password: config.routerPassword,
  timeoutMs: config.requestTimeoutMs,
});
const names = process.argv.length > 2 ? process.argv.slice(2) : CANDIDATES;
for (const name of names) {
  if (!/\/(Get|Check)\w*$/.test(name)) {
    console.log(`[probe] skipped non read-only action ${name}`);
    continue;
  }
  let payload;
  try {
    payload = await client.callRaw(name, {});
  } catch (error) {
    console.log(`TIMEOUT/ERROR            ${name}  ${error.message}`);
    continue;
  }
  if (payload.result === '_ErrorUnauthorized') {
    console.error('[probe] login rejected, stopping to avoid an account lockout');
    process.exit(1);
  }
  console.log(
    `${payload.result.padEnd(24)} ${name}  ${payload.result === 'OK' ? `keys=${Object.keys(payload.output ?? {}).join(',')}` : (payload.error ?? '')}`,
  );
}
