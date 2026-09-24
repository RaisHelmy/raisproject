# RUNFORGE

## Product Name

**RunForge**

### Tagline

**Your infrastructure. One control panel.**

Alternative:

**Deploy. Manage. Monitor. Anywhere.**

---

# 1. PRODUCT VISION

Build a production-quality SaaS platform called **RunForge**.

RunForge is a modern cloud server and application management control panel inspired by the operational model of RunCloud, but designed for modern developers and modern infrastructure.

Reference product:

**RunCloud**

RunCloud demonstrates the important concept of:

> Connect your own infrastructure, then manage the server and applications through a powerful web control panel.

RunForge should take this concept significantly further.

RunForge should combine:

* RunCloud-style server management
* Google Cloud Run-style application/service management
* Cloudflare networking
* Docker/container management
* GitHub/GitLab deployment
* Database management
* Reverse proxy management
* Domain/DNS management
* Monitoring
* Logs
* Backups
* Infrastructure automation
* Self-hosted servers
* Proxmox
* Cloud Run
* Cloudflare Workers/Containers
* MCP
* AI infrastructure operations

The user should be able to manage almost their entire application infrastructure from RunForge.

---

# 2. CORE PRODUCT PRINCIPLE

The most important principle:

> **RunForge is a control plane, not a hosting provider.**

Users can bring their own infrastructure.

Examples:

```text
VPS
Dedicated Server
AWS
Azure
Google Cloud
DigitalOcean
Hetzner
Vultr
UpCloud
Proxmox
Home Lab
Office Server
Cloud Run
Cloudflare
Docker Host
Kubernetes
```

RunForge connects to that infrastructure and provides a unified management layer.

The user should NOT have to repeatedly SSH into servers for common operations.

---

# 3. PRIMARY USER EXPERIENCE

The primary workflow should be:

```text
Create Account
      ↓
Create Organization
      ↓
Connect Server
      ↓
Install RunForge Agent
      ↓
Server appears in dashboard
      ↓
Create Application
      ↓
Connect GitHub/GitLab
      ↓
Select Repository
      ↓
Configure Runtime
      ↓
Configure Domain
      ↓
Configure Database
      ↓
Deploy
      ↓
Monitor
      ↓
Manage
```

The entire workflow should feel simple enough for a developer who understands applications but does not want to be a Linux system administrator.

---

# 4. IMPORTANT DIFFERENCE FROM RUNCOUD

Do not make RunForge merely a RunCloud clone.

RunCloud's current product focuses heavily on server/application management, Git deployment, monitoring, Docker, DNS, backups and web infrastructure.

RunForge should preserve that excellent control-panel concept but make the underlying architecture:

```text
Provider agnostic
Container first
API first
Event driven
MCP first
AI ready
Database agnostic
Cloudflare native
```

---

# 5. TECHNOLOGY STACK

Frontend:

* React
* TypeScript
* Bootstrap 5
* Bootstrap Icons
* Highcharts
* React

Backend/control plane:

* Bun
* TypeScript
* Cloudflare Workers

Storage:

* Postgres (via Cloudflare Hyperdrive)
* Cloudflare R2

Use:

* Cloudflare Queues
* Durable Objects
* Workflows

where appropriate.

Use asynchronous jobs for long-running operations.

---

# 6. CONTROL PLANE ARCHITECTURE

Architecture:

```text
                         RUNFORGE
                       CONTROL PLANE

                         React UI
                            │
                            ▼
                    Cloudflare Workers
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          Projects      Deployments       MCP
             │              │              │
             └──────────────┼──────────────┘
                            │
                       Job / Event Bus
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
        ▼                   ▼                    ▼
   Cloudflare           Cloud Run            Self-hosted
        │                   │                    │
        │                   │               RunForge Agent
        │                   │                    │
        │                   │             ┌──────┼───────┐
        │                   │             │      │       │
        │                   │           Docker Proxmox Linux
        │                   │
        └───────────────────┴────────────────────┘
```

---

# 7. PROVIDER ABSTRACTION

This is critical.

Never hard-code RunForge directly to Cloudflare or Docker.

Create interfaces.

Example conceptual architecture:

```text
ComputeProvider
├── DockerProvider
├── CloudRunProvider
├── CloudflareProvider
├── ProxmoxProvider
├── KubernetesProvider
└── FutureAWSProvider
```

