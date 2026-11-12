// The standard safe change: read the current settings, let the caller change a copy (it may throw to refuse),
// save a backup of the original, write, then read back and verify. Every admin feature goes through this.
import { httpError } from '../lib/httpError.js';
import { sendSet } from './routerWrite.js';

export async function changeSettings({ client, backups, label, getAction, setAction, change, verify }) {
  const current = await client.call(getAction);
  const next = structuredClone(current);
  change(next, current);
  const backup = await backups.save({ label, setAction, payload: current });
  const { removed } = await sendSet(client, setAction, next);
  const confirmed = await client.call(getAction);
  if (verify && !verify(confirmed, next)) {
    throw httpError(502, 'The router accepted the change but still reports the old value');
  }
  return { backup, removedFields: removed, current: confirmed };
}
