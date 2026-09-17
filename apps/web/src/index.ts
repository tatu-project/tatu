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
      .health-list { display: grid; gap: .6rem; list-style: none; padding: 0; }
      .health-item { background: #2d211b; border: 1px solid #604a3b; border-radius: .6rem; padding: .65rem .8rem; }
      .health-label { font-weight: 700; }
      .health-state { float: right; font-size: .85rem; text-transform: uppercase; }
      .health-state-ready, .health-state-configured { color: #8de0a7; }
      .health-state-disabled, .health-state-unknown, .health-state-not-implemented { color: #f0c674; }
      .health-state-unavailable { color: #f08d8d; }
      .health-detail { color: #dfc8b5; display: block; font-size: .85rem; margin-top: .2rem; }
    </style>
  </head>
  <body>
    <main>
      <p class="status">● Healthy</p>
      <h1>Tatu Health</h1>
      <p>The technical foundation is running.</p>
      <p>Machine-readable status: <code>/api/health</code></p>
      <section aria-labelledby="setup-health-title"><h2 id="setup-health-title">Setup Health</h2><p id="setup-health-status" class="muted" aria-live="polite">Loading setup health…</p><ul id="setup-health" class="health-list" aria-label="Setup health checks"></ul><p id="setup-next" class="muted"></p></section>
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
      const setupHealthList = document.querySelector('#setup-health');
      const setupHealthStatus = document.querySelector('#setup-health-status');
      const setupNext = document.querySelector('#setup-next');
      const manualKeys = new Map();

      function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
      function appendText(parent, tag, value, className) { const child = document.createElement(tag); child.textContent = String(value); if (className) child.className = className; parent.append(child); return child; }
      function safeDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'horário indisponível' : date.toLocaleString(); }
      function safeDetail(value) { return typeof value === 'string' ? value.replace(/[\t\r\n]+/g, ' ').slice(0, 160) : ''; }

      const setupLabels = {agent: 'Agent online', storage: 'Storage online', 'ai-route': 'AI route available', research: 'Web research available', memory: 'Memory online', scheduler: 'Scheduler online'};
      const setupStates = {healthy: 'ready', configured: 'configured', disabled: 'disabled', unknown: 'unknown', not_implemented: 'not implemented', unavailable: 'unavailable'};
      function safeSetupHealth(value) {
        if (!value || typeof value !== 'object' || !Array.isArray(value.checks) || !value.estimatedCost || typeof value.estimatedCost !== 'object' || value.estimatedCost.status !== 'unknown') return null;
        const checks = value.checks.map((check) => {
          if (!check || typeof check !== 'object' || !Object.hasOwn(setupLabels, check.id) || !Object.hasOwn(setupStates, check.state) || typeof check.detail !== 'string') return null;
          return {id: check.id, label: setupLabels[check.id], state: setupStates[check.state], detail: safeDetail(check.detail)};
        }).filter(Boolean);
        if (checks.length !== Object.keys(setupLabels).length) return null;
        const nextTask = value.nextTask && typeof value.nextTask === 'object' && /^\\d{2}:\\d{2}$/u.test(value.nextTask.time) && typeof value.nextTask.timezone === 'string' && value.nextTask.timezone.length > 0 && value.nextTask.timezone.length <= 64 ? value.nextTask : null;
        return {checks, nextTask};
      }

      async function loadSetupHealth() {
        setupHealthStatus.textContent = 'Loading setup health…';
        clear(setupHealthList);
        try {
          const response = await fetch('/api/setup-health');
          if (!response.ok) throw new Error('setup-health');
          const health = safeSetupHealth(await response.json());
          if (!health) throw new Error('invalid-setup-health');
          setupHealthStatus.textContent = '';
          health.checks.forEach((check) => {
            const item = document.createElement('li'); item.className = 'health-item';
            appendText(item, 'span', check.label, 'health-label');
            appendText(item, 'span', check.state, 'health-state health-state-' + check.state.replace(/ /g, '-'));
            appendText(item, 'span', check.detail, 'health-detail');
            setupHealthList.append(item);
          });
          appendText(setupHealthList, 'li', 'Estimated cost: unknown', 'health-item');
          setupNext.textContent = health.nextTask ? 'Next task: ' + health.nextTask.time + ' (' + health.nextTask.timezone + ')' : 'Next task: not configured';
        } catch { setupHealthStatus.textContent = 'Setup health is unavailable.'; setupNext.textContent = ''; }
      }

      async function testTask(taskId, button, status) {
        const key = manualKeys.get(taskId) ?? crypto.randomUUID();
        manualKeys.set(taskId, key);
        button.disabled = true;
        status.textContent = 'Enfileirando teste…';
        try {
          const response = await fetch('/api/tasks/' + encodeURIComponent(taskId) + '/test', {method:'POST', headers:{'Idempotency-Key': key}});
          const body = await response.json();
          if (!response.ok || !body || typeof body.id !== 'string') throw new Error('manual-test');
          status.textContent = 'Teste enfileirado.';
          await executions();
        } catch { status.textContent = 'Não foi possível iniciar o teste.'; }
        finally { button.disabled = false; }
      }

      async function tasks() {
        clear(taskList);
        try {
          const response = await fetch('/api/tasks');
          if (!response.ok) throw new Error('tasks');
          const items = await response.json();
          if (!Array.isArray(items) || items.length === 0) { appendText(taskList, 'li', 'Nenhuma tarefa confirmada.', 'muted'); return; }
          items.forEach((task) => {
            const item = document.createElement('li');
            appendText(item, 'span', task.time + ' — ' + task.quantity + ' notícias sobre ' + task.topic + ' (' + task.timezone + ')');
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Testar agora';
            button.setAttribute('aria-label', 'Testar tarefa agora');
            const status = document.createElement('span');
            status.className = 'muted';
            status.setAttribute('aria-live', 'polite');
            button.onclick = () => testTask(task.id, button, status);
            item.append(button, status);
            taskList.append(item);
          });
        } catch { appendText(taskList, 'li', 'Não foi possível carregar as tarefas.', 'muted'); }
      }

      async function eventsFor(execution) {
        const response = await fetch('/api/executions/' + encodeURIComponent(execution.id) + '/events');
        if (!response.ok) throw new Error('events');
        const events = await response.json();
        return Array.isArray(events) ? events : [];
      }

      async function briefingFor(execution) {
        const response = await fetch('/api/executions/' + encodeURIComponent(execution.id) + '/briefing');
        if (!response.ok) throw new Error('briefing');
        return response.json();
      }

      function safeObservability(value) {
        if (!value || typeof value !== 'object') return null;
        const allowedProviders = ['public-rss', 'local-ollama'];
        const allowedTools = ['public-rss', 'local-ollama', 'file-outbox'];
        const provider = value.provider;
        const model = value.model;
        const tools = value.tools;
        const latencyMs = value.latencyMs;
        const estimatedCost = value.estimatedCost;
        if (Object.keys(value).length !== 5 || !allowedProviders.includes(provider) || (model !== null && (typeof model !== 'string' || model.length === 0 || model.length > 128 || /[\\u0000-\\u001f\\u007f]/u.test(model))) || !Array.isArray(tools) || tools.length < 1 || tools.length > 3 || new Set(tools).size !== tools.length || !tools.includes('public-rss') || tools.some((tool) => !allowedTools.includes(tool)) || (provider === 'local-ollama' && (model === null || !tools.includes('local-ollama'))) || (provider === 'public-rss' && model !== null) || !Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 86400000 || !Number.isInteger(latencyMs) || !estimatedCost || typeof estimatedCost !== 'object' || Object.keys(estimatedCost).length !== 1 || estimatedCost.status !== 'unknown') return null;
        return {provider, model, tools, latencyMs};
      }

      function safeFallback(value) {
        return value && typeof value === 'object' && value.from === 'local-ollama' && ['model_unavailable', 'model_invalid_output', 'model_timeout'].includes(value.reason) ? value.reason : null;
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
            try {
              const briefing = await briefingFor(execution);
              const metadata = document.createElement('div'); metadata.className = 'execution-meta';
              const observability = safeObservability(briefing.observability);
              if (observability) {
                appendText(metadata, 'p', 'Provider: ' + observability.provider);
                appendText(metadata, 'p', 'Model: ' + (observability.model ?? 'none'));
                appendText(metadata, 'p', 'Tools: ' + observability.tools.join(', '));
                appendText(metadata, 'p', 'Measured latency: ' + String(observability.latencyMs) + ' ms');
                appendText(metadata, 'p', 'Estimated cost: unknown');
              }
              const fallback = safeFallback(briefing.fallback);
              if (fallback) appendText(metadata, 'p', 'Fallback: ' + fallback);
              if (metadata.childNodes.length > 0) details.append(metadata);
            } catch { appendText(details, 'p', 'Briefing metadata indisponível.', 'muted'); }
            executionList.append(item);
          }
        } catch { executionStatus.textContent = 'Não foi possível carregar as execuções.'; }
      }

      document.querySelector('#draft').onclick = async () => { const response = await fetch('/api/briefing-drafts', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({message: document.querySelector('#message').value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone}) }); const body = await response.json(); if (!response.ok) { result.textContent = body.clarification; confirm.hidden = true; return; } draftId = body.draftId; result.textContent = 'Confirme a tarefa diária às ' + body.confirmation.time + '.'; confirm.hidden = false; };
      confirm.onclick = async () => { const response = await fetch('/api/briefing-drafts/' + draftId + '/confirm', {method:'POST'}); if (response.ok) { result.textContent = 'Tarefa confirmada.'; confirm.hidden = true; tasks(); executions(); } };
      loadSetupHealth();
      tasks();
      executions();
    </script>
  </body>
</html>`;
}
