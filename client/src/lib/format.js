// Small display helpers.
// Mirrors the server rule: the router only accepts letters and digits in a reservation description.
export function sanitizeDescription(value, maxLength = 63) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, maxLength);
}

export function ipSortKey(ip) {
  return ip ? ip.split('.').reduce((total, part) => total * 256 + Number(part), 0) : Number.POSITIVE_INFINITY;
}

export function formatUptime(seconds) {
  if (typeof seconds !== 'number') {
    return '—';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatLease(minutes) {
  if (typeof minutes !== 'number') {
    return '—';
  }
  return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

// Minutes after midnight <-> the "HH:MM" an <input type="time"> uses.
export function minutesToTime(minutes) {
  const safe = Number.isInteger(minutes) ? minutes : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function timeToMinutes(text) {
  const [hours, minutes] = String(text).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
}

// Ports that are dangerous to expose to the internet, with the reason shown next to the rule.
export const RISKY_PORTS = {
  21: 'FTP sends passwords in the clear',
  22: 'SSH is scanned constantly by attackers',
  23: 'Telnet is unencrypted',
  445: 'Windows file sharing (SMB) is a common ransomware entry point',
  3306: 'a MySQL database',
  3389: 'Remote Desktop is a favourite attack target',
  5432: 'a PostgreSQL database',
  5900: 'VNC screen sharing is a common attack target',
};
