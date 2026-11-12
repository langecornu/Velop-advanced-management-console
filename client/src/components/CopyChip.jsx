// Monospace value that copies itself on click, with a brief confirmation.
import { useState } from 'react';

import Icon from './Icon.jsx';

export default function CopyChip({ value, label }) {
  const [isCopied, setIsCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1200);
    } catch {
      setIsCopied(false);
    }
  }

  if (!value) {
    return <span className="muted">—</span>;
  }
  return (
    <button type="button" className="chip mono" onClick={handleCopy} aria-label={`Copy ${label} ${value}`}>
      {value}
      <Icon name={isCopied ? 'check' : 'copy'} size={13} />
    </button>
  );
}
