/**
 * RAIS HELMY — Tip Slide Renderer
 * Reads window.TIP_DATA and builds the full slide player.
 *
 * TIP_DATA schema:  (see tips_slide/data/[slug].js for examples)
 * {
 *   id, title, description, category, tags[], date,
 *   author: { name, role, url },
 *   slides: [
 *     { type: "cover"|"evr-code"|"evr"|"nuance"|"framework"|"cta"|"custom", ... }
 *   ]
 * }
 */
(function() {
  'use strict';

  const D = window.TIP_DATA;
  if (!D) { console.error('[TipRenderer] No window.TIP_DATA found.'); return; }

  const AUTHOR = D.author || { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' };
  const SITE   = 'raishelmy.uk';
  const total  = D.slides.length;

  /* ─── Helpers ─── */
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  // Raw HTML pass-through — used for code blocks which already contain <span> tags
  function raw(s) { return s || ''; }
  function stripHtml(h) { return String(h||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim(); }

  /* ─── Slide footer ─── */
  function footer(url, label) {
    const href = url || (AUTHOR.url + '/tips/' + D.id);
    const text = label || (SITE + '/tips/' + D.id);
    return `<div class="sf" style="margin-top:8px;">
      <a href="https://${text}" target="_blank" rel="noopener">${text}</a>
      <span class="au">${esc(AUTHOR.name)}</span>
    </div>`;
  }

  /* ─── Render: COVER ─── */
  function renderCover(s) {
    const dark = s.dark !== false;
    const bg   = dark ? 'background:#0a0a0a;' : '';
    const numColor = dark ? 'color:#333;' : '';
    const labelColor = dark ? 'color:var(--red-soft);' : '';
    const tagsHtml = (s.tags || D.tags || []).map(t =>
      `<span style="font-family:'DM Mono',monospace;font-size:clamp(6.5px,1vw,8px);padding:3px 8px;border:1px solid #1e1e1e;color:#444;border-radius:2px;">${esc(t)}</span>`
    ).join('');

    return `<div class="slide ${s.active?'active':''}" style="${bg}">
  <div class="si">
    <span class="snum" style="${numColor}">${esc(s.num)}</span>
    <div class="label" style="${labelColor}">${esc(s.label || 'a real talk thread · '+AUTHOR.name.toLowerCase())}</div>
    <div style="height:1.5px;background:${dark?'#1e1e1e':'var(--rule)'};margin:7px 0 14px;"></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px;">
      <p style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8.5px);letter-spacing:.14em;text-transform:uppercase;color:#444;">${total} slides · ${esc(D.category||'software engineering')}</p>
      <h1 style="font-size:clamp(20px,5vw,34px);font-weight:700;line-height:1.1;letter-spacing:-.03em;color:${dark?'#fff':'var(--ink)'};">
        ${raw(s.title_html || esc(s.title || D.title))}
      </h1>
      <p style="font-size:clamp(9px,1.4vw,11px);color:#555;line-height:1.7;max-width:85%;">${raw(s.description_html||esc(s.description||D.description||''))}</p>
      <div style="display:flex;flex-wrap:wrap;gap:5px;">${tagsHtml}</div>
    </div>
    <div style="padding-top:8px;border-top:1px solid ${dark?'#1a1a1a':'#eee'};display:flex;justify-content:space-between;align-items:center;">
      <span style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8px);color:#333;">→ swipe to continue</span>
      <div style="display:flex;gap:10px;">
        <a href="https://wa.me/60111674580" style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8px);color:#333;text-decoration:none;">WA</a>
        <a href="mailto:raishelmy97@gmail.com" style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8px);color:#333;text-decoration:none;">Email</a>
        <a href="https://raishelmy.uk" style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8px);color:#333;text-decoration:none;">Web</a>
      </div>
    </div>
  </div>
</div>`;
  }

  /* ─── Render: EVR with two code blocks ─── */
  function renderEvrCode(s) {
    const expItemsHtml = (s.expect_items||[]).map(i=>`<div class="evr-item exp">${raw(i)}</div>`).join('');
    const realItemsHtml= (s.reality_items||[]).map(i=>`<div class="evr-item real">${raw(i)}</div>`).join('');
    const hasEvr = s.expect_items && s.expect_items.length;

    return `<div class="slide">
  <div class="si">
    <span class="snum">${esc(s.num)}</span>
    <div class="label">${esc(s.label)}</div>
    <div class="red-rule"></div>
    ${hasEvr ? `<div class="evr" style="margin-bottom:8px;flex:none;">
      <div class="evr-col left">
        <div class="evr-head exp">✦ Expectation — best practice</div>
        ${expItemsHtml}
      </div>
      <div class="evr-col right">
        <div class="evr-head real">✗ Reality — what most do</div>
        ${realItemsHtml}
      </div>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;flex:1;">
      <div class="code" style="border-left-color:var(--green);">
        <pre>${raw(s.code_good)}</pre>
      </div>
      <div class="code">
        <pre>${raw(s.code_bad)}</pre>
      </div>
    </div>
    ${footer(s.footer_url, s.footer_text)}
  </div>
</div>`;
  }

  /* ─── Render: EVR with single code block ─── */
  function renderEvr(s) {
    const expItemsHtml = (s.expect_items||[]).map(i=>`<div class="evr-item exp">${raw(i)}</div>`).join('');
    const realItemsHtml= (s.reality_items||[]).map(i=>`<div class="evr-item real">${raw(i)}</div>`).join('');

    return `<div class="slide">
  <div class="si">
    <span class="snum">${esc(s.num)}</span>
    <div class="label">${esc(s.label)}</div>
    <div class="red-rule"></div>
    <div class="evr" style="margin-bottom:8px;flex:none;">
      <div class="evr-col left">
        <div class="evr-head exp">✦ Expectation — best practice</div>
        ${expItemsHtml}
      </div>
      <div class="evr-col right">
        <div class="evr-head real">✗ Reality — what most do</div>
        ${realItemsHtml}
      </div>
    </div>
    <div class="code" style="flex:1;">
      <pre>${raw(s.code)}</pre>
    </div>
    ${footer(s.footer_url, s.footer_text)}
  </div>
</div>`;
  }

  /* ─── Render: NUANCE (key lesson slide) ─── */
  function renderNuance(s) {
    return `<div class="slide">
  <div class="si">
    <span class="snum">${esc(s.num)}</span>
    <div class="label">${esc(s.label)}</div>
    <div class="red-rule"></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:10px;justify-content:center;">
      <div style="background:#fff8f8;border-left:4px solid var(--red);padding:clamp(8px,1.8vw,14px);">
        <p style="font-size:clamp(13px,2.8vw,19px);font-weight:700;color:var(--ink);line-height:1.2;margin-bottom:5px;">${raw(s.quote_title)}</p>
        <p style="font-size:clamp(8px,1.3vw,10px);color:var(--ink-3);line-height:1.7;">${raw(s.quote_body)}</p>
      </div>
      ${s.left_label||s.right_label ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        <div style="background:var(--red-pale);border:1.5px solid var(--rule);padding:clamp(6px,1.3vw,10px);">
          <p style="font-family:'DM Mono',monospace;font-size:clamp(6.5px,1vw,8px);color:var(--red);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">${esc(s.left_label||'')}</p>
          <p style="font-size:clamp(7.5px,1.2vw,9px);color:var(--ink-2);line-height:1.6;">${raw(s.left_body||'')}</p>
        </div>
        <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;padding:clamp(6px,1.3vw,10px);">
          <p style="font-family:'DM Mono',monospace;font-size:clamp(6.5px,1vw,8px);color:var(--green);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">${esc(s.right_label||'')}</p>
          <p style="font-size:clamp(7.5px,1.2vw,9px);color:var(--ink-2);line-height:1.6;">${raw(s.right_body||'')}</p>
        </div>
      </div>` : ''}
      ${s.insight ? `<div style="background:#0d0d0d;border-left:3px solid var(--red);padding:clamp(7px,1.5vw,12px);">
        <p style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8.5px);color:var(--red-soft);line-height:1.7;">${raw(s.insight)}</p>
      </div>` : ''}
    </div>
    <div class="sf">
      <a href="https://${SITE}/tips/${D.id}" target="_blank" rel="noopener">${SITE}/tips/${D.id}</a>
      <span class="au">${esc(AUTHOR.name)}</span>
    </div>
  </div>
</div>`;
  }

  /* ─── Render: FRAMEWORK (info grid) ─── */
  function renderFramework(s) {
    const cells = s.cells || [];
    const cellsHtml = cells.map(c => `<div class="ig-cell">
      <div class="il">${esc(c.label)}</div>
      <div class="iv" ${c.red?'style="color:var(--red);"':''}>${raw(c.value)}</div>
      <div class="is">${raw(c.sub||'')}</div>
    </div>`).join('');
    const gridId = 'ig-' + Math.random().toString(36).slice(2);
    const svgId  = 'igs-' + Math.random().toString(36).slice(2);

    return `<div class="slide">
  <div class="si">
    <span class="snum">${esc(s.num)}</span>
    <div class="label">${esc(s.label)}</div>
    <div class="red-rule"></div>
    <div class="info-grid" style="position:relative;flex:1;" id="${gridId}" data-svgid="${svgId}">
      <svg style="position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:5;" id="${svgId}"></svg>
      ${cellsHtml}
    </div>
    <div class="sf" style="margin-top:8px;">
      <a href="https://${SITE}/tips/${D.id}" target="_blank" rel="noopener">Read full breakdown →</a>
      <span class="au">${esc(AUTHOR.name)}</span>
    </div>
  </div>
</div>`;
  }

  /* ─── Render: CTA ─── */
  function renderCta(s) {
    const expYears = Math.floor((new Date() - new Date(2020,0,1)) / (365.25*24*60*60*1000));
    return `<div class="slide" style="background:#0a0a0a;">
  <div class="si">
    <span class="snum" style="color:#2a2a2a;">${esc(s.num)}</span>
    <div class="label" style="color:var(--red-soft);">found this useful?</div>
    <div style="height:1.5px;background:#1a1a1a;margin:7px 0 10px;"></div>
    <div style="margin-bottom:10px;">
      <h2 style="font-size:clamp(16px,3.5vw,22px);font-weight:700;line-height:1.15;letter-spacing:-.025em;color:#fff;">
        Rais Helmy <span style="color:var(--red);">Sapiullah</span>
      </h2>
      <p style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8.5px);color:var(--red-soft);letter-spacing:.08em;text-transform:uppercase;margin-top:4px;">Senior .NET · FlutterFlow · Solution Architect · Cloudflare</p>
      <p style="font-size:clamp(8px,1.25vw,9.5px);color:#555;line-height:1.7;margin-top:7px;">I build enterprise .NET systems that are actually maintainable — not just architecturally impressive templates. ${expYears}+ years across insurance, defence, utility, and ERP in Malaysia.</p>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:5px;">
      <a href="https://wa.me/60111674580" class="cta-link" style="background:#052e16;border:1px solid #16a34a;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#4ade80"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <div>
          <div class="cl-label" style="color:#4ade80;">WhatsApp — tap to chat</div>
          <div class="cl-val" style="color:#888;">+60 11-1674 5806</div>
        </div>
      </a>
      <a href="mailto:raishelmy97@gmail.com" class="cta-link" style="background:#2d0000;border:1px solid var(--red);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <div>
          <div class="cl-label" style="color:#f87171;">Email me</div>
          <div class="cl-val" style="color:#888;">raishelmy97@gmail.com</div>
        </div>
      </a>
      <a href="https://raishelmy.uk" class="cta-link" style="background:#0f0f0f;border:1px solid #2a2a2a;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <div>
          <div class="cl-label" style="color:#666;">Website &amp; all tips</div>
          <div class="cl-val" style="color:#888;">raishelmy.uk/tips</div>
        </div>
      </a>
    </div>
    <div style="padding-top:8px;border-top:1px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8px);color:#2a2a2a;">rais.helmy.sapiullah · ${new Date().getFullYear()}</span>
      <button onclick="TipPlayer.share()" style="font-family:'DM Mono',monospace;font-size:clamp(7px,1.1vw,8px);background:transparent;border:1px solid #222;color:#444;padding:4px 10px;border-radius:2px;cursor:pointer;transition:all .18s;" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'" onmouseout="this.style.borderColor='#222';this.style.color='#444'">⬤ share this</button>
    </div>
  </div>
</div>`;
  }

  /* ─── Render: CUSTOM (raw HTML) ─── */
  function renderCustom(s) {
    return `<div class="slide">${raw(s.html)}</div>`;
  }

  /* ─── Dispatch renderer ─── */
  function renderSlide(s, idx) {
    s = Object.assign({ num: (idx+1)+' / '+total }, s);
    if (idx === 0) s.active = true;
    switch (s.type) {
      case 'cover':     return renderCover(s);
      case 'evr-code':  return renderEvrCode(s);
      case 'evr':       return renderEvr(s);
      case 'nuance':    return renderNuance(s);
      case 'framework': return renderFramework(s);
      case 'cta':       return renderCta(s);
      case 'custom':    return renderCustom(s);
      default:          return `<div class="slide"><div class="si"><p style="color:red;">Unknown slide type: ${esc(s.type)}</p></div></div>`;
    }
  }

  /* ─── LinkedIn Caption Panel ─── */
  function buildCaption() {
    if (D.linkedin_caption) return D.linkedin_caption;
    return D.title + '\n\n' + (D.description || '');
  }

  function buildLinkedInPanel() {
    var caption = buildCaption();
    return '<aside id="li-panel">' +
      '<div class="li-panel-toprow">' +
        '<div class="li-panel-badge">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>' +
          ' LinkedIn Caption' +
        '</div>' +
        '<button class="li-collapse-btn" id="li-collapse-btn" onclick="TipPlayer.toggleLinkedInPanel()" title="Collapse panel">' +
          '<svg id="li-collapse-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="li-panel-body" id="li-panel-body">' +
        '<div class="li-panel-header">' +
          '<div class="li-avatar">RH</div>' +
          '<div>' +
            '<div class="li-meta-name">' + esc(AUTHOR.name) + '</div>' +
            '<div class="li-meta-role">' + esc(AUTHOR.role) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="li-caption-box" id="li-caption" contenteditable="true" spellcheck="false">' + esc(caption) + '</div>' +
        '<button class="li-copy-btn" id="li-copy-btn" onclick="TipPlayer.copyCaption()">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
          ' Copy Caption' +
        '</button>' +
      '</div>' +
    '</aside>';
  }

  /* ─── Build HTML ─── */
  function buildTopbar() {
    return `<div id="topbar">
  <a href="/tips" class="tb-back">← All Tips</a>
  <span class="tb-title">${esc(D.title)}</span>
  <div class="tb-right">
    <button class="tb-btn" id="tb-theme-btn" onclick="TipPlayer.toggleTheme()" title="Toggle dark/light mode">
      <svg id="tb-theme-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    </button>
    <button class="tb-btn" onclick="TipPlayer.share()">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      Share
    </button>
    <div class="tb-dl-wrap" id="tb-dl-wrap">
      <button class="tb-btn red" id="tb-dl-btn" onclick="TipPlayer.toggleDlMenu()">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download ▾
      </button>
      <div class="tb-dl-menu" id="tb-dl-menu">
        <button onclick="TipPlayer.downloadSlide();TipPlayer.closeDlMenu()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          This slide only
        </button>
        <button onclick="TipPlayer.downloadAll();TipPlayer.closeDlMenu()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg>
          All slides
        </button>
        <button onclick="TipPlayer.downloadLinkedIn3();TipPlayer.closeDlMenu()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
          First 3 slides <span style="opacity:.5;font-size:8px">(LinkedIn)</span>
        </button>
        <div style="height:1px;background:#2a2a2a;margin:3px 0"></div>
        <button onclick="window.print();TipPlayer.closeDlMenu()">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Save as PDF
        </button>
      </div>
    </div>
  </div>
</div>
<div id="pbar"><div id="pfill" style="width:${(1/total*100).toFixed(1)}%"></div></div>`;
  }

  function buildDots() {
    return '<div id="dots">' + D.slides.map((_, i) =>
      `<button class="dot ${i===0?'on':''}" onclick="TipPlayer.goTo(${i})"></button>`
    ).join('') + '</div>';
  }

  /* ─── Inject into DOM ─── */
  const wrap    = document.getElementById('slide-wrap');
  const main    = document.getElementById('main');
  const appRoot = document.getElementById('tip-app');

  // Apply saved theme BEFORE rendering to avoid flash
  try {
    if (localStorage.getItem('rh-tips-theme') === 'dark') document.body.classList.add('dark');
  } catch(e) {}

  // Apply saved LinkedIn panel state
  try {
    if (localStorage.getItem('rh-li-panel-collapsed') === '1') {
      document.addEventListener('DOMContentLoaded', function() {
        var p = document.getElementById('li-panel');
        var icon = document.getElementById('li-collapse-icon');
        if (p) { p.classList.add('li-collapsed'); }
        if (icon) icon.innerHTML = '<polyline points="9 18 15 12 9 6"/>';
      });
    }
  } catch(e) {}

  const slidesHtml = D.slides.map((s, i) => renderSlide(s, i)).join('\n');

  if (appRoot) {
    // Thin-wrapper mode: appRoot replaces everything
    appRoot.innerHTML = buildLinkedInPanel() +
      buildTopbar() +
      '<div id="toast">🔗 Link copied!</div>' +
      '<button class="arr" id="al" onclick="TipPlayer.go(-1)">&#8592;</button>' +
      '<button class="arr" id="ar" onclick="TipPlayer.go(1)">&#8594;</button>' +
      '<div id="main"><div id="slide-wrap">' + slidesHtml + '</div></div>' +
      buildDots();
  } else if (wrap) {
    wrap.innerHTML = slidesHtml;
    if (main) { main.parentNode.insertAdjacentHTML('prepend', buildTopbar()); }
    document.body.insertAdjacentHTML('beforeend', buildDots());
  }

  /* ─── Player controls ─── */
  window.TipPlayer = {
    cur: 0,
    total: total,

    goTo: function(n) {
      const slides = document.querySelectorAll('.slide');
      const dots   = document.querySelectorAll('.dot');
      const pfill  = document.getElementById('pfill');
      const al     = document.getElementById('al');
      const ar     = document.getElementById('ar');
      slides.forEach(function(s,i){ s.classList.toggle('active', i===n); });
      dots.forEach(function(d,i){ d.classList.toggle('on', i===n); });
      if (pfill) pfill.style.width = ((n+1)/total*100)+'%';
      if (al) al.style.opacity = n===0?'0.2':'1';
      if (ar) ar.style.opacity = n===total-1?'0.2':'1';
      this.cur = n;
      // Draw stars on framework slides
      const active = slides[n];
      if (active) {
        const grid = active.querySelector('.info-grid');
        if (grid) setTimeout(function(){ TipPlayer.drawStars(grid); }, 80);
      }
    },

    go: function(dir) {
      const n = this.cur + dir;
      if (n >= 0 && n < total) this.goTo(n);
    },

    share: function() {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: D.title, url: url });
      } else {
        navigator.clipboard.writeText(url).then(function(){
          const t = document.getElementById('toast');
          if (t) { t.classList.add('on'); setTimeout(function(){ t.classList.remove('on'); }, 2200); }
        });
      }
    },

    toggleDlMenu: function() {
      var m = document.getElementById('tb-dl-menu');
      if (m) m.classList.toggle('open');
    },

    toggleTheme: function() {
      var dark = document.body.classList.toggle('dark');
      try { localStorage.setItem('rh-tips-theme', dark ? 'dark' : 'light'); } catch(e) {}
      var icon = document.getElementById('tb-theme-icon');
      if (icon) {
        icon.innerHTML = dark
          ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
          : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
      }
    },
    closeDlMenu: function() {
      var m = document.getElementById('tb-dl-menu');
      if (m) m.classList.remove('open');
    },

    _loadHtml2Canvas: function(cb) {
      if (window.html2canvas) { cb(); return; }
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = cb;
      s.onerror = function() { alert('Could not load image capture library. Check your internet connection.'); };
      document.head.appendChild(s);
    },

    _captureSlide: function(idx, slug, cb) {
      var self = this;
      self.goTo(idx);
      // Wait for fonts + paint
      setTimeout(function() {
        var el = document.querySelectorAll('.slide')[idx];
        if (!el) { cb && cb(); return; }
        html2canvas(el, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: null,
          logging: false
        }).then(function(canvas) {
          var link = document.createElement('a');
          link.download = slug + '-slide-' + (idx + 1) + '.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
          cb && cb();
        });
      }, 220);
    },

    downloadSlide: function() {
      var self = this;
      var slug = D.id || 'tip';
      var toast = document.getElementById('toast');
      self._loadHtml2Canvas(function() {
        self._captureSlide(self.cur, slug, function() {
          if (toast) {
            toast.textContent = '🖼 Image saved!';
            toast.classList.add('on');
            setTimeout(function() { toast.classList.remove('on'); toast.textContent = '🔗 Link copied!'; }, 2200);
          }
        });
      });
    },

    downloadAll: function() {
      var self = this;
      var slug = D.id || 'tip';
      var count = D.slides.length;
      var orig = self.cur;
      var toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = '⏳ Capturing ' + count + ' slides…';
        toast.classList.add('on');
      }
      self._loadHtml2Canvas(function() {
        var idx = 0;
        function next() {
          if (idx >= count) {
            self.goTo(orig);
            if (toast) {
              toast.textContent = '🖼 ' + count + ' slides downloaded!';
              setTimeout(function() { toast.classList.remove('on'); toast.textContent = '🔗 Link copied!'; }, 2800);
            }
            return;
          }
          self._captureSlide(idx, slug, function() { idx++; setTimeout(next, 300); });
        }
        next();
      });
    },

    downloadLinkedIn3: function() {
      var self = this;
      var slug = D.id || 'tip';
      var count = Math.min(3, D.slides.length);
      var orig = self.cur;
      var toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = '⏳ Capturing ' + count + ' slides…';
        toast.classList.add('on');
      }
      self._loadHtml2Canvas(function() {
        var idx = 0;
        function next() {
          if (idx >= count) {
            self.goTo(orig);
            if (toast) {
              toast.textContent = '💼 ' + count + ' slides downloaded!';
              setTimeout(function() { toast.classList.remove('on'); toast.textContent = '🔗 Link copied!'; }, 2800);
            }
            return;
          }
          self._captureSlide(idx, slug + '-linkedin', function() {
            idx++;
            setTimeout(next, 300);
          });
        }
        next();
      });
    },

    toggleLinkedInPanel: function() {
      var body = document.getElementById('li-panel-body');
      var panel = document.getElementById('li-panel');
      var icon = document.getElementById('li-collapse-icon');
      if (!body || !panel) return;
      var collapsed = panel.classList.toggle('li-collapsed');
      if (icon) {
        icon.innerHTML = collapsed
          ? '<polyline points="9 18 15 12 9 6"/>'
          : '<polyline points="15 18 9 12 15 6"/>';
      }
      try { localStorage.setItem('rh-li-panel-collapsed', collapsed ? '1' : '0'); } catch(e) {}
    },

    copyCaption: function() {
      var box = document.getElementById('li-caption');
      var btn = document.getElementById('li-copy-btn');
      if (!box) return;
      var text = (box.innerText || box.textContent || '').trim();
      var self = this;
      function flash() {
        if (!btn) return;
        btn.classList.add('copied');
        btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Caption';
        }, 2200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(flash).catch(function() { self._copyFallback(text); flash(); });
      } else {
        self._copyFallback(text); flash();
      }
    },

    _copyFallback: function(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
    },

    drawStars: function(grid) {
      const ns = 'http://www.w3.org/2000/svg';
      const svgId  = grid.getAttribute('data-svgid');
      const svg = svgId ? document.getElementById(svgId) : grid.querySelector('svg');
      if (!svg) return;
      svg.innerHTML = '';
      const gr = grid.getBoundingClientRect();
      const xs = new Set([0, grid.offsetWidth]);
      const ys = new Set([0, grid.offsetHeight]);
      grid.querySelectorAll('.ig-cell').forEach(function(c){
        const cr = c.getBoundingClientRect();
        xs.add(Math.round(cr.left-gr.left)); xs.add(Math.round(cr.right-gr.left));
        ys.add(Math.round(cr.top-gr.top));   ys.add(Math.round(cr.bottom-gr.top));
      });
      const sp = (function(){
        var o=4,n=1.6,a=8,d='';
        for(var i=0;i<a*2;i++){
          var ang=(Math.PI/a)*i-Math.PI/2, r=i%2===0?o:n;
          d+=(i===0?'M':'L')+(Math.cos(ang)*r).toFixed(2)+','+(Math.sin(ang)*r).toFixed(2);
        }
        return d+'Z';
      })();
      xs.forEach(function(x){ ys.forEach(function(y){
        var g=document.createElementNS(ns,'g');
        g.setAttribute('transform','translate('+x+','+y+')');
        var p=document.createElementNS(ns,'path');
        p.setAttribute('d',sp); p.setAttribute('fill','#dc2626'); p.setAttribute('opacity','0.38');
        g.appendChild(p);
        var c=document.createElementNS(ns,'circle');
        c.setAttribute('cx','0'); c.setAttribute('cy','0'); c.setAttribute('r','0.85'); c.setAttribute('fill','#dc2626');
        g.appendChild(c);
        svg.appendChild(g);
      });});
    }
  };

  /* ─── Keyboard + Touch ─── */
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#tb-dl-wrap')) TipPlayer.closeDlMenu();
  });

  document.addEventListener('keydown', function(e){
    if (e.key==='ArrowRight'||e.key==='ArrowDown') TipPlayer.go(1);
    if (e.key==='ArrowLeft' ||e.key==='ArrowUp')   TipPlayer.go(-1);
  });

  var tx = 0;
  document.addEventListener('touchstart', function(e){
    const sw = document.getElementById('slide-wrap');
    if (sw && sw.contains(e.target)) tx = e.touches[0].clientX;
  }, {passive:true});
  document.addEventListener('touchend', function(e){
    const sw = document.getElementById('slide-wrap');
    if (sw && sw.contains(e.target)) {
      const dx = tx - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 35) TipPlayer.go(dx > 0 ? 1 : -1);
    }
  }, {passive:true});

  /* ─── Init ─── */
  TipPlayer.goTo(0);

})();
