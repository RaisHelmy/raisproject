import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

interface Endpoint {
  method: string;
  path: string;
  scope: string;
  summary: string;
}

interface McpTool {
  name: string;
  title: string;
  description: string;
  requiredScope: string;
}

/**
 * In-app reference for the three ways in (§141, §142). Written for someone who
 * wants to call RaisAI without reading the source, and kept next to the keys
 * they will need.
 */
export function DeveloperDocsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);

  useEffect(() => {
    api<{ endpoints: Endpoint[] }>("/openapi/summary")
      .then((r) => setEndpoints(r.endpoints))
      .catch(() => setEndpoints([]));
    api<{ tools: McpTool[] }>("/mcp")
      .then((r) => setTools(r.tools))
      .catch(() => setTools([]));
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app";

  return (
    <section className="workspace-page" style={{ maxWidth: 960 }}>
      <p className="lp-eyebrow mb-2">Build on RaisAI</p><h1 className="display-6 fw-bold mb-2">Developer</h1><p className="text-secondary mb-4">Connect your existing systems to the same models, budgets and audit trail.</p>
      <p className="text-secondary mb-4">
        Everything the web app does is available over the API and to AI agents over MCP. Same services,
        same balance, same rules.
      </p>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h6">Get a key</h2>
          <p className="small text-secondary">
            Create an <Link to="/developer/api-keys">API key</Link> for your own code, or an{" "}
            <Link to="/developer/mcp">MCP token</Link> for an AI agent. Grant only the scopes it needs.
          </p>
        </div>
      </div>

      <h2 className="h5 mb-2">Calling the API</h2>
      <p className="small text-secondary">
        Send the key as a bearer token. Generations charge your prepaid balance, so check the estimate first.
      </p>
      <pre className="bg-body-tertiary p-3 rounded small"><code>{`# What a generation would cost, before running it
curl ${origin}/api/v1/models/@cf/leonardo/lucid-origin/estimate \\
  -H "authorization: Bearer $RAISAI_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"prompt":"a rainy cyberpunk street"}'
# -> {"estimatedSen":38,"approximate":false,"currency":"MYR"}

# Generate. Idempotency-Key makes a retry safe.
curl ${origin}/api/v1/generations \\
  -H "authorization: Bearer $RAISAI_API_KEY" \\
  -H "content-type: application/json" \\
  -H "idempotency-key: $(uuidgen)" \\
  -d '{"modelId":"@cf/leonardo/lucid-origin","prompt":"a rainy cyberpunk street"}'`}</code></pre>

      <h2 className="h5 mb-2 mt-4">Connecting an agent</h2>
      <p className="small text-secondary">
        Point any MCP client at the endpoint below with an MCP token. The agent sees only the tools its
        scopes allow.
      </p>
      <pre className="bg-body-tertiary p-3 rounded small"><code>{`{
  "mcpServers": {
    "raisai": {
      "url": "${origin}/api/v1/mcp",
      "headers": { "Authorization": "Bearer $RAISAI_MCP_TOKEN" }
    }
  }
}`}</code></pre>

      {tools.length > 0 && (
        <>
          <h3 className="h6 mt-4">Tools your token can use</h3>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <caption className="visually-hidden">MCP tools</caption>
              <thead>
                <tr><th scope="col">Tool</th><th scope="col">What it does</th><th scope="col">Scope</th></tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.name}>
                    <td className="font-monospace small">{tool.name}</td>
                    <td className="small">{tool.description}</td>
                    <td className="font-monospace small text-secondary">{tool.requiredScope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="h5 mb-2 mt-4">Endpoints</h2>
      <p className="small text-secondary">
        The machine-readable description is at <code>/api/v1/openapi.json</code>.
      </p>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <caption className="visually-hidden">REST endpoints</caption>
          <thead>
            <tr><th scope="col">Endpoint</th><th scope="col">What it does</th><th scope="col">Scope</th></tr>
          </thead>
          <tbody>
            {endpoints.map((endpoint) => (
              <tr key={`${endpoint.method} ${endpoint.path}`}>
                <td className="font-monospace small text-nowrap">
                  <span className="badge text-bg-secondary me-1">{endpoint.method}</span>
                  {endpoint.path}
                </td>
                <td className="small">{endpoint.summary}</td>
                <td className="font-monospace small text-secondary">{endpoint.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="h5 mb-2 mt-4">Errors</h2>
      <p className="small text-secondary">
        Failures come back with a stable code, a message for a person, and often what to do next.
      </p>
      <pre className="bg-body-tertiary p-3 rounded small"><code>{`{
  "error": {
    "code": "insufficient_balance",
    "message": "Your balance does not cover this generation.",
    "action": "Add balance and try again.",
    "details": { "estimatedSen": 3800, "availableSen": 320 }
  }
}`}</code></pre>
    </section>
  );
}
