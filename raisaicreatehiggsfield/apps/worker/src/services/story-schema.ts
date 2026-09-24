import { z } from "zod";

/**
 * The shape a story must come back in.
 *
 * An LLM writes prose by default; this forces it into addressable pieces so a
 * single scene or shot can be edited and regenerated without touching the rest
 * (§32). Anything that does not parse is rejected rather than half-imported.
 */
export const storySchema = z.object({
  title: z.string().min(1),
  logline: z.string().min(1),
  synopsis: z.string().min(1),
  visualStyle: z.string().default(""),
  characters: z
    .array(
      z.object({
        name: z.string().min(1),
        age: z.string().optional(),
        description: z.string().default(""),
        appearance: z.string().default(""),
        personality: z.string().default(""),
      }),
    )
    .default([]),
  locations: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().default(""),
        lighting: z.string().default(""),
      }),
    )
    .default([]),
  scenes: z
    .array(
      z.object({
        number: z.number().int().positive(),
        title: z.string().min(1),
        location: z.string().default(""),
        timeOfDay: z.string().default(""),
        characters: z.array(z.string()).default([]),
        action: z.string().default(""),
        dialogue: z
          .array(z.object({ character: z.string(), line: z.string() }))
          .default([]),
        shots: z
          .array(
            z.object({
              number: z.number().int().positive(),
              shotType: z.string().default("medium"),
              cameraMovement: z.string().default("static"),
              description: z.string().min(1),
              durationSeconds: z.number().positive().max(30).default(4),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
});

export type Story = z.infer<typeof storySchema>;

/** The instruction sent to the model, kept beside the schema it must satisfy. */
export function storyPrompt(idea: string, targetDurationSeconds: number): string {
  const sceneCount = Math.max(2, Math.min(12, Math.round(targetDurationSeconds / 45)));
  return [
    "You are a film development assistant. Turn the idea below into a structured treatment.",
    "",
    `Idea: ${idea}`,
    `Target length: about ${Math.round(targetDurationSeconds / 60)} minutes, roughly ${sceneCount} scenes.`,
    "",
    "Reply with JSON only, no prose around it, matching exactly this shape:",
    JSON.stringify(
      {
        title: "string",
        logline: "one sentence",
        synopsis: "a paragraph",
        visualStyle: "how it should look",
        characters: [{ name: "string", age: "string", description: "string", appearance: "string", personality: "string" }],
        locations: [{ name: "string", description: "string", lighting: "string" }],
        scenes: [
          {
            number: 1,
            title: "string",
            location: "must match a location name above",
            timeOfDay: "string",
            characters: ["must match character names above"],
            action: "what happens",
            dialogue: [{ character: "name", line: "what they say" }],
            shots: [
              { number: 1, shotType: "wide|medium|close-up|tracking", cameraMovement: "string", description: "what the camera sees", durationSeconds: 4 },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "",
    "Every scene needs at least two shots. Shot descriptions must be visual: describe what is seen, not what is felt.",
  ].join("\n");
}

/** Pulls the JSON object out of a reply that may be wrapped in prose or fences. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    // Fall back to the outermost braces, which survives a chatty preamble.
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
