/**
 * A stand-in for the AI binding used by the browser smoke test, so the run
 * exercises the whole stack without calling a real model or spending money.
 * Enabled only when APP_ENV is "e2e".
 */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const STUB_STORY = {
  title: "Neon Rain",
  logline: "A detective chases a ghost through a flooded city.",
  synopsis: "A tired detective takes one last case.",
  visualStyle: "wet neon, deep shadows",
  characters: [{ name: "Aiman", age: "32", description: "A tired detective", appearance: "grey coat", personality: "dogged" }],
  locations: [{ name: "Night Market", description: "Steam and neon", lighting: "hard neon" }],
  scenes: [
    {
      number: 1,
      title: "The Call",
      location: "Night Market",
      timeOfDay: "night",
      characters: ["Aiman"],
      action: "Aiman takes a call he does not want.",
      dialogue: [{ character: "Aiman", line: "I already told you no." }],
      shots: [
        { number: 1, shotType: "wide", cameraMovement: "static", description: "Rain over the night market", durationSeconds: 5 },
        { number: 2, shotType: "close-up", cameraMovement: "push in", description: "A face lit by a phone", durationSeconds: 3 },
      ],
    },
  ],
};

export function createStubAI(): Ai {
  return {
    run: async (model: string) => {
      if (model.includes("melotts") || model.includes("aura")) return { audio: PNG_BASE64 };
      if (model.includes("whisper")) return { text: "stub transcription" };
      if (model.includes("llama") || model.includes("gemma")) {
        // Movie mode asks for a story as JSON, so the stub answers in that shape.
        return { response: JSON.stringify(STUB_STORY), usage: { prompt_tokens: 40, completion_tokens: 400 } };
      }
      return { image: PNG_BASE64 };
    },
  } as unknown as Ai;
}
