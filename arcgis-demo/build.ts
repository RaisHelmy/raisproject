import { rm, cp, mkdir } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/main.js"],
  outdir: "dist/assets",
  minify: true,
  target: "browser",
  naming: "[name].js",
});
if (!result.success) {
  for (const l of result.logs) console.error(l);
  process.exit(1);
}
console.log("built dist/ with", result.outputs.length, "bundle(s)");
