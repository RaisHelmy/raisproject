/* Position: Solution Engineer
   Used by cv.html and coverletter.html via dynamic script injection.
   Edit this file to customise content for the Solution Engineer target role.
   window.POSITION is read by initPage() once this script loads. */

window.POSITION = {
  label: 'Solution Engineer',

  cv: {
    pageTitle: 'Rais Helmy Sapiullah — Solution Engineer CV',
    roleTags: [
      'Solution Engineer',
      'Pre-Sales Engineer',
      'Technical Pre-Sales Specialist',
      'Solution Consultant',
      'Technology Solutions Engineer'
    ],
    glanceSpec: 'Solution Design · HLD/LLD<br>Technical Pre-Sales<br>Stakeholder Management<br>Architecture Proposals',
    summary: `Solution engineer and technical lead with <span class="cv-exp-text">6+</span> years translating complex enterprise requirements into coherent, deliverable architectures. Experienced in producing <strong>HLD/LLD documentation, RFP/RFI analysis</strong>, and proof-of-concept deliverables for government and corporate clients. Comfortable presenting to technical and non-technical stakeholders, facilitating requirements workshops, and bridging the gap between business expectations and engineering constraints. Hands-on background in <strong>.NET, FlutterFlow, cloud infrastructure, and enterprise integration</strong> ensures proposed solutions are grounded in real-world delivery experience.`,
    competencies: [
      'Solution Architecture', 'HLD / LLD', 'Technical Pre-Sales',
      'RFP / RFI Analysis', 'Stakeholder Management', 'Proof of Concept',
      'Architecture Diagrams', 'Risk Assessment', 'Enterprise Architecture',
      '.NET 8', 'Cloudflare', 'Presales Presentations'
    ]
  },

  cl: {
    pageTitle: 'Rais Helmy Sapiullah — Cover Letter · Solution Engineer',
    headerRole: 'Solution Engineer · Architecture · Pre-Sales · Technical Lead',
    subject: 'Application for Solution Engineer Position',
    sigTags: [
      'Solution Engineer',
      'Pre-Sales Architect',
      'Technical Lead',
      'Enterprise Solution Design'
    ],
    hlCells: [
      { label: 'experience', val: '6+ Years',             sub: 'Solution Design · Architecture' },
      { label: 'core stack', val: 'HLD/LLD · RFP · PoC', sub: '.NET 8 · Cloudflare · FlutterFlow' },
      { label: 'domains',    val: 'Utility · Defence · Insurance', sub: 'TNB · PDRM · Etiqa' }
    ],
    body: [
      `I am writing to apply for the <strong>Solution Engineer</strong> position. With over <strong>six years designing and delivering enterprise solutions</strong> across government, defence, and financial services sectors in Malaysia, I offer a track record of converting complex stakeholder requirements into structured, buildable architectures — and then leading their delivery.`,
      `My solution design work spans both pre-delivery and execution phases. On the <strong>TNB TOMAS</strong> project, I was responsible for architecting the full technical blueprint: identifying integration touchpoints with SAP, LDAP/AD, Oracle, and Esri ArcGIS, designing the API surface, proposing the mobile delivery strategy, and presenting trade-off decisions to senior TNB stakeholders before a line of code was written. I then owned end-to-end delivery against that architecture.`,
      `For the <strong>PDRM C4i Command Centre</strong>, I developed the infrastructure, networking, and system integration design for a national law enforcement operations platform — including high-availability topology, VPN perimeter design, and communications systems integration. Presenting these proposals to a defence client required precision, clarity, and credibility earned from genuine technical depth.`,
      `I understand the pre-sales and scoping lifecycle well: I know how to read RFPs critically, identify risks buried in scope descriptions, structure PoC deliverables that demonstrate value without overcommitting, and produce HLD/LLD documentation that architecture review boards can actually approve.`,
      `My hands-on implementation background means I do not propose solutions I cannot defend technically. When I recommend a technology or architecture pattern, I have generally built or operated it in a production context.`,
      `I am enthusiastic about the opportunity to contribute both architectural thinking and technical credibility to your solution engineering team.`,
      `Thank you for your time. I look forward to discussing how I can support your client engagements.`
    ]
  }
};
