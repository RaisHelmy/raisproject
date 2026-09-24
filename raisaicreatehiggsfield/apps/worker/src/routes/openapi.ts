import { Hono } from "hono";
import { SCOPES, type Scope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";

export const openapi = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

interface EndpointSpec {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  summary: string;
  scope: Scope | "session";
  requestBody?: Record<string, unknown>;
  responseExample?: Record<string, unknown>;
}

/**
 * The public REST surface, described once and used twice: as the OpenAPI
 * document and as the in-app reference. Keeping it in one place is what stops
 * the two from drifting apart.
 *
 * Admin routes are deliberately absent: they are not part of the customer API
 * and a bearer credential cannot reach them anyway.
 */
const ENDPOINTS: EndpointSpec[] = [
  { method: "get", path: "/models", summary: "List available models with what each can do and a typical cost.", scope: "models:read" },
  { method: "get", path: "/models/{id}", summary: "One model's capabilities, parameters and limits.", scope: "models:read" },
  { method: "get", path: "/models/compatible", summary: "Models that support the capabilities you need.", scope: "models:read" },
  {
    method: "post", path: "/models/{id}/estimate",
    summary: "What a generation would cost, before running it.",
    scope: "models:read",
    requestBody: { prompt: "a rainy cyberpunk street", width: 1024, height: 1024 },
    responseExample: { estimatedSen: 38, approximate: false, currency: "MYR" },
  },
  {
    method: "post", path: "/generations",
    summary: "Generate an image, video, speech or text. Charges your balance.",
    scope: "generations:write",
    requestBody: { modelId: "@cf/leonardo/lucid-origin", prompt: "a rainy cyberpunk street", imageAssetIds: [] },
    responseExample: { generation: { id: "…", status: "completed", chargedSen: 38 }, balanceAfterSen: 4962 },
  },
  { method: "get", path: "/generations", summary: "Your generation history.", scope: "generations:read" },
  { method: "get", path: "/generations/{id}", summary: "One generation and its outputs.", scope: "generations:read" },
  {
    method: "post", path: "/generations/{id}/cancel",
    summary: "Stop a generation that is still running. What was already produced is still charged.",
    scope: "generations:write",
  },
  { method: "get", path: "/models/preferences", summary: "Your favourite and recently used models.", scope: "models:read" },
  { method: "get", path: "/projects", summary: "List projects.", scope: "projects:read" },
  { method: "post", path: "/projects", summary: "Create a project.", scope: "projects:write" },
  { method: "get", path: "/workflows", summary: "List workflows.", scope: "workflows:read" },
  { method: "post", path: "/workflows", summary: "Create a workflow.", scope: "workflows:write" },
  { method: "get", path: "/workflows/{id}", summary: "A workflow and its current document.", scope: "workflows:read" },
  { method: "post", path: "/workflows/{id}/preview", summary: "Validate a workflow and price it without running it.", scope: "workflows:read" },
  {
    method: "post", path: "/workflows/{id}/run",
    summary: "Run a workflow. Charges your balance.",
    scope: "workflows:execute",
    requestBody: { variables: {}, fromNodeIds: [], maxCostSen: 500 },
  },
  { method: "get", path: "/workflows/{id}/export", summary: "Export a workflow as portable JSON.", scope: "workflows:read" },
  { method: "post", path: "/workflows/import", summary: "Import a workflow from exported JSON.", scope: "workflows:write" },
  { method: "get", path: "/workflow-runs/{id}", summary: "Status, outputs and cost of a run.", scope: "workflows:read" },
  { method: "get", path: "/workflow-runs/{id}/events", summary: "Live run status as server-sent events.", scope: "workflows:read" },
  { method: "post", path: "/workflow-runs/{id}/cancel", summary: "Ask a run to stop between nodes.", scope: "workflows:execute" },
  { method: "get", path: "/connectors", summary: "Saved connections workflow nodes can use.", scope: "account:read" },
  { method: "post", path: "/connectors", summary: "Save a connection. Its token is stored encrypted and never returned.", scope: "account:write" },
  { method: "get", path: "/templates", summary: "List templates, yours and public ones.", scope: "templates:read" },
  { method: "get", path: "/templates/{id}", summary: "A template and the inputs it needs.", scope: "templates:read" },
  {
    method: "post", path: "/templates/{id}/execute",
    summary: "Run a template with your inputs. Charges your balance.",
    scope: "templates:execute",
    requestBody: { variables: { subject: "a tiger" } },
  },
  { method: "get", path: "/assets", summary: "List files: generated results and uploads.", scope: "assets:read" },
  { method: "get", path: "/assets/{id}/content", summary: "Download a file.", scope: "assets:read" },
  { method: "post", path: "/assets", summary: "Upload a file as multipart form data.", scope: "assets:write" },
  { method: "get", path: "/balance", summary: "Prepaid balance and what is held for running work.", scope: "billing:read" },
  { method: "get", path: "/balance/transactions", summary: "Ledger history.", scope: "billing:read" },
  { method: "get", path: "/usage", summary: "What you have spent, by day, model and project.", scope: "billing:read" },
  { method: "get", path: "/webhooks", summary: "List webhook endpoints.", scope: "account:read" },
  { method: "post", path: "/webhooks", summary: "Add a webhook endpoint.", scope: "account:write" },
];

/** A compact list for the in-app reference. */
openapi.get("/openapi/summary", (c) =>
  c.json({
    endpoints: ENDPOINTS.map((e) => ({
      method: e.method.toUpperCase(),
      path: `/api/v1${e.path}`,
      summary: e.summary,
      scope: e.scope,
    })),
    scopes: SCOPES,
  }),
);

/** The machine-readable description, for generating clients. */
openapi.get("/openapi.json", (c) => {
  const url = new URL(c.req.url);
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of ENDPOINTS) {
    const path = `/api/v1${endpoint.path}`;
    paths[path] ??= {};
    paths[path][endpoint.method] = {
      summary: endpoint.summary,
      security: [{ bearerAuth: [endpoint.scope] }],
      ...(endpoint.requestBody
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: { type: "object" }, example: endpoint.requestBody } },
            },
          }
        : {}),
      responses: {
        "200": {
          description: "Success",
          content: {
            "application/json": {
              schema: { type: "object" },
              ...(endpoint.responseExample ? { example: endpoint.responseExample } : {}),
            },
          },
        },
        "402": { description: "Insufficient balance", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "403": { description: "The credential lacks the required scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        "429": { description: "Rate limited", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
    };
  }

  return c.json({
    openapi: "3.1.0",
    info: {
      title: "RaisAI Create",
      version: "1.0.0",
      description:
        "Generate images, video, speech and text, and run saved workflows and templates. " +
        "Amounts are integer sen in Malaysian ringgit: 4962 means RM49.62. Generations spend " +
        "prepaid balance, so price a request with an estimate endpoint before running it.",
    },
    servers: [{ url: url.origin }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "An API key created in Developer settings." },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string", description: "Stable machine-readable code." },
                message: { type: "string", description: "Written for a person to read." },
                action: { type: "string", description: "What to do next, when there is something to do." },
                details: { type: "object" },
              },
              required: ["code", "message"],
            },
          },
        },
      },
    },
    paths,
  });
});
