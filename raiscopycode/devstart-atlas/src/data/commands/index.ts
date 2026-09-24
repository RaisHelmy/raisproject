import type { CheatSheet } from "../../types";

export const cheatSheets: CheatSheet[] = [
  {
    id: "git",
    title: "Git",
    icon: "bi-git",
    description: "Everyday Git — from init to rebase, with clear warnings on the destructive ones.",
    tags: ["git", "version control", "vcs", "commit", "branch", "merge", "rebase"],
    groups: [
      {
        title: "Start & clone",
        entries: [
          { code: "git init", description: "Create a new repository in the current directory" },
          { code: "git clone https://github.com/user/repo.git", description: "Clone a remote repository" },
          { code: "git clone --depth 1 https://github.com/user/repo.git", description: "Shallow clone (faster, no full history)" },
        ],
      },
      {
        title: "Everyday flow",
        entries: [
          { code: "git status", description: "Show changed/staged/untracked files" },
          { code: "git add .", description: "Stage all changes in the current directory" },
          { code: "git add -p", description: "Stage interactively, hunk by hunk" },
          { code: 'git commit -m "feat: add user endpoint"', description: "Commit staged changes" },
          { code: "git log --oneline --graph -20", description: "Compact history with branch graph" },
          { code: "git diff", description: "Unstaged changes; add --staged for staged changes" },
        ],
      },
      {
        title: "Branches",
        entries: [
          { code: "git branch", description: "List local branches" },
          { code: "git switch -c feature/login", description: "Create and switch to a new branch" },
          { code: "git switch main", description: "Switch to an existing branch" },
          { code: "git merge feature/login", description: "Merge a branch into the current one" },
          { code: "git branch -d feature/login", description: "Delete a merged branch (-D forces, even if unmerged)", warning: "-D discards unmerged commits on that branch." },
        ],
      },
      {
        title: "Sync with remotes",
        entries: [
          { code: "git remote -v", description: "List configured remotes" },
          { code: "git fetch origin", description: "Download remote changes without touching your work" },
          { code: "git pull --rebase origin main", description: "Update your branch, replaying your commits on top" },
          { code: "git push -u origin feature/login", description: "Push a branch and set its upstream" },
        ],
      },
      {
        title: "Undo & rewrite",
        entries: [
          { code: "git restore file.ts", description: "Discard unstaged changes to a file", warning: "Discarded changes are gone — there is no undo." },
          { code: "git restore --staged file.ts", description: "Unstage a file (keeps the changes)" },
          { code: "git revert <commit>", description: "Safely undo a commit by creating an inverse commit (history preserved)" },
          { code: "git reset --soft HEAD~1", description: "Undo the last commit, keep its changes staged" },
          { code: "git reset --hard HEAD~1", description: "Delete the last commit AND its changes", warning: "Destructive: uncommitted work and the commit's changes are lost. Check `git reflog` if you need to recover." },
          { code: "git commit --amend", description: "Edit the last commit (message or content)", warning: "Rewrites history — don't amend commits already pushed to a shared branch." },
        ],
      },
      {
        title: "Stash, rebase, cherry-pick, tags",
        entries: [
          { code: "git stash", description: "Shelve uncommitted changes; `git stash pop` restores them" },
          { code: "git rebase main", description: "Replay your branch's commits on top of main", warning: "Rewrites history — never rebase a branch others are working on." },
          { code: "git cherry-pick <commit>", description: "Apply one specific commit onto the current branch" },
          { code: "git tag -a v1.0.0 -m 'Release 1.0.0'", description: "Create an annotated tag; push with `git push origin v1.0.0`" },
          { code: "git reflog", description: "Every position HEAD has been at — the safety net for recovering 'lost' commits" },
        ],
      },
    ],
  },
  {
    id: "docker",
    title: "Docker",
    icon: "bi-box",
    description: "Images, containers, logs, exec and Compose — the commands you actually use.",
    tags: ["docker", "container", "compose", "image", "devops"],
    groups: [
      {
        title: "Images",
        entries: [
          { code: "docker build -t my-api:latest .", description: "Build an image from the Dockerfile in the current directory" },
          { code: "docker images", description: "List local images" },
          { code: "docker pull postgres:16-alpine", description: "Download an image" },
          { code: "docker image prune -a", description: "Delete all unused images", warning: "Removes every image not used by a container — expect re-downloads." },
        ],
      },
      {
        title: "Containers",
        entries: [
          { code: "docker run --rm -p 3000:3000 --env-file .env my-api", description: "Run a container, map port 3000, auto-remove on exit" },
          { code: "docker run -d --name db -e POSTGRES_PASSWORD=dev postgres:16-alpine", description: "Run detached with a name and env var" },
          { code: "docker ps", description: "List running containers (-a includes stopped)" },
          { code: "docker stop db && docker rm db", description: "Stop then remove a container" },
          { code: "docker logs -f my-api", description: "Follow a container's logs" },
          { code: "docker exec -it db psql -U postgres", description: "Open an interactive shell/command inside a running container" },
          { code: "docker inspect my-api", description: "Full JSON details (network, mounts, env)" },
          { code: "docker stats", description: "Live CPU/memory usage per container" },
        ],
      },
      {
        title: "Compose",
        entries: [
          { code: "docker compose up -d", description: "Start all services in the background (--build to rebuild)" },
          { code: "docker compose logs -f api", description: "Follow one service's logs" },
          { code: "docker compose exec api sh", description: "Shell into a running service" },
          { code: "docker compose down", description: "Stop and remove containers and networks" },
          { code: "docker compose down -v", description: "Also remove volumes", warning: "Deletes named volumes — database data is lost." },
        ],
      },
      {
        title: "Cleanup",
        entries: [
          { code: "docker system df", description: "Show disk usage by images/containers/volumes" },
          { code: "docker system prune", description: "Remove stopped containers, unused networks and dangling images", warning: "Add -a --volumes to remove everything unused, including volumes with data." },
        ],
      },
    ],
  },
  {
    id: "linux",
    title: "Linux / Shell",
    icon: "bi-terminal",
    description: "Files, search, processes, services and disks — with PowerShell equivalents where useful.",
    tags: ["linux", "bash", "shell", "unix", "terminal", "grep", "find"],
    groups: [
      {
        title: "Files & directories",
        entries: [
          { code: "mkdir -p src/app/services", description: "Create nested directories (PowerShell: New-Item -ItemType Directory -Force src/app/services)" },
          { code: "touch README.md", description: "Create an empty file (PowerShell: New-Item README.md)" },
          { code: "cp -r src/ backup/", description: "Copy recursively (PowerShell: Copy-Item -Recurse src backup)" },
          { code: "mv old.txt new.txt", description: "Move/rename (PowerShell: Move-Item)" },
          { code: "rm -rf node_modules", description: "Delete a directory tree", warning: "rm -rf is unrecoverable. Double-check the path — especially with variables: `rm -rf \"$DIR\"/` with an empty $DIR is catastrophic." },
          { code: "ls -lah", description: "List with sizes, permissions and hidden files (PowerShell: Get-ChildItem -Force)" },
        ],
      },
      {
        title: "Viewing & searching",
        entries: [
          { code: "cat config.json", description: "Print a file (PowerShell: Get-Content)" },
          { code: "less app.log", description: "Page through a file; q to quit, / to search" },
          { code: "tail -f app.log", description: "Follow a growing log (PowerShell: Get-Content -Wait)" },
          { code: 'grep -rn "TODO" src/', description: "Search recursively with line numbers (PowerShell: Select-String -Path src -Pattern TODO -Recurse)" },
          { code: 'find . -name "*.ts" -not -path "*/node_modules/*"', description: "Find files by name, excluding a directory" },
          { code: "sed -i 's/localhost/0.0.0.0/g' config.yml", description: "In-place find & replace (macOS: sed -i '' ...)" },
          { code: "awk -F',' '{print $2}' data.csv", description: "Print the second comma-separated column" },
        ],
      },
      {
        title: "Network & downloads",
        entries: [
          { code: "curl -s https://api.example.com/health | jq", description: "GET a URL and pretty-print JSON" },
          { code: "curl -o file.tar.gz https://example.com/file.tar.gz", description: "Download to a file (or wget URL)" },
          { code: "ss -tlnp", description: "Which processes listen on which ports (macOS: lsof -i -P | grep LISTEN)" },
        ],
      },
      {
        title: "Processes & services",
        entries: [
          { code: "ps aux | grep node", description: "Find processes by name" },
          { code: "top", description: "Live process monitor (htop if installed)" },
          { code: "kill -15 <pid>", description: "Ask a process to exit gracefully; -9 force-kills as last resort", warning: "kill -9 skips cleanup handlers — use only when -15 fails." },
          { code: "systemctl status nginx", description: "Service status (start/stop/restart/enable likewise)" },
          { code: "journalctl -u nginx -f --since '10 min ago'", description: "Follow a service's logs" },
        ],
      },
      {
        title: "Disk & permissions",
        entries: [
          { code: "df -h", description: "Free space per filesystem" },
          { code: "du -sh */ | sort -h", description: "Size of each subdirectory, sorted" },
          { code: "chmod +x deploy.sh", description: "Make a script executable" },
          { code: "chown -R app:app /var/www/app", description: "Change owner recursively" },
        ],
      },
    ],
  },
  {
    id: "powershell",
    title: "PowerShell",
    icon: "bi-terminal-fill",
    description: "The Windows-native (and cross-platform) equivalents for everyday shell work.",
    tags: ["powershell", "windows", "shell", "pwsh", "scripting"],
    groups: [
      {
        title: "Files & directories",
        entries: [
          { code: "New-Item -ItemType Directory -Force src/app/services", description: "Create nested directories (like mkdir -p)", shell: "powershell" },
          { code: "New-Item README.md", description: "Create an empty file", shell: "powershell" },
          { code: "Copy-Item -Recurse src backup", description: "Copy a directory tree", shell: "powershell" },
          { code: "Remove-Item -Recurse -Force node_modules", description: "Delete a directory tree", shell: "powershell", warning: "Unrecoverable, like rm -rf." },
          { code: "Get-ChildItem -Force", description: "List files including hidden (alias: ls, dir)", shell: "powershell" },
        ],
      },
      {
        title: "Content & search",
        entries: [
          { code: "Get-Content app.log -Tail 50 -Wait", description: "Follow a log like tail -f", shell: "powershell" },
          { code: "Select-String -Path src -Pattern 'TODO' -Recurse", description: "grep equivalent", shell: "powershell" },
          { code: "Get-ChildItem -Recurse -Filter *.ts | Where-Object FullName -NotMatch node_modules", description: "find equivalent with exclusion", shell: "powershell" },
        ],
      },
      {
        title: "Processes, services, network",
        entries: [
          { code: "Get-Process node", description: "Find processes by name", shell: "powershell" },
          { code: "Stop-Process -Name node -Force", description: "Kill processes by name", shell: "powershell", warning: "Kills every matching process." },
          { code: "Get-Service | Where-Object Status -eq 'Running'", description: "List running services", shell: "powershell" },
          { code: "Invoke-RestMethod https://api.example.com/health", description: "curl-for-JSON: GET and parse in one step", shell: "powershell" },
          { code: "Test-NetConnection localhost -Port 5432", description: "Check if a port is reachable", shell: "powershell" },
          { code: "Get-NetTCPConnection -State Listen | Select LocalPort,OwningProcess", description: "What's listening on which port", shell: "powershell" },
        ],
      },
      {
        title: "Environment",
        entries: [
          { code: "$env:DATABASE_URL = 'postgres://localhost:5432/app'", description: "Set an env var for this session", shell: "powershell" },
          { code: "Get-ChildItem Env:", description: "List all environment variables", shell: "powershell" },
        ],
      },
    ],
  },
  {
    id: "http",
    title: "HTTP / API",
    icon: "bi-globe",
    description: "Methods, status codes, headers, auth and copyable curl for every common API call.",
    tags: ["http", "api", "rest", "curl", "status codes", "headers", "cors"],
    groups: [
      {
        title: "Methods (when to use which)",
        entries: [
          { code: "GET /api/users?page=2&sort=-createdAt", description: "Read. Safe and idempotent; never changes state; cacheable." },
          { code: "POST /api/users", description: "Create (or non-idempotent action). Returns 201 with a Location header." },
          { code: "PUT /api/users/42", description: "Full replace. Idempotent — sending it twice gives the same result." },
          { code: "PATCH /api/users/42", description: "Partial update — send only the fields that change." },
          { code: "DELETE /api/users/42", description: "Delete. Idempotent; a second call typically returns 404 or 204." },
        ],
      },
      {
        title: "Status codes that matter",
        entries: [
          { code: "200 OK / 201 Created / 204 No Content", description: "Success: general / resource created / success with no body" },
          { code: "301 / 302 / 304", description: "Moved permanently / temporary redirect / not modified (cache hit)" },
          { code: "400 / 401 / 403 / 404 / 409 / 422", description: "Bad request / not authenticated / not allowed / not found / conflict / validation failed" },
          { code: "429 Too Many Requests", description: "Rate limited — honor the Retry-After header" },
          { code: "500 / 502 / 503 / 504", description: "Server error / bad gateway / unavailable / gateway timeout — retry with backoff if idempotent" },
        ],
      },
      {
        title: "curl for everything",
        entries: [
          { code: "curl -s https://api.example.com/users | jq", description: "GET with pretty-printed JSON" },
          { code: `curl -s -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"a@b.com","name":"Ada"}'`, description: "POST JSON" },
          { code: `curl -s https://api.example.com/me \\
  -H "Authorization: Bearer $TOKEN"`, description: "Authenticated request" },
          { code: "curl -i -s https://api.example.com/health", description: "Include response headers (-I for headers only)" },
          { code: "curl -s -w '%{http_code} %{time_total}s\\n' -o /dev/null https://api.example.com", description: "Just the status code and timing" },
          { code: `curl -s -X PATCH https://api.example.com/users/42 \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"name":"Ada Lovelace"}'`, description: "PATCH with an idempotency key for safe retries" },
        ],
      },
      {
        title: "Headers & auth",
        entries: [
          { code: "Authorization: Bearer <jwt>", description: "Token auth — the API standard. Cookies (with HttpOnly, Secure, SameSite) for browser sessions." },
          { code: "Content-Type / Accept: application/json", description: "What you're sending / what you want back" },
          { code: "Cache-Control: no-store | max-age=3600", description: "Response cacheability" },
          { code: "X-Request-Id / traceparent", description: "Correlation IDs — pass them through every hop for tracing" },
        ],
      },
      {
        title: "API design conventions",
        entries: [
          { code: "GET /api/v1/orders?status=pending&sort=-createdAt&page=1&pageSize=20", description: "Convention: filtering + sorting (- prefix = descending) + pagination in query params" },
          { code: `{ "error": { "code": "email_taken", "message": "Email already registered" } }`, description: "Convention: machine-readable error code + human message (see also RFC 9457 problem+json)" },
          { code: "/api/v1/... or Accept-Version header", description: "Version your API from day one — path versioning is the pragmatic default" },
        ],
      },
    ],
  },
  {
    id: "regex",
    title: "Regex",
    icon: "bi-asterisk",
    description: "The regex constructs you look up every time, plus battle-tested common patterns.",
    tags: ["regex", "regular expression", "pattern", "match"],
    groups: [
      {
        title: "Building blocks",
        entries: [
          { code: ".  \\d  \\w  \\s", description: "Any char / digit / word char [a-zA-Z0-9_] / whitespace (capitalize to negate: \\D \\W \\S)" },
          { code: "*  +  ?  {2,5}", description: "0+ / 1+ / 0 or 1 / between 2 and 5 repetitions" },
          { code: "^  $  \\b", description: "Start of line / end of line / word boundary" },
          { code: "[abc]  [^abc]  [a-z0-9]", description: "Character class / negated / range" },
          { code: "(foo|bar)  (?:foo)  (?<name>foo)", description: "Capture group with alternation / non-capturing / named group" },
          { code: "a(?=b)  a(?!b)", description: "Lookahead: 'a' followed by b / not followed by b" },
          { code: "*?  +?", description: "Lazy quantifiers — match as little as possible (e.g. <.+?> for single tags)" },
        ],
      },
      {
        title: "Common patterns",
        entries: [
          { code: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", description: "Pragmatic email check (full RFC validation isn't worth a regex — verify by sending)" },
          { code: "^\\d{4}-\\d{2}-\\d{2}$", description: "ISO date (YYYY-MM-DD) shape" },
          { code: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", description: "UUID (case-insensitive flag recommended)" },
          { code: "^https?:\\/\\/[^\\s/$.?#].[^\\s]*$", description: "Rough URL shape check" },
          { code: "^[a-z0-9]+(?:-[a-z0-9]+)*$", description: "URL slug (kebab-case)" },
          { code: "\\/\\*[\\s\\S]*?\\*\\/", description: "Block comments /* ... */ (lazy, spans lines)" },
        ],
      },
      {
        title: "Usage",
        entries: [
          { code: 'grep -E "error|warn" app.log', description: "Extended regex in grep" },
          { code: 'const m = "2026-09-04".match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);', description: "JavaScript: m[1] is the year; use .test() for a boolean" },
          { code: "sed -E 's/user_([0-9]+)/id:\\1/g' file.txt", description: "Backreference in a sed replacement" },
        ],
      },
    ],
  },
];

export const cheatSheetById = new Map(cheatSheets.map((c) => [c.id, c]));
