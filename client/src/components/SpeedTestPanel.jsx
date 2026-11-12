// The router's own internet speed test, with its stored history.
import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Icon from './Icon.jsx';
import State from './State.jsx';

const GIVE_UP_MS = 120_000;
const POLL_MS = 3000;

export default function SpeedTestPanel() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.speedtest(signal), []);
  const [waiting, setWaiting] = useState(null);
  const [isAsking, setIsAsking] = useState(false);

  // Poll until a new result appears, rather than trusting how the router reports "running".
  useEffect(() => {
    if (!waiting && !data?.isRunning) {
      return undefined;
    }
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, data?.isRunning, reload]);

  useEffect(() => {
    if (!waiting || !data) {
      return;
    }
    const newest = data.history[0];
    if (!data.isRunning && newest && newest.id !== waiting.baselineId) {
      setWaiting(null);
      toast(
        newest.isSuccess ? 'ok' : 'error',
        newest.isSuccess
          ? `Speed test done: ${newest.downloadMbps} Mbps down, ${newest.uploadMbps} Mbps up`
          : `The speed test did not finish (${newest.exitCode})`,
      );
    } else if (Date.now() - waiting.startedAt > GIVE_UP_MS) {
      setWaiting(null);
      toast('error', 'No result yet. The test may still be running, so check again in a minute.');
    }
  }, [data, waiting, toast]);

  async function handleStart() {
    setIsAsking(false);
    try {
      await api.startSpeedtest();
      setWaiting({ baselineId: data?.history[0]?.id, startedAt: Date.now() });
      toast('ok', 'Speed test started. It takes about half a minute.');
    } catch (startError) {
      toast('error', startError.message);
    }
  }

  if (isLoading && !data) {
    return <State isLoading rows={3} />;
  }
  if (error) {
    return <State error={error} onRetry={reload} />;
  }
  const best = Math.max(1, ...data.history.map((item) => item.downloadMbps ?? 0));
  const good = data.lastGood;
  return (
    <section className="card pad">
      <div className="row-between">
        <div>
          <h2>Internet speed test</h2>
          <p className="muted">
            Run by the router itself, so it measures the connection into your home, not your Wi-Fi.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={Boolean(waiting) || data.isRunning}
          onClick={() => setIsAsking(true)}
        >
          <Icon name="gauge" size={16} />
          {waiting || data.isRunning ? 'Testing…' : 'Run speed test'}
        </button>
      </div>
      {good && (
        <div className="grid-3">
          <div className="fact">
            <dt>Download</dt>
            <dd className="big">{good.downloadMbps} Mbps</dd>
          </div>
          <div className="fact">
            <dt>Upload</dt>
            <dd className="big">{good.uploadMbps} Mbps</dd>
          </div>
          <div className="fact">
            <dt>Latency</dt>
            <dd className="big">{good.latencyMs} ms</dd>
          </div>
        </div>
      )}
      {good && <p className="muted">Latest successful test: {new Date(good.timestamp).toLocaleString()}</p>}
      <details className="subsection" open={false}>
        <summary>
          <span>History</span>
          <span className="count">{data.history.length}</span>
        </summary>
        <ul className="rows">
          {data.history.map((item) => (
            <li key={item.id} className="row-item compact">
              <span className="muted mono">{new Date(item.timestamp).toLocaleString()}</span>
              {item.isSuccess ? (
                <span className="bar-wrap">
                  <span className="bar" style={{ width: `${Math.max(4, (item.downloadMbps / best) * 100)}%` }} />
                  <span className="mono">
                    {item.downloadMbps} down · {item.uploadMbps} up · {item.latencyMs} ms
                  </span>
                </span>
              ) : (
                <span className="badge badge-muted">{item.exitCode}</span>
              )}
            </li>
          ))}
        </ul>
      </details>
      {isAsking && (
        <ConfirmDialog
          title="Run a speed test?"
          message="The router will use your whole internet connection for about 30 seconds, so everything online slows down briefly."
          confirmLabel="Run test"
          onConfirm={handleStart}
          onClose={() => setIsAsking(false)}
        />
      )}
    </section>
  );
}
