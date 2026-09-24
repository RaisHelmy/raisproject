/* Position: Full Stack Engineer
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the Full Stack Engineer target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'Full Stack Engineer',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — Full Stack Engineer CV',
    roleTags: [
      'Full Stack Engineer',
      'Full Stack Developer',
      'Software Engineer',
      'Web & Mobile Developer',
      'End-to-End Engineer'
    ],
    glanceSpec: '.NET 8 · FlutterFlow · React<br>REST API · Mobile Dev<br>Cloudflare Serverless<br>End-to-End Delivery',
    summary: `Versatile full stack engineer with <span class="cv-exp-text">6+</span> years delivering end-to-end enterprise software across <strong>.NET 8 / ASP.NET Core</strong> backends, <strong>FlutterFlow / Flutter</strong> mobile frontends, <strong>React</strong> web interfaces, and <strong>Cloudflare Workers</strong> edge deployments. Comfortable owning the entire delivery lifecycle — from domain modelling and API design to iOS/Android distribution and CI/CD pipeline configuration. Proven in government, insurance, and defence contexts where quality, performance, and regulatory compliance are non-negotiable.`,
    competencies: [
      '.NET 8', 'FlutterFlow', 'Flutter / Dart',
      'React', 'REST API', 'ASP.NET Core',
      'SQL Server', 'Cloudflare Workers', 'HTML / CSS / JS',
      'iOS Enterprise', 'Android', 'EF Core'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · Full Stack Engineer',
    headerRole: 'Full Stack Engineer · .NET · FlutterFlow · Cloudflare',
    subject: 'Application for Full Stack Engineer Position',
    sigTags: [
      'Full Stack Engineer',
      '.NET Developer',
      'FlutterFlow Developer',
      'Cloudflare Serverless'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',         sub: '.NET · Flutter · React · Cloud' },
      { label: 'core stack', val: '.NET 8 · FlutterFlow', sub: 'React · Cloudflare Workers' },
      { label: 'domains',    val: 'Insurance · Defence · Utility', sub: 'Etiqa · PDRM · TNB' }
    ],
    body: [
      `I am writing to express my enthusiasm for the <strong>Full Stack Engineer</strong> role at your organisation. With over <strong>six years spanning backend API development, cross-platform mobile delivery, and edge-side serverless deployments</strong>, I bring a genuinely end-to-end engineering perspective to every project I join.`,
      `On the backend, I design and build clean, maintainable <strong>.NET 8 / ASP.NET Core REST APIs</strong> using Clean Architecture and CQRS, backed by <strong>SQL Server, Oracle, and PostgreSQL</strong>. I understand the importance of proper API design — versioning, JWT authentication, structured error responses, and audit logging — and I apply these consistently regardless of project scale.`,
      `On the frontend and mobile layer, I have delivered production applications with <strong>FlutterFlow and Flutter / Dart</strong> for both iOS Enterprise and Android, and built web frontends with <strong>React and vanilla HTML/CSS/JS</strong>. I recently published a full-stack Cloudflare Workers + Pages application stack, managing CORS, D1 SQLite, and R2 storage entirely at the edge.`,
      `At <em>JuruQuest Consulting</em>, I delivered <strong>TNB TOMAS</strong> — a full ERP-integrated field engineering platform with SAP backend sync, LDAP/AD authentication, Esri ArcGIS work order mapping, multi-tier approvals, and iOS/Android mobile clients. My role spanned every layer: database schema, backend API, and mobile UI — while coordinating directly with TNB stakeholders. I also built a small <strong>Angular</strong> internal reporting dashboard (2023–2024) and a lightweight <strong>Node.js</strong> notification microservice that plugged into the platform.`,
      `At <em>atQuest Sdn. Bhd.</em>, I shipped a run of minor feature and validation enhancements on the TNB ESS platform — a <strong>Node.js</strong> notification utility, added form-level validation rules, and small fixes to a legacy <strong>Java</strong> payroll batch module — while keeping changes tightly scoped within a mission-critical .NET monolith.`,
      `At <em>Etiqa Insurance</em>, I maintain and extend enterprise insurance backend systems integrated with Oracle, SQL Server, and PolisyM — practising incremental delivery within BNM-regulated production environments where zero-tolerance for errors is the standard.`,
      `I thrive on the clarity of owning both sides of a system — knowing exactly why state flows the way it does, from database to UI. That ownership mindset means fewer surprises in production.`,
      `Thank you for considering my application. I welcome the opportunity to discuss how my full stack background can accelerate your team's delivery.`
    ]
  }
};
