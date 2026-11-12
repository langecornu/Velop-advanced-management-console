// Router health tiles plus on-router ping. Each probe reports its own result so one unsupported
// action never hides the rest.
import { useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import { formatUptime } from '../lib/format.js';
import Icon from './Icon.jsx';
import ResponseView from './ResponseView.jsx';
import SpeedTestPanel from './SpeedTestPanel.jsx';
import State from './State.jsx';
import StatCard from './StatCard.jsx';

export default function DiagnosticsTab() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.overview(signal), []);
  const [host, setHost] = useState('1.1.1.1');
  const [pingOutput, setPingOutput] = useState(null);
  const [isPinging, setIsPinging] = useState(false);

  async function handlePing(event) {
    event.preventDefault();
    setIsPinging(true);
    try {
      await api.startPing({ host, count: 4 });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      setPingOutput(await api.pingStatus());
    } catch (pingError) {
      toast('error', pingError.message);
    } finally {
      setIsPinging(false);
    }
  }

  const output = (name) => data?.[name]?.output ?? {};
  const wan = output('router/GetWANStatus3');
  const backhaul = output('nodes/diagnostics/GetBackhaulInfo').backhaulDevices;
  return (
    <div className="stack">
      <State error={error} onRetry={reload} />
      <div className="grid-4">
        <StatCard
          label="Router uptime"
          value={formatUptime(output('diagnostics/GetSystemStats').uptimeSeconds)}
          caption="since last reboot"
          isLoading={isLoading}
        />
        <StatCard
          label="Internet"
          value={wan.wanStatus ?? '—'}
          caption={wan.wanConnection?.wanType ?? 'WAN connection'}
          isLoading={isLoading}
        />
        <StatCard
          label="Router logging"
          value={output('routerlog/GetLogSettings').isLoggingEnabled ? 'On' : 'Off'}
          caption="remote log setting"
          isLoading={isLoading}
        />
        <StatCard
          label="Backhaul links"
          value={Array.isArray(backhaul) ? backhaul.length : '—'}
          caption="node to node"
          isLoading={isLoading}
        />
      </div>

      <SpeedTestPanel />

      <section className="card pad">
        <h2>Ping from the router</h2>
        <p className="muted">Runs on the router itself, so it tests the router's own path to the internet.</p>
        <form className="toolbar" onSubmit={handlePing}>
          <label className="search">
            <Icon name="activity" />
            <span className="sr-only">Host to ping</span>
            <input value={host} onChange={(event) => setHost(event.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={isPinging}>
            <Icon name="play" size={14} />
            {isPinging ? 'Pinging…' : 'Ping'}
          </button>
        </form>
        {pingOutput && <ResponseView data={pingOutput} label="Ping result" />}
      </section>
    </div>
  );
}
