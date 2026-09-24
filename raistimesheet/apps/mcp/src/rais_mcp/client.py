"""Async HTTP client for the Rais Timesheet Worker API. The API is the source of truth."""
from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

log = structlog.get_logger("rais_mcp.client")


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int, reference: str | None = None):
        super().__init__(message)
        self.code, self.message, self.status, self.reference = code, message, status, reference


class RaisClient:
    def __init__(self, base_url: str | None = None, token: str | None = None):
        self.base_url = (base_url or os.environ.get("RAIS_API_URL", "http://localhost:8787")).rstrip("/")
        self.token = token or os.environ.get("RAIS_API_TOKEN", "")
        self._http = httpx.AsyncClient(base_url=self.base_url, timeout=60.0)

    async def ensure_token(self) -> None:
        """Bootstrap a personal API token when only the server bootstrap token is configured."""
        if self.token:
            return
        boot = os.environ.get("RAIS_MCP_BOOTSTRAP_TOKEN")
        email = os.environ.get("RAIS_USER_EMAIL")
        if not boot or not email:
            raise ApiError("NO_TOKEN", "Set RAIS_API_TOKEN, or RAIS_MCP_BOOTSTRAP_TOKEN + RAIS_USER_EMAIL.", 0)
        r = await self._http.post("/api/auth/mcp/bootstrap", json={"bootstrap_token": boot, "email": email, "name": "MCP"}, headers={"X-Requested-With": "RaisTimesheet"})
        body = r.json()
        if not body.get("success"):
            raise ApiError(body["error"]["code"], body["error"]["message"], r.status_code)
        self.token = body["data"]["token"]
        log.info("mcp_token_bootstrapped")

    async def request(self, method: str, path: str, *, json: Any = None, params: dict | None = None, files: dict | None = None, data: dict | None = None) -> tuple[Any, list[str]]:
        await self.ensure_token()
        headers = {"Authorization": f"Bearer {self.token}", "X-Requested-With": "RaisTimesheet", "Accept": "application/json"}
        r = await self._http.request(method, f"/api{path}", json=json, params={k: v for k, v in (params or {}).items() if v not in (None, "")}, files=files, data=data, headers=headers)
        try:
            body = r.json()
        except ValueError as e:
            raise ApiError("BAD_RESPONSE", f"Unexpected response ({r.status_code})", r.status_code) from e
        if not body.get("success"):
            err = body.get("error", {})
            raise ApiError(err.get("code", "ERROR"), err.get("message", "Request failed"), r.status_code, err.get("reference"))
        return body["data"], body.get("warnings", [])

    async def get(self, path: str, **params: Any):
        return await self.request("GET", path, params=params)

    async def post(self, path: str, json: Any = None, **kw: Any):
        return await self.request("POST", path, json=json if json is not None else {}, **kw)

    async def patch(self, path: str, json: Any):
        return await self.request("PATCH", path, json=json)

    async def download(self, path: str) -> bytes:
        await self.ensure_token()
        r = await self._http.get(f"/api{path}", headers={"Authorization": f"Bearer {self.token}"})
        r.raise_for_status()
        return r.content

    async def aclose(self) -> None:
        await self._http.aclose()
