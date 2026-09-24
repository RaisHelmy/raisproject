export const PORT_TYPES = [
  "string", "number", "boolean", "json", "image", "image[]", "video", "audio",
  "file", "text", "prompt", "model", "array", "object", "any",
] as const;
export type PortType = (typeof PORT_TYPES)[number];

/** Directed compatibility: can a value of `from` be connected to an input of `to`? */
const COMPAT: Partial<Record<PortType, PortType[]>> = {
  string: ["string", "text", "prompt", "any"],
  text: ["text", "string", "prompt", "any"],
  prompt: ["prompt", "text", "string", "any"],
  number: ["number", "any"],
  boolean: ["boolean", "any"],
  json: ["json", "object", "array", "any"],
  object: ["object", "json", "any"],
  array: ["array", "json", "any"],
  image: ["image", "image[]", "any"],
  "image[]": ["image[]", "array", "any"],
  video: ["video", "any"],
  audio: ["audio", "any"],
  file: ["file", "any"],
  model: ["model", "any"],
  any: [...PORT_TYPES],
};

export function isPortCompatible(from: PortType, to: PortType): boolean {
  if (to === "any") return true;
  return (COMPAT[from] ?? []).includes(to);
}
