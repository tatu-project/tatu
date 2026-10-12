const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="120" fill="#dcebc9"/><path d="M92 309c0-107 81-174 173-174 82 0 151 59 151 134v40H92Z" fill="#45634b"/><path d="M121 310c0-83 52-143 115-161m-62 160c0-78 43-137 104-169m-50 169c0-73 37-123 91-155m-33 155c0-56 29-101 70-128" fill="none" stroke="#b5cd97" stroke-width="17" stroke-linecap="round"/><path d="M329 264c-2-32 16-57 42-57 33 0 61 34 77 75l-19 28h-89Z" fill="#c9dcad"/><path d="m365 219-3-43 27 22" fill="#c9dcad"/><circle cx="406" cy="267" r="7" fill="#263d31"/><path d="m439 285 15 3-12 11" fill="#263d31"/><path d="M128 304v37h33v-37m145 0v37h33v-37" fill="#45634b"/><path d="m93 291-42 24 42-3" fill="#45634b"/><path d="M90 371h338" stroke="#b5cd97" stroke-width="8" stroke-linecap="round"/></svg>`;
const offline = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#263d31"><title>Tatu · Offline</title><style>body{font:16px system-ui;background:#f7f8f3;color:#263d31;margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:380px;padding:32px;text-align:center}img{width:90px}p{line-height:1.7}a{display:inline-block;color:inherit;padding:12px;border:1px solid #b5cd97;border-radius:12px}</style><main><img src="/icon.svg" alt="Tatu"><h1>Vamos nos reconectar.</h1><p>O Tatu está offline. Seus dados pessoais não ficam no cache deste aplicativo e nenhuma ação será enfileirada.</p><p>Confira a conexão e se o serviço online está disponível.</p><a href="/">Tentar novamente</a></main></html>`;

/** Cache only a neutral offline page and icon; navigation/API/writes stay network-only. */
export const serviceWorkerScript = String.raw`
'use strict';
const cacheName='tatu-neutral-v1';
const staticPaths=['/offline.html','/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(staticPaths)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('tatu-neutral-')&&key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(url.origin!==self.location.origin||request.method!=='GET')return;if(staticPaths.includes(url.pathname)&&!url.search){event.respondWith(caches.open(cacheName).then(cache=>cache.match(request)).then(cached=>cached||fetch(request,{cache:'no-store'})));return;}if(request.mode==='navigate'){event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.open(cacheName).then(cache=>cache.match('/offline.html'))));}});
`;

export const pwaAssets: Readonly<
  Record<string, { contentType: string; body: string }>
> = Object.freeze({
  '/manifest.webmanifest': {
    contentType: 'application/manifest+json; charset=utf-8',
    body: JSON.stringify({
      id: '/',
      name: 'Tatu · Assistente pessoal',
      short_name: 'Tatu',
      lang: 'pt-BR',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#f7f8f3',
      theme_color: '#263d31',
      icons: [
        {
          src: '/icon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        },
      ],
    }),
  },
  '/icon.svg': { contentType: 'image/svg+xml; charset=utf-8', body: icon },
  '/sw.js': {
    contentType: 'text/javascript; charset=utf-8',
    body: serviceWorkerScript,
  },
  '/offline.html': { contentType: 'text/html; charset=utf-8', body: offline },
});