Server provider:

```text
ServerProvider
├── SelfHostedProvider
├── DigitalOceanProvider
├── HetznerProvider
├── VultrProvider
├── AWSProvider
└── AzureProvider
```

Database:

```text
DatabaseProvider
├── PostgreSQL
├── MySQL
├── SQLServer
├── SQLite
└── Future providers
```

Git:

```text
GitProvider
├── GitHub
├── GitLab
├── Bitbucket
├── Gitea
└── Custom Git
```

Networking:

```text
NetworkProvider
├── Cloudflare
├── Nginx
├── Docker
├── Caddy
└── Future providers
```

The control plane must communicate with these through interfaces.

---

# 8. MAIN SIDEBAR

Create a professional infrastructure dashboard sidebar.

Navigation:

```text
Overview

Projects
Applications
Deployments

Servers
Containers
Services

Databases
Storage

Domains
DNS
Networking

Monitoring
Logs
Events
Incidents

Git

Backups

MCP
AI Operations

Templates

Integrations

Team

Settings
```

Sidebar should support collapse.

---

# 9. OVERVIEW DASHBOARD

The dashboard should immediately answer:

> Is everything okay?

Show:

```text
Projects
12

Applications
47

Servers
8

Containers
94

Databases
16

Deployments Today
38

Healthy
43

Degraded
3

Failed
1
```

Then show:

### Infrastructure Health

Highcharts:

* CPU
* Memory
* Network
* Requests
* Errors
* Latency

### Recent Activity

Timeline:

```text
Deployment completed
API restarted
Server connected
Database backup completed
Domain added
Container stopped
SSL renewed
```

### Recent Deployments

Show:

* Application
* Environment
* Version
* Commit
* Server
* Status
* Duration
* Time

---

# 10. SERVERS

This is one of the most important sections.

Create:

**Servers**

List:

```text
Server
Status
Provider
OS
CPU
RAM
Disk
Containers
Applications
Uptime
```

Example:

```text
production-01

● Online

Ubuntu 24.04
8 CPU
32 GB RAM
420 GB SSD

CPU 17%
RAM 41%
Disk 62%

12 Containers
4 Applications
```

Actions:

* Connect
* Install Agent
* Restart Agent
* View Details
* Terminal
* Containers
* Services
* Networking
* Firewall
* Monitoring
* Logs
* Backups
* Remove

---

# 11. SERVER CONNECTION

Support:

### Automatic

User provides cloud provider API credentials.

RunForge can:

* Create server
* Select region
* Select CPU
* Select RAM
* Select disk
* Select OS
* Provision server
* Install RunForge Agent
* Connect server

### Manual

Show installation command:

```bash
curl -fsSL https://install.runforge.dev | sh
```

User runs it on the server.

Agent connects outbound to RunForge.

Do NOT require the RunForge control plane to expose an administrative endpoint on the user's server.

---

# 12. RUNFORGE AGENT

Build architecture for:

**runforge-agent**

The agent runs on Linux servers.

Responsibilities:

* Server metrics
* Docker management
* Process management
* Service management
* Network management
* Firewall integration
* Application deployment
* Logs
* Health checks
* File operations
* Backups
* Reverse proxy configuration

Agent should communicate securely outbound.

Never blindly execute arbitrary commands received from the browser.

Commands should pass through:

```text
Authentication
Authorization
Validation
Command policy
Execution
Audit event
```

---

# 13. SERVER DETAIL

Server page should feel like a professional cloud management console.

Header:

```text
production-01

● Healthy

Ubuntu 24.04
Hetzner
Singapore

[Deploy] [Terminal] [Restart Agent] [...]
```

Metrics:

```text
CPU
17%

Memory
41%

Disk
62%

Network
3.8 Mbps
```

Tabs:

```text
Overview
Applications
Containers
Services
Processes
Databases
Storage
Networking
Firewall
Monitoring
Logs
Events
Backups
Settings
```

---

# 14. APPLICATIONS

Applications are the primary deployment abstraction.

Create:

```text
Applications
```

Each application has:

* Name
* Project
* Environment
* Source
* Runtime
* Server/provider
* Domain
* Port
* Database
* Storage
* Deployment
* Health
* Logs
* Metrics

