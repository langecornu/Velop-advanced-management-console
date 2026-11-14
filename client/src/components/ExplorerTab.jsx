// The "hidden menu": run any JNAP action the firmware advertises. Writes need an explicit tick-box.
import { useEffect, useRef, useState } from 'react';

import { api } from '../api.js';
import { useAsync } from '../hooks/useAsync.js';
import { useToast } from '../hooks/useToast.js';
import { copyText } from '../lib/clipboard.js';
import ActionHelp from './ActionHelp.jsx';
import Icon from './Icon.jsx';
import ResponseView from './ResponseView.jsx';
import State from './State.jsx';

const READ_ONLY = /\/(Get|Check|Is)\w*$/;

export default function ExplorerTab() {
  const toast = useToast();
  const { data, error, isLoading, reload } = useAsync((signal) => api.actions(signal), []);
  const [action, setAction] = useState('router/GetLANSettings');
  const [requestText, setRequestText] = useState('{}');
  const [confirmWrite, setConfirmWrite] = useState(false);
  const [response, setResponse] = useState(null);
  const [ranAction, setRanAction] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [filter, setFilter] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const responseRef = useRef(null);

  // Bring a fresh answer into view, especially after a preset chip runs it from the top of the page.
  useEffect(() => {
    responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [response]);

  async function run(actionName, request, allowWrite) {
    setIsRunning(true);
    try {
      const result = await api.call({ action: actionName, request, confirmWrite: allowWrite });
      setResponse(result.response);
      setRanAction(actionName);
    } catch (runError) {
      toast('error', runError.message);
    } finally {
      setIsRunning(false);
    }
  }

  function handleRun(event) {
    event.preventDefault();
    let request;
    try {
      request = JSON.parse(requestText);
    } catch {
      toast('error', 'The request is not valid JSON');
      return;
    }
    run(action, request, confirmWrite);
  }

  // A preset fills the form and, because every preset only reads, runs straight away.
  function handlePreset(preset) {
    setAction(preset.action);
    setRequestText(JSON.stringify(preset.request));
    setConfirmWrite(false);
    if (READ_ONLY.test(preset.action)) {
      run(preset.action, preset.request, false);
    }
  }

  async function handleCopy() {
    try {
      await copyText(JSON.stringify(response, null, 2));
      toast('ok', 'Response copied');
    } catch {
      toast('error', 'Could not copy to the clipboard');
    }
  }

  if (isLoading || error) {
    return <State isLoading={isLoading} error={error} onRetry={reload} rows={4} />;
  }
  const services = data.services
    .map((service) => service.replace('http://linksys.com/jnap/', ''))
    .filter((service) => service.toLowerCase().includes(filter.toLowerCase()));
  const result = response?.result;
  return (
    <div className="stack">
      <div className="card pad">
        <div className="row-between">
          <div>
            <h2>JNAP console</h2>
            <p className="muted">
              {data.device.modelNumber} · firmware {data.device.firmwareVersion} · {data.services.length} services
              advertised
            </p>
          </div>
        </div>
        <div className="chips">
          {data.presets.map((preset) => (
            <button
              key={preset.action}
              type="button"
              className={`filter${action === preset.action ? ' is-active' : ''}`}
              onClick={() => handlePreset(preset)}
              disabled={isRunning}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <form className="form" onSubmit={handleRun}>
          <label className="field">
            <span>Action</span>
            <input className="mono" value={action} onChange={(event) => setAction(event.target.value)} />
          </label>
          <div className="field">
            <div className="field-head">
              <label htmlFor="request-json">Request JSON</label>
              <button
                type="button"
                className={`info-btn${isHelpOpen ? ' is-active' : ''}`}
                aria-expanded={isHelpOpen}
                aria-controls="action-help"
                onClick={() => setIsHelpOpen(!isHelpOpen)}
              >
                <Icon name="info" size={15} />
                What can I send?
              </button>
            </div>
            <textarea
              id="request-json"
              className="mono"
              rows={4}
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
            />
            {isHelpOpen && <ActionHelp action={action} onInsert={setRequestText} />}
          </div>
          <label className="check">
            <input type="checkbox" checked={confirmWrite} onChange={(event) => setConfirmWrite(event.target.checked)} />
            <span>Allow actions that change the router (Set*, Start*, Reboot…)</span>
          </label>
          <div>
            <button type="submit" className="btn btn-primary" disabled={isRunning}>
              <Icon name="play" size={14} />
              {isRunning ? 'Running…' : 'Run action'}
            </button>
          </div>
        </form>
      </div>

      {isRunning && <State isLoading rows={3} />}
      {response && !isRunning && (
        <div className="card pad" ref={responseRef}>
          <h3>
            Response{' '}
            <span className={`badge badge-${result === 'OK' ? 'ok' : 'bad'}`}>
              <span className="dot" aria-hidden="true" />
              {result}
            </span>
            <span className="muted mono"> {ranAction}</span>
          </h3>
          {response.error && (
            <p className="alert" role="alert">
              {response.error}
            </p>
          )}
          <ResponseView data={response.output ?? response} action={ranAction} label="Response" onCopy={handleCopy} />
        </div>
      )}

      <details className="card disclosure">
        <summary>
          Advertised services <span className="count">{data.services.length}</span>
        </summary>
        <label className="search search-sm">
          <Icon name="search" size={16} />
          <span className="sr-only">Filter services</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter services"
          />
        </label>
        <ul className="service-list mono">
          {services.map((service) => (
            <li key={service}>{service}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
