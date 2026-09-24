# Rais Timesheet MCP

Python MCP server exposing Rais Timesheet to AI clients (Claude Desktop, Claude Code, etc.).
It is a thin, structured client over the Worker API — the Worker remains the source of truth.

```bash
cd apps/mcp
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # set RAIS_API_URL and RAIS_API_TOKEN
rais-mcp               # stdio transport
```

Claude Desktop config:
```json
{ "mcpServers": { "rais-timesheet": { "command": "/path/to/apps/mcp/.venv/bin/rais-mcp", "env": { "RAIS_API_URL": "http://localhost:8787", "RAIS_API_TOKEN": "rts_..." } } } }
```
See docs/mcp.md for the tool catalogue and example prompts.
