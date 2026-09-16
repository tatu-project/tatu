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
      main { background: #241b16; border: 1px solid #604a3b; border-radius: 1rem; max-width: 42rem; padding: 2rem; width: min(100%, 42rem); }
      .status { color: #8de0a7; font-weight: 700; }
      code { background: #372a22; border-radius: .3rem; padding: .15rem .3rem; }
      section { border-top: 1px solid #604a3b; margin-top: 1.5rem; padding-top: 1.5rem; }
      textarea { box-sizing: border-box; display: block; margin: .5rem 0; min-height: 6rem; padding: .5rem; width: 100%; }
      button { cursor: pointer; margin-right: .5rem; padding: .45rem .7rem; }
      ul, ol { padding-left: 1.25rem; }
      .execution { background: #2d211b; border: 1px solid #604a3b; border-radius: .6rem; margin: .75rem 0; padding: .75rem 1rem; }
      .execution summary { cursor: pointer; font-weight: 700; }
      .execution-meta { color: #dfc8b5; font-size: .9rem; margin: .5rem 0; }
      .timeline { border-left: 2px solid #80624e; list-style: none; margin: .75rem 0 0 .35rem; padding-left: 1rem; }
      .timeline li { margin: .7rem 0; position: relative; }
      .timeline li::before { background: #8de0a7; border-radius: 50%; content: ''; height: .55rem; left: -1.35rem; position: absolute; top: .3rem; width: .55rem; }
      .event-type { font-weight: 700; }
      .event-at { color: #dfc8b5; font-size: .85rem; margin-left: .4rem; }
      .event-detail { color: #dfc8b5; display: block; font-size: .85rem; margin-top: .15rem; }
      .muted { color: #dfc8b5; }
    </style>
  </head>
  <body>
    <main>
      <p class="status">● Healthy</p>
      <h1>Tatu Health</h1>
      <p>The technical foundation is running.</p>
      <p>Machine-readable status: <code>/api/health</code></p>
      <section aria-labelledby="chat-title"><h2 id="chat-title">Chat</h2><label for="message">Pedido diário</label><textarea id="message">Todos os dias às 8h, encontre as três notícias mais importantes sobre inteligência artificial e me envie.</textarea><button id="draft">Preparar confirmação</button><p id="result" aria-live="polite"></p><button id="confirm" hidden>Confirmar tarefa</button></section>
      <section aria-labelledby="tasks-title"><h2 id="tasks-title">Tasks</h2><p>As tarefas confirmadas permanecem salvas para execução agendada.</p><ul id="tasks"></ul></section>
      <section aria-labelledby="executions-title"><h2 id="executions-title">Execution timeline</h2><p id="executions-status" class="muted" aria-live="polite">Carregando execuções…</p><ul id="executions" aria-label="Execution history"></ul></section>
    </main>
    <script>
      let draftId;
      const result = document.querySelector('#result');
      const confirm = document.querySelector('#confirm');
      const taskList = document.querySelector('#tasks');
      const executionList = document.querySelector('#executions');
      const executionStatus = document.querySelector('#executions-status');

      function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
      function appendText(parent, tag, value, className) { const child = document.createElement(tag); child.textContent = String(value); if (className) child.className = className; parent.append(child); return child; }
      function safeDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'horário indisponível' : date.toLocaleString(); }
      function safeDetail(value) { return typeof value === 'string' ? value.replace(/[\t\r\n]+/g, ' ').slice(0, 160) : ''; }

      async function tasks() {
        clear(taskList);
        try {
          const response = await fetch('/api/tasks');
          if (!response.ok) throw new Error('tasks');
          const items = await response.json();
          if (!Array.isArray(items) || items.length === 0) { appendText(taskList, 'li', 'Nenhuma tarefa confirmada.', 'muted'); return; }
          items.forEach((task) => appendText(taskList, 'li', task.time + ' — ' + task.quantity + ' notícias sobre ' + task.topic + ' (' + task.timezone + ')'));
        } catch { appendText(taskList, 'li', 'Não foi possível carregar as tarefas.', 'muted'); }
      }

      async function eventsFor(execution) {
        const response = await fetch('/api/executions/' + encodeURIComponent(execution.id) + '/events');
        if (!response.ok) throw new Error('events');
        const events = await response.json();
        return Array.isArray(events) ? events : [];
      }

      async function executions() {
        clear(executionList);
        executionStatus.textContent = 'Carregando execuções…';
        try {
          const response = await fetch('/api/executions');
          if (!response.ok) throw new Error('executions');
          const items = await response.json();
          if (!Array.isArray(items) || items.length === 0) { executionStatus.textContent = 'Nenhuma execução registrada.'; return; }
          executionStatus.textContent = '';
          for (const execution of items) {
            const item = document.createElement('li'); item.className = 'execution';
            const details = document.createElement('details'); details.open = true; item.append(details);
            const summary = document.createElement('summary'); summary.textContent = String(execution.status ?? 'status indisponível') + ' — ' + safeDate(execution.scheduledFor); details.append(summary);
            appendText(details, 'p', 'Tentativa ' + String(execution.attempt ?? '?') + ' de ' + String(execution.maxAttempts ?? '?'), 'execution-meta');
            if (execution.failure) appendText(details, 'p', 'Falha: ' + String(execution.failure), 'execution-meta');
            const timeline = document.createElement('ol'); timeline.className = 'timeline'; timeline.setAttribute('aria-label', 'Execution events'); details.append(timeline);
            try {
              const events = await eventsFor(execution);
              if (events.length === 0) appendText(timeline, 'li', 'Nenhum evento registrado.', 'muted');
              events.forEach((event) => {
                const line = document.createElement('li');
                appendText(line, 'span', event.type ?? 'evento', 'event-type');
                appendText(line, 'time', safeDate(event.at), 'event-at');
                const detail = safeDetail(event.detail); if (detail) appendText(line, 'span', detail, 'event-detail');
                timeline.append(line);
              });
            } catch { appendText(timeline, 'li', 'Timeline indisponível.', 'muted'); }
            executionList.append(item);
          }
        } catch { executionStatus.textContent = 'Não foi possível carregar as execuções.'; }
      }

      document.querySelector('#draft').onclick = async () => { const response = await fetch('/api/briefing-drafts', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({message: document.querySelector('#message').value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone}) }); const body = await response.json(); if (!response.ok) { result.textContent = body.clarification; confirm.hidden = true; return; } draftId = body.draftId; result.textContent = 'Confirme a tarefa diária às ' + body.confirmation.time + '.'; confirm.hidden = false; };
      confirm.onclick = async () => { const response = await fetch('/api/briefing-drafts/' + draftId + '/confirm', {method:'POST'}); if (response.ok) { result.textContent = 'Tarefa confirmada.'; confirm.hidden = true; tasks(); executions(); } };
      tasks();
      executions();
    </script>
  </body>
</html>`;
}
