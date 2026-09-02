import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';

import { getHealthStatus } from '@tatu/shared';
import { renderHealthPage } from '@tatu/web';

export function createTatuServer(): Server {
  return createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/api/health') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(getHealthStatus()));
      return;
    }

    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderHealthPage());
      return;
    }

    response.writeHead(404, {
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}

function start(): void {
  const port = Number(process.env.PORT ?? 3000);
  const server = createTatuServer();

  server.listen(port, () => {
    console.log(`Tatu API listening on http://localhost:${port}`);
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  start();
}
