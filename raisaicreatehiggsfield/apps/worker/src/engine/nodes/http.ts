import { z } from "zod";
import { AppError } from "@raisai/shared";
import { registerNode, type NodeDefinition } from "../registry";
import type { PortValue } from "../values";
import { interpolate } from "./basic";

const configSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  url: z.string().url(),
  headers: z.record(z.string()).default({}),
  body: z.string().optional(),
  timeoutMs: z.number().int().min(100).max(30_000).default(10_000),
});

/** Blocks requests that would reach infrastructure rather than the internet. */
export function assertPublicUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError("invalid_input", `"${rawUrl}" is not a valid URL.`, { action: "Enter a full URL." });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AppError("invalid_input", "Only http and https URLs are allowed.");
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]";
  if (blocked) {
    throw new AppError("invalid_input", "That address is not reachable from a workflow.", {
      action: "Use a public URL.",
    });
  }
  return url;
}

const httpNode: NodeDefinition = {
  type: "http",
  version: 1,
  category: "developer",
  label: "HTTP request",
  description: "Calls an external API and returns the response.",
  inputs: [{ name: "body", type: "json", label: "Body" }],
  outputs: [
    { name: "json", type: "json", label: "JSON" },
    { name: "text", type: "text", label: "Text" },
    { name: "status", type: "number", label: "Status" },
  ],
  configSchema,

  async execute(ctx) {
    const config = configSchema.parse(ctx.config);
    const url = assertPublicUrl(interpolate(config.url, ctx.variables));

    const headers = new Headers();
    for (const [k, v] of Object.entries(config.headers)) headers.set(k, interpolate(v, ctx.variables));

    const inputBody = ctx.inputs.body;
    const body =
      config.method === "GET" || config.method === "DELETE"
        ? undefined
        : inputBody !== undefined
          ? JSON.stringify(inputBody)
          : config.body
            ? interpolate(config.body, ctx.variables)
            : undefined;
    if (body && !headers.has("content-type")) headers.set("content-type", "application/json");

    const timeout = AbortSignal.timeout(config.timeoutMs);
    let response: Response;
    try {
      response = await ctx.services.fetch(url.toString(), {
        method: config.method,
        headers,
        body,
        signal: timeout,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(message.includes("abort") || message.includes("timeout") ? "provider_timeout" : "provider_error",
        `The request to ${url.host} failed: ${message}`, { action: "Check the URL and try again." });
    }

    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return {
      outputs: {
        ...(json !== undefined ? { json: json as PortValue } : {}),
        text,
        status: response.status,
      },
    };
  },
};

export function registerHttpNode(): void {
  registerNode(httpNode);
}
