import { DurableObject } from "cloudflare:workers";

interface LocationPoint {
  lat: number;
  lng: number;
  ts: string;
}

/**
 * One Durable Object instance per job (keyed by job id via idFromName), so
 * every job's live GPS stream and its retained track are fully isolated.
 * CLAUDE.md "Jobs and matching": stream while active, purchaser watches on
 * a map, retain the track for dispute evidence, stop the moment the job
 * hits a terminal state — except an SOS incident on this job overrides
 * that and keeps tracking going until admin resolves it.
 */
export class LiveLocationRoom extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/push-location" && request.method === "POST") {
      if (await this.ctx.storage.get("stopped")) {
        return new Response("tracking stopped for this job", { status: 409 });
      }
      const point = (await request.json()) as LocationPoint;
      await this.ctx.storage.put(`point:${point.ts}`, point);
      await this.ctx.storage.put("latest", point);
      this.broadcast(point);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/history" && request.method === "GET") {
      const entries = await this.ctx.storage.list<LocationPoint>({ prefix: "point:" });
      return Response.json(Array.from(entries.values()));
    }

    if (url.pathname === "/latest" && request.method === "GET") {
      const latest = await this.ctx.storage.get<LocationPoint>("latest");
      return Response.json(latest ?? null);
    }

    /** Called by the job route the moment a job reaches a terminal state. */
    if (url.pathname === "/stop" && request.method === "POST") {
      const extended = await this.ctx.storage.get("extended");
      if (!extended) {
        await this.ctx.storage.put("stopped", true);
      }
      return Response.json({ ok: true, stopped: !extended });
    }

    /** Called on SOS — overrides the normal stop-on-terminal-state rule. */
    if (url.pathname === "/extend-tracking" && request.method === "POST") {
      await this.ctx.storage.put("extended", true);
      await this.ctx.storage.delete("stopped");
      return Response.json({ ok: true });
    }

    if (url.pathname === "/stream" && request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response("not found", { status: 404 });
  }

  /** Viewers (purchaser's map) only ever receive; nothing expected inbound. */
  override webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): void {}

  override webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {
    ws.close();
  }

  private broadcast(point: LocationPoint) {
    const payload = JSON.stringify({ type: "location", ...point });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch (err) {
        console.error("failed to send location update to a websocket viewer", err);
      }
    }
  }
}

export function getDurableObjectStub(env: Env, jobId: string) {
  const id = env.LIVE_LOCATION.idFromName(jobId);
  return env.LIVE_LOCATION.get(id);
}
