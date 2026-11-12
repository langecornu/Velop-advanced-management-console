// Restart the router, then watch for it to go down and come back.
import { useEffect, useState } from 'react';

import { api } from '../api.js';
import { useToast } from '../hooks/useToast.js';
import Icon from './Icon.jsx';
import TypedConfirmDialog from './TypedConfirmDialog.jsx';

const POLL_MS = 5000;
const GIVE_UP_SECONDS = 300;

export default function RestartPanel() {
  const toast = useToast();
  const [isAsking, setIsAsking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (phase === 'idle' || phase === 'back') {
      return undefined;
    }
    const startedAt = Date.now();
    let hasGoneDown = false;
    const timer = setInterval(async () => {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      setSeconds(elapsed);
      try {
        await api.info();
        if (hasGoneDown || elapsed > 60) {
          setPhase('back');
          toast('ok', 'The router is back online');
        }
      } catch {
        hasGoneDown = true;
        setPhase('waiting');
      }
      if (elapsed > GIVE_UP_SECONDS) {
        setPhase('idle');
        toast('error', 'The router has not come back yet. Check its power and lights.');
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [phase, toast]);

  async function handleRestart() {
    setIsBusy(true);
    try {
      await api.reboot({ confirm: 'RESTART' });
      setPhase('restarting');
      setSeconds(0);
    } catch (restartError) {
      toast('error', restartError.message);
    } finally {
      setIsBusy(false);
      setIsAsking(false);
    }
  }

  return (
    <section className="card pad">
      <h2>Restart the router</h2>
      <p className="muted">
        Reboots the main router. The internet and Wi-Fi drop for about two minutes while it restarts, and the mesh nodes
        rejoin on their own. This tool keeps working and will tell you when the router answers again.
      </p>
      {phase === 'idle' || phase === 'back' ? (
        <div>
          {phase === 'back' && <p className="alert alert-ok">The router is back online.</p>}
          <button type="button" className="btn btn-danger" onClick={() => setIsAsking(true)}>
            <Icon name="power" size={16} />
            Restart router…
          </button>
        </div>
      ) : (
        <div className="restart-wait" role="status">
          <div className="spinner" aria-hidden="true" />
          <strong>{phase === 'restarting' ? 'Restart requested…' : 'Router is restarting…'}</strong>
          <span className="muted">{seconds}s elapsed. Waiting for it to answer again.</span>
        </div>
      )}
      {isAsking && (
        <TypedConfirmDialog
          title="Restart the router?"
          phrase="RESTART"
          confirmLabel="Restart now"
          isBusy={isBusy}
          onClose={() => setIsAsking(false)}
          onConfirm={handleRestart}
        >
          <p>
            Everyone on the network loses internet for about two minutes. Make sure nobody is in the middle of a call or
            an update.
          </p>
        </TypedConfirmDialog>
      )}
    </section>
  );
}