Example:

```text
MERC999 API

● Healthy

Production

https://api.example.com

Docker
.NET 8

Port 8080

PostgreSQL
Connected

CPU 18%
Memory 421MB
```

---

# 15. APPLICATION CREATION

Create a polished wizard.

## Step 1

Choose source:

```text
GitHub
GitLab
Bitbucket
Custom Git
Docker Image
Dockerfile
Manual
```

## Step 2

Repository:

```text
Account
Repository
Branch
```

## Step 3

Runtime:

Automatically detect:

* .NET
* Node.js
* Bun
* Python
* Go
* Java
* PHP
* Rust
* Docker

## Step 4

Build:

```text
Dockerfile
Build command
Start command
Working directory
```

## Step 5

Runtime:

```text
CPU
Memory
Instances
Minimum instances
Maximum instances
Port
Health endpoint
```

## Step 6

Environment variables

## Step 7

Database

## Step 8

Storage

## Step 9

Domain/networking

## Step 10

Deployment target

```text
Self-hosted Server
Docker
Cloud Run
Cloudflare
Proxmox
```

## Step 11

Review

## Step 12

Deploy

---

# 16. CLOUD RUN STYLE SERVICE EXPERIENCE

The application detail page should strongly resemble the operational simplicity of Cloud Run.

Show:

```text
Application

● Healthy

Production

Current Revision
v1.8.32

Traffic
100%

Requests
14.2k

Latency
42ms

Errors
0.03%

CPU
18%

Memory
421MB
```

Actions:

```text
Deploy
Redeploy
Restart
Stop
Rollback
Scale
Clone
```

---

# 17. REVISIONS

Every deployment creates a revision.

Example:

```text
Revision      Traffic      Status

v1.8.32       100%         ● Healthy
v1.8.31         0%         ● Healthy
v1.8.30         0%         ● Healthy
```

Support:

* Rollback
* Traffic splitting
* Canary
* Revision comparison
* Logs
* Metrics

---

# 18. ZERO-DOWNTIME DEPLOYMENT

Support atomic deployment where possible.

For container applications:

```text
Build
 ↓
Create new container
 ↓
Health check
 ↓
Ready
 ↓
Switch traffic
 ↓
Remove old container
```

Never switch production traffic before the new revision passes health checks.

---

# 19. GIT INTEGRATION

Support:

* GitHub
* GitLab
* Bitbucket
* Custom Git
* Self-hosted GitLab
* Gitea

OAuth integration where possible.

Automatically:

* Browse repositories
* Browse branches
* Configure deployment key
* Configure webhook
* Enable auto deploy

Support:

```text
Push
 ↓
Webhook
 ↓
RunForge
 ↓
Build
 ↓
Deploy
 ↓
Health check
```

---

# 20. DEPLOYMENT CENTER

Create a complete deployment center.

Statuses:

```text
Queued
Cloning
Building
Packaging
Deploying
Starting
Health Checking
Switching Traffic
Completed
Failed
Cancelled
Rolled Back
```

Live deployment timeline:

```text
✓ Repository cloned
✓ Dependencies installed
✓ Docker image built
✓ Image pushed
✓ New revision created
✓ Container started
✓ Health check passed
✓ Traffic switched

Deployment successful
```

---

# 21. CONTAINERS

Create a Docker management interface.

Show:

```text
Container
Image
Server
Status
CPU
Memory
Ports
Network
Created
```

Container detail:

```text
Overview
Logs
Terminal
Metrics
Environment
Ports
Volumes
Networks
Health
Events
```

Actions:

```text
Start
Stop
Restart
Pause
Remove
Recreate
Update Image
```

---

# 22. SERVICES / PROCESSES

Support system services.

Examples:

```text
Docker
Nginx
Caddy
PostgreSQL
Redis
MySQL
Cron
Custom Services
```

Show:

```text
Service
Status
PID
CPU
Memory
Uptime
```

Actions:

```text
Start
Stop
Restart
Enable
Disable
View Logs
```

---

# 23. REVERSE PROXY

This must be a first-class feature.

Support:

* Nginx
* Caddy
* Cloudflare
* Docker routing

User should configure visually.

Example:

