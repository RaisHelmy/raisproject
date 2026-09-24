/**
 * Demo mode seeds itself in-memory on boot (see packages/providers/src/demo/seed.ts) —
 * there is nothing to run here for local development. This script is the hook
 * point for seeding a real D1 database once production mode is wired up.
 */
console.log("Demo mode seeds itself automatically when the API starts (RunForge.tick/DemoWorld).");
console.log("Nothing to do for `bun db:seed` in demo mode.");
