// On/off switches. Each one reads the router's current value, flips it and verifies the result.
import { useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import State from './State.jsx';
import ToggleSwitch from './ToggleSwitch.jsx';

export default function SwitchesPanel() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.adminControls(signal), []);
  const [busyId, setBusyId] = useState('');
  const [pending, setPending] = useState(null);

  async function apply(control, value, confirm) {
    setBusyId(control.id);
    try {
      await api.setControl(control.id, { value, confirm });
      toast('ok', `${control.label} turned ${value ? 'on' : 'off'}`);
      reload();
    } catch (changeError) {
      toast('error', changeError.message);
    } finally {
      setBusyId('');
      setPending(null);
    }
  }

  function handleChange(control, value) {
    if (control.risk === 'high') {
      setPending({ control, value });
    } else {
      apply(control, value, false);
    }
  }

  if (isLoading && !data) {
    return <State isLoading rows={6} />;
  }
  if (error) {
    return <State error={error} onRetry={reload} />;
  }
  const groups = [...new Set(data.controls.map((control) => control.group))];
  return (
    <div className="stack">
      {groups.map((group) => (
        <section key={group} className="card">
          <h3 className="group-title">{group}</h3>
          <ul className="rows">
            {data.controls
              .filter((control) => control.group === group)
              .map((control) => (
                <li key={control.id} className="row-item">
                  <div>
                    <strong>{control.label}</strong>
                    {control.risk === 'high' && <span className="tag tag-warn">Security</span>}
                    <p className="muted">{control.isSupported ? control.about : 'Not available on this firmware.'}</p>
                  </div>
                  <ToggleSwitch
                    checked={Boolean(control.value)}
                    label={control.label}
                    disabled={!control.isSupported}
                    isBusy={busyId === control.id}
                    onChange={(value) => handleChange(control, value)}
                  />
                </li>
              ))}
          </ul>
        </section>
      ))}
      {pending && (
        <ConfirmDialog
          title={`Turn ${pending.control.label} ${pending.value ? 'on' : 'off'}?`}
          message={
            pending.value
              ? `${pending.control.about} Your previous setting is backed up first.`
              : `Turning this off lowers your network's protection. ${pending.control.about} Your previous setting is backed up first.`
          }
          confirmLabel={`Turn ${pending.value ? 'on' : 'off'}`}
          isDanger={!pending.value}
          isBusy={busyId === pending.control.id}
          onConfirm={() => apply(pending.control, pending.value, true)}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
