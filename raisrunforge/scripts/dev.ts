/**
 * `bun dev` — runs the API (Bun HTTP server, demo mode) and the web app
 * (Vite) together, so the whole RunForge control plane comes up with one
 * command. Ctrl+C stops both.
 */
const procs = [
  Bun.spawn(["bun", "run", "--cwd", "apps/api", "dev"], { stdout: "inherit", stderr: "inherit", stdin: "inherit" }),
  Bun.spawn(["bun", "run", "--cwd", "apps/web", "dev"], { stdout: "inherit", stderr: "inherit", stdin: "inherit" }),
];

function shutdown() {
  for (const p of procs) p.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.race(procs.map((p) => p.exited));
shutdown();
