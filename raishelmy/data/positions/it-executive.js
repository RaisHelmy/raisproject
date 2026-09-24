/* Position: IT Executive
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the IT Executive target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'IT Executive',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — IT Executive CV',
    roleTags: [
      'IT Executive',
      'IT Officer',
      'Information Technology Executive',
      'IT Operations Executive',
      'Systems & IT Executive'
    ],
    glanceSpec: '.NET · SQL Server · REST API<br>Windows Server · LDAP / AD<br>System Integration<br>Insurance · Defence · Utility',
    summary: `Results-driven IT Executive with <span class="cv-exp-text">6+</span> years of progressive experience across enterprise application development, system integration, and IT operations in regulated industries. Delivered end-to-end technology solutions for <strong>Etiqa Insurance</strong>, <strong>TNB</strong>, and <strong>PDRM</strong> — spanning <strong>.NET 8 / ASP.NET Core</strong> backend systems, <strong>SQL Server / Oracle</strong> database administration, <strong>Active Directory / LDAP</strong> identity management, and cloud-edge deployments on <strong>Cloudflare Workers</strong>. Adept at bridging technical delivery with business requirements, coordinating cross-functional teams, and maintaining production stability under strict SLA and compliance frameworks.`,
    competencies: [
      '.NET 8 / ASP.NET Core', 'SQL Server', 'Oracle',
      'LDAP / Active Directory', 'REST API', 'Windows Server',
      'Cloudflare Workers', 'VMware ESXi', 'System Integration',
      'IT Documentation', 'Project Coordination', 'Application Insights'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · IT Executive',
    headerRole: 'IT Executive · .NET · System Integration · IT Operations',
    subject: 'Application for IT Executive Position',
    sigTags: [
      'IT Executive',
      '.NET Developer',
      'System Integration',
      'IT Operations'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',               sub: 'Enterprise · Government · Regulated' },
      { label: 'core stack', val: '.NET 8 · SQL Server · AD', sub: 'Cloudflare · Oracle · VMware' },
      { label: 'domains',    val: 'Insurance · Defence · Utility', sub: 'Etiqa · PDRM · TNB' }
    ],
    body: [
      `I am writing to express my keen interest in the <strong>IT Executive</strong> position at your organisation. With over <strong>six years of hands-on experience</strong> spanning enterprise application development, systems integration, and IT operations across Malaysia's insurance, defence, and utility sectors, I am confident in my ability to contribute meaningfully from day one.`,
      `In my current role at <em>Etiqa Insurance and Takaful Berhad</em>, I maintain and extend critical insurance backend systems integrated with <strong>SQL Server, Oracle, MDM, and PolisyM</strong>. I work within a <strong>BNM-regulated production environment</strong> — managing change requests, coordinating release cycles, maintaining audit logs, and troubleshooting production incidents with full accountability to compliance standards. This has strengthened both my technical depth and my ability to communicate clearly with compliance, operations, and business stakeholders.`,
      `At <em>JuruQuest Consulting</em>, I led the full technical delivery of <strong>TNB TOMAS</strong> — an enterprise field engineering management platform integrating <strong>SAP ERP</strong>, <strong>LDAP / Active Directory SSO</strong>, <strong>Esri ArcGIS</strong> work order mapping, and iOS/Android mobile clients for TNB field engineers. I handled database design, API development, deployment coordination, and direct stakeholder engagement — precisely the cross-functional IT executive profile most organisations need. I also coordinated a small <strong>Angular</strong> internal reporting dashboard (2023–2024) and a <strong>Node.js</strong> notification utility that shipped alongside the core platform.`,
      `At <em>atQuest Sdn. Bhd.</em>, I coordinated a series of minor enhancements to the TNB ESS platform — new validation rules, a lightweight <strong>Node.js</strong> notification service, and small fixes to a legacy <strong>Java</strong> payroll batch module — each scoped, tested, and deployed through structured CR processes with minimal disruption to a mission-critical HR system.`,
      `At <em>Vector Intelligence</em>, I designed and maintained the <strong>PDRM C4i Command Centre</strong> infrastructure — including <strong>VMware ESXi hyperconverged servers</strong>, enterprise <strong>VPN perimeters</strong> (OpenVPN, IPSec), <strong>Active Directory RBAC</strong>, and integrated CCTV and communications systems. Operating a 24/7 law enforcement platform where any downtime has real-world consequences taught me the discipline of proactive monitoring, rigorous documentation, and structured incident response.`,
      `Beyond technical delivery, I maintain clear IT documentation, produce internal system guides, and take ownership of user-facing support escalations. I understand that the IT Executive role sits at the intersection of technology and people — and I approach that responsibility with both professional rigour and a service mindset.`,
      `I look forward to the opportunity to discuss how my background can contribute to your organisation's IT objectives and operations.`,
      `Thank you for your time and consideration.`
    ]
  }
};
