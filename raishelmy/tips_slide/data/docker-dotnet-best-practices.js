/* ── Docker Best Practices for .NET ─────────────────────────────── */
window.TIP_DATA = {
  id: 'docker-dotnet-best-practices',
  title: 'Docker Best Practices for .NET',
  description: 'Multi-stage builds, non-root user, layer caching, .dockerignore — building lean, secure .NET container images.',
  category: 'DevOps · 7 slides',
  tags: ['#docker', '#dotnet', '#devops', '#containers'],
  date: '2026-04-18',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `First .NET Docker image I ever built: 1.8GB. Running as root. SDK in production. 300+ critical vulnerabilities on the security scan.

The images I build now sit around 90MB. Non-root user. Multi-stage build. No dev tools anywhere near the runtime layer.

The gap is not complicated — you just need to know the patterns. Multi-stage builds, right base images, layer ordering for cache hits, .dockerignore.

All of it in these slides.

#docker #dotnet #devops #containers`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Docker & .NET.<br><span style="color:var(--red);">Running as root.</span><br><span style="color:#555;font-weight:300;">1.8GB image.</span>',
      description: 'Dockerfile: FROM mcr.microsoft.com/dotnet/sdk:8.0. No multi-stage build. Running as root. 1.8GB image. Security scan: 340 critical vulnerabilities from the SDK tools in production.',
      tags: ['#docker', '#dotnet', '#devops', '#containers']
    },

    /* 02 Multi-stage Build */
    {
      type: 'evr-code',
      label: 'topic 1 · multi-stage builds',
      expect_items: [
        'Multi-stage: build stage uses SDK, final stage uses runtime-only — image size 80% smaller.',
        'Copy .csproj and restore before copying source — layer cache avoids re-restore on code changes.',
        'Use mcr.microsoft.com/dotnet/aspnet:8.0 runtime (not SDK) for final image.'
      ],
      reality_items: [
        'Single stage FROM sdk — ships compiler, NuGet cache, build tools in production image.',
        'No .dockerignore — COPY . . copies bin/obj/node_modules/secrets into image context.',
        'Rebuild restores all packages on every code change — no layer caching, slow CI.'
      ],
      code_good: `<span class="cgr"># ✦ Multi-stage Dockerfile</span>
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY src/*.csproj ./src/              <span class="cgr"># ← copy .csproj first</span>
RUN dotnet restore src/*.csproj       <span class="cgr"># ← cached layer</span>
COPY . .
RUN dotnet publish src -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final  <span class="cgr"># ← runtime only</span>
WORKDIR /app
RUN adduser -u 1001 --disabled-password appuser     <span class="cgr"># ← non-root</span>
COPY --from=build /app/publish .
USER appuser                                        <span class="cgr"># ← non-root user</span>
ENTRYPOINT ["dotnet", "MyApp.dll"]`,
      code_bad: `<span class="cgr"># ✗ Single stage, no .dockerignore, root</span>
FROM mcr.microsoft.com/dotnet/sdk:8.0
WORKDIR /app
COPY . .          <span class="cgr"># copies bin/obj/secrets too</span>
RUN dotnet publish -c Release -o /out
ENTRYPOINT ["dotnet", "/out/MyApp.dll"]
<span class="cgr"># Result: 1.8GB image running as root
# SDK tools accessible at runtime`
    },

    /* 03 Security */
    {
      type: 'evr',
      label: 'topic 2 · container security',
      expect_items: [
        'Non-root user: RUN adduser + USER appuser — limits blast radius of container escape.',
        '.dockerignore: exclude .git, bin, obj, *.user, appsettings.Development.json, secrets/',
        'Scan with docker scout or trivy in CI — block deploys with critical CVEs.'
      ],
      reality_items: [
        'Running as root in containers — container escape = full host access.',
        'No .dockerignore — development configs, local secrets copied into image layers.',
        'No security scanning in CI — deploying images with known CVEs to production unknowingly.'
      ],
      code: `<span class="cgr"># .dockerignore</span>
.git
.gitignore
bin/
obj/
*.user
*.suo
.vs/
appsettings.Development.json
appsettings.Local.json
secrets/
local.env

<span class="cgr"># trivy scan in CI (GitHub Actions)</span>
- <span class="cr">name</span>: Scan image
  <span class="cr">uses</span>: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:${{ github.sha }}
    format: sarif
    exit-code: <span class="cb">1</span>            <span class="cgr"># ← fails pipeline on critical CVE</span>
    severity: CRITICAL,HIGH`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · container best practices',
      cells: [
        { label: 'Base Image',      value: 'dotnet/aspnet:8.0 (runtime)',    sub: 'Never use SDK in final stage' },
        { label: 'Multi-stage',     value: 'Build → Test → Publish → Final', sub: 'Each stage discards previous layer bloat' },
        { label: '.dockerignore',   value: 'bin, obj, .git, secrets',        sub: 'Reduces build context, hides local config' },
        { label: 'Non-root User',   value: 'RUN adduser + USER appuser',     sub: 'UID 1000-65534 — never 0 (root) in prod' },
        { label: 'Layer Caching',   value: 'Copy .csproj first, restore, then COPY .', sub: 'Restore cached until .csproj changes' },
        { label: 'CVE Scanning', red: true, value: 'trivy / docker scout CI', sub: 'Gate releases on critical vulnerability count' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · the sdk is not your runtime',
      quote_title: 'The .NET SDK ships a compiler,<br>NuGet, and <span style="color:var(--red);">build tools.</span>',
      quote_body: 'None of those tools should be in your production container. The runtime image (dotnet/aspnet) is a fraction of the SDK size — ~200MB vs ~800MB. Smaller means fewer attack surfaces, faster pulls, lower container registry costs.',
      left_label: 'Distroless images',
      left_body: 'mcr.microsoft.com/dotnet/runtime-deps + self-contained publish produces the smallest possible image — no OS shell, no package manager. Hardest to debug but most secure.',
      right_label: 'Health checks in Dockerfile',
      right_body: 'HEALTHCHECK CMD curl -f http://localhost:8080/healthz || exit 1 — Docker and k8s use this to detect and restart unhealthy containers automatically.',
      insight: 'In Kubernetes, <strong style="color:#fff;">a lean image is not just a security concern</strong> — it directly affects cold start time and node autoscale speed. A 200MB image pulls 4× faster than an 800MB one on a new node.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
