# Self Introduction — System Limited APAC Interview (via Hastraa)
Role: Automation Developer — e-Statement Engine (Mobius). Client: System Limited APAC. Hiring agency: Hastraa.
Structure: Present – Past – Future, built using 4 Skills / 3 Experience / 2 Achievements / 1 Reason to Hire Me.
Tone: simple, spoken, confident — not a presentation.

---

Thank you so much for having me here today, I'm really excited for this interview.

My name is Rais Helmy. I'm originally from Semporna, a small town in Sabah, and I studied at Universiti Malaysia Sabah. I got married in 2021, I have one son, and right now I'm based in Kota Damansara.

## PRESENT — who I am now (4 skills)

Professionally, I'm a full stack engineer with over six years of experience, and a good part of that has been building background services that process large volumes of data — which lines up closely with what an e-Statement Engine on Mobius needs to do. Four things I'm strongest at:

1. Backend and API development with .NET — this is my main tool for building background services and batch jobs that process large volumes of data reliably; almost all of the actual data processing logic lives here.
2. ETL-style data pipelines — importing, validating, transforming, and storing large datasets, with logging, auditing, and error recovery using tools like Serilog.
3. SQL Server and data access — optimising queries, stored procedures, and Dapper-based data access for high-volume processing.
4. Supporting scripting around the pipeline — Python for simple, self-contained jobs like migrating or loading data from one table to another, and Linux shell scripting for cron-driven file transport and migration tasks. But the heavy lifting — the actual data processing — is done inside .NET, not the scripts.

## PAST — where that came from (3 experiences)

I built these skills across three main experiences.

First, and most relevant here, at Etiqa Insurance, I built the AMLA and blacklist screening system — a background service that processed millions of customer records in batches, validated and transformed them through an ETL-style pipeline, and screened them against watchlists with full audit logging and error recovery. That's a large-scale, high-integrity batch-processing problem, the same category of engineering challenge as a statement generation engine.

Second, still at Etiqa, I worked on other compliance systems that had to meet strict regulatory requirements from Bank Negara — which taught me how to build systems where accuracy, audit trail, and idempotency really matter when you can't afford to process a record twice or lose one silently.

Third, on the TNB side, through JuruQuest and atQuest, I handled full stack delivery end to end — backend, frontend, and mobile — for enterprise and field applications, which gave me the broader system-integration experience to connect these pipelines into a larger enterprise landscape.

## PAST — proof it worked (2 achievements)

Two moments stand out.

At Etiqa, the AMLA/blacklist screening system I built had to process millions of customer records efficiently — batching, pagination, and bulk operations — while staying resumable and idempotent, so a failure partway through never meant reprocessing everything or corrupting the audit trail.

At Etiqa, I also joined a project that was already a year behind schedule, and I got it delivered within two months — showing I can take over a struggling data-heavy system and push it to completion.

## FUTURE — why you should hire me (1 reason)

If I had to give you one reason to hire me: I've already built the exact engineering patterns an e-Statement Engine needs — batch processing millions of records, ETL pipelines with validation and transformation, Serilog-based logging and auditing, optimised SQL Server and Dapper data access, and idempotent, resumable, retry-safe long-running jobs — mainly in .NET, with Python and Linux shell scripting as supporting tools around the edges for simple data loading and cron-driven file transport. The domain changes — from watchlists to statements — but the underlying engineering is largely the same. I don't need to learn how to build this kind of system, I've already built one at scale.

---

### Delivery notes
- Say this like a conversation, not a pitch — pause after the personal part, let it breathe.
- The four skills should be said quickly and clearly, almost like counting on fingers — this signals confidence and structure.
- Don't rush the Etiqa AMLA/blacklist screening story — it's your strongest and most directly relevant achievement for this role.
- If asked to go deeper on transferable strengths, be ready to speak to: batch processing at scale, ETL pipelines, logging/auditing (Serilog), SQL Server/Dapper optimisation, idempotency/retries/resumability, and large file (Excel/CSV) validation.
- If asked about tech stack: be clear that .NET is the primary tool and where the actual data processing happens; Python is only for simple table-to-table migration/loading scripts, and Linux shell scripting is only for cron jobs and file transport — don't overstate Python/scripting as core to the architecture.
- If time is short: personal intro → present (4 skills, short) → the Etiqa AMLA/blacklist achievement → the 1 reason to hire me.
