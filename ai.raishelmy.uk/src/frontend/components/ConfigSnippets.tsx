import { useState } from "react";

const BASE = `${location.origin}/v1`;
const TABS = ["Environment", "cURL", "Python", "Node.js", "OpenAI SDK"] as const;

export function ConfigSnippets({ apiKey, model }: { apiKey: string; model: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Environment");
  const [copied, setCopied] = useState(false);
  const snippets: Record<(typeof TABS)[number], string> = {
    Environment: `export OPENAI_BASE_URL="${BASE}"\nexport OPENAI_API_KEY="${apiKey}"\nexport OPENAI_MODEL="${model}"`,
    cURL: `curl ${BASE}/chat/completions \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${model}","messages":[{"role":"user","content":"Hello"}]}'`,
    Python: `from openai import OpenAI\n\nclient = OpenAI(base_url="${BASE}", api_key="${apiKey}")\nr = client.chat.completions.create(model="${model}", messages=[{"role": "user", "content": "Hello"}])\nprint(r.choices[0].message.content)`,
    "Node.js": `import OpenAI from "openai";\n\nconst client = new OpenAI({ baseURL: "${BASE}", apiKey: "${apiKey}" });\nconst r = await client.chat.completions.create({ model: "${model}", messages: [{ role: "user", content: "Hello" }] });\nconsole.log(r.choices[0].message.content);`,
    "OpenAI SDK": `# Any OpenAI-compatible tool (OpenHands, OpenCode, OpenClaw, Continue, Cursor…)\nBase URL:  ${BASE}\nAPI key:   ${apiKey}\nModel:     ${model}\n\n# Model list for pickers: GET ${BASE}/models`,
  };
  const copy = async () => { await navigator.clipboard.writeText(snippets[tab]); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div>
      <ul className="nav nav-pills nav-sm mb-2 gap-1">
        {TABS.map((t) => <li className="nav-item" key={t}><button className={`nav-link py-1 px-2 small ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button></li>)}
        <li className="ms-auto"><button className="btn btn-sm btn-outline-secondary" onClick={copy}>{copied ? "Copied" : "Copy configuration"}</button></li>
      </ul>
      <pre className="snippet mono mb-0">{snippets[tab]}</pre>
    </div>
  );
}
