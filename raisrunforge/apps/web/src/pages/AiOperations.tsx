import { useState } from "react";

const SUGGESTIONS = [
  "Why is production slow?",
  "Why did the latest deployment fail?",
  "Which server is overloaded?",
  "What changed before this outage?",
  "Deploy the latest staging build.",
  "Restart the API.",
  "Check database health.",
  "Find unused containers.",
];

export function AiOperations() {
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);

  function ask(q: string) {
    setMessages((prev) => [
      ...prev,
      { role: "user", text: q },
      {
        role: "ai",
        text: "AI Operations connects to the same MCP tools shown on the MCP page. Wiring this panel to a live model is the next milestone — for now, try the tools directly from MCP → Call Tool.",
      },
    ]);
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">AI Operations</h1>
          <div className="rf-page-sub">Ask questions about your infrastructure in plain language.</div>
        </div>
      </div>
      <div className="rf-card mb-3">
        <div className="d-flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="btn-rf" onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
      </div>
      <div className="rf-card" style={{ minHeight: 200 }}>
        {messages.length === 0 && <div className="rf-empty"><i className="bi bi-stars" />Ask a question to get started.</div>}
        {messages.map((m, i) => (
          <div key={i} className="mb-2">
            <div className="rf-faint">{m.role === "user" ? "You" : "RunForge AI"}</div>
            <div>{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
