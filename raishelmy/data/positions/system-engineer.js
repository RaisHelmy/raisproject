/* Position: System Engineer
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the System Engineer target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'System Engineer',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — System Engineer CV',
    roleTags: [
      'System Engineer',
      'Infrastructure Engineer',
      'Network Engineer',
      'IT Infrastructure Engineer',
      'Systems Administrator'
    ],
    glanceSpec: 'VMware ESXi · Linux<br>Networking · VPN Design<br>High Availability · HCI<br>Docker · GitLab CI/CD',
    summary: `Systems engineer with <span class="cv-exp-text">6+</span> years of hands-on infrastructure experience across hyperconverged compute, enterprise networking, and secure government deployments. Adept at architecting <strong>VMware ESXi HCI clusters</strong>, designing <strong>OpenVPN / IPSec perimeters</strong>, managing <strong>Active Directory RBAC</strong>, and operating Linux and Windows Server environments under operational and compliance pressures. Proven in high-availability government and defence programmes where infrastructure uptime is mission-critical.`,
    competencies: [
      'VMware ESXi', 'Linux', 'Windows Server',
      'nginx', 'Docker', 'GitLab CI/CD',
      'OpenVPN / IPSec', 'Active Directory', 'RBAC',
      'High Availability', 'Networking', 'Cloudflare'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · System Engineer',
    headerRole: 'System Engineer · Infrastructure · DevOps · Networking',
    subject: 'Application for System Engineer Position',
    sigTags: [
      'System Engineer',
      'Infrastructure Engineer',
      'VMware · Linux Specialist',
      'DevOps Engineer'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',              sub: 'Infrastructure · DevOps' },
      { label: 'core stack', val: 'VMware · Linux · Docker', sub: 'OpenVPN · AD · GitLab CI/CD' },
      { label: 'domains',    val: 'Defence · Utility · Insurance', sub: 'PDRM · TNB · Etiqa' }
    ],
    body: [
      `I am applying for the <strong>System Engineer</strong> role and bring over <strong>six years of infrastructure and systems experience</strong> across enterprise, government, and utility sectors — including full ownership of hyperconverged compute, networking, and secure operation centre deployments.`,
      `My most intensive infrastructure work was at <em>Vector Intelligence</em>, where I designed and deployed the full technical architecture for the <strong>PDRM C4i Command Centre</strong> — a 24/7 law enforcement operations platform demanding zero tolerance for failure. My responsibilities included <strong>VMware ESXi hyperconverged infrastructure</strong>, enterprise <strong>VPN topology</strong> (OpenVPN site-to-site and IPSec remote access), <strong>Active Directory RBAC</strong> design, high-availability clustering, and IP-based CCTV / unified communications integration.`,
      `At <em>JuruQuest Consulting</em> on the <strong>TNB TOMAS</strong> project, I managed the server-side environment alongside application development — configuring <strong>Windows Server</strong> application hosts, planning deployment pipelines, and ensuring system reliability for a multi-site utility field engineering platform with mobile consumers across iOS and Android. I also stood up hosting for a small <strong>Angular</strong> reporting dashboard (2023–2024) and a lightweight <strong>Node.js</strong> notification service that ran alongside the core .NET application.`,
      `Afterwards, at <em>atQuest Sdn. Bhd.</em>, I supported deployment of a run of minor enhancements to the TNB ESS platform — a small <strong>Node.js</strong> notification service and fixes to a legacy <strong>Java</strong> payroll batch job — into a mission-critical Windows Server / IIS environment with tightly controlled release windows.`,
      `I apply DevOps practices naturally: containerising services with <strong>Docker</strong>, automating pipelines with <strong>GitLab CI/CD</strong>, and managing web layer infrastructure via <strong>nginx</strong> reverse proxy with TLS termination. I understand the operational lifecycle of systems beyond deployment — patching cycles, log management, access reviews, and incident escalation.`,
      `Whether designing from scratch, hardening an existing environment, or bridging infrastructure with application teams, I bring methodical thinking, clear documentation, and a deep appreciation for the consequences of infrastructure decisions.`,
      `I am confident I can contribute meaningfully to your systems team and would welcome the opportunity to discuss how my background aligns with your infrastructure challenges.`,
      `Thank you for your time and consideration.`
    ]
  }
};
