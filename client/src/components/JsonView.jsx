// Pretty-prints JSON with colour. Builds React nodes from tokens (no HTML injection).
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+\.?\d*(?:[eE][+-]?\d+)?/g;

function highlight(text) {
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const [token, string, colon, word] = match;
    const kind = string ? (colon ? 'key' : 'str') : word ? 'kw' : 'num';
    nodes.push(
      <span key={match.index} className={`tok-${kind}`}>
        {string && colon ? string : token}
      </span>,
    );
    if (string && colon) {
      nodes.push(colon);
    }
    last = match.index + token.length;
  }
  nodes.push(text.slice(last));
  return nodes;
}

export default function JsonView({ value, label }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <pre className="code" aria-label={label}>
      {highlight(text ?? '')}
    </pre>
  );
}
