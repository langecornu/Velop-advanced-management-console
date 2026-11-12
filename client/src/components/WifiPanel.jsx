// Wi-Fi: see every band, rename the network, set a new password, switch bands on or off.
// Changes disconnect devices, so they need a typed confirmation, and the old settings are backed up first.
import { useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import Icon from './Icon.jsx';
import State from './State.jsx';
import ToggleSwitch from './ToggleSwitch.jsx';
import TypedConfirmDialog from './TypedConfirmDialog.jsx';

export default function WifiPanel() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.adminWifi(signal), []);
  const [ssid, setSsid] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isShown, setIsShown] = useState(false);
  const [unselected, setUnselected] = useState([]);
  const [pending, setPending] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  if (isLoading && !data) {
    return <State isLoading rows={4} />;
  }
  if (error) {
    return <State error={error} onRetry={reload} />;
  }
  const selected = data.radios.filter((radio) => !unselected.includes(radio.radioId));
  const passwordProblem =
    passphrase && (passphrase.length < 8 || passphrase.length > 63) ? 'Use 8 to 63 characters.' : '';
  const canSave = selected.length > 0 && (ssid.trim() || passphrase) && !passwordProblem;

  async function apply(changes, success) {
    setIsBusy(true);
    try {
      await api.updateWifi({ ...changes, confirm: 'CHANGE WI-FI' });
      toast('ok', success);
      setPassphrase('');
      setSsid('');
      reload();
    } catch (changeError) {
      toast('error', changeError.message);
    } finally {
      setIsBusy(false);
      setPending(null);
    }
  }

  const describeChange = () =>
    [ssid.trim() && `rename the network to "${ssid.trim()}"`, passphrase && 'set a new password']
      .filter(Boolean)
      .join(' and ');

  return (
    <div className="stack">
      <div className="grid-3">
        {data.radios.map((radio) => (
          <div key={radio.radioId} className="card radio">
            <div className="row-between">
              <strong>{radio.label}</strong>
              <ToggleSwitch
                checked={radio.isEnabled}
                label={`${radio.label} radio`}
                onChange={(value) => setPending({ kind: 'power', radio, value })}
              />
            </div>
            <p className="radio-ssid">{radio.ssid}</p>
            <p className="muted">
              {radio.security} · channel {radio.channel === 0 ? 'auto' : radio.channel}
              {radio.channelRange && ` (${radio.channelRange})`}
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={!unselected.includes(radio.radioId)}
                onChange={(event) =>
                  setUnselected(
                    event.target.checked
                      ? unselected.filter((id) => id !== radio.radioId)
                      : [...unselected, radio.radioId],
                  )
                }
              />
              <span>Apply name / password changes here</span>
            </label>
          </div>
        ))}
      </div>

      <section className="card pad">
        <h2>Change name or password</h2>
        <p className="muted">Leave a field empty to keep it. Passwords are never shown or sent back to this page.</p>
        <div className="form two-col">
          <label className="field">
            <span>New Wi-Fi name (SSID)</span>
            <input
              value={ssid}
              maxLength={32}
              onChange={(event) => setSsid(event.target.value)}
              placeholder="Keep current name"
            />
          </label>
          <label className="field">
            <span>New password</span>
            <span className="input-group">
              <input
                type={isShown ? 'text' : 'password'}
                value={passphrase}
                maxLength={63}
                autoComplete="new-password"
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Keep current password"
              />
              <button type="button" className="btn btn-sm" onClick={() => setIsShown(!isShown)}>
                {isShown ? 'Hide' : 'Show'}
              </button>
            </span>
            {passwordProblem && <small className="error-text">{passwordProblem}</small>}
          </label>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSave}
            onClick={() => setPending({ kind: 'credentials' })}
          >
            <Icon name="wifi" size={16} />
            Review and apply
          </button>
        </div>
      </section>

      {pending?.kind === 'credentials' && (
        <TypedConfirmDialog
          title="Change Wi-Fi settings?"
          phrase="CHANGE WI-FI"
          confirmLabel="Apply to the router"
          isBusy={isBusy}
          onClose={() => setPending(null)}
          onConfirm={() =>
            apply(
              {
                radioIds: selected.map((radio) => radio.radioId),
                ssid: ssid.trim() || undefined,
                passphrase: passphrase || undefined,
              },
              'Wi-Fi settings updated',
            )
          }
        >
          <p>
            This will {describeChange()} on {selected.map((radio) => radio.label).join(' + ')}.
          </p>
          <p className="muted">
            Devices on those bands disconnect for up to a minute and need the new details to rejoin, including this
            computer if it is on Wi-Fi. The current settings are saved first so you can undo from History.
          </p>
        </TypedConfirmDialog>
      )}
      {pending?.kind === 'power' && (
        <TypedConfirmDialog
          title={`Turn the ${pending.radio.label} radio ${pending.value ? 'on' : 'off'}?`}
          phrase="CHANGE WI-FI"
          confirmLabel={`Turn ${pending.value ? 'on' : 'off'}`}
          isBusy={isBusy}
          onClose={() => setPending(null)}
          onConfirm={() =>
            apply(
              { radioIds: [pending.radio.radioId], isEnabled: pending.value },
              `${pending.radio.label} turned ${pending.value ? 'on' : 'off'}`,
            )
          }
        >
          <p className="muted">
            {pending.value
              ? 'Devices will be able to join this band again.'
              : 'Everything connected on this band will be disconnected. The router keeps at least one band on.'}
          </p>
        </TypedConfirmDialog>
      )}
    </div>
  );
}
