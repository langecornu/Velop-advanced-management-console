// Shared by the route modules: async error forwarding and schema validation that raises a 400.
import { httpError } from './httpError.js';

export function wrap(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

export function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw httpError(
      400,
      'Invalid request',
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return result.data;
}
