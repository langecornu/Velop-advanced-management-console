// "What can I send?" panel for the JNAP console. It explains the selected action and, on request, asks the
// router what input it wants and what it returns (only for read-only actions; writes are never probed).
import { useEffect, useState } from 'react';

import { api } from '../api.js';
import Icon from './Icon.jsx';

const KIND = {
  read: {
    label: 'Read-only',
    tone: 'ok',
    text: 'Looks at something and changes nothing. Most read actions take {} (no parameters).',
  },
  write: {
    label: 'Changes the router',
    tone: 'warn',
    text: 'May change a setting. Tick the box below the JSON to allow it.',
  },
  blocked: { label: 'Blocked', tone: 'bad', text: 'Destructive, so it cannot be run from here.' },
};

function classify(action) {
  if (/(FactoryReset|ResetToFactory|SetAdminPassword|RestoreConfiguration|DeleteAdmin)/i.test(action)) {
    return 'blocked';
  }
  return /\/(Get|Check|Is)\w*$/.test(action) ? 'read' : 'write';
}

// A starting point only: booleans for flag-like names, empty text otherwise.
function templateFor(fields) {
  return JSON.stringify(
    Object.fromEntries(fields.map((name) => [name, /^(is|can|include|enable)/i.test(name) ? true : ''])),
    null,
    2,
  );
}

function FieldChips({ fields }) {
  return (
    <div className="chips">
      {fields.map((field) => (
        <span key={field.name} className="tag no-gap mono">
          {field.name}
          <small className="muted">{field.type}</small>
        </span>
      ))}
    </div>
  );
}

export default function ActionHelp({ action, onInsert }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const kind = KIND[classify(action)];
  // Only settings-style reads have a matching setter; status, lists, logs and stats are read-only by nature.
  const writeSibling = /\/Get\w*(Settings|Setting|Rules)\d*$/.test(action)
    ? action.replace(/\/Get(?=[A-Z])/, '/Set')
    : null;

  useEffect(() => {
    setInfo(null);
    setError('');
  }, [action]);

  async function handleCheck() {
    setIsLoading(true);
    setError('');
    try {
      setInfo(await api.describe(action));
    } catch (checkError) {
      setError(checkError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div id="action-help" className="help-panel" role="region" aria-label="About this action">
      <div className="row-between">
        <span className={`badge badge-${kind.tone}`}>
          <span className="dot" aria-hidden="true" />
          {kind.label}
        </span>
        <button type="button" className="btn btn-sm" onClick={handleCheck} disabled={isLoading}>
          <Icon name="search" size={14} />
          {isLoading ? 'Asking the router…' : 'Check what it accepts'}
        </button>
      </div>
      <p className="muted">{kind.text}</p>
      {writeSibling && (
        <p className="muted">
          To change these settings, the matching action is usually <code>{writeSibling}</code>, sent with the fields you
          want to change.
        </p>
      )}
      {error && <p className="alert">{error}</p>}
      {info && (
        <div className="help-result">
          {info.note && <p className="muted">{info.note}</p>}
          {info.isSupported === false && <p className="alert">This router does not recognise that action.</p>}
          {info.requiredInput?.length > 0 && (
            <div className="stack tight">
              <strong>It needs these fields</strong>
              <FieldChips fields={info.requiredInput.map((name) => ({ name, type: 'required' }))} />
              <div>
                <button type="button" className="btn btn-sm" onClick={() => onInsert(templateFor(info.requiredInput))}>
                  Insert as a starting point
                </button>
              </div>
            </div>
          )}
          {info.isSupported && info.requiredInput?.length === 0 && info.returns?.length > 0 && (
            <div className="stack tight">
              <strong>No parameters needed. Send {'{}'}.</strong>
              <span className="muted">It returns:</span>
              <FieldChips fields={info.returns} />
            </div>
          )}
          {info.siblingFields?.length > 0 && (
            <div className="stack tight">
              <strong>Settings it probably takes</strong>
              <span className="muted">From {info.sibling}. The router rejects read-only fields and names them.</span>
              <FieldChips fields={info.siblingFields} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
