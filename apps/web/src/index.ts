export function renderHealthPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tatu Health</title>
    <style>
      :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #14100d; color: #fff8ef; }
      body { display: grid; min-block-size: 100vh; margin: 0; place-items: center; padding: 1.5rem; }
      main { background: #241b16; border: 1px solid #604a3b; border-radius: 1rem; max-width: 38rem; padding: 2rem; width: min(100%, 38rem); }
      .status { color: #8de0a7; font-weight: 700; }
      code { background: #372a22; border-radius: .3rem; padding: .15rem .3rem; }
    </style>
  </head>
  <body>
    <main>
      <p class="status">● Healthy</p>
      <h1>Tatu Health</h1>
      <p>The technical foundation is running.</p>
      <p>Machine-readable status: <code>/api/health</code></p>
      <section aria-labelledby="chat-title"><h2 id="chat-title">Chat</h2><label for="message">Pedido diário</label><textarea id="message">Todos os dias às 8h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.</textarea><button id="draft">Preparar confirmação</button><p id="result" aria-live="polite"></p><button id="confirm" hidden>Confirmar tarefa</button></section>
      <section aria-labelledby="tasks-title"><h2 id="tasks-title">Tasks</h2><p>Entrega solicitada; a execução ainda não foi implementada.</p><ul id="tasks"></ul></section>
    </main>
    <script>
      let draftId;
      const result = document.querySelector('#result'); const confirm = document.querySelector('#confirm');
      async function tasks() { const items = await fetch('/api/tasks').then(r => r.json()); document.querySelector('#tasks').innerHTML = items.map(t => '<li>' + t.time + ' — ' + t.quantity + ' notícias sobre ' + t.topic + ' (' + t.timezone + ')</li>').join(''); }
      document.querySelector('#draft').onclick = async () => { const response = await fetch('/api/briefing-drafts', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({message: document.querySelector('#message').value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone}) }); const body = await response.json(); if (!response.ok) { result.textContent = body.clarification; confirm.hidden = true; return; } draftId = body.draftId; result.textContent = 'Confirme a tarefa diária às ' + body.confirmation.time + '.'; confirm.hidden = false; };
      confirm.onclick = async () => { const response = await fetch('/api/briefing-drafts/' + draftId + '/confirm', {method:'POST'}); if (response.ok) { result.textContent = 'Tarefa confirmada.'; confirm.hidden = true; tasks(); } };
      tasks();
    </script>
  </body>
</html>`;
}
