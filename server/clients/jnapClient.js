// Wraps the one external system we talk to: the Linksys JNAP endpoint on the router.
// Everything else in the app goes through this client so auth, timeouts and error mapping live in one place.
import { httpError } from '../lib/httpError.js';

const ACTION_PREFIX = 'http://linksys.com/jnap/';

export function fullAction(action) {
  return action.startsWith('http') ? action : `${ACTION_PREFIX}${action}`;
}

// The router echoes the Authorization header inside its unauthorized error text, which would leak the password.
export function redact(payload) {
  if (typeof payload?.error === 'string') {
    payload.error = payload.error.replace(/Basic [A-Za-z0-9+/=]+/g, 'Basic [redacted]');
  }
  return payload;
}

export function createJnapClient({ host, user, password, timeoutMs, fetchImpl = fetch }) {
  const endpoint = `http://${host}/JNAP/`;
  const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

  // Circuit breaker: Velop locks the admin account after repeated bad logins, so after one rejection we stop
  // sending anything until the process is restarted with a corrected password.
  let isAuthBlocked = false;

  async function post(action, body, timeout = timeoutMs) {
    if (isAuthBlocked) {
      throw httpError(
        503,
        'Router login was rejected earlier; fix the password in .env and restart to avoid a lockout',
      );
    }
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-JNAP-Action': fullAction(action),
          'X-JNAP-Authorization': authorization,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      console.error(`[jnap] request to router failed: ${error.name}`);
      throw httpError(504, 'The router did not respond in time or is unreachable');
    }
    try {
      const payload = redact(await response.json());
      if (payload.result === '_ErrorUnauthorized') {
        isAuthBlocked = true;
      }
      return payload;
    } catch {
      throw httpError(502, 'The router returned a response that was not JSON');
    }
  }

  function unwrap(action, payload) {
    if (payload.result === 'OK') {
      return payload.output ?? {};
    }
    if (payload.result === '_ErrorUnauthorized') {
      throw httpError(502, 'The router rejected the admin credentials');
    }
    throw httpError(502, `Router action failed: ${payload.result}${payload.error ? ` - ${payload.error}` : ''}`, {
      action,
      result: payload.result,
      error: payload.error,
    });
  }

  return {
    async call(action, request = {}, { timeoutMs: timeout } = {}) {
      return unwrap(action, await post(action, request, timeout));
    },

    // Raw variant used by the explorer: returns the router's answer untouched, errors included.
    async callRaw(action, request = {}) {
      return post(action, request);
    },

    // One HTTP round trip for several read or write actions.
    async transaction(calls) {
      const payload = await post(
        'core/Transaction',
        calls.map((item) => ({
          action: fullAction(item.action),
          request: item.request ?? {},
        })),
      );
      unwrap('core/Transaction', payload);
      return (payload.responses ?? []).map((item, index) => ({
        action: calls[index].action,
        result: item.result,
        output: item.output ?? {},
        error: item.error,
      }));
    },
  };
}