```text
Domain

api.example.com

Target

MERC999 API

Internal Port

8080

Protocol

HTTPS

WebSocket

Enabled

Health Check

/health
```

RunForge generates the required reverse-proxy configuration.

---

# 24. PORT MANAGEMENT

Create:

**Networking → Ports**

Show:

```text
Port
Protocol
Service
Container
Server
Exposure
Status
```

Example:

```text
8080
TCP
MERC999 API
api-container
production-01
Internal
● Active
```

Allow:

* Open
* Close
* Map
* Unmap
* Restrict
* Firewall rule

Never expose a port without clearly showing the security impact.

---

# 25. DOMAIN MANAGEMENT

Support:

* Domains
* Subdomains
* SSL
* DNS
* Redirects
* Routes

Example:

```text
api.example.com
 ↓
Cloudflare
 ↓
RunForge Route
 ↓
MERC999 API
 ↓
8080
```

Support automatic SSL configuration.

---

# 26. CLOUDFLARE INTEGRATION

Users can connect their own Cloudflare account.

Support:

* DNS
* Zones
* Domains
* Workers
* Containers
* R2
* D1
* Tunnels
* SSL
* Routes

Cloudflare should be treated as a provider, not as RunForge's only infrastructure.

---

# 27. CLOUDFLARE TUNNEL

Make Tunnel a major feature for self-hosting.

Architecture:

```text
Internet
   ↓
Cloudflare
   ↓
Cloudflare Tunnel
   ↓
RunForge Agent
   ↓
Reverse Proxy
   ↓
Application
```

This allows users to expose applications without requiring direct inbound access to their server.

Provide a visual Tunnel configuration UI.

---

# 28. DATABASES

Create:

**Databases**

Support:

* PostgreSQL
* MySQL
* SQL Server
* SQLite

Database page:

```text
PostgreSQL

● Healthy

Version 17

Size 8.2 GB

Connections
34 / 100

Queries/sec
312
```

Tabs:

```text
Overview
Tables
Schema
Queries
Users
Connections
Logs
Metrics
Backups
Migrations
Settings
```

---

# 29. DATABASE TEMPLATES

Create reusable templates.

Examples:

```text
SaaS Starter
.NET Web API
Node API
E-commerce
CRM
Authentication
Audit Logging
Multi-tenant SaaS
```

A template contains:

* Tables
* Columns
* Relationships
* Indexes
* Constraints
* Seed data
* Migrations

---

# 30. DATABASE PORTABILITY

Do NOT make PostgreSQL SQL the source of truth.

Create a logical schema model.

Example:

```json
{
  "table": "users",
  "columns": [
    {
      "name": "id",
      "type": "uuid",
      "primaryKey": true
    },
    {
      "name": "email",
      "type": "string",
      "unique": true
    }
  ]
}
```

Generate:

```text
PostgreSQL
MySQL
SQL Server
SQLite
```

from the same logical definition.

---

# 31. DATABASE MIGRATION

Support:

```text
PostgreSQL → SQL Server
PostgreSQL → MySQL
PostgreSQL → SQLite

SQL Server → PostgreSQL
MySQL → PostgreSQL
SQLite → PostgreSQL
```

Analyze:

* Types
* Tables
* Constraints
* Indexes
* Foreign keys
* Views
* Functions
* Triggers

Show compatibility:

```text
✓ Compatible: 421
⚠ Requires conversion: 17
✕ Unsupported: 3
```

Generate migration.

Allow:

* Review
* Execute
* Verify
* Rollback

---

# 32. BACKUPS

Create a first-class backup center.

Support:

* Application backups
* Database backups
* Server backups
* Configuration backups

Destinations:

* R2
* S3
* S3-compatible
* Local storage

Features:

* Schedule
* Retention
* Encryption
* Restore
* Download
* Verify

Show:

```text
Last backup
2 hours ago

Status
● Verified

Size
4.8 GB
```

---

# 33. FILE MANAGER

For self-hosted servers, provide a safe file manager.

Features:

* Browse
* Upload
* Download
* Rename
* Delete
* Create folder
* Permissions
* Search

Large files should use direct transfer mechanisms rather than passing through the main API unnecessarily.

---

# 34. TERMINAL

Provide optional web terminal access.

Architecture:

