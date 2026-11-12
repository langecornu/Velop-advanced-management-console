// Network administration endpoints. Routes only validate; the services do the work and keep the safety rules.
// Every change needs an explicit confirmation field, so a stray request cannot alter the network.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { httpError } from '../lib/httpError.js';
import { parse, wrap } from '../lib/routeHelpers.js';
import { getAccess, removeParentalRule, setMacFilter } from '../services/accessService.js';
import { listControls, reboot, restoreBackup, setControl } from '../services/adminService.js';
import { deleteDevices, renameDevice } from '../services/deviceAdminService.js';
import { createNodeService } from '../services/nodeService.js';
import { addRule, deleteRule, getPortForwarding, updateRule } from '../services/portForwardService.js';
import { getSchedules, setFirmwarePolicy, setScheduledReboot, setTimeZone } from '../services/settingsService.js';
import { getSpeedTest, startSpeedTest, stopSpeedTest } from '../services/speedTestService.js';
import { getWifi, updateWifi } from '../services/wifiService.js';

const ControlSchema = z.object({ value: z.boolean(), confirm: z.boolean().default(false) }).strict();
const WifiSchema = z
  .object({
    radioIds: z.array(z.string().max(40)).max(6).optional(),
    ssid: z.string().max(64).optional(),
    passphrase: z.string().max(64).optional(),
    isEnabled: z.boolean().optional(),
    confirm: z.literal('CHANGE WI-FI'),
  })
  .strict();
const MacFilterSchema = z
  .object({ mode: z.string().max(20), macAddresses: z.array(z.string().max(17)).max(64), confirm: z.literal(true) })
  .strict();
const RebootSchema = z.object({ confirm: z.literal('RESTART') }).strict();
const RestoreSchema = z.object({ confirm: z.literal(true) }).strict();
const ScheduleRebootSchema = z.object({ isEnabled: z.boolean(), interval: z.string().max(20) }).strict();
const FirmwareSchema = z
  .object({
    policy: z.string().max(40),
    startMinute: z.number().int(),
    durationMinutes: z.number().int(),
    confirm: z.boolean().default(false),
  })
  .strict();
const TimeSchema = z.object({ timeZoneId: z.string().max(60), autoAdjustForDst: z.boolean() }).strict();
const SpeedTestSchema = z.object({ confirm: z.literal(true) }).strict();
const RuleSchema = z
  .object({
    isEnabled: z.boolean(),
    externalPort: z.number().int(),
    protocol: z.string().max(4),
    internalIp: z.string().max(15),
    internalPort: z.number().int(),
    description: z.string().max(64).default(''),
    confirm: z.literal(true),
  })
  .strict();
const RenameSchema = z.object({ name: z.string().max(64) }).strict();
const DeleteDevicesSchema = z
  .object({ deviceIds: z.array(z.string().max(64)).min(1).max(200), confirm: z.literal('DELETE DEVICES') })
  .strict();
const NodeUpdateSchema = z.object({ confirm: z.literal('UPDATE NODES') }).strict();

