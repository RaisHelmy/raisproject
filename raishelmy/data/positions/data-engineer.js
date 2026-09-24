/* Position: Data Engineer
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the Data Engineer target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'Data Engineer',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — Data Engineer CV',
    roleTags: [
      'Data Engineer',
      'Data Pipeline Engineer',
      'ETL Developer',
      'Big Data Platform Engineer',
      'Analytics Engineer'
    ],
    glanceSpec: 'Advanced SQL · ETL/Batch Pipelines<br>Python · SQL Server &amp; Oracle<br>Distributed Systems<br>Kubernetes &amp; Docker',
    summary: `Backend engineer with <span class="cv-exp-text">6+</span> years building large-scale, high-integrity <strong>batch and ETL-style data pipelines</strong> in regulated environments. Proven track record processing millions of records with validation, transformation, audit logging, and idempotent/resumable batch design. Strong in <strong>advanced SQL Server</strong> (window functions, CTEs, indexing, execution-plan tuning), <strong>Python</strong> for data-processing scripts, and <strong>distributed systems</strong> with growing hands-on exposure to <strong>Kubernetes and Docker</strong>. Currently expanding into the modern data platform stack — orchestration, data lake/warehouse design, and query federation — on top of an already solid data-engineering foundation.`,
    competencies: [
      'Advanced SQL (Window Fns/CTE)', 'SQL Server', 'Oracle',
      'ETL / Batch Pipelines', 'Python', 'Data Validation & Auditing',
      'Distributed Systems', 'Kubernetes', 'Docker', 'CI/CD'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · Data Engineer',
    headerRole: 'Data Engineer · ETL &amp; Batch Pipelines · Advanced SQL',
    subject: 'Application for Data Engineer Position',
    sigTags: [
      'Data Engineer',
      'ETL / Batch Pipelines',
      'Advanced SQL',
      'Distributed Systems'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',        sub: 'Batch/ETL Pipelines · Enterprise' },
      { label: 'core stack', val: 'SQL Server · Python', sub: 'Oracle · Distributed Systems' },
      { label: 'domains',    val: 'Insurance · Utility · Defence', sub: 'Etiqa · TNB · PDRM' }
    ],
    body: [
      `I am applying for the <strong>Data Engineer</strong> role. Over <strong>six years as a backend engineer</strong>, a significant part of my work has centred on building <strong>large-scale batch and ETL-style data pipelines</strong> in regulated, high-integrity environments — the same core problem data engineering solves, approached from the systems-engineering side.`,
      `At <em>Etiqa Insurance and Takaful Berhad</em>, I built the <strong>AMLA and blacklist watchlist screening pipeline</strong> — a scheduled batch job processing millions of customer records: extracting from source systems, validating and transforming data, screening against watchlists, and writing full audit trails aligned to BNM regulatory requirements. I applied <strong>advanced SQL Server</strong> techniques — window functions, CTEs, indexing, and execution-plan tuning — to keep batch queries performant at scale, with supporting <strong>Python</strong> scripts for table-to-table data loading and Linux cron-driven file transport. The pipeline was designed to be idempotent and resumable, so a failure partway through never meant reprocessing everything or corrupting the audit trail.`,
      `At <em>JuruQuest Consulting</em> and <em>atQuest Sdn. Bhd.</em>, I worked across <strong>SQL Server, Oracle, and SAP-integrated data flows</strong> for TNB's enterprise systems, giving me practical exposure to data integration across heterogeneous sources and the operational discipline of running these processes in mission-critical production systems.`,
      `I am actively building on this foundation into the modern data platform stack — orchestration (Airflow), data lake/warehouse design (Parquet, Medallion architecture, star schema), and query federation (Trino) — and bring genuine hands-on exposure to <strong>Kubernetes and Docker</strong> for deploying and operating these systems reliably.`,
      `I don't come to data engineering without context — I've already built and operated the core pattern (large-scale batch processing, validation, transformation, audit, idempotency) that sits underneath most modern data pipelines. I'm confident I can ramp quickly on the surrounding ecosystem and contribute meaningfully from early on.`,
      `Thank you for your time and consideration. I look forward to the opportunity to discuss my experience further.`
    ]
  }
};
