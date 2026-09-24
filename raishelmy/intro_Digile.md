# Self Introduction — Data Engineer Interview (Digi)
Role: Data Engineer / Big Data Platform Engineer. Company: Digi.
Structure: Present – Past – Future, built using 4 Skills / 3 Experience / 2 Achievements / 1 Reason to Hire Me.
Tone: simple, spoken, confident — not a presentation.

---

Thank you so much for having me here today, I'm really excited for this interview.

My name is Rais Helmy. I'm originally from Semporna, a small town in Sabah, and I studied at Universiti Malaysia Sabah. I got married in 2021, I have one son, and right now I'm based in Kota Damansara.

## PRESENT — who I am now (4 skills)

Professionally, I'm a backend engineer with over six years of experience, and a large part of that has actually been building large-scale, high-integrity batch and ETL-style data pipelines — which is closer to this Data Engineer role than a typical software job title suggests. Four things I'm strongest at:

1. Advanced SQL — I work daily with SQL Server and Oracle: window functions, CTEs, MERGE/UPSERT patterns, indexing, and execution plan tuning. This is the single most transferable skill into this role, and it's the one I already use the most.
2. Batch and ETL pipeline engineering — extracting, validating, transforming, and loading large datasets, with structured logging, auditing, and error recovery, built to be idempotent and resumable at scale.
3. Python for data processing — reading and transforming datasets, table-to-table loading, and scripting around a pipeline, alongside Linux shell scripting for cron-driven jobs.
4. Distributed systems and infrastructure awareness — I come from a backend/systems background with real exposure to Kubernetes, Docker, and designing for reliability and recovery, which maps directly onto the orchestration and infrastructure side of a modern data platform.

## PAST — where that came from (3 experiences)

I built these skills across three main experiences.

First, and most relevant here, at Etiqa Insurance, I built the AMLA and blacklist screening system — a scheduled batch pipeline that processed millions of customer records: extracting from source systems, validating and transforming the data, screening it against watchlists, and writing full audit trails to meet Bank Negara regulatory requirements. That's the exact same shape of problem as designing a data pipeline for analytics — just applied to compliance instead of reporting.

Second, still at Etiqa, I worked on other systems bound by strict Bank Negara requirements, which taught me how to design for correctness, auditability, and idempotency — you cannot afford to silently drop a record or process one twice, which is exactly the discipline good data engineering also demands.

Third, on the TNB side, through JuruQuest and atQuest, I integrated across SQL Server, Oracle, and SAP-based enterprise data sources, and worked with distributed, multi-tier systems — giving me practical experience with heterogeneous data integration, which is close to what tools like Trino do at a larger scale.

## PAST — proof it worked (2 achievements)

Two moments stand out.

At Etiqa, the AMLA/blacklist pipeline had to process millions of customer records efficiently — batching, pagination, and bulk operations — while staying resumable and idempotent, so a failure partway through never meant reprocessing everything or corrupting the audit trail. That is a real, production-proven data pipeline, not a toy example.

At Etiqa, I also joined a project that was already a year behind schedule, and I got it delivered within two months — showing I can take ownership of a struggling data-heavy system and push it to completion quickly.

## FUTURE — why you should hire me (1 reason)

If I had to give you one reason to hire me: I'm not starting from zero on data engineering — I've already built and operated the core pattern this role is built on: large-scale batch processing, ETL pipelines with validation and transformation, structured logging and auditing, advanced SQL performance tuning, and idempotent, resumable, retry-safe long-running jobs. What I'm actively building on top of that foundation is the modern data platform ecosystem — orchestration with Airflow, data lake and warehouse design, and query federation with Trino — and given how much of the underlying engineering I already have, I expect to ramp on that layer quickly rather than needing to learn data engineering from scratch.

---

### Delivery notes
- Say this like a conversation, not a pitch — pause after the personal part, let it breathe.
- The four skills should be said quickly and clearly, almost like counting on fingers — this signals confidence and structure.
- Don't rush the Etiqa AMLA/blacklist screening story — it's your strongest and most directly relevant achievement for this role.
- Be honest about the gap: you have the engineering fundamentals (SQL, ETL/batch, distributed systems, Kubernetes exposure) but are still building depth in Airflow, Trino, Iceberg/Parquet, and Data Lake/Warehouse modelling. Frame this as "fast ramp," not "already expert."
- If asked about tech stack: SQL Server/Oracle and batch/ETL design are your strongest, proven skills. Python is a supporting tool for data processing scripts, not your primary language. Kubernetes/Docker exposure is real but limited to deployment-level, not cluster administration.
- If asked what you're studying to close the gap, mention: advanced SQL window functions, Airflow DAGs, Trino/data lake concepts (Parquet, Iceberg, Medallion architecture), and CDC concepts — signals initiative without overclaiming experience you don't have.
- If time is short: personal intro → present (4 skills, short) → the Etiqa AMLA/blacklist achievement → the 1 reason to hire me.