export function createAdminRouter({ client, backups, deviceCache }) {
  const router = express.Router();
  const nodes = createNodeService({ client, getDevices: () => deviceCache.get(false), backups });
  const afterDeviceChange = () => deviceCache.invalidate();
  // Changes are rare and deliberate; a tight limit also blunts any runaway script.
  router.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));

  router.get(
    '/controls',
    wrap(async (req, res) => res.json({ controls: await listControls(client) })),
  );
  router.post(
    '/controls/:id',
    wrap(async (req, res) => {
      const { value, confirm } = parse(ControlSchema, req.body);
      res.json(await setControl(client, backups, req.params.id, value, confirm));
    }),
  );

  router.get(
    '/wifi',
    wrap(async (req, res) => res.json(await getWifi(client))),
  );
  router.post(
    '/wifi',
    wrap(async (req, res) => {
      const changes = parse(WifiSchema, req.body);
      delete changes.confirm; // validated by the schema; the service does not need it
      res.json(await updateWifi(client, backups, changes));
    }),
  );

  router.get(
    '/access',
    wrap(async (req, res) => res.json(await getAccess(client))),
  );
  router.post(
    '/access/mac-filter',
    wrap(async (req, res) => {
      const request = parse(MacFilterSchema, req.body);
      delete request.confirm; // validated by the schema; the service does not need it
      res.json(await setMacFilter(client, backups, request));
    }),
  );
  router.delete(
    '/access/parental-rules/:index',
    wrap(async (req, res) => {
      res.json(await removeParentalRule(client, backups, Number(req.params.index)));
    }),
  );

  router.get(
    '/schedules',
    wrap(async (req, res) => res.json(await getSchedules(client))),
  );
  router.post(
    '/schedules/reboot',
    wrap(async (req, res) => {
      res.json(await setScheduledReboot(client, backups, parse(ScheduleRebootSchema, req.body)));
    }),
  );
  router.post(
    '/schedules/firmware',
    wrap(async (req, res) => {
      const { confirm, ...settings } = parse(FirmwareSchema, req.body);
      if (settings.policy === 'Manual' && !confirm) {
        throw httpError(
          409,
          'Turning automatic updates off leaves the router unpatched. Resend with confirm set to true',
        );
      }
      res.json(await setFirmwarePolicy(client, backups, settings));
    }),
  );
  router.post(
    '/schedules/time',
    wrap(async (req, res) => {
      res.json(await setTimeZone(client, backups, parse(TimeSchema, req.body)));
    }),
  );

  router.get(
    '/speedtest',
    wrap(async (req, res) => res.json(await getSpeedTest(client))),
  );
  router.post(
    '/speedtest',
    wrap(async (req, res) => {
      parse(SpeedTestSchema, req.body);
      await startSpeedTest(client);
      res.sendStatus(202);
    }),
  );
  router.delete(
    '/speedtest',
    wrap(async (req, res) => {
      await stopSpeedTest(client);
      res.sendStatus(204);
    }),
  );

  router.get(
    '/port-forwarding',
    wrap(async (req, res) => res.json(await getPortForwarding(client))),
  );
  router.post(
    '/port-forwarding',
    wrap(async (req, res) => {
      const rule = parse(RuleSchema, req.body);
      delete rule.confirm; // opening a port needs it; the schema already checked
      res.status(201).json(await addRule(client, backups, rule));
    }),
  );
  router.put(
    '/port-forwarding/:index',
    wrap(async (req, res) => {
      const rule = parse(RuleSchema, req.body);
      delete rule.confirm;
      res.json(await updateRule(client, backups, Number(req.params.index), rule));
    }),
  );
  router.delete(
    '/port-forwarding/:index',
    wrap(async (req, res) => {
      res.json(await deleteRule(client, backups, Number(req.params.index)));
    }),
  );

  router.post(
    '/devices/delete',
    wrap(async (req, res) => {
      const { deviceIds } = parse(DeleteDevicesSchema, req.body);
      res.json(await deleteDevices(client, backups, deviceIds, afterDeviceChange));
    }),
  );
  router.post(
    '/devices/:id/rename',
    wrap(async (req, res) => {
      const { name } = parse(RenameSchema, req.body);
      res.json(await renameDevice(client, backups, req.params.id, name, afterDeviceChange));
    }),
  );

  router.get(
    '/nodes',
    wrap(async (req, res) => res.json({ nodes: await nodes.list() })),
  );
  router.post(
    '/nodes/check',
    wrap(async (req, res) => {
      await nodes.check();
      res.sendStatus(202);
    }),
  );
  router.post(
    '/nodes/update',
    wrap(async (req, res) => {
      parse(NodeUpdateSchema, req.body);
      await nodes.update();
      res.sendStatus(202);
    }),
  );
  router.post(
    '/nodes/refresh',
    wrap(async (req, res) => {
      await nodes.refresh();
      res.sendStatus(202);
    }),
  );

  router.post(
    '/reboot',
    wrap(async (req, res) => {
      parse(RebootSchema, req.body);
      await reboot(client, backups);
      res.sendStatus(202);
    }),
  );

  router.get(
    '/backups',
    wrap(async (req, res) => res.json({ backups: await backups.list() })),
  );
  router.post(
    '/backups/:file/restore',
    wrap(async (req, res) => {
      parse(RestoreSchema, req.body);
      res.json(await restoreBackup(client, backups, req.params.file));
    }),
  );
  return router;
}