```text
Browser
 ↓
Authenticated session
 ↓
RunForge
 ↓
Agent
 ↓
PTY
```

Every terminal session must be:

* authenticated
* authorized
* time-limited
* auditable

Clearly show:

```text
You are connected to:

production-01
```

---

# 35. MONITORING

Monitoring must be built into every server and application.

Server metrics:

* CPU
* Memory
* Disk
* Load
* Network
* Processes
* Disk I/O

Application metrics:

* Requests
* Latency
* Errors
* Throughput
* Restarts
* CPU
* Memory

Database metrics:

* Connections
* Queries
* Slow queries
* CPU
* Memory
* Storage

Use Highcharts.

---

# 36. ADVANCED MONITORING

Add:

### Top Processes

Show processes consuming the most:

* CPU
* RAM

### Slow Queries

Show:

```text
Query
Duration
Frequency
Database
Time
```

### Disk Usage

Show:

```text
Application
Database
Docker
Logs
Backups
System
```

### Slow Requests

Show:

```text
Endpoint
Requests
Average
P95
P99
Error rate
```

---

# 37. LOGS

Centralized logging.

Sources:

```text
Application
Container
Server
Nginx
Caddy
Database
Deployment
Agent
Cloudflare
```

Filters:

* Service
* Server
* Environment
* Severity
* Time
* Request ID
* Deployment

Support live streaming.

---

# 38. EVENTS

Every important action generates an event.

Examples:

```text
Deployment started
Deployment failed
Server connected
Container restarted
Database created
Domain added
DNS changed
Port opened
SSL renewed
Backup completed
User changed environment variable
AI performed restart
```

---

# 39. AUDIT LOG

Store:

```text
Actor
User
AI
System

Action
Resource
Before
After
Timestamp
IP
Result
Correlation ID
```

This is essential for enterprise usage.

---

# 40. INCIDENT MANAGEMENT

Automatically detect:

* Application unhealthy
* Server offline
* High CPU
* High memory
* Disk almost full
* High error rate
* Database unavailable
* SSL expiration
* Deployment failure

Create incidents.

Example:

```text
INCIDENT

MERC999 API degraded

Started
23:12

Impact
8.3%

Likely cause
Database connection exhaustion

Related deployment
v1.8.32

Related changes
Environment variable modified
```

---

# 41. AI OPERATIONS

Create:

**AI Operations**

The AI can inspect:

* Servers
* Applications
* Containers
* Deployments
* Logs
* Metrics
* Databases
* Networking
* Events
* Git commits

User can ask:

```text
Why is production slow?

Why did the latest deployment fail?

Which server is overloaded?

What changed before this outage?

Deploy the latest staging build.

Restart the API.

Check database health.

Find unused containers.

Find applications with high memory usage.
```

---

# 42. MCP

MCP is a first-class feature.

Create a RunForge MCP server.

The MCP server exposes controlled access to RunForge.

Example capabilities:

```text
Projects
Applications
Deployments
Servers
Containers
Databases
Domains
DNS
Networking
Logs
Metrics
Events
Incidents
Git
Backups
Cloudflare
Storage
```

---

# 43. MCP TOOL DESIGN

Use high-level tools.

Examples:

```text
list_projects
get_project
list_applications
get_application
get_application_health
get_application_logs
deploy_application
rollback_application
restart_application
get_deployment
get_server
get_server_health
list_containers
restart_container
get_database
get_database_health
run_database_query
create_database
get_domain
create_domain_route
get_incidents
get_events
```

Do not expose unnecessary hundreds of tiny tools.

---

# 44. MCP PERMISSIONS

Every MCP request must pass normal RunForge authorization.

Never allow MCP to bypass permissions.

Permission levels:

```text
READ
WRITE
DANGEROUS
```

Examples:

```text
View logs
READ

Restart application
WRITE

Deploy staging
WRITE

Deploy production
DANGEROUS

Delete production database
DANGEROUS
```

Dangerous operations require confirmation.

---

# 45. MCP APPROVAL UI

When AI wants to perform a dangerous action:

```text
AI ACTION REQUEST

Deploy:

MERC999 API

Environment:
Production

Commit:
abc1234

Changes:
27 files

Risk:
HIGH

[Approve]
[Reject]
```

For database deletion:

