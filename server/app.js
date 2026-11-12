// Builds the Express app. Routes only parse and validate; services hold the logic; the client talks to the router.
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';

import { createAccessGate } from './lib/accessGate.js';
import { httpError } from './lib/httpError.js';
import { parse, wrap } from './lib/routeHelpers.js';
import { createBackupStore } from './lib/backupStore.js';
import { createAdminRouter } from './routes/adminRoutes.js';
import { addReservation, getDhcp, removeReservation } from './services/dhcpService.js';
import { getOverview, getPingStatus, startPing } from './services/diagnosticsService.js';
import { createDeviceCache, searchDevices, summarize } from './services/deviceService.js';
import { getCatalog, runProbe } from './services/systemService.js';
import { createSysinfoService } from './services/sysinfoService.js';
import { probeHosts } from './services/pingService.js';
import { createActionDescriber, listActions, runAction } from './services/explorerService.js';

const CLIENT_DIST = fileURLToPath(new URL('../client/dist', import.meta.url));

const ReservationSchema = z
  .object({
    macAddress: z.string().max(32),
    ipAddress: z.string().max(15),
    description: z.string().max(63).optional(),
  })
  .strict();
const CallSchema = z
  .object({
    action: z
      .string()
      .min(3)
      .max(200)
      .regex(/^(http:\/\/linksys\.com\/jnap\/)?[\w/]+$/),
    request: z.record(z.string(), z.unknown()).default({}),
    confirmWrite: z.boolean().default(false),
  })
  .strict();
const DescribeSchema = z
  .object({
    action: z
      .string()
      .min(3)
      .max(200)
      .regex(/^(http:\/\/linksys\.com\/jnap\/)?[\w/]+$/),
  })
  .strict();
const ProbeSchema = z.object({ ips: z.array(z.string().max(15)).min(1).max(300) }).strict();
const PingSchema = z.object({ host: z.string().max(253), count: z.number().int().min(1).max(10).default(4) }).strict();

export function createApp({ client, config, clientDist = CLIENT_DIST }) {
  const app = express();
  app.disable('x-powered-by');
  // Helmet's defaults force browsers to upgrade requests to HTTPS and pin HTTPS for a year. That breaks this tool
  // when it is opened over plain HTTP from another device on the network, so those two are switched off.
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } },
      hsts: false,
    }),
  );
  if (config.accessPassword) {
    app.use(createAccessGate({ password: config.accessPassword }));
  }
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

  // Locked CORS for the Vite dev origin, plus a custom header on writes so other web pages cannot drive the router.
  app.use('/api', (req, res, next) => {
    if (req.headers.origin === config.allowedOrigin) {
      res.set('Access-Control-Allow-Origin', config.allowedOrigin);
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-Velop-Tool');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    if (req.method !== 'GET' && req.headers['x-velop-tool'] !== '1') {
      return next(httpError(403, 'Missing X-Velop-Tool header'));
    }
    return next();
  });

  const sysinfo = createSysinfoService(client);
  const describeAction = createActionDescriber(client);
  const deviceCache = createDeviceCache(client);
  const backups = createBackupStore(config.dataDir);
  const api = express.Router();
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.get('/system/catalog', (req, res) => res.json({ categories: getCatalog() }));
  api.get(
    '/system/probe/:id',
    wrap(async (req, res) => res.json(await runProbe(client, req.params.id))),
  );
  api.post(
    '/devices/probe',
    wrap(async (req, res) => res.json(await probeHosts(parse(ProbeSchema, req.body).ips))),
  );
  api.get(
    '/info',
    wrap(async (req, res) => {
      const info = (await client.callRaw('core/GetDeviceInfo')).output ?? {};
      res.json({
        model: info.modelNumber,
        description: info.description,
        firmware: info.firmwareVersion,
        routerHost: config.routerHost,
      });
    }),
  );
  api.get(
    '/overview',
    wrap(async (req, res) => res.json(await getOverview(client))),
  );
  api.get(
    '/devices',
    wrap(async (req, res) => {
      const all = await deviceCache.get(req.query.refresh === '1');
      const devices = searchDevices(all, req.query.q);
      res.json({ count: devices.length, devices, stats: summarize(all) });
    }),
  );
  api.get(
    '/dhcp',
    wrap(async (req, res) => res.json(await getDhcp(client))),
  );
  api.post(
    '/dhcp/reservations',
    wrap(async (req, res) => {
      res.status(201).json(await addReservation(client, parse(ReservationSchema, req.body)));
    }),
  );
  api.delete(
    '/dhcp/reservations/:mac',
    wrap(async (req, res) => {
      await removeReservation(client, req.params.mac);
      res.sendStatus(204);
    }),
  );
  api.get(
    '/sysinfo',
    wrap(async (req, res) => res.json(await sysinfo.getSections(req.query.refresh === '1'))),
  );
  api.get(
    '/sysinfo/section',
    wrap(async (req, res) => res.json(await sysinfo.getSection(String(req.query.name ?? '')))),
  );
  api.get(
    '/sysinfo/search',
    wrap(async (req, res) => res.json(await sysinfo.search(String(req.query.q ?? '')))),
  );
  api.get(
    '/explorer/describe',
    wrap(async (req, res) => {
      const { action } = parse(DescribeSchema, req.query);
      res.json(await describeAction(action));
    }),
  );
  api.get(
    '/explorer/actions',
    wrap(async (req, res) => res.json(await listActions(client))),
  );
  api.post(
    '/explorer/call',
    wrap(async (req, res) => res.json(await runAction(client, parse(CallSchema, req.body)))),
  );
  api.post(
    '/diagnostics/ping',
    wrap(async (req, res) => {
      await startPing(client, parse(PingSchema, req.body));
      res.sendStatus(202);
    }),
  );
  api.get(
    '/diagnostics/ping',
    wrap(async (req, res) => res.json(await getPingStatus(client))),
  );
  api.use('/admin', createAdminRouter({ client, backups, deviceCache }));
  app.use('/api', api);

  // Always mounted: a build made after start-up is served without a restart. Without a build, say what to do
  // instead of Express's bare "Cannot GET /".
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      return next();
    }
    const hasBuild = existsSync(`${clientDist}/index.html`);
    return res
      .status(404)
      .type('text/plain')
      .send(
        hasBuild
          ? 'Not found'
          : 'The web interface has not been built yet. Run "npm run build" in the project folder, then reload this page.',
      );
  });

  app.use((error, req, res, next) => {
    const correlationId = crypto.randomUUID();
    const status = error.expose ? error.status : error.type === 'entity.too.large' ? 413 : 500;
    console.error(`[app] ${correlationId} ${req.method} ${req.path} -> ${status}: ${error.message}`);
    res.status(status).json({
      error: error.expose || status === 413 ? error.message : 'Internal server error',
      details: error.expose ? error.details : undefined,
      correlationId,
    });
    return next;
  });
  return app;
}
