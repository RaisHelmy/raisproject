/**
 * Turns Cloudflare's model index into a catalog file.
 *
 * The index carries a name, an author, a task type, a description and whether
 * Cloudflare hosts the model. It carries no rates and no input schema, so
 * every model produced here lands at `discovered`: an admin sets the price,
 * runs a test generation, and only then can it be offered (CLAUDE.md §125).
 *
 *   bun scripts/parse-model-catalog.ts docs/cloudflare_models.MD
 */
import { readFileSync, writeFileSync } from "node:fs";

interface Entry {
  id: string;
  name: string;
  author: string;
  authorLabel: string;
  task: string;
  description: string;
  hosting: "workers-ai" | "third-party";
  badges: string[];
  docUrl: string;
}

const source = process.argv[2] ?? "docs/cloudflare_models.MD";
const out = process.argv[3] ?? "packages/seed-models/src/discovered.ts";

const TASKS = [
  "Text Generation", "Text-to-Image", "Image-to-Image", "Image-to-Video", "Text-to-Video",
  "Text-to-Speech", "Automatic Speech Recognition", "Text Embeddings", "Image Classification",
  "Object Detection", "Text Classification", "Translation", "Summarization", "Image-to-Text",
  "Music Generation", "video-to-video", "Image-Text-to-Text", "Voice Activity Detection",
] as const;

/**
 * Models the index lists that this platform cannot drive.
 *
 * A real-time voice model speaks over a websocket for the length of a
 * conversation. Our engine sends a request and stores a result, so listing one
 * would put a model in the catalog that could never be run.
 */
const UNSUPPORTED = new Set(["xai/grok-voice"]);

/**
 * The labels Cloudflare puts after each description. They run together with no
 * separator, so they are peeled off the end rather than matched as a group.
 * Longest first, so "Function calling" wins over nothing and "Real-time" is
 * never split.
 */
const BADGES = [
  "Zero data retention", "Cloudflare-hosted", "Function calling", "Third-party",
  "Real-time", "Deprecated", "Reasoning", "Partner", "Vision", "Batch", "LoRA",
] as const;

const entries: Entry[] = [];
const seen = new Set<string>();

for (const line of readFileSync(source, "utf8").split("\n")) {
  if (!line.startsWith("[![")) continue;

  const urlMatch = line.match(/\((https:\/\/developers\.cloudflare\.com\/ai\/models\/([^)]+?))\/?\)\s*$/);
  if (!urlMatch) continue;
  const docUrl = `${urlMatch[1]}/`;
  const path = urlMatch[2]!;

  // Cloudflare-hosted models carry their real id in the path: @cf/author/name.
  // Third-party ones are author/name, which is how the gateway addresses them.
  const id = path;
  const [authorPart, name] = path.split("/").slice(-2);
  if (!name || !authorPart) continue;
  if (seen.has(id) || UNSUPPORTED.has(id)) continue;

  const body = line.slice(line.indexOf(")", line.indexOf("](")) + 1);
  const task = TASKS.find((t) => body.includes(t));
  if (!task) continue;

  const beforeTask = body.slice(0, body.indexOf(task));
  const afterTask = body.slice(body.indexOf(task) + task.length);

  // "<name><Author Label>" sits before the task type.
  const displayName = name;
  const authorLabel = beforeTask.startsWith(name) ? beforeTask.slice(name.length) : authorPart.replace(/^@cf\//, "");

  // The line ends with "<description><badges>](<url>)". Cut the link first,
  // then peel badges off the end one at a time: they run together with no
  // separator, so a single pass leaves the inner ones behind.
  let rest = afterTask.replace(/\]\(https:\/\/[^)]*\)\s*$/, "");
  const badges: string[] = [];
  for (;;) {
    const badge = BADGES.find((b) => rest.endsWith(b));
    if (!badge) break;
    badges.unshift(badge);
    rest = rest.slice(0, -badge.length);
  }
  const description = rest.replace(/\\([[\]])/g, "$1").trim();

  seen.add(id);
  entries.push({
    id,
    name: displayName,
    author: authorPart.replace(/^@cf\//, ""),
    authorLabel: authorLabel.trim() || authorPart,
    task,
    description,
    hosting: badges.includes("Cloudflare-hosted") ? "workers-ai" : "third-party",
    badges,
    docUrl,
  });
}

