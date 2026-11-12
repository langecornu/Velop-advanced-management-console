// One row of the device table. data-label attributes let the CSS turn rows into cards on narrow screens.
import CopyChip from './CopyChip.jsx';
import Icon from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function DeviceRow({ device, status, onReserve, onRename }) {
  const vendor = [device.manufacturer, device.model].filter(Boolean).join(' · ');
  const subtitle = device.isNode
    ? [device.model, device.firmware && `fw ${device.firmware}`, device.backhaul].filter(Boolean).join(' · ')
    : vendor || device.hostname || device.type || '—';
  return (
    <tr>
      <td data-label="Device">
        <div className="device-name">
          <span className={`avatar${device.isNode ? ' avatar-node' : ''}`} aria-hidden="true">
            <Icon name={device.isNode ? 'wifi' : 'devices'} size={16} />
          </span>
          <span>
            <strong>{device.name}</strong>
            <small className="muted">{subtitle}</small>
          </span>
        </div>
      </td>
      <td data-label="IP address">
        <CopyChip value={device.ip} label="IP address" />
      </td>
      <td data-label="MAC address">
        <CopyChip value={device.mac} label="MAC address" />
      </td>
      <td data-label="Status">
        <StatusBadge status={status} />
        {device.isGuest && <span className="tag">Guest</span>}
      </td>
      <td data-label="Reserved">
        {device.reservedIp ? (
          <span className="tag tag-accent">
            <Icon name="pin" size={12} />
            {device.reservedIp}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="actions">
        {device.deviceId && (
          <button
            type="button"
            className="btn btn-sm"
            aria-label={`Rename ${device.name}`}
            onClick={() => onRename(device)}
          >
            <Icon name="edit" size={14} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm"
          aria-label={`${device.reservedIp ? 'Edit reservation for' : 'Reserve an IP for'} ${device.name}`}
          onClick={() => onReserve(device)}
        >
          <Icon name="pin" size={14} />
          <span className="btn-label">{device.reservedIp ? 'Edit' : 'Reserve'}</span>
        </button>
      </td>
    </tr>
  );
}
