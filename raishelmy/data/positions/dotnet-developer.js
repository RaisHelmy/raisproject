/* Position: .NET Developer
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the .NET Developer target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: '.NET Developer',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — .NET Developer CV',
    roleTags: [
      'Senior .NET Developer',
      'C# Software Engineer',
      '.NET Backend Engineer',
      'Enterprise .NET Developer',
      'Back End Engineer'
    ],
    glanceSpec: '.NET 8 · Clean Architecture<br>CQRS · MediatR · DDD<br>Enterprise Backend<br>Insurance &amp; ERP APIs',
    summary: `Senior .NET Developer with <span class="cv-exp-text">6+</span> years of enterprise backend delivery across insurance, ERP, and defence sectors in Malaysia. I design and build systems grounded in <strong>.NET 8 Clean Architecture</strong>, <strong>CQRS with MediatR</strong>, and <strong>Domain-Driven Design</strong> — enforcing strict layer separation and writing code that teams can inherit and extend. Currently at Etiqa Insurance engineering policy lifecycle APIs, AMLA watchlist batch jobs, and Oracle/SQL Server integrations under BNM regulatory requirements. I take ownership of correctness, auditability, and long-term maintainability.`,
    competencies: [
      '.NET 8', 'ASP.NET Core', 'C#',
      'Clean Architecture', 'CQRS / DDD', 'MediatR', 'EF Core',
      'SQL Server', 'Oracle', 'REST API', 'JWT Auth', 'Serilog'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · .NET Developer',
    headerRole: 'Senior .NET Developer · Clean Architecture · CQRS · MediatR',
    subject: 'Application for Senior .NET Developer Position',
    sigTags: [
      'Senior .NET Developer',
      'Clean Architecture',
      'CQRS / DDD',
      'MediatR Expert'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',            sub: '.NET · C# · Enterprise Backend' },
      { label: 'core stack', val: '.NET 8 · CQRS · MediatR', sub: 'Clean Arch · EF Core · SQL Server' },
      { label: 'domains',    val: 'Insurance · ERP · Defence', sub: 'BNM · PDRM · TNB · Etiqa' }
    ],
    body: [
      `I am writing to express my strong interest in joining your engineering team as a <strong>Senior .NET Developer</strong>. With over <strong>six years of hands-on experience</strong> delivering enterprise-grade .NET backend systems across Malaysia's insurance, ERP, and defence sectors, I am confident I can contribute meaningfully from day one.`,
      `In my current role at <em>Etiqa Insurance and Takaful Berhad</em>, I engineer production systems using <strong>.NET 8 Clean Architecture and CQRS with MediatR</strong> — building insurance policy lifecycle APIs, integrating with <strong>SQL Server, Oracle, MDM, and PolisyM</strong>, and delivering a fully automated <strong>AMLA Watchlist Batch Job</strong> for BNM-aligned regulatory compliance. Writing .NET code that must be correct, auditable, and resilient under real regulatory pressure is my daily environment.`,
      `Just before that, at <em>atQuest Sdn. Bhd.</em>, I delivered a series of minor enhancements to the TNB ESS platform — new validation logic, a small <strong>Node.js</strong> notification service, and fixes to a legacy <strong>Java</strong> payroll batch module — on top of the existing .NET 4.5.1 codebase.`,
      `Prior to that, I was engaged by <em>JuruQuest Consulting</em> to rescue a failing enterprise mobile project for <strong>Tenaga Nasional Berhad (TNB)</strong>. I rebuilt the <strong>.NET 6 REST API</strong> from the ground up — introducing clean API design, JWT authentication, <strong>LDAP / SAP integration</strong>, and a configurable multi-layer approval workflow engine. The backend now serves field operations across TNB's asset management and permit systems. Alongside the core API, I built a small <strong>Angular</strong> admin dashboard (2023–2024) and a lightweight <strong>Node.js</strong> notification microservice to complement it.`,
      `Earlier in my career I served as <strong>Solution Architect</strong> for the <strong>PDRM C4i Command and Control Centre</strong> — delivering a mission-critical .NET Core API backend integrated with GIS, telephony, unified communications, and enterprise VPN. Writing reliable software for a law enforcement command centre demanded the highest standard of engineering discipline.`,
      `Beyond delivery, I bring practical experience in <strong>Cloudflare Workers serverless</strong> architectures, <strong>GitLab CI/CD</strong>, Docker, and a consistent commitment to writing maintainable, well-structured .NET code that future engineers can confidently own.`,
      `I thrive in environments where the engineering bar is set deliberately high, the problems are real, and quality is non-negotiable. I would welcome the opportunity to bring that same rigour to your .NET team.`,
      `Thank you sincerely for your time and consideration. I look forward to discussing how my background aligns with your team's goals.`
    ]
  }
};
