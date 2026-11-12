// DHCP overview, reservations (add / edit / remove) and the live lease table.
import { useMemo, useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import { formatLease, ipSortKey } from '../lib/format.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import CopyChip from './CopyChip.jsx';
import Icon from './Icon.jsx';
import ReserveDialog from './ReserveDialog.jsx';
import State from './State.jsx';
import StatCard from './StatCard.jsx';

export default function DhcpTab() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.dhcp(signal), []);
  const [reserving, setReserving] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [leaseQuery, setLeaseQuery] = useState('');

  const reservedMacs = useMemo(() => new Set((data?.reservations ?? []).map((item) => item.macAddress)), [data]);
  const leases = useMemo(() => {
    const needle = leaseQuery.trim().toLowerCase();
    return [...(data?.leases ?? [])]
      .filter(
        (lease) => !needle || `${lease.hostName} ${lease.ipAddress} ${lease.macAddress}`.toLowerCase().includes(needle),
      )
      .sort((a, b) => ipSortKey(a.ipAddress) - ipSortKey(b.ipAddress));
  }, [data, leaseQuery]);

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await api.removeReservation(removing.macAddress);
      toast('ok', `Removed the reservation for ${removing.macAddress}`);
      setRemoving(null);
      reload();
    } catch (removeError) {
      toast('error', `Could not remove: ${removeError.message}`);
    } finally {
      setIsRemoving(false);
    }
  }

  const dhcp = data?.dhcpSettings ?? {};
  return (
    <div className="stack">
      <div className="grid-4">
        <StatCard
          label="Network"
          value={data ? `${data.network.ipAddress}/${data.network.networkPrefixLength}` : ''}
          caption={data?.network.isDHCPEnabled ? 'DHCP enabled' : 'DHCP disabled'}
          isLoading={isLoading && !data}
        />
        <StatCard
          label="Address pool"
          value={
            dhcp.firstClientIPAddress
              ? `${dhcp.firstClientIPAddress.split('.').pop()}–${dhcp.lastClientIPAddress?.split('.').pop()}`
              : '—'
          }
          caption={dhcp.firstClientIPAddress ? `last octet range` : ''}
          isLoading={isLoading && !data}
        />
        <StatCard
          label="Lease time"
          value={formatLease(dhcp.leaseMinutes)}
          caption="per client"
          isLoading={isLoading && !data}
        />
        <StatCard
          label="DNS"
          value={dhcp.dnsServer1 || 'Automatic'}
          caption={dhcp.dnsServer2 || 'ISP-provided'}
          isLoading={isLoading && !data}
        />
      </div>
      <State isLoading={isLoading && !data} error={error} onRetry={reload} />
      {data && (
        <>
          <section className="stack">
            <div className="section-head">
              <h2>
                Reservations <span className="count">{data.reservations.length}</span>
              </h2>
              <button type="button" className="btn btn-primary" onClick={() => setReserving({})}>
                <Icon name="plus" />
                Add reservation
              </button>
            </div>
            <State
              isEmpty={data.reservations.length === 0}
              emptyTitle="No reservations yet"
              emptyText="Reserve an IP so a device always gets the same address."
            />
            {data.reservations.length > 0 && (
              <div className="card table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>IP address</th>
                      <th>MAC address</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.reservations.map((item) => (
                      <tr key={item.macAddress}>
                        <td data-label="Description">
                          <strong>{item.description || '—'}</strong>
                        </td>
                        <td data-label="IP address">
                          <CopyChip value={item.ipAddress} label="IP address" />
                        </td>
                        <td data-label="MAC address">
                          <CopyChip value={item.macAddress} label="MAC address" />
                        </td>
                        <td className="actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost-danger"
                            aria-label={`Remove reservation for ${item.macAddress}`}
                            onClick={() => setRemoving(item)}
                          >
                            <Icon name="trash" size={14} />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="stack">
            <div className="section-head">
              <h2>
                Active leases <span className="count">{data.leases.length}</span>
              </h2>
              <label className="search search-sm">
                <Icon name="search" size={16} />
                <span className="sr-only">Filter leases</span>
                <input
                  type="search"
                  value={leaseQuery}
                  onChange={(event) => setLeaseQuery(event.target.value)}
                  placeholder="Filter leases"
                />
              </label>
            </div>
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Host</th>
                    <th>IP address</th>
                    <th>MAC address</th>
                    <th>Expires</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {leases.map((lease) => (
                    <tr key={lease.macAddress}>
                      <td data-label="Host">
                        <strong>{lease.hostName || '—'}</strong>
                      </td>
                      <td data-label="IP address">
                        <CopyChip value={lease.ipAddress} label="IP address" />
                      </td>
                      <td data-label="MAC address">
                        <CopyChip value={lease.macAddress} label="MAC address" />
                      </td>
                      <td data-label="Expires" className="muted">
                        {lease.expiration ? new Date(lease.expiration).toLocaleString() : '—'}
                      </td>
                      <td className="actions">
                        {reservedMacs.has(lease.macAddress) ? (
                          <span className="tag tag-accent">
                            <Icon name="pin" size={12} />
                            Reserved
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() =>
                              setReserving({ mac: lease.macAddress, ip: lease.ipAddress, name: lease.hostName })
                            }
                          >
                            <Icon name="pin" size={14} />
                            Reserve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {reserving && (
        <ReserveDialog
          device={reserving}
          onClose={() => setReserving(null)}
          onSaved={(message) => {
            setReserving(null);
            toast('ok', message);
            reload();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remove reservation?"
          message={`${removing.description || removing.macAddress} will no longer be guaranteed ${removing.ipAddress}. It keeps working, but may get a different address next time.`}
          confirmLabel="Remove reservation"
          isDanger
          isBusy={isRemoving}
          onConfirm={handleRemove}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
