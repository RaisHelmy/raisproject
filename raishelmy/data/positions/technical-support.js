/* Position: Technical Support
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the Technical Support target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'Technical Support',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — Technical Support CV',
    roleTags: [
      'Technical Support Engineer',
      'IT Support Specialist',
      'Enterprise Application Support',
      'Systems Support Engineer',
      'IT Support & Operations'
    ],
    glanceSpec: 'Enterprise Support · Diagnostics<br>LDAP / AD · Windows Server<br>System Integration<br>Multi-Domain Experience',
    summary: `Adaptable technical support engineer with <span class="cv-exp-text">6+</span> years bridging complex enterprise systems and end-user environments across insurance, utility, and defence sectors. Experienced in diagnosing production failures, maintaining critical enterprise platforms, and supporting <strong>LDAP/AD, SQL Server, SAP, Oracle</strong> integrations under strict SLA conditions. Comfortable operating across the full stack — from infrastructure diagnostics and Windows/Linux server management to API-level troubleshooting and application monitoring with <strong>Application Insights</strong> and <strong>Serilog</strong>.`,
    competencies: [
      'Troubleshooting', 'LDAP / AD', 'Windows Server',
      'SQL Server', 'System Diagnostics', 'API Testing',
      'VMware ESXi', 'Linux', 'Network Support',
      'Incident Response', 'Application Insights', 'Postman'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · Technical Support',
    headerRole: 'Technical Support Engineer · System Integration · Infrastructure',
    subject: 'Application for Technical Support Engineer Position',
    sigTags: [
      'Technical Support Engineer',
      'System Integration',
      'LDAP / AD Specialist',
      'IT Troubleshooting'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',            sub: 'Enterprise · Government · Defence' },
      { label: 'core stack', val: 'LDAP · SQL Server · SAP', sub: 'Windows Server · VMware · Linux' },
      { label: 'domains',    val: 'Insurance · Defence · Utility', sub: 'TNB · PDRM · Etiqa' }
    ],
    body: [
      `I am writing to express my strong interest in the <strong>Technical Support Engineer</strong> position at your organisation. With over <strong>six years of enterprise delivery experience</strong> across some of Malaysia's most demanding technical environments — insurance, law enforcement, and national utility — I bring deep practical ability to diagnose, resolve, and prevent complex system issues.`,
      `In my current role at <em>Etiqa Insurance and Takaful Berhad</em>, I maintain and extend enterprise insurance backend systems integrated with <strong>SQL Server, Oracle, MDM, and PolisyM</strong>. I have first-hand experience with production incident response, regulatory audit log review, and API-level troubleshooting at scale. Supporting complex integrations under BNM compliance requirements has sharpened my ability to work under pressure while keeping stakeholders informed.`,
      `At <em>JuruQuest Consulting</em> on the <strong>TNB TOMAS</strong> project, I performed full reverse engineering of a broken production codebase — diagnose-first, fix-second — and rebuilt the system from scratch. This included <strong>LDAP / Active Directory integration</strong> for enterprise SSO, <strong>SAP ERP</strong> data synchronisation, and multi-layer approval workflows serving TNB field engineers on iOS and Android. Supporting complex systems across teams requires exactly this kind of structured diagnostic thinking. I later supported a small <strong>Angular</strong> reporting dashboard (2023–2024) and a <strong>Node.js</strong> notification service that shipped alongside the platform.`,
      `Afterwards, at <em>atQuest Sdn. Bhd.</em>, I supported a run of minor enhancements to the TNB ESS platform — triaging validation issues, supporting a small <strong>Node.js</strong> notification service, and troubleshooting a legacy <strong>Java</strong> payroll batch module — within a mission-critical HR system where any regression affected thousands of employees.`,
      `At <em>Vector Intelligence</em>, I designed and supported <strong>VMware ESXi hyperconverged infrastructure</strong>, enterprise <strong>VPN perimeters</strong> (OpenVPN, IPSec), <strong>Active Directory RBAC</strong>, and integrated CCTV / communications systems for the <strong>PDRM C4i Command Centre</strong> — a 24/7 law enforcement operations platform where uptime was non-negotiable.`,
      `I bring strong documentation habits, structured incident reporting, and a calm, methodical approach to high-pressure support scenarios. I communicate technical issues clearly to both engineering teams and non-technical stakeholders.`,
      `I would welcome the opportunity to contribute this depth of diagnostic and system support experience to your team.`,
      `Thank you sincerely for your time and consideration. I look forward to discussing how my background can support your operations.`
    ]
  }
};
