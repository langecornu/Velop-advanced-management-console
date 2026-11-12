// Renders one scalar the way a person wants to read it: badge, copy chip, date, or plain text.
import { classifyValue } from '../lib/humanize.js';
import CopyChip from './CopyChip.jsx';

export default function DataValue({ name, value }) {
  const item = classifyValue(name, value);
  switch (item.kind) {
    case 'empty':
      return <span className="muted">—</span>;
    case 'bool':
      return (
        <span className={`badge badge-${item.isTrue ? 'ok' : 'muted'}`}>
          <span className="dot" aria-hidden="true" />
          {item.text}
        </span>
      );
    case 'mac':
    case 'ip':
      return <CopyChip value={item.text} label={name} />;
    case 'number':
      return <span className="num">{item.text}</span>;
    case 'long':
      return <code className="long">{item.text}</code>;
    default:
      return <span>{item.text}</span>;
  }
}
