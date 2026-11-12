// Entry point: load config, wire the router client into the app, start listening.
import { networkInterfaces } from 'node:os';

import { createJnapClient } from './clients/jnapClient.js';
import { createApp } from './app.js';
import { loadConfigFromDisk } from './config.js';

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection', reason);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  console.error('[process] uncaughtException', error);
  process.exit(1);
});

function networkUrls(port) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => `http://${item.address}:${port}`);
}

// A bad setup should end with one readable line, not a stack trace.
function loadConfigOrExit() {
  try {
    return loadConfigFromDisk();
  } catch (error) {
    if (!error.issues) {
      throw error;
    }
    console.error(`[config] ${error.issues.map((issue) => issue.message).join('; ')}`);
    process.exit(1);
  }
}

const config = loadConfigOrExit();
const client = createJnapClient({
  host: config.routerHost,
  user: config.routerUser,
  password: config.routerPassword,
  timeoutMs: config.requestTimeoutMs,
});
const server = createApp({ client, config }).listen(config.port, config.bindAddress, () => {
  console.log(`[server] Velop Toolkit on http://${config.bindAddress}:${config.port} -> router ${config.routerHost}`);
  if (config.bindAddress === '0.0.0.0') {
    console.log(
      `[server] Open from other devices on this network: ${networkUrls(config.port).join('  ') || '(no network address found)'}`,
    );
    console.log('[server] They will be asked for the access password (any user name).');
  }
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
