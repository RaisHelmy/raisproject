import type { Template } from "../../types";

export const fastapiPostgres: Template = {
  id: "fastapi-postgres",
  title: "FastAPI + PostgreSQL",
  description:
    "Async Python API with FastAPI, SQLAlchemy 2.0 and PostgreSQL: Pydantic validation, a real users endpoint, automatic OpenAPI docs, tests and Docker.",
  technologies: ["python", "fastapi", "postgresql", "docker"],
  projectTypes: ["Web API", "REST API"],
  architectures: ["layered", "simple"],
  databases: ["postgresql"],
  difficulty: "beginner",
  productionReady: true,
  prerequisites: ["Python 3.11+", "Docker (for PostgreSQL)"],
  estimatedSetupMinutes: 8,
  versions: [
    { name: "Python", version: "3.12" },
    { name: "FastAPI", version: "0.11x" },
    { name: "SQLAlchemy", version: "2.x" },
  ],
  lastReviewed: "2026-09",
  tags: ["python", "fastapi", "postgres", "async", "api", "pydantic"],
  patterns: ["dependency-injection", "repository"],
  recipes: ["docker-compose-postgres", "github-actions-ci", "pagination", "jwt-authentication"],
  relatedTemplates: ["node-express-postgres-api", "dotnet-clean-architecture"],
  zeroToRunning: ["01 Create project", "02 Install dependencies", "03 Add the code", "04 Database", "05 Run & test"],
  completeness: [
    { label: "Project creation", done: true },
    { label: "Dependencies", done: true },
    { label: "Folder structure", done: true },
    { label: "Configuration", done: true },
    { label: "Database", done: true },
    { label: "API endpoint", done: true },
    { label: "Testing", done: true },
    { label: "Docker", done: true },
    { label: "CI/CD", done: true },
    { label: "Kubernetes", done: false },
  ],
  nextSteps: [
    { label: "Add JWT authentication", recipeId: "jwt-authentication" },
    { label: "Add Alembic migrations", recipeId: "db-migrations" },
    { label: "Add pagination", recipeId: "pagination" },
    { label: "Add rate limiting", recipeId: "rate-limiting" },
  ],
  steps: [
    {
      id: "create",
      title: "01 Create project",
      description: "Project folder with an isolated virtual environment.",
      commands: [
        {
          shell: "bash",
          provenance: "official",
          code: `mkdir my-api && cd my-api
python3 -m venv .venv
source .venv/bin/activate`,
          description: "Linux/macOS",
        },
        {
          shell: "powershell",
          provenance: "official",
          code: `mkdir my-api; cd my-api
python -m venv .venv
.venv\\Scripts\\Activate.ps1`,
          description: "Windows PowerShell",
        },
      ],
    },
    {
      id: "install",
      title: "02 Install dependencies",
      description: "FastAPI with uvicorn, async SQLAlchemy with the asyncpg driver, pytest for tests.",
      commands: [
        {
          shell: "bash",
          provenance: "official",
          code: `pip install "fastapi[standard]" "sqlalchemy[asyncio]" asyncpg pydantic-settings
pip install pytest httpx pytest-asyncio
pip freeze > requirements.txt`,
          description: "Install and pin dependencies",
        },
      ],
    },
    {
      id: "code",
      title: "03 Add the code",
      description: "App structure: app/main.py, config, models, schemas, routes. A complete users create/fetch flow.",
      commands: [
        { shell: "bash", code: "mkdir -p app/routers", description: "Create the package (Linux/macOS)" },
        { shell: "powershell", code: "New-Item -ItemType Directory -Force app/routers", description: "PowerShell" },
      ],
      files: [
        {
          path: "app/config.py",
          language: "python",
          content: `from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://app:dev_only_password@localhost:5432/app"

    class Config:
        env_file = ".env"


settings = Settings()`,
        },
        {
          path: "app/db.py",
          language: "python",
          content: `from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    async with SessionLocal() as session:
        yield session`,
        },
        {
          path: "app/models.py",
          language: "python",
          content: `import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )`,
        },
        {
          path: "app/schemas.py",
          language: "python",
          content: `import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}`,
        },
        {
          path: "app/routers/users.py",
          language: "python",
          content: `import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User
from app.schemas import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", response_model=UserOut, status_code=201)
async def create_user(payload: UserCreate, session: AsyncSession = Depends(get_session)):
    email = payload.email.lower()
    existing = await session.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=409, detail="email_taken")

    user = User(email=email, name=payload.name.strip())
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="not_found")
    return user`,
        },
        {
          path: "app/main.py",
          language: "python",
          content: `from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import Base, engine
from app.routers import users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev convenience: create tables at startup. Use Alembic migrations for production.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="My API", lifespan=lifespan)
app.include_router(users.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}`,
        },
        {
          path: ".env.example",
          language: "text",
          description: "⚠ Copy to .env and adjust; never commit .env.",
          content: `DATABASE_URL=postgresql+asyncpg://app:dev_only_password@localhost:5432/app`,
        },
        {
          path: "tests/test_users.py",
          language: "python",
          description: "API test against SQLite in-memory via dependency override — fast and isolated.",
          content: `import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import Base, get_session
from app.main import app


@pytest.fixture()
async def client():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def override():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_session] = override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_and_get_user(client):
    created = await client.post("/api/users", json={"email": "ada@example.com", "name": "Ada"})
    assert created.status_code == 201
    user = created.json()

    fetched = await client.get(f"/api/users/{user['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["email"] == "ada@example.com"


@pytest.mark.asyncio
async def test_duplicate_email_conflicts(client):
    await client.post("/api/users", json={"email": "ada@example.com", "name": "Ada"})
    dup = await client.post("/api/users", json={"email": "ada@example.com", "name": "Other"})
    assert dup.status_code == 409`,
        },
      ],
      notes: ["The test file needs `pip install aiosqlite` and `asyncio_mode = auto` (or the markers shown) in pytest config."],
    },
    {
      id: "database",
      title: "04 Database",
      description: "Start PostgreSQL — tables are created at app startup in dev (switch to Alembic for production).",
      commands: [
        {
          shell: "bash",
          code: `docker run -d --name my-api-db \\
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=dev_only_password -e POSTGRES_DB=app \\
  -p 5432:5432 postgres:16-alpine`,
          description: "PostgreSQL in Docker",
        },
      ],
    },
    {
      id: "run",
      title: "05 Run & test",
      description: "fastapi dev gives hot reload; /docs serves interactive OpenAPI docs for free.",
      commands: [
        { shell: "bash", provenance: "official", code: "fastapi dev app/main.py", description: "Run with hot reload (docs at http://localhost:8000/docs)" },
        {
          shell: "bash",
          code: `curl -s -X POST http://localhost:8000/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}' | jq`,
          description: "Create a user",
        },
        { shell: "bash", code: "pytest", description: "Run tests" },
      ],
    },
    {
      id: "docker",
      title: "06 Docker",
      description: "Production container.",
      files: [
        {
          path: "Dockerfile",
          language: "dockerfile",
          content: `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
CMD ["fastapi", "run", "app/main.py", "--port", "8000"]`,
        },
      ],
    },
    {
      id: "production",
      title: "07 Production checklist",
      description: "Before real traffic:",
      notes: [
        "Replace startup create_all with Alembic migrations.",
        "Add auth (OAuth2/JWT — FastAPI has first-class support), CORS middleware for your frontend origin.",
        "Run behind multiple workers (fastapi run --workers or uvicorn workers).",
        "Add structured logging and request IDs.",
      ],
    },
  ],
  files: [],
};
