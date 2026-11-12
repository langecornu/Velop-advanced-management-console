// All HTTP to the local server goes through here. Throws Error(message) for any non-2xx answer.
async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    signal,
    headers: { 'Content-Type': 'application/json', 'X-Velop-Tool': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = Array.isArray(data.details) ? ` (${data.details.join('; ')})` : '';
    throw new Error(`${data.error ?? `Request failed (${res.status})`}${detail}`);
  }
  return res.status === 204 || res.status === 202 ? null : res.json();
}

export const api = {
  info: (signal) => request('/info', { signal }),
  devices: (query, signal, refresh = false) =>
    request(`/devices?q=${encodeURIComponent(query)}${refresh ? '&refresh=1' : ''}`, { signal }),
  probe: (ips) => request('/devices/probe', { method: 'POST', body: { ips } }),
  dhcp: (signal) => request('/dhcp', { signal }),
  addReservation: (body) => request('/dhcp/reservations', { method: 'POST', body }),
  removeReservation: (mac) => request(`/dhcp/reservations/${encodeURIComponent(mac)}`, { method: 'DELETE' }),
  sysinfo: (refresh, signal) => request(`/sysinfo${refresh ? '?refresh=1' : ''}`, { signal }),
  sysinfoSection: (name) => request(`/sysinfo/section?name=${encodeURIComponent(name)}`),
  sysinfoSearch: (q) => request(`/sysinfo/search?q=${encodeURIComponent(q)}`),
  systemCatalog: (signal) => request('/system/catalog', { signal }),
  systemProbe: (id, signal) => request(`/system/probe/${encodeURIComponent(id)}`, { signal }),
  adminControls: (signal) => request('/admin/controls', { signal }),
  setControl: (id, body) => request(`/admin/controls/${encodeURIComponent(id)}`, { method: 'POST', body }),
  adminWifi: (signal) => request('/admin/wifi', { signal }),
  updateWifi: (body) => request('/admin/wifi', { method: 'POST', body }),
  adminAccess: (signal) => request('/admin/access', { signal }),
  setMacFilter: (body) => request('/admin/access/mac-filter', { method: 'POST', body }),
  removeRule: (index) => request(`/admin/access/parental-rules/${index}`, { method: 'DELETE' }),
  reboot: (body) => request('/admin/reboot', { method: 'POST', body }),
  backups: (signal) => request('/admin/backups', { signal }),
  restore: (file) =>
    request(`/admin/backups/${encodeURIComponent(file)}/restore`, { method: 'POST', body: { confirm: true } }),
  adminSchedules: (signal) => request('/admin/schedules', { signal }),
  setReboot: (body) => request('/admin/schedules/reboot', { method: 'POST', body }),
  setFirmware: (body) => request('/admin/schedules/firmware', { method: 'POST', body }),
  setTimeZone: (body) => request('/admin/schedules/time', { method: 'POST', body }),
  speedtest: (signal) => request('/admin/speedtest', { signal }),
  startSpeedtest: () => request('/admin/speedtest', { method: 'POST', body: { confirm: true } }),
  stopSpeedtest: () => request('/admin/speedtest', { method: 'DELETE' }),
  portForwarding: (signal) => request('/admin/port-forwarding', { signal }),
  addRule: (body) => request('/admin/port-forwarding', { method: 'POST', body: { ...body, confirm: true } }),
  updateRule: (index, body) =>
    request(`/admin/port-forwarding/${index}`, { method: 'PUT', body: { ...body, confirm: true } }),
  deleteRule: (index) => request(`/admin/port-forwarding/${index}`, { method: 'DELETE' }),
  renameDevice: (id, name) =>
    request(`/admin/devices/${encodeURIComponent(id)}/rename`, { method: 'POST', body: { name } }),
  deleteDevices: (deviceIds) =>
    request('/admin/devices/delete', { method: 'POST', body: { deviceIds, confirm: 'DELETE DEVICES' } }),
  nodes: (signal) => request('/admin/nodes', { signal }),
  checkNodes: () => request('/admin/nodes/check', { method: 'POST', body: {} }),
  updateNodes: () => request('/admin/nodes/update', { method: 'POST', body: { confirm: 'UPDATE NODES' } }),
  refreshNodes: () => request('/admin/nodes/refresh', { method: 'POST', body: {} }),
  overview: (signal) => request('/overview', { signal }),
  actions: (signal) => request('/explorer/actions', { signal }),
  describe: (action) => request(`/explorer/describe?action=${encodeURIComponent(action)}`),
  call: (body) => request('/explorer/call', { method: 'POST', body }),
  startPing: (body) => request('/diagnostics/ping', { method: 'POST', body }),
  pingStatus: () => request('/diagnostics/ping'),
};
