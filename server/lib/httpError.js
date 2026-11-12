// One shared way to raise an error that carries an HTTP status and a client-safe message.
export function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}
