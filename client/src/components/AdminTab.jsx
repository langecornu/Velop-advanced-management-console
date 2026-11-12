// Network administration: everything here changes the router. Each panel confirms, backs up and verifies.
import { useState } from 'react';

import HistoryPanel from './HistoryPanel.jsx';
import Icon from './Icon.jsx';
import AccessPanel from './AccessPanel.jsx';
import RestartPanel from './RestartPanel.jsx';
import NodesPanel from './NodesPanel.jsx';
import PortForwardPanel from './PortForwardPanel.jsx';
import SchedulesPanel from './SchedulesPanel.jsx';
import SwitchesPanel from './SwitchesPanel.jsx';
import WifiPanel from './WifiPanel.jsx';

const SECTIONS = [
  { id: 'switches', label: 'Switches', icon: 'sliders', Component: SwitchesPanel },
  { id: 'wifi', label: 'Wi-Fi', icon: 'wifi', Component: WifiPanel },
  { id: 'access', label: 'Access control', icon: 'shield', Component: AccessPanel },
  { id: 'ports', label: 'Port forwarding', icon: 'network', Component: PortForwardPanel },
  { id: 'schedules', label: 'Schedules & updates', icon: 'refresh', Component: SchedulesPanel },
  { id: 'nodes', label: 'Mesh nodes', icon: 'devices', Component: NodesPanel },
  { id: 'restart', label: 'Restart', icon: 'power', Component: RestartPanel },
  { id: 'history', label: 'History & undo', icon: 'history', Component: HistoryPanel },
];

export default function AdminTab() {
  const [active, setActive] = useState('switches');
  const { Component } = SECTIONS.find((item) => item.id === active);
  return (
    <div className="stack">
      <div className="sys-head">
        <h2>Network administration</h2>
        <p className="muted">
          These controls change your live network. Every change is backed up first and can be undone from History.
        </p>
      </div>
      <div className="seg seg-lg" role="tablist" aria-label="Administration sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active}
            aria-pressed={item.id === active}
            onClick={() => setActive(item.id)}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </button>
        ))}
      </div>
      <Component />
    </div>
  );
}
