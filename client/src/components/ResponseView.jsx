// Router response with a Visual / JSON switch. Visual parses the JSON into a readable layout.
import { useState } from 'react';

import { adaptOutput } from '../lib/adapters.js';
import DataView from './DataView.jsx';
import Icon from './Icon.jsx';
import JsonView from './JsonView.jsx';

export default function ResponseView({ data, action, label, onCopy }) {
  const [mode, setMode] = useState('visual');
  return (
    <div className="response">
      <div className="row-between">
        <div className="seg" role="group" aria-label="Response format">
          {['visual', 'json'].map((item) => (
            <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>
              {item === 'visual' ? 'Visual' : 'JSON'}
            </button>
          ))}
        </div>
        {onCopy && (
          <button type="button" className="btn btn-sm" onClick={onCopy}>
            <Icon name="copy" size={14} />
            Copy JSON
          </button>
        )}
      </div>
      {mode === 'visual' ? <DataView value={adaptOutput(action, data)} /> : <JsonView value={data} label={label} />}
    </div>
  );
}