```text
DELETE DATABASE

Database:
production-db

This action may permanently destroy data.

[Require confirmation]
```

---

# 46. AI CHANGE INTELLIGENCE

Record enough historical information for AI to understand infrastructure evolution.

Example:

```text
23:10
Deployment v1.8.32

23:11
Memory increased 512MB → 1GB

23:12
Error rate increased

23:13
Database connections reached 100%

23:15
Rollback v1.8.31
```

AI can then answer:

> What changed before production started failing?

---

# 47. INFRASTRUCTURE GRAPH

Create a visual relationship view.

Example:

```text
Domain
  ↓
Cloudflare
  ↓
Tunnel
  ↓
Server
  ↓
Reverse Proxy
  ↓
Container
  ↓
API
  ↓
PostgreSQL
  ↓
R2
```

Allow users to visually inspect dependencies.

Clicking a node opens its resource.

This should become one of the signature RunForge features.

---

# 48. ENVIRONMENTS

Support:

```text
Development
Staging
Production
Custom
```

Each environment can have:

* Services
* Servers
* Databases
* Domains
* Secrets
* Deployments

Support environment cloning.

Example:

```text
Production
     ↓
Clone
     ↓
Staging
```

---

# 49. TEAM MANAGEMENT

Support:

* Organizations
* Teams
* Members
* Roles
* Permissions

Roles:

```text
Owner
Admin
Developer
Operator
Viewer
AI Agent
```

Allow permissions at:

* Organization
* Project
* Server
* Application
* Database

---

# 50. GLOBAL SEARCH

Search everything.

Example:

```text
CMD/CTRL + K
```

Search:

```text
MERC999
api.example.com
production-01
PostgreSQL
deployment abc123
server
container
incident
```

---

# 51. COMMAND PALETTE

Commands:

```text
Create project
Create application
Deploy application
Create database
Connect server
Open production logs
Restart API
Rollback deployment
Create domain
Open MCP
```

---

# 52. API

Everything the UI does should be possible through the API.

Example:

```text
GET    /api/projects
POST   /api/projects

GET    /api/applications
POST   /api/applications

POST   /api/applications/:id/deploy
POST   /api/applications/:id/restart
POST   /api/applications/:id/rollback

GET    /api/servers
POST   /api/servers

GET    /api/containers
POST   /api/containers

GET    /api/databases
POST   /api/databases

GET    /api/domains
POST   /api/domains

GET    /api/events
GET    /api/incidents
```

MCP must call the same domain/service layer.

Do not duplicate business logic.

---

# 53. EVENT-DRIVEN ARCHITECTURE

Long operations must be asynchronous.

Example:

```text
User
 ↓
API
 ↓
Command
 ↓
Queue
 ↓
Worker
 ↓
Provider
 ↓
Operation
 ↓
Health Check
 ↓
Event
```

Operations:

* Deploy
* Build
* Backup
* Restore
* Database migration
* Server provisioning
* Container creation
* Cloudflare configuration

should not block the HTTP request.

---

# 54. DATABASE DESIGN

Design the control-plane schema (Postgres, accessed via Cloudflare Hyperdrive) for multi-tenancy.

Core tables:

```text
users
organizations
members
projects
environments
applications
application_revisions
deployments
servers
server_agents
containers
services
databases
database_connections
database_migrations
domains
dns_records
routes
ports
storage
backups
logs
metrics
events
incidents
integrations
git_connections
secrets
mcp_tokens
audit_logs
templates
jobs
```

All tenant-owned resources must have proper organization/project relationships.

---

# 55. SECURITY

Implement:

* Secure authentication
* RBAC
* Organization isolation
* Project isolation
* Encrypted secrets
* API tokens
* MCP tokens
* Audit logs
* Rate limiting
* CSRF protection where applicable
* Secure cookies
* Input validation
* Command allowlisting
* Dangerous-action confirmation

Never expose credentials in:

* Logs
* Error messages
* Browser storage unnecessarily
* Events
* Metrics

---

# 56. MULTI-TENANCY

Assume many users from the beginning.

Every request must establish:

```text
User
 ↓
Organization
 ↓
Permission
 ↓
Resource
```

Never rely on the frontend to enforce tenant boundaries.

Authorization must happen server-side.

---

# 57. DESIGN LANGUAGE

The UI should feel like:

