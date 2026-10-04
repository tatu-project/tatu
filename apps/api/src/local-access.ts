import type { IncomingMessage, Server } from 'node:http';

export function localListenOptions(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const rawPort = environment.PORT ?? '3000';
  const host = environment.TATU_BIND_HOST ?? '127.0.0.1';
  if (!/^[1-9]\d{0,4}$/u.test(rawPort) || Number(rawPort) > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  if (!['127.0.0.1', '::1', '0.0.0.0'].includes(host)) {
    throw new Error('TATU_BIND_HOST must be 127.0.0.1, ::1 or 0.0.0.0.');
  }
  return { host, port: Number(rawPort) };
}

export function listenLocally(
  server: Server,
  environment: NodeJS.ProcessEnv = process.env,
  onListening?: () => void,
): void {
  server.listen(localListenOptions(environment), onListening);
}

const singleHeader = (request: IncomingMessage, name: string) => {
  const count = request.rawHeaders.filter(
    (_, index) =>
      index % 2 === 0 && request.rawHeaders[index].toLowerCase() === name,
  ).length;
  const value = request.headers[name];
  return count === 1 && typeof value === 'string' ? value : undefined;
};

/** Local HTTP boundary, not authentication. Forwarding headers are ignored. */
export function permitsLocalRequest(request: IncomingMessage): boolean {
  const host = singleHeader(request, 'host');
  const authority = host?.match(
    /^(localhost|127\.0\.0\.1|\[::1\])(?::([1-9]\d{0,4}))?$/iu,
  );
  if (!authority) return false;
  const port = authority[2] === undefined ? 80 : Number(authority[2]);
  if (port > 65535 || port !== request.socket.localPort) return false;

  if ('origin' in request.headers) {
    const origin = singleHeader(request, 'origin');
    const match = origin?.match(
      /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::([1-9]\d{0,4}))?$/iu,
    );
    if (
      !match ||
      match[1].toLowerCase() !== authority[1].toLowerCase() ||
      Number(match[2] ?? 80) !== port
    )
      return false;
  }

  if ('sec-fetch-site' in request.headers) {
    const site = singleHeader(request, 'sec-fetch-site');
    if (!site || !['same-origin', 'none'].includes(site)) return false;
  }
  return true;
}
