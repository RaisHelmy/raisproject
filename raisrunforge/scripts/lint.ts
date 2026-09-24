/**
 * Minimal lint gate for the scaffold: runs typecheck across every workspace.
 * Swap in ESLint/Biome here once the project settles on one.
 */
const proc = Bun.spawn(["bun", "run", "typecheck"], { stdout: "inherit", stderr: "inherit" });
process.exit(await proc.exited);
