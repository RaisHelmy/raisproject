import type { CheatSheet } from "../../types";

// Database quick references, using the same CheatSheet shape as /commands
// so the UI renders them with the same components.

export const databaseSheets: CheatSheet[] = [
  {
    id: "postgresql",
    title: "PostgreSQL",
    icon: "bi-database",
    description: "Install, connect, CRUD, joins, indexes, transactions, backup — the working set.",
    tags: ["postgres", "postgresql", "sql", "database", "psql"],
    groups: [
      {
        title: "Install & connect",
        entries: [
          { code: "docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -v pgdata:/var/lib/postgresql/data postgres:16-alpine", description: "Fastest local install: Docker with a persistent volume" },
          { code: "brew install postgresql@16   # macOS\nsudo apt install postgresql   # Debian/Ubuntu", description: "Native install" },
          { code: "psql -h localhost -U postgres -d app", description: "Connect with psql" },
          { code: "postgres://user:password@localhost:5432/app", description: "Connection string format (DATABASE_URL)" },
          { code: "\\l   \\c app   \\dt   \\d users   \\q", description: "psql meta: list DBs / switch DB / list tables / describe table / quit" },
        ],
      },
      {
        title: "Database & tables",
        entries: [
          { code: "CREATE DATABASE app;", description: "Create a database" },
          { code: `CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`, description: "Typical table: uuid PK, unique email, timestamptz" },
          { code: "ALTER TABLE users ADD COLUMN is_active boolean NOT NULL DEFAULT true;", description: "Add a column" },
        ],
      },
      {
        title: "CRUD",
        entries: [
          { code: "INSERT INTO users (email, name) VALUES ('ada@example.com', 'Ada') RETURNING id;", description: "Insert and get the generated id back" },
          { code: "SELECT id, email FROM users WHERE is_active ORDER BY created_at DESC LIMIT 20;", description: "Filtered, ordered, limited select" },
          { code: "UPDATE users SET name = 'Ada Lovelace' WHERE id = $1;", description: "Update (always with a WHERE)" },
          { code: "DELETE FROM users WHERE id = $1;", description: "Delete", warning: "A DELETE or UPDATE without WHERE hits every row. Run a SELECT with the same WHERE first." },
          { code: `INSERT INTO settings (key, value) VALUES ($1, $2)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`, description: "Upsert" },
        ],
      },
      {
        title: "Joins & aggregates",
        entries: [
          { code: `SELECT o.id, o.total, u.email
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'pending';`, description: "Inner join (LEFT JOIN keeps rows without a match)" },
          { code: `SELECT user_id, count(*) AS orders, sum(total) AS revenue
FROM orders
GROUP BY user_id
HAVING count(*) > 5;`, description: "Group + aggregate + filter on aggregates" },
        ],
      },
      {
        title: "Indexes & performance",
        entries: [
          { code: "CREATE INDEX idx_orders_user_id ON orders (user_id);", description: "Index foreign keys and frequent WHERE columns" },
          { code: "CREATE UNIQUE INDEX idx_users_email ON users (lower(email));", description: "Case-insensitive unique email via expression index" },
          { code: "EXPLAIN ANALYZE SELECT ...;", description: "See the actual query plan and timing — look for Seq Scan on big tables" },
        ],
      },
      {
        title: "Transactions",
        entries: [
          { code: `BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;   -- or ROLLBACK;`, description: "All-or-nothing money movement" },
        ],
      },
      {
        title: "Backup & restore",
        entries: [
          { code: "pg_dump -Fc -h localhost -U postgres app > app.dump", description: "Compressed backup" },
          { code: "pg_restore -h localhost -U postgres -d app --clean app.dump", description: "Restore (--clean drops objects first)", warning: "--clean drops existing objects in the target database before restoring." },
        ],
      },
    ],
  },
  {
    id: "mysql",
    title: "MySQL",
    icon: "bi-database",
    description: "The MySQL/MariaDB equivalents: connect, CRUD, indexes, dump and restore.",
    tags: ["mysql", "mariadb", "sql", "database"],
    groups: [
      {
        title: "Install & connect",
        entries: [
          { code: "docker run -d --name mysql -e MYSQL_ROOT_PASSWORD=dev -p 3306:3306 -v mysqldata:/var/lib/mysql mysql:8", description: "Local MySQL via Docker" },
          { code: "mysql -h localhost -u root -p app", description: "Connect with the mysql client" },
          { code: "SHOW DATABASES;  USE app;  SHOW TABLES;  DESCRIBE users;", description: "Orientation commands" },
        ],
      },
      {
        title: "Tables & CRUD",
        entries: [
          { code: `CREATE TABLE users (
  id BINARY(16) PRIMARY KEY DEFAULT (UUID_TO_BIN(UUID())),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`, description: "Typical table (MySQL 8)" },
          { code: "INSERT INTO users (email, name) VALUES ('ada@example.com', 'Ada');", description: "Insert; SELECT LAST_INSERT_ID() for auto-increment keys" },
          { code: "SELECT id, email FROM users ORDER BY created_at DESC LIMIT 20 OFFSET 0;", description: "Paged select" },
          { code: `INSERT INTO settings (k, v) VALUES ('theme', 'dark')
ON DUPLICATE KEY UPDATE v = VALUES(v);`, description: "Upsert" },
          { code: "DELETE FROM users WHERE id = ?;", description: "Delete", warning: "Same rule as everywhere: never without WHERE." },
        ],
      },
      {
        title: "Indexes & transactions",
        entries: [
          { code: "CREATE INDEX idx_orders_user_id ON orders (user_id);", description: "Index join/filter columns" },
          { code: "EXPLAIN SELECT ...;", description: "Query plan — watch for type=ALL (full scan)" },
          { code: "START TRANSACTION; ... COMMIT;", description: "Transactions (InnoDB)" },
        ],
      },
      {
        title: "Backup & restore",
        entries: [
          { code: "mysqldump -u root -p app > app.sql", description: "Logical backup" },
          { code: "mysql -u root -p app < app.sql", description: "Restore" },
        ],
      },
    ],
  },
  {
    id: "sqlserver",
    title: "SQL Server",
    icon: "bi-database-fill",
    description: "T-SQL essentials: connect, CRUD, TOP/OFFSET, indexes, backup.",
    tags: ["sqlserver", "mssql", "tsql", "sql", "database", "microsoft"],
    groups: [
      {
        title: "Install & connect",
        entries: [
          { code: 'docker run -d --name mssql -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Dev_Passw0rd!" -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest', description: "SQL Server 2022 in Docker (password must meet complexity rules)" },
          { code: 'sqlcmd -S localhost -U sa -P "Dev_Passw0rd!" -C', description: "Connect with sqlcmd (-C trusts the dev certificate)" },
          { code: "Server=localhost,1433;Database=app;User Id=sa;Password=...;TrustServerCertificate=True", description: "ADO.NET connection string format" },
        ],
      },
      {
        title: "Tables & CRUD",
        entries: [
          { code: `CREATE TABLE Users (
  Id uniqueidentifier PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
  Email nvarchar(255) NOT NULL UNIQUE,
  Name nvarchar(100) NOT NULL,
  CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);`, description: "Typical table" },
          { code: "INSERT INTO Users (Email, Name) OUTPUT INSERTED.Id VALUES ('ada@example.com', 'Ada');", description: "Insert returning the generated id" },
          { code: `SELECT Id, Email FROM Users
ORDER BY CreatedAt DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY;`, description: "Paging (OFFSET/FETCH); SELECT TOP 20 for a quick limit" },
          { code: `MERGE Settings AS t
USING (SELECT 'theme' AS K, 'dark' AS V) AS s ON t.K = s.K
WHEN MATCHED THEN UPDATE SET V = s.V
WHEN NOT MATCHED THEN INSERT (K, V) VALUES (s.K, s.V);`, description: "Upsert via MERGE" },
        ],
      },
      {
        title: "Indexes & transactions",
        entries: [
          { code: "CREATE INDEX IX_Orders_UserId ON Orders (UserId);", description: "Nonclustered index on filter/join columns" },
          { code: "BEGIN TRANSACTION; ... COMMIT; -- or ROLLBACK;", description: "Explicit transaction" },
          { code: "SET STATISTICS IO, TIME ON;", description: "Per-query IO/time stats while tuning" },
        ],
      },
      {
        title: "Backup & restore",
        entries: [
          { code: "BACKUP DATABASE app TO DISK = '/var/opt/mssql/backup/app.bak';", description: "Full backup" },
          { code: "RESTORE DATABASE app FROM DISK = '/var/opt/mssql/backup/app.bak' WITH REPLACE;", description: "Restore", warning: "WITH REPLACE overwrites the existing database." },
        ],
      },
    ],
  },
  {
    id: "sqlite",
    title: "SQLite",
    icon: "bi-file-earmark-binary",
    description: "The zero-setup database: one file, full SQL. Perfect for local tools and small apps.",
    tags: ["sqlite", "sql", "database", "embedded"],
    groups: [
      {
        title: "Get started",
        entries: [
          { code: "sqlite3 app.db", description: "Create/open a database file and start the shell" },
          { code: ".tables   .schema users   .headers on   .mode column   .quit", description: "Shell meta-commands: list tables / show DDL / readable output / quit" },
          { code: "PRAGMA journal_mode = WAL;", description: "Write-Ahead Logging — better concurrency, do this once per database" },
          { code: "PRAGMA foreign_keys = ON;", description: "Foreign keys are OFF by default per connection — turn them on", warning: "Without this pragma, FK constraints are silently ignored." },
        ],
      },
      {
        title: "Tables & CRUD",
        entries: [
          { code: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`, description: "INTEGER PRIMARY KEY is the fast rowid alias" },
          { code: "INSERT INTO users (email, name) VALUES ('ada@example.com', 'Ada') RETURNING id;", description: "Insert returning id (SQLite 3.35+)" },
          { code: `INSERT INTO settings (key, value) VALUES ('theme', 'dark')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;`, description: "Upsert" },
        ],
      },
      {
        title: "Backup",
        entries: [
          { code: '.backup backup.db', description: "Consistent backup from the sqlite3 shell (works while the DB is in use)" },
          { code: "VACUUM;", description: "Compact the file after large deletes" },
        ],
      },
    ],
  },
  {
    id: "mongodb",
    title: "MongoDB",
    icon: "bi-leaf",
    description: "Document CRUD, queries, indexes and aggregation with mongosh.",
    tags: ["mongodb", "mongo", "nosql", "document", "database"],
    groups: [
      {
        title: "Install & connect",
        entries: [
          { code: "docker run -d --name mongo -p 27017:27017 -v mongodata:/data/db mongo:7", description: "Local MongoDB via Docker" },
          { code: "mongosh mongodb://localhost:27017/app", description: "Connect with the shell" },
          { code: "show dbs   use app   show collections", description: "Orientation" },
        ],
      },
      {
        title: "CRUD",
        entries: [
          { code: 'db.users.insertOne({ email: "ada@example.com", name: "Ada", createdAt: new Date() })', description: "Insert a document" },
          { code: 'db.users.find({ isActive: true }).sort({ createdAt: -1 }).limit(20)', description: "Filter, sort, limit" },
          { code: 'db.users.updateOne({ _id: id }, { $set: { name: "Ada Lovelace" } })', description: "Update fields with $set" },
          { code: 'db.users.deleteOne({ _id: id })', description: "Delete one document", warning: "deleteMany({}) empties the whole collection." },
          { code: 'db.settings.updateOne({ key: "theme" }, { $set: { value: "dark" } }, { upsert: true })', description: "Upsert" },
        ],
      },
      {
        title: "Indexes & aggregation",
        entries: [
          { code: 'db.users.createIndex({ email: 1 }, { unique: true })', description: "Unique index" },
          { code: `db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: { _id: "$userId", revenue: { $sum: "$total" } } },
  { $sort: { revenue: -1 } },
])`, description: "Aggregation pipeline: filter → group → sort" },
          { code: 'db.orders.find({ userId }).explain("executionStats")', description: "Check whether a query uses an index" },
        ],
      },
    ],
  },
  {
    id: "redis",
    title: "Redis",
    icon: "bi-lightning-charge-fill",
    description: "Caching, sessions, counters, queues — the core commands and TTL patterns.",
    tags: ["redis", "cache", "in-memory", "database", "queue"],
    groups: [
      {
        title: "Install & connect",
        entries: [
          { code: "docker run -d --name redis -p 6379:6379 redis:7-alpine", description: "Local Redis via Docker" },
          { code: "redis-cli", description: "Interactive client (PING → PONG to verify)" },
        ],
      },
      {
        title: "Strings & caching",
        entries: [
          { code: 'SET user:42:profile "{...json...}" EX 300', description: "Cache with a 5-minute TTL — always set a TTL on cache keys" },
          { code: "GET user:42:profile", description: "Read (nil = cache miss)" },
          { code: "DEL user:42:profile", description: "Invalidate" },
          { code: "INCR api:calls:2026-09-04", description: "Atomic counter (rate limits, stats)" },
          { code: "TTL user:42:profile", description: "Seconds until expiry (-1 = no TTL, -2 = gone)" },
        ],
      },
      {
        title: "Hashes, lists, sets",
        entries: [
          { code: "HSET user:42 name Ada tier gold\nHGETALL user:42", description: "Hash: field/value map per key" },
          { code: "LPUSH jobs '{\"type\":\"email\"}'\nBRPOP jobs 5", description: "Simple queue: push left, blocking-pop right" },
          { code: "SADD online:users 42\nSISMEMBER online:users 42", description: "Sets: membership checks" },
          { code: "ZADD leaderboard 1500 player:42\nZREVRANGE leaderboard 0 9 WITHSCORES", description: "Sorted set: top-10 leaderboard" },
        ],
      },
      {
        title: "Ops",
        entries: [
          { code: "KEYS user:*", description: "Find keys — development only", warning: "KEYS blocks the server; in production use SCAN instead." },
          { code: "SCAN 0 MATCH user:* COUNT 100", description: "Non-blocking key iteration" },
          { code: "INFO memory", description: "Memory usage; set maxmemory + eviction policy for cache workloads" },
          { code: "FLUSHALL", description: "Delete everything", warning: "Irreversibly wipes every key in every database." },
        ],
      },
    ],
  },
];

export const databaseSheetById = new Map(databaseSheets.map((d) => [d.id, d]));
