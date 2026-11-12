// Internet speed test run by the router itself (its "health check" feature), plus the stored history.
import { httpError } from '../lib/httpError.js';

const MAX_HISTORY = 30;

export function normalizeResult(result) {
  const test = result.speedTestResult ?? {};
  return {
    id: result.resultID,
    timestamp: result.timestamp,
    isSuccess: test.exitCode === 'Success',
    exitCode: test.exitCode ?? 'Unknown',
    latencyMs: test.latency ?? null,
    downloadMbps: typeof test.downloadBandwidth === 'number' ? Math.round(test.downloadBandwidth / 100) / 10 : null,
    uploadMbps: typeof test.uploadBandwidth === 'number' ? Math.round(test.uploadBandwidth / 100) / 10 : null,
  };
}

export async function getSpeedTest(client) {
  const [status, results] = await Promise.all([
    client.callRaw('healthcheck/GetHealthCheckStatus'),
    client.callRaw('healthcheck/GetHealthCheckResults', { includeModuleResults: true }),
  ]);
  // While a test runs the router already lists a placeholder result ("Unavailable") for it. Hide that one:
  // it is not a result yet, and it would otherwise look like a finished (failed) test.
  const inProgressId = status.output?.speedTestResult?.resultID;
  const history = (results.output?.healthCheckResults ?? [])
    .filter((result) => result.speedTestResult && result.resultID !== inProgressId)
    .map(normalizeResult)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_HISTORY);
  return {
    // Idle is {}. While testing the router reports which module is running (confirmed on real hardware).
    isRunning: Boolean(status.output?.healthCheckModuleCurrentlyRunning),
    status: status.output ?? {},
    history,
    lastGood: history.find((item) => item.isSuccess) ?? null,
  };
}

export async function startSpeedTest(client) {
  const current = await getSpeedTest(client);
  if (current.isRunning) {
    throw httpError(409, 'A speed test is already running');
  }
  const response = await client.callRaw('healthcheck/RunHealthCheck', {});
  if (response.result !== 'OK') {
    throw httpError(
      502,
      `The router would not start a speed test: ${response.result}${response.error ? ` - ${response.error}` : ''}`,
    );
  }
}

export async function stopSpeedTest(client) {
  const response = await client.callRaw('healthcheck/StopHealthCheck', {});
  if (response.result !== 'OK') {
    throw httpError(502, `The router would not stop the speed test: ${response.result}`);
  }
}
