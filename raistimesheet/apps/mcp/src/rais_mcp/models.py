"""Pydantic models: structured MCP responses and AI field provenance."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ToolResponse(BaseModel):
    """Every tool returns this envelope — never unstructured text."""

    success: bool
    data: Any = None
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)

    @classmethod
    def ok(cls, data: Any, warnings: list[str] | None = None) -> "ToolResponse":
        return cls(success=True, data=data, warnings=warnings or [])

    @classmethod
    def fail(cls, *errors: str, data: Any = None) -> "ToolResponse":
        return cls(success=False, data=data, errors=list(errors))


class Evidence(BaseModel):
    message_id: str
    reason: str


class AIField(BaseModel):
    value: Any
    source: Literal["explicit", "inferred", "assumed", "unknown"]
    confidence: float
    reason: str


class ExtractedWorkItem(BaseModel):
    title: str
    description: str
    work_date: AIField
    duration_minutes: AIField
    status: AIField
    evidence: list[Evidence]


class ParsedMessage(BaseModel):
    seq: int
    timestamp: str
    sender: str
    message: str
    is_system: bool = False
    is_attachment: bool = False
    is_deleted: bool = False
