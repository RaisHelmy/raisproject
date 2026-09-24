/* Position: Technical Consultant
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the Technical Consultant target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'Technical Consultant',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — Technical Consultant CV',
    roleTags: [
      'Technical Consultant',
      'IT Delivery Consultant',
      'Enterprise Technology Consultant',
      'Technology Advisor',
      'IT Project Consultant'
    ],
    glanceSpec: 'Technical Consulting<br>Enterprise Delivery<br>Project Rescue<br>Client Advisory',
    summary: `Technical consultant with <span class="cv-exp-text">6+</span> years of multi-domain delivery experience spanning insurance, government utility, defence, and public-sector clients in Malaysia. Skilled at entering complex, ambiguous project environments — assessing technical health, identifying risk, aligning stakeholders, and driving delivery forward. Experienced in <strong>project rescue, requirements analysis, HLD/LLD documentation, and cross-functional team advisory</strong> alongside hands-on delivery in <strong>.NET 8, FlutterFlow, SAP integration, and enterprise infrastructure</strong>. Credible with both technical teams and non-technical decision-makers.`,
    competencies: [
      'Technical Consulting', 'Project Management', 'Project Rescue',
      'Client Advisory', 'Requirements Analysis', 'Risk Assessment',
      'Technical Documentation', 'Stakeholder Engagement', 'Enterprise Delivery',
      '.NET 8', 'FlutterFlow', 'SAP / LDAP'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · Technical Consultant',
    headerRole: 'Technical Consultant · Enterprise Delivery · Client Advisory',
    subject: 'Application for Technical Consultant Position',
    sigTags: [
      'Technical Consultant',
      'Enterprise Delivery',
      'Project Rescue Specialist',
      'Client Advisory'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',                 sub: 'Multi-Domain Consulting' },
      { label: 'core stack', val: '.NET 8 · SAP · FlutterFlow', sub: 'Architecture · Project Delivery' },
      { label: 'domains',    val: 'Insurance · Defence · Utility', sub: 'Etiqa · PDRM · TNB' }
    ],
    body: [
      `I am writing to apply for the <strong>Technical Consultant</strong> position. Over <strong>six years of enterprise delivery</strong> across insurance, government utility, public safety, and defence sectors, I have consistently operated at the intersection of technical depth and client-facing advisory — diagnosing problems clearly, communicating risks honestly, and helping organisations move confidently through complex technology challenges.`,
      `My most illustrative consulting engagement was the <strong>TNB TOMAS</strong> project at <em>JuruQuest Consulting</em>. I was brought into a project with an entirely broken codebase, no working documentation, and a frustrated national utility client. My first task was a technical assessment — methodically tracing what existed, identifying what was salvageable, and producing a clear picture of the actual scope required to deliver. I then rebuilt the platform end-to-end: <strong>SAP ERP integration, LDAP/AD SSO, Oracle backend, Esri ArcGIS work orders, and FlutterFlow mobile clients</strong> for iOS and Android. Throughout delivery, I maintained direct advisory engagement with TNB stakeholders on scope, risk, and timeline expectations, later advising on a small <strong>Angular</strong> reporting module (2023–2024) and a supporting <strong>Node.js</strong> notification service added to the platform.`,
      `I then advised <em>atQuest Sdn. Bhd.</em> on the TNB ESS platform, scoping a handful of minor enhancements — validation rules, a <strong>Node.js</strong> notification utility, and small fixes to a legacy <strong>Java</strong> payroll batch module — while keeping change requests tightly scoped against the mission-critical .NET monolith underneath.`,
      `At <em>Vector Intelligence</em>, I consulted on the architecture and delivery of the <strong>PDRM C4i Command Centre</strong> — a law enforcement operations platform requiring infrastructure design, communications integration, and phased stakeholder sign-off at each milestone.`,
      `As a consultant, I bring habits that clients value: I document decisions and their rationale, surface issues early rather than absorbing them silently, structure proposals that decision-makers can act on, and hold the broader delivery picture even while working in the technical detail.`,
      `Currently at <em>Etiqa Insurance</em>, I advise on technical change in a regulated environment where BNM compliance, legacy system constraints, and audit requirements shape every delivery decision — excellent grounding for working in risk-sensitive consulting contexts.`,
      `I am excited by the opportunity to contribute both technical breadth and consulting discipline to your team and your clients.`,
      `Thank you sincerely for your consideration. I look forward to the conversation.`
    ]
  }
};
