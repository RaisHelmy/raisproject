import { useState } from "react";
import { Link } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { MCP_STACK, MCP_TOOLS } from "./pagesData";

/**
 * MCP & CLI: the app-icon stack, lime headline, trial banner, then the
 * connect card with a tool picker and MCP / CLI toggle, followed by the
 * "How does MCP work?" steps.
 */
const STEPS: Record<string, { n: string; title: string; body: string; cta: string }[]> = {
  MCP: [
    { n: "1", title: "Add the RaisAI plugin", body: "Find RaisAI in the Plugins Directory or click the button below. Then click Add and sign in", cta: "Add RaisAI plugin" },
    { n: "2", title: "Connect and start creating", body: "After signing in, ask your assistant to generate an image or video", cta: "Start creating" },
  ],
  CLI: [
    { n: "1", title: "Install the CLI", body: "Run one command to install the RaisAI command line tool, then authenticate with your API key", cta: "Copy install command" },
    { n: "2", title: "Generate from your terminal", body: "Call any model, chain workflows and pull results straight into your project", cta: "Read the docs" },
  ],
};

const HOW = [
  { title: "Connect once", body: "Authorise RaisAI in your assistant. Your balance, models and workflows come with you." },
  { title: "Ask in plain language", body: "Describe the image, video or voice you want. The assistant picks the model and shows the estimate." },
  { title: "Get it back in the chat", body: "Results land in the conversation and in your library, ready to reuse or hand to a workflow." },
];

export function McpPage() {
  const [tool, setTool] = useState(MCP_TOOLS[0]?.name ?? "ChatGPT");
  const [mode, setMode] = useState<"MCP" | "CLI">("MCP");
  return (
    <>
      <HfHeader />
      <main id="main" className="pg pg-mcp">
        <div className="pg-container">
          <div className="pg-stack" aria-hidden="true">
            {MCP_STACK.map((s, i) => (
              <span key={s} className="pg-stack-icon" data-mid={i === Math.floor(MCP_STACK.length / 2) || undefined}>
                <img src={s} alt="" />
              </span>
            ))}
          </div>

          <h1 className="pg-mcp-title">RaisAI plugin for {tool}</h1>
          <p className="pg-mcp-sub">Create stunning images and videos without leaving {tool}</p>

          <Link to="/signup" className="pg-trial">
            <TagIcon />
            Connect MCP &amp; access a 3-day free trial plan with 100 credits
            <span className="pg-trial-badge">Free 100 credits</span>
          </Link>

          <section className="pg-connect">
            <header className="pg-connect-head">
              <div className="pg-tools" role="tablist" aria-label="Assistant">
                {MCP_TOOLS.map((t) => (
                  <button key={t.name} type="button" role="tab" aria-selected={t.name === tool} data-active={t.name === tool || undefined} onClick={() => setTool(t.name)}>
                    {t.icon ? <img src={t.icon} alt="" /> : <span className="pg-tool-dot" />}
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="pg-modes" role="tablist" aria-label="Connection type">
                {(["MCP", "CLI"] as const).map((mo) => (
                  <button key={mo} type="button" role="tab" aria-selected={mo === mode} data-active={mo === mode || undefined} onClick={() => setMode(mo)}>
                    {mo === "MCP" ? <PlugIcon /> : <CodeIcon />}{mo}
                  </button>
                ))}
              </div>
            </header>
            <div className="pg-steps">
              {STEPS[mode]!.map((s) => (
                <div key={s.n} className="pg-step">
                  <span className="pg-step-n">{s.n}</span>
                  <h2>{s.title}</h2>
                  <p>{s.body}</p>
                  <button type="button" className="pg-btn pg-btn-white">{s.cta}</button>
                </div>
              ))}
            </div>
          </section>

          <p className="pg-note">
            If you are using Claude Code or Codex, it&rsquo;s better to use the CLI
            <Link to="/developer/docs"> <ExternalIcon /></Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="pg-note-gh"><GithubIcon />GitHub</a>
          </p>

          <section className="pg-how">
            <h2>How does MCP work?</h2>
            <div className="pg-how-grid">
              {HOW.map((h, i) => (
                <article key={h.title}>
                  <span className="pg-how-n">{i + 1}</span>
                  <h3>{h.title}</h3>
                  <p>{h.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const TagIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M4 11V5a1 1 0 0 1 1-1h6l8 8-7 7-8-8Z" {...s} /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /></svg>;
const PlugIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M9 3v6M15 3v6M7 9h10v3a5 5 0 0 1-10 0V9ZM12 17v4" {...s} /></svg>;
const CodeIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4" {...s} /></svg>;
const ExternalIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" {...s} /></svg>;
const GithubIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.6 1a9 9 0 0 1 4.7 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.6.6.6 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.5Z" fill="currentColor" /></svg>;
