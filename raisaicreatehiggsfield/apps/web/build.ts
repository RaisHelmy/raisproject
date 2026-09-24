/// <reference types="bun" />
import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const bootstrapDir = dirname(require.resolve("bootstrap/package.json"));
const iconsDir = dirname(require.resolve("bootstrap-icons/package.json"));

const watch = process.argv.includes("--watch");
const outdir = "dist";

async function build() {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  const result = await Bun.build({
    entrypoints: ["src/main.tsx"],
    outdir,
    target: "browser",
    // Code splitting keeps the first load small: the charts and the node canvas
    // are heavy and most sessions never open either (§114).
    splitting: true,
    minify: !watch,
    sourcemap: watch ? "inline" : "none",
    naming: { entry: "[name].[ext]", chunk: "chunks/[name]-[hash].[ext]" },
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("build failed");
  }
  await cp("public", outdir, { recursive: true });
  await cp(join(bootstrapDir, "dist/css/bootstrap.min.css"), `${outdir}/bootstrap.min.css`);
  await cp(join(iconsDir, "font"), `${outdir}/bootstrap-icons`, { recursive: true });
  console.log("web built");
}

await build();
if (watch) {
  const { watch: fsWatch } = await import("node:fs");
  fsWatch("src", { recursive: true }, () => build().catch((e) => console.error(e)));
}
