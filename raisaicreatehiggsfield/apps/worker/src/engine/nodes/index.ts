import { registerBasicNodes } from "./basic";
import { registerAiNodes } from "./ai-model";
import { registerHttpNode } from "./http";
import { registerLogicNodes } from "./logic";
import { registerMediaNodes } from "./media";
import { registerAgentNode } from "./agent";
import { registerMcpNode } from "./mcp";
import { registerStudioNodes } from "./ai-presets";
import { registerImageNodes } from "./image";

let registered = false;

/** Registers every built-in node once per isolate. */
export function registerBuiltinNodes(): void {
  if (registered) return;
  registerBasicNodes();
  registerAiNodes();
  registerStudioNodes();
  registerImageNodes();
  registerHttpNode();
  registerLogicNodes();
  registerMediaNodes();
  registerAgentNode();
  registerMcpNode();
  registered = true;
}
