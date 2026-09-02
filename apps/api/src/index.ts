import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';

import { getHealthStatus } from '@tatu/shared';
import { parseBriefing, type BriefingDraft } from '@tatu/shared';
import { renderHealthPage } from '@tatu/web';
import { TaskRepository } from './task-repository.js';

const drafts = new Map<string, BriefingDraft>();
const json = (
  response: import('node:http').ServerResponse,
  status: number,
  body: unknown,
) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
};
const maxJsonBytes = 64 * 1024;
class BodyTooLargeError extends Error {}
const readJson = async (request: import('node:http').IncomingMessage) => {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (byteLength + bytes.length > maxJsonBytes) {
      request.resume();
      throw new BodyTooLargeError();
    }
    chunks.push(bytes);
    byteLength += bytes.length;
  }
  return JSON.parse(Buffer.concat(chunks, byteLength).toString('utf8')) as {
    message?: string;
    timezone?: string;
  };
};
export function createTatuServer(
  databasePath = process.env.TATU_DATABASE_PATH ?? 'data/tatu.sqlite',
): Server {
  const repository = new TaskRepository(databasePath);
  return createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/api/health') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(getHealthStatus()));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/tasks') {
      json(response, 200, repository.list());
      return;
    }

    if (request.method === 'POST' && request.url === '/api/briefing-drafts') {
      readJson(request)
        .then(({ message, timezone }) => {
          if (typeof message !== 'string' || typeof timezone !== 'string') {
            json(response, 422, {
              clarification: 'Informe mensagem e fuso horário.',
            });
            return;
          }
          const parsed = parseBriefing(message, timezone);
          if (!parsed.ok) {
            json(response, 422, parsed);
            return;
          }
          const draftId = crypto.randomUUID();
          drafts.set(draftId, parsed.draft);
          json(response, 201, { draftId, confirmation: parsed.draft });
        })
        .catch((error: unknown) =>
          json(
            response,
            error instanceof BodyTooLargeError ? 413 : 400,
            error instanceof BodyTooLargeError
              ? { error: 'Corpo JSON excede 64 KiB.' }
              : { error: 'JSON inválido.' },
          ),
        );
      return;
    }
    const confirm = request.url?.match(
      /^\/api\/briefing-drafts\/([^/]+)\/confirm$/,
    );
    if (request.method === 'POST' && confirm) {
      const draft = drafts.get(confirm[1]);
      if (!draft) {
        json(response, 409, {
          error: 'Rascunho inexistente ou já confirmado.',
        });
        return;
      }
      drafts.delete(confirm[1]);
      json(response, 201, repository.create(draft));
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
  }).on('close', () => repository.close());
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
