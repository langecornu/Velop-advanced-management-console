// Turns any JSON into a readable layout: scalars as fact tiles, nested objects as sections, arrays as tables or chips.
import { humanizeKey, isScalar } from '../lib/humanize.js';
import DataTable from './DataTable.jsx';
import DataValue from './DataValue.jsx';

function countLabel(value) {
  const size = Array.isArray(value) ? value.length : Object.keys(value).length;
  return Array.isArray(value) ? `${size} item${size === 1 ? '' : 's'}` : `${size} field${size === 1 ? '' : 's'}`;
}

function ArrayView({ value, depth }) {
  if (value.length === 0) {
    return <p className="muted">None</p>;
  }
  if (value.every(isScalar)) {
    return (
      <div className="chips">
        {value.map((item, index) => (
          <span key={index} className="tag no-gap">
            <DataValue name="item" value={item} />
          </span>
        ))}
      </div>
    );
  }
  if (value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
    return <DataTable rows={value} depth={depth} />;
  }
  return (
    <div className="stack tight">
      {value.map((item, index) => (
        <DataView key={index} value={item} depth={depth + 1} />
      ))}
    </div>
  );
}

function ObjectView({ value, depth }) {
  const entries = Object.entries(value);
  const facts = entries.filter(([, item]) => isScalar(item));
  const sections = entries.filter(([, item]) => !isScalar(item));
  if (entries.length === 0) {
    return <p className="muted">Empty</p>;
  }
  return (
    <div className="stack tight">
      {facts.length > 0 && (
        <dl className="facts">
          {facts.map(([key, item]) => (
            <div key={key} className="fact">
              <dt>{humanizeKey(key)}</dt>
              <dd>
                <DataValue name={key} value={item} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {sections.map(([key, item]) => (
        <details key={key} className="subsection" open={depth < 2}>
          <summary>
            <span>{humanizeKey(key)}</span>
            <span className="count">{countLabel(item)}</span>
          </summary>
          <div className="subsection-body">
            <DataView value={item} depth={depth + 1} />
          </div>
        </details>
      ))}
    </div>
  );
}

export default function DataView({ value, depth = 0 }) {
  if (isScalar(value)) {
    return <DataValue name="value" value={value} />;
  }
  return Array.isArray(value) ? <ArrayView value={value} depth={depth} /> : <ObjectView value={value} depth={depth} />;
}
