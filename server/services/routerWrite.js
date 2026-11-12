// The one place that sends a Set* action to the router.
// The router names any field it does not accept ('unexpected member "x"') and rejects the request WITHOUT
// applying anything. So when a Get* result is sent back as a Set* payload, read-only fields are discovered
// and dropped automatically, one at a time, until the router accepts it.
import { httpError } from '../lib/httpError.js';

const MAX_STRIPS = 12;

export function parseUnexpectedMember(text) {
  const match = /unexpected member "([^"]+)"/.exec(text ?? '');
  return match ? match[1] : null;
}

export function stripMember(value, name) {
  if (Array.isArray(value)) {
    return value.map((item) => stripMember(item, name));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== name)
        .map(([key, item]) => [key, stripMember(item, name)]),
    );
  }
  return value;
}

export async function sendSet(client, action, payload) {
  let body = structuredClone(payload);
  const removed = [];
  for (let attempt = 0; attempt <= MAX_STRIPS; attempt += 1) {
    const response = await client.callRaw(action, body);
    if (response.result === 'OK') {
      return { removed };
    }
    const member = response.result === '_ErrorInvalidInput' ? parseUnexpectedMember(response.error) : null;
    if (!member) {
      throw httpError(
        502,
        `The router rejected the change: ${response.result}${response.error ? ` - ${response.error}` : ''}`,
      );
    }
    body = stripMember(body, member);
    removed.push(member);
  }
  throw httpError(502, 'The router kept rejecting the settings, so nothing was changed');
}
