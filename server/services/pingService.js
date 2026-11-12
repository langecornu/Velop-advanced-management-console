// Live reachability check. The router's own online flag goes stale, so we also ping each device from this machine.
// Only private LAN addresses are accepted, and ping is run with execFile (no shell) so input can never be injected.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { httpError } from '../lib/httpError.js';
import { isPrivateIpv4 } from '../lib/network.js';

const execFileAsync = promisify(execFile);
const PING_WAIT_MS = 1500;
const CONCURRENCY = 24;
export const MAX_PROBE_HOSTS = 300;

// macOS counts -W in milliseconds, Linux in whole seconds.
export function buildPingArgs(ip, platform = process.platform) {
  const wait = platform === 'darwin' ? String(PING_WAIT_MS) : String(Math.ceil(PING_WAIT_MS / 1000));
  return ['-c', '1', '-W', wait, ip];
}

export function parseRoundTripMs(output) {
  const match = /time[=<]\s*([\d.]+)\s*ms/i.exec(output);
  return match ? Math.round(Number(match[1])) : null;
}

export async function runPing(ip) {
  try {
    const { stdout } = await execFileAsync('ping', buildPingArgs(ip), { timeout: PING_WAIT_MS + 1500 });
    return { reachable: true, rttMs: parseRoundTripMs(stdout) };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw httpError(501, 'The ping command is not available on the machine running this tool');
    }
    return { reachable: false, rttMs: null };
  }
}

// Small worker pool so 150 devices do not spawn 150 processes at once.
export async function probeHosts(ips, { ping = runPing, concurrency = CONCURRENCY } = {}) {
  const unique = [...new Set(ips)];
  if (unique.length > MAX_PROBE_HOSTS) {
    throw httpError(400, `At most ${MAX_PROBE_HOSTS} hosts can be probed at once`);
  }
  const rejected = unique.find((ip) => !isPrivateIpv4(ip));
  if (rejected) {
    throw httpError(400, 'Only private LAN IPv4 addresses can be probed');
  }
  const results = {};
  const queue = [...unique];
  async function worker() {
    while (queue.length > 0) {
      const ip = queue.shift();
      results[ip] = await ping(ip);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return results;
}
