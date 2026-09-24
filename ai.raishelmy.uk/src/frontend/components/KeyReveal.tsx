import { useState } from "react";
import { ConfigSnippets } from "./ConfigSnippets";

export function KeyReveal({ apiKey, model, onDone }: { apiKey: string; model: string; onDone?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(apiKey); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="card border-success mb-4">
      <div className="card-body">
        <h5 className="card-title">Your credential — shown once</h5>
        <p className="text-secondary small mb-2">Store it now. It cannot be displayed again; if you lose it, rotate the credential to get a new one.</p>
        <div className="d-flex gap-2 align-items-center mb-3">
          <div className="key-box mono flex-grow-1">{apiKey}</div>
          <button className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <ConfigSnippets apiKey={apiKey} model={model} />
        {onDone && <button className="btn btn-outline-secondary mt-3" onClick={onDone}>I have saved it</button>}
      </div>
    </div>
  );
}
