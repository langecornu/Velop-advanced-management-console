// Password gate for clients on the network. Requests from this computer itself are exempt, so local use needs no
// login. Everyone else must send the access password with HTTP Basic auth (any user name), and an address that
// guesses wrong too often is locked out for a while.
import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_FAILURES = 10;
const WINDOW_MS = 10 * 60_000;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export const isLoopbackAddress = (address) => LOOPBACK.has(address);

const digest = (value) => createHash('sha256').update(value).digest();

export function createAccessGate({ password, now = () => Date.now(), isExempt = isLoopbackAddress }) {
  const expected = digest(password);
  const failures = new Map();

  function isLockedOut(address) {
    const record = failures.get(address);
    if (!record) {
      return false;
    }
    if (now() > record.resetAt) {
      failures.delete(address);
      return false;
    }
    return record.count >= MAX_FAILURES;
  }

  function recordFailure(address) {
    const record = failures.get(address);
    failures.set(
      address,
      record && now() <= record.resetAt
        ? { ...record, count: record.count + 1 }
        : { count: 1, resetAt: now() + WINDOW_MS },
    );
  }

  function isCorrect(header) {
    const [scheme, encoded] = String(header ?? '').split(' ');
    if (scheme !== 'Basic' || !encoded) {
      return false;
    }
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const given = decoded.slice(decoded.indexOf(':') + 1);
    return timingSafeEqual(digest(given), expected);
  }

  return (req, res, next) => {
    const address = req.socket?.remoteAddress ?? '';
    if (isExempt(address)) {
      return next();
    }
    if (isLockedOut(address)) {
      return res.status(429).type('text/plain').send('Too many wrong passwords. Try again in ten minutes.');
    }
    if (isCorrect(req.headers.authorization)) {
      failures.delete(address);
      return next();
    }
    // Only a request that actually sent credentials counts as a guess; the browser's first, empty request does not.
    if (req.headers.authorization) {
      recordFailure(address);
    }
    res.set('WWW-Authenticate', 'Basic realm="Velop Toolkit", charset="UTF-8"');
    return res.status(401).type('text/plain').send('Password required');
  };
}
