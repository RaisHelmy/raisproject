import type { Template } from "../../types";

export const dotnetCleanArchitecture: Template = {
  id: "dotnet-clean-architecture",
  title: "ASP.NET Core Clean Architecture",
  description:
    "Production-shaped .NET 8 Web API with Clean Architecture: Domain, Application, Infrastructure and Api projects, EF Core + PostgreSQL, a real User endpoint end-to-end, tests, Docker and CI.",
  technologies: ["csharp", "dotnet", "aspnet-core", "ef-core", "postgresql", "docker"],
  projectTypes: ["Web API"],
  architectures: ["clean"],
  databases: ["postgresql"],
  difficulty: "intermediate",
  productionReady: true,
  prerequisites: [".NET 8 SDK", "Docker (for PostgreSQL)", "dotnet-ef tool (installed in step 05)"],
  estimatedSetupMinutes: 10,
  versions: [
    { name: ".NET", version: "8.0" },
    { name: "ASP.NET Core", version: "8.0" },
    { name: "EF Core", version: "8.x" },
  ],
  lastReviewed: "2026-09",
  tags: ["dotnet", "clean architecture", "web api", "postgres", "ef core", "jwt", "docker"],
  patterns: ["repository", "dependency-injection", "unit-of-work", "result", "options"],
  recipes: ["jwt-authentication", "db-migrations", "docker-compose-postgres", "github-actions-ci", "health-checks"],
  relatedTemplates: ["node-express-postgres-api", "spring-boot-postgres-api"],
  zeroToRunning: [
    "01 Create solution & projects",
    "02 Install packages",
    "04 Add the code",
    "05 Database & migrations",
    "06 Run & test the endpoint",
  ],
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
    { label: "Add input validation", recipeId: "input-validation" },
    { label: "Add structured logging (Serilog)", recipeId: "structured-logging" },
    { label: "Add health checks", recipeId: "health-checks" },
    { label: "Add rate limiting", recipeId: "rate-limiting" },
    { label: "Add pagination to list endpoints", recipeId: "pagination" },
  ],
  steps: [
    {
      id: "create",
      title: "01 Create solution & projects",
      description:
        "One solution, four projects. Domain has no dependencies; Application references Domain; Infrastructure and Api reference Application. That reference graph IS the architecture.",
      commands: [
        {
          shell: "bash",
          provenance: "official",
          description: "Create the solution and projects (official dotnet CLI)",
          code: `dotnet new sln -n MyApi
dotnet new classlib -n MyApi.Domain -o src/Domain
dotnet new classlib -n MyApi.Application -o src/Application
dotnet new classlib -n MyApi.Infrastructure -o src/Infrastructure
dotnet new webapi -n MyApi.Api -o src/Api --use-controllers
dotnet new xunit -n MyApi.UnitTests -o tests/UnitTests
dotnet sln add src/Domain src/Application src/Infrastructure src/Api tests/UnitTests`,
        },
        {
          shell: "bash",
          provenance: "official",
          description: "Wire project references — dependencies point inward",
          code: `dotnet add src/Application reference src/Domain
dotnet add src/Infrastructure reference src/Application
dotnet add src/Api reference src/Application src/Infrastructure
dotnet add tests/UnitTests reference src/Application src/Domain`,
        },
      ],
      notes: ["Api referencing Infrastructure is only for DI registration at the composition root — controllers must depend on Application interfaces, never Infrastructure types."],
    },
    {
      id: "packages",
      title: "02 Install packages",
      description: "EF Core with the Npgsql provider, plus design-time tooling for migrations.",
      commands: [
        {
          shell: "bash",
          provenance: "official",
          description: "Infrastructure: EF Core + PostgreSQL provider",
          code: `dotnet add src/Infrastructure package Microsoft.EntityFrameworkCore
dotnet add src/Infrastructure package Npgsql.EntityFrameworkCore.PostgreSQL`,
        },
        {
          shell: "bash",
          provenance: "official",
          description: "Api: EF design-time support (for migrations run against the startup project)",
          code: `dotnet add src/Api package Microsoft.EntityFrameworkCore.Design`,
        },
      ],
    },
    {
      id: "structure",
      title: "03 Folder structure",
      description: "The complete layout after this template. Copy the tree, or the mkdir commands for the inner folders.",
      commands: [
        {
          shell: "bash",
          description: "Create the inner folders (Linux/macOS)",
          code: `mkdir -p src/Domain/Entities src/Domain/Common
mkdir -p src/Application/Interfaces src/Application/Users
mkdir -p src/Infrastructure/Persistence
mkdir -p src/Api/Controllers`,
        },
        {
          shell: "powershell",
          description: "Create the inner folders (PowerShell)",
          code: `New-Item -ItemType Directory -Force src/Domain/Entities, src/Domain/Common,
  src/Application/Interfaces, src/Application/Users,
  src/Infrastructure/Persistence, src/Api/Controllers`,
        },
      ],
      notes: [
        `Layout:
MyApi/
├── src/
│   ├── Domain/            # entities, no dependencies
│   ├── Application/       # use cases + interfaces
│   ├── Infrastructure/    # EF Core, repositories
│   └── Api/               # controllers, DI, config
└── tests/
    └── UnitTests/`,
      ],
    },
    {
      id: "code",
      title: "04 Add the code",
      description:
        "A complete CreateUser/GetUser flow: Controller → Application service → IUserRepository → EF Core → PostgreSQL. Every file below is real and compiles together.",
      files: [
        {
          path: "src/Domain/Entities/User.cs",
          language: "csharp",
          description: "The domain entity. Creation goes through a factory method that enforces invariants.",
          content: `namespace MyApi.Domain.Entities;

public class User
{
    public Guid Id { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }

    private User() { } // EF Core

    public static User Create(string email, string name)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw new ArgumentException("A valid email is required.", nameof(email));
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));

        return new User
        {
            Id = Guid.NewGuid(),
            Email = email.Trim().ToLowerInvariant(),
            Name = name.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
    }
}`,
        },
        {
          path: "src/Application/Interfaces/IUserRepository.cs",
          language: "csharp",
          description: "The port. Application defines it; Infrastructure implements it.",
          content: `using MyApi.Domain.Entities;

namespace MyApi.Application.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<User?> GetByEmailAsync(string email, CancellationToken ct);
    Task AddAsync(User user, CancellationToken ct);
    Task<int> SaveChangesAsync(CancellationToken ct);
}`,
        },
        {
          path: "src/Application/Users/UserService.cs",
          language: "csharp",
          description: "The use case. Pure application logic — no EF, no HTTP. Returns results, not exceptions, for expected failures.",
          content: `using MyApi.Application.Interfaces;
using MyApi.Domain.Entities;

namespace MyApi.Application.Users;

public record UserDto(Guid Id, string Email, string Name, DateTimeOffset CreatedAt);

public record CreateUserRequest(string Email, string Name);

public class UserService(IUserRepository users)
{
    public async Task<(UserDto? User, string? Error)> CreateAsync(
        CreateUserRequest request, CancellationToken ct)
    {
        var existing = await users.GetByEmailAsync(request.Email.Trim().ToLowerInvariant(), ct);
        if (existing is not null)
            return (null, "email_taken");

        var user = User.Create(request.Email, request.Name);
        await users.AddAsync(user, ct);
        await users.SaveChangesAsync(ct);
        return (ToDto(user), null);
    }

    public async Task<UserDto?> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(id, ct);
        return user is null ? null : ToDto(user);
    }

    private static UserDto ToDto(User u) => new(u.Id, u.Email, u.Name, u.CreatedAt);
}`,
        },
        {
          path: "src/Infrastructure/Persistence/AppDbContext.cs",
          language: "csharp",
          description: "EF Core DbContext with explicit mapping.",
          content: `using Microsoft.EntityFrameworkCore;
using MyApi.Domain.Entities;

namespace MyApi.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(u => u.Id);
            e.Property(u => u.Email).IsRequired().HasMaxLength(255);
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Name).IsRequired().HasMaxLength(100);
        });
    }
}`,
        },
        {
          path: "src/Infrastructure/Persistence/UserRepository.cs",
          language: "csharp",
          description: "The adapter: implements the Application port with EF Core.",
          content: `using Microsoft.EntityFrameworkCore;
using MyApi.Application.Interfaces;
using MyApi.Domain.Entities;

namespace MyApi.Infrastructure.Persistence;

public class UserRepository(AppDbContext db) : IUserRepository
{
    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

    public async Task AddAsync(User user, CancellationToken ct) =>
        await db.Users.AddAsync(user, ct);

    public Task<int> SaveChangesAsync(CancellationToken ct) =>
        db.SaveChangesAsync(ct);
}`,
        },
        {
          path: "src/Api/Controllers/UsersController.cs",
          language: "csharp",
          description: "Thin controller: translate HTTP ↔ application calls, nothing else.",
          content: `using Microsoft.AspNetCore.Mvc;
using MyApi.Application.Users;

namespace MyApi.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController(UserService userService) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateUserRequest request, CancellationToken ct)
    {
        var (user, error) = await userService.CreateAsync(request, ct);
        if (error == "email_taken")
            return Conflict(new { error });
        return CreatedAtAction(nameof(GetById), new { id = user!.Id }, user);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var user = await userService.GetByIdAsync(id, ct);
        return user is null ? NotFound() : Ok(user);
    }
}`,
        },
        {
          path: "src/Api/Program.cs",
          language: "csharp",
          description: "Composition root: DI wiring lives here and only here.",
          content: `using Microsoft.EntityFrameworkCore;
using MyApi.Application.Interfaces;
using MyApi.Application.Users;
using MyApi.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<UserService>();

var app = builder.Build();

app.MapControllers();

app.Run();`,
        },
        {
          path: "src/Api/appsettings.Development.json",
          language: "json",
          description: "Local connection string. Production values come from environment variables or a secret store, never this file.",
          content: `{
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=myapi;Username=app;Password=dev_only_password"
  },
  "Logging": {
    "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" }
  }
}`,
        },
        {
          path: "tests/UnitTests/UserServiceTests.cs",
          language: "csharp",
          description: "Unit test with an in-memory fake repository — no database needed, because the architecture kept EF out of Application.",
          content: `using MyApi.Application.Interfaces;
using MyApi.Application.Users;
using MyApi.Domain.Entities;

namespace MyApi.UnitTests;

public class UserServiceTests
{
    private class FakeUserRepository : IUserRepository
    {
        public readonly List<User> Users = [];
        public Task<User?> GetByIdAsync(Guid id, CancellationToken ct) =>
            Task.FromResult(Users.FirstOrDefault(u => u.Id == id));
        public Task<User?> GetByEmailAsync(string email, CancellationToken ct) =>
            Task.FromResult(Users.FirstOrDefault(u => u.Email == email));
        public Task AddAsync(User user, CancellationToken ct)
        { Users.Add(user); return Task.CompletedTask; }
        public Task<int> SaveChangesAsync(CancellationToken ct) => Task.FromResult(1);
    }

    [Fact]
    public async Task Create_returns_user_for_new_email()
    {
        var service = new UserService(new FakeUserRepository());
        var (user, error) = await service.CreateAsync(
            new CreateUserRequest("ada@example.com", "Ada"), CancellationToken.None);

        Assert.Null(error);
        Assert.NotNull(user);
        Assert.Equal("ada@example.com", user!.Email);
    }

    [Fact]
    public async Task Create_rejects_duplicate_email()
    {
        var repo = new FakeUserRepository();
        var service = new UserService(repo);
        await service.CreateAsync(new CreateUserRequest("ada@example.com", "Ada"), CancellationToken.None);

        var (user, error) = await service.CreateAsync(
            new CreateUserRequest("ada@example.com", "Other"), CancellationToken.None);

        Assert.Null(user);
        Assert.Equal("email_taken", error);
    }
}`,
        },
      ],
    },
    {
      id: "database",
      title: "05 Database & migrations",
      description: "Start PostgreSQL, create the first migration from the model, apply it.",
      commands: [
        {
          shell: "bash",
          description: "Start PostgreSQL in Docker",
          code: `docker run -d --name myapi-db \\
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=dev_only_password -e POSTGRES_DB=myapi \\
  -p 5432:5432 -v myapi-pgdata:/var/lib/postgresql/data \\
  postgres:16-alpine`,
        },
        {
          shell: "bash",
          provenance: "official",
          description: "Install the EF CLI (once per machine), then create and apply the migration",
          code: `dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate --project src/Infrastructure --startup-project src/Api
dotnet ef database update --project src/Infrastructure --startup-project src/Api`,
        },
      ],
      warnings: ["If `dotnet ef` isn't found after install, restart the terminal so PATH picks up the global tools directory."],
    },
    {
      id: "run",
      title: "06 Run & test the endpoint",
      description: "Start the API and exercise the full flow.",
      commands: [
        { shell: "bash", description: "Run the API", code: "dotnet run --project src/Api" },
        {
          shell: "bash",
          description: "Create a user, then fetch it (adjust the port to what `dotnet run` prints)",
          code: `curl -s -X POST http://localhost:5000/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}'

curl -s http://localhost:5000/api/users/<id-from-response>`,
        },
        { shell: "bash", description: "Run the tests", code: "dotnet test" },
      ],
    },
    {
      id: "architecture",
      title: "07 Architecture: why it's wired this way",
      description:
        "Dependency direction: Api → Application → Domain, Infrastructure → Application → Domain. Domain knows nothing about EF or HTTP. Application defines IUserRepository (the port); Infrastructure implements it (the adapter); Api wires them in Program.cs (the composition root). That's why UserService is unit-testable with a 10-line fake — the payoff of the whole structure.",
      notes: [
        "Rule of thumb: if a file in Application imports anything from Infrastructure, the architecture is broken — fix the direction, don't add an exception.",
        "This structure is worth its boilerplate for long-lived systems with real domain logic. For a small CRUD API, prefer the simpler Node/Express or Minimal API shape.",
      ],
    },
    {
      id: "docker",
      title: "08 Docker",
      description: "Multi-stage Dockerfile plus a compose file for app + database.",
      files: [
        {
          path: "Dockerfile",
          language: "dockerfile",
          content: `FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish src/Api -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "MyApi.Api.dll"]`,
        },
        {
          path: "docker-compose.yml",
          language: "yaml",
          content: `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: dev_only_password
      POSTGRES_DB: myapi
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 10

  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      ConnectionStrings__Default: Host=db;Port=5432;Database=myapi;Username=app;Password=dev_only_password
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:`,
        },
      ],
      commands: [{ shell: "bash", code: "docker compose up --build", description: "Run the whole stack" }],
    },
    {
      id: "cicd",
      title: "09 CI/CD",
      description: "GitHub Actions workflow: restore, build, test on every push and PR.",
      files: [
        {
          path: ".github/workflows/ci.yml",
          language: "yaml",
          content: `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: 8.0.x
      - run: dotnet restore
      - run: dotnet build --no-restore -c Release
      - run: dotnet test --no-build -c Release`,
        },
      ],
    },
    {
      id: "production",
      title: "10 Production checklist",
      description: "Before this goes anywhere near real traffic:",
      notes: [
        "Secrets: connection string and keys from environment variables or a secret manager — appsettings.Development.json never leaves dev.",
        "Add authentication (JWT recipe) and authorization policies.",
        "Add health checks (/healthz, /readyz) and structured logging (Serilog recipe).",
        "Add rate limiting and CORS configured to your frontend origin only.",
        "Run migrations as a deploy step, not automatically at app start with multiple replicas.",
        "Set up database backups and test restoring one.",
      ],
    },
  ],
  files: [],
};