/** Task type to the category and capabilities the UI drives itself from (§9). */
function shape(
  task: string,
  description: string,
  badges: string[] = [],
): { category: string; task: string; capabilities: string[] } {
  const d = description.toLowerCase();
  const extra: string[] = [];
  // A badge is Cloudflare's own statement about the model, so it is trusted
  // ahead of anything guessed from the prose.
  if (badges.includes("Function calling")) extra.push("tool-calling");
  if (badges.includes("Vision")) extra.push("vision");
  if (badges.includes("Batch")) extra.push("async-job");
  if (/negative prompt/.test(d)) extra.push("negative-prompt");
  if (/\bseed\b/.test(d)) extra.push("seed");
  if (/aspect ratio/.test(d)) extra.push("aspect-ratio");
  if (/resolution|720p|1080p|480p/.test(d)) extra.push("resolution");
  if (/duration|\bseconds\b|\d+-\d+s\b/.test(d)) extra.push("duration");
  if (/tool use|tool call|function calling|agent/.test(d)) extra.push("tool-calling");
  if (/vision|image understanding|understands? images|multimodal/.test(d)) extra.push("vision");

  switch (task) {
    case "Text Generation":
      return { category: "text", task: "text-generation", capabilities: ["text-generation", "streaming", ...extra] };
    case "Text-to-Image":
      return { category: "image", task: "text-to-image", capabilities: ["text-to-image", ...extra] };
    case "Image-to-Image":
      return { category: "image", task: "image-to-image", capabilities: ["image-to-image", "image-input", ...extra] };
    case "Image-to-Video":
      return { category: "video", task: "image-to-video", capabilities: ["image-to-video", "image-input", "async-job", ...extra] };
    case "Text-to-Video":
      return { category: "video", task: "text-to-video", capabilities: ["text-to-video", "async-job", ...extra] };
    case "Text-to-Speech":
      return { category: "audio", task: "text-to-speech", capabilities: ["text-to-speech", "audio-output", ...extra] };
    case "Automatic Speech Recognition":
      return { category: "audio", task: "speech-to-text", capabilities: ["speech-to-text", ...extra] };
    case "Music Generation":
      return { category: "audio", task: "music", capabilities: ["music", "audio-output", "async-job", ...extra] };
    case "video-to-video":
      return { category: "video", task: "video-to-video", capabilities: ["async-job", ...extra] };
    case "Image-Text-to-Text":
      return { category: "vision", task: "vision", capabilities: ["vision", "image-input", "text-generation", ...extra] };
    case "Voice Activity Detection":
      return { category: "utility", task: "voice-activity-detection", capabilities: [] };
    case "Text Embeddings":
      return { category: "embedding", task: "embedding", capabilities: ["embedding"] };
    case "Image-to-Text":
    case "Image Classification":
    case "Object Detection":
      return { category: "vision", task: task.toLowerCase().replace(/ /g, "-"), capabilities: ["vision", "image-input"] };
    default:
      return { category: "utility", task: task.toLowerCase().replace(/ /g, "-"), capabilities: [] };
  }
}

/** Inputs and outputs follow from the task, since the index publishes no schema. */
function ports(category: string, task: string): { inputs: Record<string, string>; outputs: Record<string, string> } {
  if (task === "text-to-image") return { inputs: { prompt: "prompt" }, outputs: { image: "image" } };
  if (task === "image-to-image") return { inputs: { prompt: "prompt", image: "image" }, outputs: { image: "image" } };
  if (task === "text-to-video") return { inputs: { prompt: "prompt" }, outputs: { video: "video" } };
  if (task === "image-to-video") return { inputs: { prompt: "prompt", image: "image" }, outputs: { video: "video" } };
  if (task === "text-to-speech") return { inputs: { text: "text" }, outputs: { audio: "audio" } };
  if (task === "speech-to-text") return { inputs: { audio: "audio" }, outputs: { text: "text" } };
  if (task === "embedding") return { inputs: { text: "text" }, outputs: { json: "json" } };
  if (task === "music") return { inputs: { prompt: "prompt" }, outputs: { audio: "audio" } };
  if (task === "video-to-video") return { inputs: { video: "video" }, outputs: { video: "video" } };
  if (task === "voice-activity-detection") return { inputs: { audio: "audio" }, outputs: { json: "json" } };
  if (category === "vision") return { inputs: { image: "image" }, outputs: { text: "text" } };
  return { inputs: { prompt: "prompt" }, outputs: { text: "text" } };
}

function title(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => (/^\d/.test(part) || part.length <= 3 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

const models = entries
  .map((entry, index) => {
    const s = shape(entry.task, entry.description, entry.badges);
    const p = ports(s.category, s.task);
    return {
      id: entry.id,
      provider: "cloudflare",
      hosting: entry.hosting,
      displayName: `${title(entry.name)} (${entry.authorLabel})`,
      description: entry.description,
      category: s.category,
      task: s.task,
      capabilities: [...new Set(s.capabilities)],
      inputs: p.inputs,
      outputs: p.outputs,
      parameters: [],
      limits: {},
      // Cloudflare says this one is on its way out; it must not be offered
      // to anyone as something new.
      status: entry.badges.includes("Deprecated") ? "deprecated" : "discovered",
      tags: [],
      docUrl: entry.docUrl,
      version: "1",
      sortOrder: 1000 + index,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const file = `// Generated by scripts/parse-model-catalog.ts from docs/cloudflare_models.MD.
// Do not edit by hand: re-run the script when the catalog changes.
//
// Every model here is \`discovered\`. Cloudflare's index publishes no rates and
// no input schema, so nothing in this file may be offered to a customer until
// an admin has priced it and a test generation has passed (CLAUDE.md §125).
import type { ModelDefinition } from "@raisai/shared";

export const DISCOVERED_MODELS: ModelDefinition[] = ${JSON.stringify(models, null, 2)} as ModelDefinition[];
`;

writeFileSync(out, file);
console.log(`${models.length} models written to ${out}`);
const byCategory = models.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.category]: (acc[m.category] ?? 0) + 1 }), {});
console.log(byCategory);
