// "System Information": a curated catalog of read-only router probes, grouped for the UI.
// The browser only ever sends a probe id; the action name is looked up here, so nothing outside this
// allowlist can be run through this endpoint.
import { httpError } from '../lib/httpError.js';

export const CATALOG = [
  {
    id: 'internet',
    label: 'Internet',
    icon: 'network',
    probes: [
      {
        id: 'wansettings',
        label: 'WAN settings',
        action: 'router/GetWANSettings',
        about: 'Connection type, MTU and domain name.',
      },
      {
        id: 'ports',
        label: 'Ethernet ports',
        action: 'router/GetEthernetPortConnections',
        about: 'Link speed of the WAN and LAN ports.',
      },
      {
        id: 'macclone',
        label: 'MAC clone',
        action: 'router/GetMACAddressCloneSettings',
        about: 'Whether the router pretends to be another MAC for your ISP.',
      },
      {
        id: 'ddnsstatus',
        label: 'DDNS status',
        action: 'ddns/GetDDNSStatus',
        about: 'Whether dynamic DNS is currently working.',
      },

      {
        id: 'wan',
        label: 'WAN status',
        action: 'router/GetWANStatus3',
        about: 'Uplink type, public IP address and link state.',
      },
      { id: 'ipv6', label: 'IPv6', action: 'router/GetIPv6Settings', about: 'IPv6 mode and the router DUID.' },
      {
        id: 'routing',
        label: 'Routing & NAT',
        action: 'router/GetRoutingSettings',
        about: 'NAT, dynamic routing and static routes.',
      },
      {
        id: 'upnp',
        label: 'UPnP',
        action: 'routerupnp/GetUPnPSettings',
        about: 'Whether devices may open ports automatically.',
      },
      { id: 'ddns', label: 'Dynamic DNS', action: 'ddns/GetDDNSSettings', about: 'Dynamic DNS provider settings.' },
      {
        id: 'express',
        label: 'Express forwarding',
        action: 'router/GetExpressForwardingSettings',
        about: 'Hardware acceleration for routing.',
      },
      {
        id: 'qos',
        label: 'QoS',
        action: 'qos/GetQoSSettings',
        about: 'Bandwidth limits and device or application priorities.',
      },
    ],
  },
  {
    id: 'wifi',
    label: 'Wi-Fi',
    icon: 'wifi',
    probes: [
      { id: 'dfs', label: 'DFS', action: 'wirelessap/GetDFSSettings', about: 'Radar-avoidance channels on 5 GHz.' },
      {
        id: 'airtime',
        label: 'Airtime fairness',
        action: 'wirelessap/GetAirtimeFairnessSettings',
        about: 'Stops slow devices hogging airtime.',
      },
      {
        id: 'guestclients',
        label: 'Guest clients',
        action: 'guestnetwork/GetGuestNetworkClients',
        about: 'Devices currently on the guest network.',
      },
      {
        id: 'wpsstate',
        label: 'WPS',
        action: 'wirelessap/GetWPSServerSettings',
        about: 'Whether WPS button join is on.',
      },

      {
        id: 'radios',
        label: 'Radios',
        action: 'wirelessap/GetRadioInfo',
        about: 'Each Wi-Fi radio: bands, channels and capabilities.',
      },
      {
        id: 'guest',
        label: 'Guest network',
        action: 'guestnetwork/GetGuestRadioSettings',
        about: 'Guest Wi-Fi status and limits.',
      },
      {
        id: 'clients',
        label: 'Clients per node',
        action: 'nodes/networkconnections/GetNodesWirelessNetworkConnections',
        about: 'Wi-Fi clients grouped by the node they are attached to.',
      },
    ],
  },
  {
    id: 'mesh',
    label: 'Mesh',
    icon: 'devices',
    probes: [
      {
        id: 'neighbors',
        label: 'Node neighbors',
        action: 'nodes/diagnostics/GetNodeNeighborInfo',
        about: 'Which nodes can hear each other.',
      },
      {
        id: 'steering',
        label: 'Client steering',
        action: 'nodes/topologyoptimization/GetTopologyOptimizationSettings',
        about: 'Whether devices are steered to the best node.',
      },
      {
        id: 'nodefirmware',
        label: 'Node firmware check',
        action: 'nodes/firmwareupdate/GetFirmwareUpdateStatus',
        about: 'When each node last checked for updates, and any pending update.',
      },
      {
        id: 'modes',
        label: 'Supported modes',
        action: 'nodes/smartmode/GetSupportedDeviceModes',
        about: 'Router or bridge modes this unit supports.',
      },

      {
        id: 'backhaul',
        label: 'Backhaul',
        action: 'nodes/diagnostics/GetBackhaulInfo',
        about: 'Link type, speed and signal between nodes.',
      },
      {
        id: 'mode',
        label: 'Node mode',
        action: 'nodes/smartmode/GetDeviceMode',
        about: 'Whether this unit runs as router or access point.',
      },
      { id: 'leds', label: 'LEDs', action: 'routerleds/GetRouterLEDSettings', about: 'Status light settings.' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: 'shield',
    probes: [
      {
        id: 'dmz',
        label: 'DMZ',
        action: 'firewall/GetDMZSettings',
        about: 'Whether one device is exposed to the internet.',
      },
      {
        id: 'forwarding',
        label: 'Port forwarding',
        action: 'firewall/GetSinglePortForwardingRules',
        about: 'Ports forwarded to devices on your network.',
      },
      {
        id: 'rangeforwarding',
        label: 'Port range forwarding',
        action: 'firewall/GetPortRangeForwardingRules',
        about: 'Ranges of ports forwarded to devices.',
      },
      {
        id: 'triggering',
        label: 'Port triggering',
        action: 'firewall/GetPortRangeTriggeringRules',
        about: 'Ports opened when a device makes an outgoing request.',
      },
      {
        id: 'ipv6rules',
        label: 'IPv6 firewall rules',
        action: 'firewall/GetIPv6FirewallRules',
        about: 'Allowed inbound IPv6 traffic.',
      },
      { id: 'alg', label: 'SIP ALG', action: 'firewall/GetALGSettings', about: 'Phone-call helper in the firewall.' },
      {
        id: 'netsecurity',
        label: 'Network security',
        action: 'networksecurity/GetNetworkSecuritySettings',
        about: 'Content filtering engines and categories.',
      },

      {
        id: 'firewall',
        label: 'Firewall',
        action: 'firewall/GetFirewallSettings',
        about: 'IPv4 and IPv6 firewall switches and blocked traffic types.',
      },
      {
        id: 'macfilter',
        label: 'MAC filter',
        action: 'macfilter/GetMACFilterSettings',
        about: 'Allow or deny list by MAC address.',
      },
      {
        id: 'parental',
        label: 'Parental controls',
        action: 'parentalcontrol/GetParentalControlSettings',
        about: 'Per-device schedules and blocked sites.',
      },
      {
        id: 'management',
        label: 'Admin access',
        action: 'routermanagement/GetManagementSettings2',
        about: 'Where the admin page may be reached from.',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: 'server',
    probes: [
      {
        id: 'reboot',
        label: 'Scheduled reboot',
        action: 'diagnostics/GetScheduledRebootSettings',
        about: 'Automatic restart schedule.',
      },
      {
        id: 'time',
        label: 'Time & time zone',
        action: 'locale/GetTimeSettings',
        about: 'The router clock and time zone.',
      },
      { id: 'homekit', label: 'HomeKit', action: 'homekit/GetHomeKitSettings', about: 'Apple Home pairing state.' },
      {
        id: 'remote',
        label: 'Remote management',
        action: 'ui/GetRemoteSetting',
        about: 'Whether outside access is on.',
      },
      {
        id: 'power',
        label: 'Power table',
        action: 'powertable/GetPowerTableSettings',
        about: 'Regional Wi-Fi power limits.',
      },
      { id: 'iptv', label: 'IPTV', action: 'iptv/GetIPTVSettings', about: 'IPTV passthrough setting.' },

      {
        id: 'stats',
        label: 'Uptime',
        action: 'diagnostics/GetSystemStats',
        about: 'How long the router has been running.',
      },
      {
        id: 'logging',
        label: 'Logging',
        action: 'routerlog/GetLogSettings',
        about: 'Whether router logging is enabled.',
      },
      {
        id: 'firmware',
        label: 'Firmware updates',
        action: 'firmwareupdate/GetFirmwareUpdateSettings',
        about: 'Automatic update policy and window.',
      },
    ],
  },
];

const PROBES = new Map(CATALOG.flatMap((category) => category.probes.map((probe) => [probe.id, probe])));

// The catalog is static, so it needs no router call.
export function getCatalog() {
  return CATALOG.map((category) => ({
    ...category,
    probes: category.probes.map(({ id, label, about, action }) => ({ id, label, about, action })),
  }));
}

export async function runProbe(client, id) {
  const probe = PROBES.get(id);
  if (!probe) {
    throw httpError(404, 'No such probe');
  }
  const response = await client.callRaw(probe.action);
  return {
    id,
    action: probe.action,
    result: response.result,
    error: response.error,
    output: response.result === 'OK' ? (response.output ?? {}) : undefined,
    fetchedAt: new Date().toISOString(),
  };
}