```text
RunCloud
+
Google Cloud Run
+
Cloudflare
+
Vercel
+
Linear
```

Do not copy their visual design.

Use a modern professional SaaS interface.

Primary characteristics:

* Dense but readable
* Developer focused
* Information rich
* Fast navigation
* Clear status
* Excellent tables
* Excellent monitoring charts
* Minimal unnecessary decoration

---

# 58. STATUS SYSTEM

Use consistent status badges.

```text
● Healthy
● Degraded
● Failed
● Building
● Deploying
● Starting
● Stopped
● Offline
● Unknown
```

Use icons + text, not color alone.

---

# 59. RESPONSIVE UI

Desktop:

Full dashboard.

Tablet:

Collapsible navigation.

Mobile:

Optimized:

* Monitoring
* Logs
* Deployment
* Server status
* Incident management
* Quick actions

---

# 60. DEMO ENVIRONMENT

The application must work immediately in Demo Mode.

Create:

```text
MERC999

Production

API
Worker
Frontend

PostgreSQL
Redis

production-01
```

Fake:

* deployments
* metrics
* logs
* containers
* database
* events
* incidents
* domains
* Cloudflare routes

But clearly label simulated operations.

Never claim that a fake deployment actually happened.

---

# 61. DEMO SERVER

Demo server:

```text
production-01

Ubuntu 24.04
8 CPU
32 GB RAM

CPU 18%
Memory 42%
Disk 63%

12 Containers
```

Demo containers:

```text
merc-api
merc-worker
merc-frontend
postgres
redis
nginx
```

---

# 62. TEMPLATE SYSTEM

Create application templates:

```text
.NET 8 API
.NET MVC
Node.js API
Bun API
React
Next.js
Python FastAPI
Django
Go
Rust
Java Spring
PHP Laravel
Docker
```

Each template can define:

* Source
* Dockerfile
* Build
* Runtime
* Port
* Health check
* Environment variables
* Database
* Storage
* Deployment
* Monitoring

---

# 63. INFRASTRUCTURE TEMPLATES

Also create infrastructure templates.

Examples:

```text
Single VPS
Docker Application
.NET + PostgreSQL
Node + Redis
Bun + PostgreSQL
React + API + PostgreSQL
Microservices
Production API
Staging Environment
```

One-click creation should generate the entire architecture.

---

# 64. COST ESTIMATION

Where provider pricing is available, estimate:

```text
Server
Database
Storage
Network
Cloudflare
Backup
```

Show:

```text
Estimated monthly cost

RM 127 / month
```

Clearly distinguish estimates from actual provider billing.

---

# 65. APPLICATION BLUEPRINT

Allow a project to be represented as:

```text
Project
│
├── Frontend
│
├── API
│
├── Worker
│
├── PostgreSQL
│
├── Redis
│
├── R2
│
└── Domain
```

The blueprint becomes the central infrastructure model.

---

# 66. BLUEPRINT DEPLOYMENT

Eventually allow:

```text
Create Blueprint
        ↓
Select Provider
        ↓
Select Server
        ↓
Deploy Entire Stack
```

Example:

```text
Frontend
   ↓
API
   ↓
PostgreSQL
   ↓
Redis
```

RunForge provisions and configures the dependencies.

---

# 67. AI BLUEPRINT GENERATION

Eventually allow:

User:

> Create a .NET API with PostgreSQL, Redis and React frontend.

AI generates:

```text
Frontend
React

API
.NET 8

Database
PostgreSQL

Cache
Redis
```

Then:

```text
Review Architecture

[Deploy]
```

Do NOT automatically deploy production infrastructure without confirmation.

---

# 68. OBSERVABILITY + DEPLOYMENT CORRELATION

Overlay deployments onto metrics.

Example:

```text
CPU
│
│        Deployment v1.8.32
│               ↓
│              /\
│             /  \
│____________/    \________
```

Click deployment marker:

```text
v1.8.32
abc1234

27 files changed
```

This makes troubleshooting dramatically easier.

---

# 69. INCIDENT AI

When an incident occurs:

```text
Investigate with AI
```

AI should automatically inspect:

```text
Recent deployments
Recent configuration changes
Logs
Metrics
Database
Server
Networking
Events
Git commits
```

Then provide:

