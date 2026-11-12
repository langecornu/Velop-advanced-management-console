// Turns raw router JSON keys and values into friendly labels and formatted values.
import { formatLease, formatUptime } from './format.js';

const ACRONYMS = new Set([
  'DHCP',
  'DNS',
  'IP',
  'IPV4',
  'IPV6',
  'MAC',
  'WAN',
  'LAN',
  'SSID',
  'WPS',
  'QOS',
  'UPNP',
  'NAT',
  'URL',
  'ID',
  'HTTP',
  'HTTPS',
  'VLAN',
  'WIFI',
  'DDNS',
  'DFS',
  'LED',
  'LEDS',
  'TR69',
  'ISP',
  'UUID',
  'JNAP',
  'CPU',
]);
const ACRONYM_LABELS = { IPV4: 'IPv4', IPV6: 'IPv6', WIFI: 'Wi-Fi' };
const MAC = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// "isDHCPEnabled" -> "DHCP enabled", "uptimeSeconds" -> "Uptime", "macAddress" -> "MAC address".
export function humanizeKey(key) {
  const words = String(key)
    .replace(/^is(?=[A-Z])/, '')
    .replace(/IPv([46])/g, 'Ipv$1')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\b(Seconds|Minutes|Bytes|Bps)$/i, '')
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (ACRONYMS.has(word.toUpperCase())) {
        return ACRONYM_LABELS[word.toUpperCase()] ?? word.toUpperCase();
      }
      return word.length > 1 && word === word.toUpperCase() ? word : index === 0 ? word : word.toLowerCase();
    });
  const label = words.join(' ') || String(key);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Returns { kind, text } so the UI can pick the right presentation (chip, badge, plain text…).
export function classifyValue(key, value) {
  if (value === null || value === undefined || value === '') {
    return { kind: 'empty', text: '—' };
  }
  if (typeof value === 'boolean') {
    return { kind: 'bool', text: value ? 'Yes' : 'No', isTrue: value };
  }
  if (typeof value === 'number') {
    if (/Seconds$/.test(key)) {
      return { kind: 'text', text: formatUptime(value) };
    }
    if (/Minutes$/.test(key)) {
      return { kind: 'text', text: formatLease(value) };
    }
    if (/bps$/i.test(key)) {
      return { kind: 'text', text: `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} Mbps` };
    }
    return { kind: 'number', text: value.toLocaleString() };
  }
  const text = String(value);
  if (MAC.test(text)) {
    return { kind: 'mac', text: text.toUpperCase().replace(/-/g, ':') };
  }
  if (IPV4.test(text)) {
    return { kind: 'ip', text };
  }
  if (ISO_DATE.test(text) && !Number.isNaN(Date.parse(text))) {
    return { kind: 'date', text: new Date(text).toLocaleString() };
  }
  return { kind: text.length > 90 ? 'long' : 'text', text };
}

export function isScalar(value) {
  return value === null || typeof value !== 'object';
}
