// Small, pure helpers for MAC and IPv4 handling shared by the services.
const MAC_PATTERN = /^[0-9A-F]{12}$/;

export function stripMac(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^0-9A-F]/g, '');
}

export function isValidMac(value) {
  return MAC_PATTERN.test(stripMac(value)) && /^[0-9A-Fa-f]{2}([:-]?[0-9A-Fa-f]{2}){5}$/.test(String(value).trim());
}

export function normalizeMac(value) {
  const hex = stripMac(value);
  return hex.match(/.{2}/g)?.join(':') ?? '';
}

export function isValidIpv4(value) {
  const parts = String(value ?? '').split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export function ipToInt(ip) {
  return ip.split('.').reduce((total, part) => total * 256 + Number(part), 0);
}

export function isInSubnet(ip, networkIp, prefixLength) {
  const size = 2 ** (32 - prefixLength);
  const base = Math.floor(ipToInt(networkIp) / size) * size;
  const value = ipToInt(ip);
  return value >= base && value < base + size;
}

export function isValidHost(value) {
  return (
    isValidIpv4(value) || /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(value)
  );
}

// RFC 1918 plus link-local: the only ranges the ping probe is allowed to touch.
export function isPrivateIpv4(value) {
  if (!isValidIpv4(value)) {
    return false;
  }
  const [first, second] = value.split('.').map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}
