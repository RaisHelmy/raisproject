/* Position: System Analyst
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the System Analyst target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'System Analyst',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — System Analyst CV',
    roleTags: [
      'System Analyst',
      'IT Systems Analyst',
      'Enterprise Systems Analyst',
      'Application Analyst',
      'Technical Business Analyst'
    ],
    glanceSpec: 'Requirements Analysis · HLD/LLD<br>System Design · Integration<br>Stakeholder Management<br>Agile · Documentation',
    summary: `System analyst with <span class="cv-exp-text">6+</span> years translating complex business requirements into structured technical specifications and working systems across insurance, utility, defence, and government sectors in Malaysia. Skilled at conducting <strong>requirements workshops, producing HLD/LLD documentation, mapping as-is and to-be processes</strong>, and bridging communication between business stakeholders and engineering teams. Hands-on delivery background in <strong>.NET 8, REST APIs, Oracle/SQL Server, SAP ERP, and enterprise integration</strong> ensures analysis outputs are grounded in technical reality and directly actionable by development teams.`,
    competencies: [
      'Requirements Analysis', 'System Design', 'HLD / LLD',
      'Process Mapping', 'Stakeholder Engagement', 'UAT Facilitation',
      'Data Flow Diagrams', 'Use Case Modelling', 'API Design',
      '.NET 8', 'Oracle / SQL Server', 'SAP / LDAP Integration'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · System Analyst',
    headerRole: 'System Analyst · Requirements · System Design · Integration',
    subject: 'Application for System Analyst Position',
    sigTags: [
      'System Analyst',
      'Business & IT Bridge',
      'Requirements & HLD/LLD',
      'Enterprise Integration'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',                   sub: 'Analysis · Design · Delivery' },
      { label: 'core stack', val: 'HLD/LLD · SAP · Oracle',     sub: '.NET 8 · LDAP · Esri ArcGIS' },
      { label: 'domains',    val: 'Insurance · Utility · Defence', sub: 'Etiqa · TNB · PDRM' }
    ],
    body: [
      `I am writing to apply for the <strong>System Analyst</strong> position. With over <strong>six years of experience</strong> bridging business requirements and technical delivery across insurance, utility, and government sectors in Malaysia, I offer a proven ability to define clear system specifications, align stakeholders, and ensure engineering teams build the right thing — correctly.`,
      `My most intensive analysis engagement was the <strong>TNB TOMAS</strong> project at <em>JuruQuest Consulting</em>, where I joined a failing enterprise initiative with no coherent documentation and a frustrated national utility client. I conducted a full technical and requirements assessment — mapping existing workflows, identifying integration points with <strong>SAP ERP, LDAP/AD, Oracle, and Esri ArcGIS</strong>, and producing the HLD and functional specification from which the re-built platform was delivered. Throughout the project, I maintained direct engagement with TNB stakeholders to validate requirements and manage scope expectations. I also scoped a small <strong>Angular</strong> reporting module (2023–2024) and a supporting <strong>Node.js</strong> notification service added later in the engagement.`,
      `Afterwards, at <em>atQuest Sdn. Bhd.</em>, I documented requirements and validation rules for a run of minor enhancements to the TNB ESS platform — including a <strong>Node.js</strong> notification utility and scoped fixes to a legacy <strong>Java</strong> payroll batch module — tracing each change back to a specific business requirement before handing off to development.`,
      `At <em>Vector Intelligence</em>, I performed system analysis for the <strong>PDRM C4i Command and Control Centre</strong> — producing integration specifications for GIS, unified communications, CCTV, and VPN infrastructure in a mission-critical law enforcement environment. This required precise requirements tracing, detailed data flow documentation, and iterative stakeholder sign-off at each programme milestone.`,
      `In my current role at <em>Etiqa Insurance</em>, I work in a BNM-regulated environment where requirements documentation, impact assessments, and traceability matrices are mandatory before any system change is approved. I routinely produce <strong>functional specifications, process flow diagrams, and UAT test plans</strong> for policy lifecycle and compliance systems.`,
      `My hands-on development background gives my analysis a practical edge: I understand API contracts, database schemas, and integration constraints deeply enough to write specifications that developers can implement without ambiguity — reducing rework and accelerating delivery.`,
      `I am keen to contribute both analytical rigour and technical credibility to your team, and I look forward to discussing how my experience aligns with your requirements.`,
      `Thank you sincerely for your time and consideration.`
    ]
  }
};
