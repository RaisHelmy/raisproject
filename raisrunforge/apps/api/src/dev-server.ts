import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT ?? 8787);

console.log(`RunForge API (demo mode) listening on http://localhost:${port}`);
Bun.serve({ port, fetch: app.fetch });