```text
Root cause candidate

Database connection exhaustion

Confidence
87%

Evidence
...

Recommended action
...
```

The AI must distinguish:

* Fact
* Evidence
* Hypothesis
* Recommendation

Never pretend certainty when evidence is insufficient.

---

# 70. PRODUCT DIFFERENTIATOR

RunForge should ultimately be able to answer:

> **What is running, where is it running, how is it connected, is it healthy, what changed, and what should I do next?**

That is the central product philosophy.

---

# 71. WHAT NOT TO BUILD

Do NOT initially attempt to build:

* Full cloud provider replacement
* Full Kubernetes replacement
* Full Terraform replacement
* Full CI/CD replacement
* Full database IDE
* Full Git hosting platform

RunForge should orchestrate existing infrastructure.

---

# 72. MVP PRIORITY

Build these first:

### Tier 1

```text
Authentication
Organizations
Projects
Servers
RunForge Agent
Applications
Docker
GitHub
GitLab
Deployments
Logs
Domains
Reverse Proxy
Monitoring
```

### Tier 2

```text
Containers
Services
Cloudflare
Cloudflare Tunnel
Databases
Backups
Networking
Firewall
Events
```

### Tier 3

```text
Cloud Run
Proxmox
Database migration
Templates
Blueprints
Cost management
Incidents
```

### Tier 4

```text
MCP
AI Operations
AI troubleshooting
AI deployment
AI infrastructure optimization
```

---

# 73. CRITICAL IMPLEMENTATION RULE

Do not build a fake static UI.

Build the real architecture.

Where real provider credentials are unavailable, implement:

```text
Provider Interface
+
Demo Provider
+
Real Provider Adapter
```

Example:

```text
DeploymentService
       │
       ▼
ComputeProvider
       │
 ┌─────┴─────┐
 ▼           ▼
Demo      Docker
Provider  Provider
```

The UI should work against the Demo Provider immediately.

---

# 74. FINAL EXPERIENCE

A developer should be able to open RunForge and see:

```text
RUNFORGE

Everything is healthy.

────────────────────────────────────────

12 Projects
47 Applications
8 Servers
94 Containers
16 Databases

99.98% Availability

────────────────────────────────────────

PRODUCTION

MERC999 API

● Healthy

https://api.example.com

Revision
v1.8.32

CPU       18%
Memory    421 MB
Requests  14.2k
Errors    0.03%
Latency   42ms

[Deploy]
[Restart]
[Rollback]

────────────────────────────────────────

SERVER

production-01

● Online

CPU       17%
Memory    41%
Disk      62%

12 Containers

────────────────────────────────────────

DATABASE

PostgreSQL

● Healthy

34 / 100 connections

────────────────────────────────────────

RECENT ACTIVITY

✓ Deployment completed
✓ Database backup completed
✓ SSL renewed
✓ Container restarted

────────────────────────────────────────

AI OPERATIONS

"Why is production slow?"

"Deploy latest staging."

"Show me what changed today."

"Find unhealthy services."

────────────────────────────────────────

MCP

Connected

Claude
ChatGPT
Other MCP clients
```

---

# 75. FINAL POSITIONING

RunForge is NOT:

> another hosting provider.

RunForge is:

> **A universal control plane for developers to deploy, monitor, manage and automate their own infrastructure.**

The conceptual comparison is:

```text
RunCloud
    +
Cloud Run
    +
Cloudflare
    +
Docker
    +
GitHub/GitLab
    +
Database Platform
    +
Observability
    +
MCP
    +
AI Operations
```

The final product should make this possible:

```text
Developer
    │
    ▼
RunForge
    │
    ├── Cloudflare
    ├── Cloud Run
    ├── VPS
    ├── Docker
    ├── Proxmox
    ├── Kubernetes
    ├── PostgreSQL
    ├── SQL Server
    ├── MySQL
    ├── GitHub
    └── GitLab
```

### Product principle:

**If a developer can currently accomplish something by SSH-ing into a server, opening another cloud dashboard, editing Nginx, running Docker commands, configuring DNS, checking logs or manually performing deployment operations, RunForge should aim to provide a safe, observable UI/API/MCP way to accomplish it.**

Build RunForge as a serious infrastructure control plane, not merely a dashboard mockup.
