/* Position: Back End Developer
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the Back End Developer target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'Back End Developer',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — Back End Developer CV',
    roleTags: [
      'Back End Developer',
      'API Engineer',
      'Server-Side Developer',
      'Back End Engineer',
      'Backend Software Engineer'
    ],
    glanceSpec: '.NET API · REST Design<br>SQL Server · Oracle<br>Clean Architecture<br>Microservices &amp; DDD',
    summary: `Backend-focused .NET engineer with <span class="cv-exp-text">6+</span> years building reliable, well-structured APIs and enterprise services. Proficient in <strong>ASP.NET Core, Clean Architecture, CQRS, and EF Core</strong> with production experience across <strong>SQL Server, Oracle, and PostgreSQL</strong> in regulated insurance, government utility, and defence domains. Strong emphasis on API security, structured logging, and maintainable domain modelling — capable of designing systems that last beyond the sprint.`,
    competencies: [
      '.NET 8', 'ASP.NET Core', 'REST API Design',
      'SQL Server', 'Oracle', 'PostgreSQL',
      'EF Core', 'Clean Architecture', 'CQRS',
      'JWT Auth', 'Microservices', 'API Security'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · Back End Developer',
    headerRole: 'Back End Developer · .NET API · Clean Architecture',
    subject: 'Application for Back End Developer Position',
    sigTags: [
      'Back End Developer',
      '.NET API Developer',
      'Clean Architecture',
      'Database Engineer'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',        sub: '.NET API · Enterprise' },
      { label: 'core stack', val: '.NET 8 · EF Core', sub: 'SQL Server · Oracle · CQRS' },
      { label: 'domains',    val: 'Insurance · Utility · Defence', sub: 'Etiqa · TNB · PDRM' }
    ],
    body: [
      `I am applying for the <strong>Back End Developer</strong> role and bring over <strong>six years of focused .NET backend engineering experience</strong> across complex enterprise environments in Malaysia's insurance, government utility, and defence sectors.`,
      `My backend work centres on <strong>ASP.NET Core REST APIs</strong> designed with Clean Architecture, CQRS, and proper DDD layering. I take data model design seriously — schema integrity, migration management, audit trails, and index planning are disciplines I apply by default. In production systems I have worked extensively with <strong>SQL Server and Oracle</strong>, and more recently with <strong>PostgreSQL</strong> on Cloudflare D1-adjacent edge deployments.`,
      `At <em>Etiqa Insurance and Takaful Berhad</em>, I maintain and extend backend systems that handle policy issuance, claims, and regulatory reporting under BNM guidelines. These are high-stakes, zero-downtime environments where correctness and structured rollback procedures are expected. My work here sharpened my instinct for conservative, auditable changes over clever shortcuts.`,
      `At <em>JuruQuest Consulting</em>, I architected and delivered the <strong>TNB TOMAS</strong> backend — integrating .NET API layers with <strong>SAP ERP, LDAP / Active Directory, Oracle, and Esri ArcGIS</strong> while serving both web and mobile consumers. The project required me to reverse-engineer legacy systems, design replacement services layer-by-layer, and document every integration contract clearly for handover. I also stood up a small <strong>Node.js</strong> notification microservice and a supporting <strong>Angular</strong> admin dashboard (2023–2024) alongside the core .NET backend.`,
      `At <em>atQuest Sdn. Bhd.</em>, I shipped a run of minor backend enhancements to the TNB ESS platform — new validation logic, a lightweight <strong>Node.js</strong> notification service, and fixes to a legacy <strong>Java</strong> payroll batch module — each scoped carefully against a mission-critical .NET 4.5.1 monolith.`,
      `I write APIs designed to be consumed without surprises: consistent response envelopes, versioned endpoints, JWT-secured routes, and structured Serilog telemetry with Application Insights integration. I also understand the maintenance burden of long-lived backend code and apply abstractions deliberately, only when they earn their complexity cost.`,
      `I am confident I can contribute strong, production-ready backend work to your team from day one.`,
      `Thank you for your time and consideration. I look forward to the opportunity to discuss my experience further.`
    ]
  }
};
