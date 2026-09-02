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
    </main>
  </body>
</html>`;
}
