// Search and browse every device. Router status is double-checked by pinging each IP from this machine,
// because the router's own online flag goes stale.
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useDebounced } from '../hooks/useDebounced.js';
import { useToast } from '../hooks/useToast.js';
import { ipSortKey } from '../lib/format.js';
import { deriveStatus } from '../lib/status.js';
import CleanupDialog from './CleanupDialog.jsx';
import DeviceRow from './DeviceRow.jsx';
import Icon from './Icon.jsx';
import RenameDialog from './RenameDialog.jsx';
import ReserveDialog from './ReserveDialog.jsx';
import State from './State.jsx';
import StatCard from './StatCard.jsx';

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'up', label: 'Online', test: (device, status) => status.isUp },
  { id: 'down', label: 'Offline', test: (device, status) => !status.isUp },
  { id: 'reserved', label: 'Reserved', test: (device) => Boolean(device.reservedIp) },
  { id: 'nodes', label: 'Mesh nodes', test: (device) => device.isNode },
];
const SORTERS = {
  name: (a, b) => a.device.name.localeCompare(b.device.name),
  ip: (a, b) => ipSortKey(a.device.ip) - ipSortKey(b.device.ip),
  status: (a, b) => Number(b.status.isUp) - Number(a.status.isUp),
};

export default function DevicesTab() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const wantsFreshRef = useRef(false);
  const { data, error, isLoading, reload } = useAsync(
    (signal) => {
      const refresh = wantsFreshRef.current;
      wantsFreshRef.current = false;
      return api.devices(debouncedQuery, signal, refresh);
    },
    [debouncedQuery],
  );
  const [probes, setProbes] = useState({});
  const [isProbing, setIsProbing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'ip', direction: 1 });
  const [reserving, setReserving] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    const ips = [...new Set((data?.devices ?? []).map((device) => device.ip).filter(Boolean))].slice(0, 300);
    if (ips.length === 0) {
      return undefined;
    }
    let isCurrent = true;
    setIsProbing(true);
    api
      .probe(ips)
      .then((result) => isCurrent && setProbes((previous) => ({ ...previous, ...result })))
      .catch((probeError) => isCurrent && toast('error', `Ping check failed: ${probeError.message}`))
      .finally(() => isCurrent && setIsProbing(false));
    return () => {
      isCurrent = false;
    };
  }, [data, toast]);

  const rows = useMemo(
    () => (data?.devices ?? []).map((device) => ({ device, status: deriveStatus(device, probes[device.ip]) })),
    [data, probes],
  );
  const visible = useMemo(() => {
    const active = FILTERS.find((item) => item.id === filter);
    return rows
      .filter((row) => active.test(row.device, row.status))
      .sort((a, b) => SORTERS[sort.key](a, b) * sort.direction);
  }, [rows, filter, sort]);

  // Refresh asks the router for a fresh device list; searching and filtering reuse the server's short cache.
  function handleRefresh() {
    wantsFreshRef.current = true;
    reload();
  }

  function handleSort(key) {
    setSort((current) => ({ key, direction: current.key === key ? -current.direction : 1 }));
  }
  const sortLabel = (key) => (sort.key === key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none');
  // Entries safe to offer for removal: known only to the device list, silent to ping, not a node, not reserved.
  const cleanable = rows
    .filter(
      ({ device, status }) =>
        device.deviceId && !device.isNode && !device.reservedIp && !status.isUp && !status.isChecking,
    )
    .map(({ device }) => device);
  const upCount = rows.filter((row) => row.status.isUp).length;
  const verifiedCount = rows.filter((row) => row.status.key === 'verified').length;

  return (
    <div className="stack">
      <div className="grid-4">
        <StatCard
          label="Devices"
          value={data?.stats.total}
          caption="known to the router"
          isLoading={isLoading && !data}
        />
        <StatCard
          label="Online now"
          value={upCount}
          caption={
            isProbing ? 'verifying with ping…' : verifiedCount ? `${verifiedCount} rescued by ping` : 'ping verified'
          }
          isLoading={isLoading && !data}
        />
        <StatCard
          label="Reserved IPs"
          value={data?.stats.reserved}
          caption="static DHCP"
          isLoading={isLoading && !data}
        />
        <StatCard label="Mesh nodes" value={data?.stats.nodes} caption="Velop units" isLoading={isLoading && !data} />
      </div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <span className="sr-only">Search by MAC, IP or name</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by MAC (any format, partial ok), IP, or name"
            autoFocus
          />
        </label>
        <button type="button" className="btn" onClick={handleRefresh}>
          <Icon name="refresh" />
          Refresh
        </button>
        <button
          type="button"
          className="btn"
          disabled={isProbing || cleanable.length === 0}
          onClick={() => setIsCleaning(true)}
        >
          <Icon name="trash" />
          Clean up offline ({isProbing ? '…' : cleanable.length})
        </button>
      </div>

      <div className="chips" role="group" aria-label="Filter devices">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`filter${filter === item.id ? ' is-active' : ''}`}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span>{rows.filter((row) => item.test(row.device, row.status)).length}</span>
          </button>
        ))}
      </div>

      <State
        isLoading={isLoading && !data}
        error={error}
        onRetry={handleRefresh}
        isEmpty={Boolean(data) && visible.length === 0}
        emptyTitle="No device matches"
        emptyText="Try a shorter MAC fragment, a partial IP, or clear the filter."
      />
      {visible.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  ['name', 'Device'],
                  ['ip', 'IP address'],
                ].map(([key, label]) => (
                  <th key={key} aria-sort={sortLabel(key)}>
                    <button type="button" className="th-btn" onClick={() => handleSort(key)}>
                      {label}
                    </button>
                  </th>
                ))}
                <th>MAC address</th>
                <th aria-sort={sortLabel('status')}>
                  <button type="button" className="th-btn" onClick={() => handleSort('status')}>
                    Status
                  </button>
                </th>
                <th>Reserved</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ device, status }) => (
                <DeviceRow
                  key={`${device.deviceId}-${device.mac}`}
                  device={device}
                  status={status}
                  onReserve={setReserving}
                  onRename={setRenaming}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {renaming && (
        <RenameDialog
          device={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(message) => {
            setRenaming(null);
            toast('ok', message);
            handleRefresh();
          }}
        />
      )}
      {isCleaning && (
        <CleanupDialog
          devices={cleanable}
          onClose={() => setIsCleaning(false)}
          onDone={(message) => {
            setIsCleaning(false);
            toast('ok', message);
            handleRefresh();
          }}
        />
      )}
      {reserving && (
        <ReserveDialog
          device={reserving}
          onClose={() => setReserving(null)}
          onSaved={(message) => {
            setReserving(null);
            toast('ok', message);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}
