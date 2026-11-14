// Shell: header with navigation and the active section.
import { useState } from 'react';

import AdminTab from './components/AdminTab.jsx';
import DevicesTab from './components/DevicesTab.jsx';
import DhcpTab from './components/DhcpTab.jsx';
import DiagnosticsTab from './components/DiagnosticsTab.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ExplorerTab from './components/ExplorerTab.jsx';
import Header from './components/Header.jsx';
import LogsTab from './components/LogsTab.jsx';
import SystemTab from './components/SystemTab.jsx';

const TABS = [
  { id: 'devices', label: 'Devices', icon: 'devices', Component: DevicesTab },
  { id: 'dhcp', label: 'DHCP', icon: 'network', Component: DhcpTab },
  { id: 'logs', label: 'Logs', icon: 'logs', Component: LogsTab },
  { id: 'admin', label: 'Network administration', icon: 'sliders', Component: AdminTab },
  { id: 'system', label: 'System information', icon: 'server', Component: SystemTab },
  { id: 'diagnostics', label: 'Diagnostics', icon: 'activity', Component: DiagnosticsTab },
  { id: 'explorer', label: 'Hidden menu', icon: 'terminal', Component: ExplorerTab },
];

export default function App() {
  const [active, setActive] = useState('devices');
  const { Component } = TABS.find((tab) => tab.id === active);
  return (
    <>
      <Header tabs={TABS} active={active} onSelect={setActive} />
      <main>
        <ErrorBoundary resetKey={active}>
          <Component />
        </ErrorBoundary>
      </main>
    </>
  );
}
