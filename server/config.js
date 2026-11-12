// Single reader of process.env. Validates at startup and fails fast so a bad setup never reaches a request.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));

const LOOPBACK_BINDS = new Set(['127.0.0.1', '::1', 'localhost']);

const ConfigSchema = z
  .object({
    routerHost: z.string().min(1),
    routerUser: z.string().min(1),
    routerPassword: z
      .string({ error: 'Set ROUTER_PASSWORD (or ROUTERPW) in .env' })
      .min(1, 'Set ROUTER_PASSWORD (or ROUTERPW) in .env'),
    port: z.coerce.number().int().min(1).max(65535),
    bindAddress: z.string().min(1),
    accessPassword: z.string().min(8, 'ACCESS_PASSWORD must be at least 8 characters').optional(),
    allowedOrigin: z.url(),
    dataDir: z.string().min(1),
    requestTimeoutMs: z.coerce.number().int().min(1000).max(60000),
  })
  // This tool can change the router, so it must never be reachable from the network without a password.
  .refine((config) => LOOPBACK_BINDS.has(config.bindAddress) || Boolean(config.accessPassword), {
    path: ['accessPassword'],
    message:
      'ACCESS_PASSWORD (8 or more characters) is required when listening on the network. Set it in .env, or set BIND_ADDRESS=127.0.0.1 to keep the tool on this computer only',
  });

export function loadConfig(env = process.env) {
  return ConfigSchema.parse({
    routerHost: env.ROUTER_HOST ?? '192.168.1.1',
    routerUser: env.ROUTER_USER ?? 'admin',
    routerPassword: env.ROUTER_PASSWORD ?? env.ROUTERPW,
    port: env.PORT ?? 3001,
    bindAddress: env.BIND_ADDRESS ?? '0.0.0.0',
    accessPassword: env.ACCESS_PASSWORD || undefined,
    allowedOrigin: env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    dataDir: env.DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url)),
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS ?? 30000,
  });
}

export function loadConfigFromDisk() {
  if (existsSync(ENV_PATH)) {
    process.loadEnvFile(ENV_PATH);
  }
  return loadConfig();
}
