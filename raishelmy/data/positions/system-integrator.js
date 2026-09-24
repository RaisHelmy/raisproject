/* Position: System Integrator
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the System Integrator target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'System Integrator',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — System Integrator CV',
    roleTags: [
      'System Integrator',
      'Enterprise Integration Engineer',
      'Middleware Architect',
      'API Integration Specialist',
      'ERP Integration Developer'
    ],
    glanceSpec: 'SAP · LDAP/AD · Oracle<br>Esri ArcGIS · SIP/PBX<br>Enterprise Middleware<br>API &amp; Protocol Integration',
    summary: `Enterprise integration specialist with <span class="cv-exp-text">6+</span> years connecting heterogeneous systems across government, utility, insurance, and defence sectors. Experienced in orchestrating <strong>SAP ERP, LDAP / Active Directory, Oracle, Esri ArcGIS, SIP/PBX, and MDM</strong> integrations within .NET-based middleware layers. Comfortable designing integration contracts, mapping data between disparate schemas, managing identity federation, and debugging opaque third-party interfaces where documentation is incomplete.`,
    competencies: [
      'SAP HR / ERP', 'LDAP / AD', 'Esri ArcGIS',
      'SIP / PBX', 'Oracle', 'REST / SOAP',
      'MDM', 'Middleware Design', 'XMPP / Jitsi',
      'Enterprise Architecture', '.NET Integration', 'JWT / SSO'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · System Integrator',
    headerRole: 'System Integrator · SAP · LDAP/AD · Enterprise Middleware',
    subject: 'Application for System Integrator Position',
    sigTags: [
      'System Integrator',
      'SAP / ERP Integration',
      'LDAP / AD Specialist',
      'Enterprise Middleware'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',               sub: 'Enterprise Integration' },
      { label: 'core stack', val: 'SAP · LDAP · Esri · Oracle', sub: 'SIP/PBX · MDM · REST/SOAP' },
      { label: 'domains',    val: 'Utility · Defence · Insurance', sub: 'TNB · PDRM · Etiqa' }
    ],
    body: [
      `I am writing to apply for the <strong>System Integrator</strong> position and to present over <strong>six years of enterprise integration experience</strong> across some of Malaysia's most complex cross-system environments — national utility infrastructure, law enforcement operations, and a major insurance conglomerate.`,
      `My deepest integration work was on the <strong>TNB TOMAS</strong> project at <em>JuruQuest Consulting</em>, where I designed and delivered a full enterprise integration layer connecting a .NET platform to <strong>SAP HR/ERP</strong> (employee sync, approval delegation), <strong>LDAP / Active Directory</strong> (SSO, group-based RBAC), <strong>Oracle</strong> (dual-schema data model), and <strong>Esri ArcGIS</strong> (geo-referenced work order mapping with custom tile rendering). Additionally, I integrated Jitsi XMPP for in-app team communications. This project required me to hold the integration surface area clearly in mind at all times — a single schema mismatch or misconfigured AD group could break the approval chain for hundreds of field engineers. I later connected a small <strong>Angular</strong> reporting module (2023–2024) and a <strong>Node.js</strong> notification service into the same platform.`,
      `Afterwards, at <em>atQuest Sdn. Bhd.</em>, I integrated a lightweight <strong>Node.js</strong> notification service and patched connectivity in a legacy <strong>Java</strong> payroll batch module into the TNB ESS platform's existing SAP HR/ERP and LDAP integration layer — careful, minor-footprint changes against a system with zero tolerance for integration breakage.`,
      `At <em>Vector Intelligence</em> on the PDRM C4i project, I integrated <strong>SIP/PBX communications, IP CCTV systems, and VMware infrastructure</strong> into a unified command-and-control platform. Integration here meant not just API connections but understanding communication protocol stacks, signal routing, and real-time data feeds from physical systems.`,
      `At <em>Etiqa Insurance</em>, I work within a legacy enterprise stack integrating <strong>Oracle, SQL Server, MDM, and PolisyM</strong> — navigating undocumented internal conventions while delivering changes that regulatory auditors can trace.`,
      `I document integration contracts thoroughly, design fallback and retry strategies for unreliable external systems, and communicate clearly with the owners of each integrated platform throughout the process.`,
      `I look forward to discussing how my integration expertise can serve your organisation's technical demands.`,
      `Thank you for your consideration.`
    ]
  }
};
