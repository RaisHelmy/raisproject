const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, PATCH, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ADMIN_PASSWORD = 'P@ssw0rd123';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && (url.pathname === '/api/visit' || url.pathname === '/api/track')) {
      return handleVisit(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/order') {
      return handleOrder(request, env);
    }

    const orderUpdateMatch = url.pathname.match(/^\/api\/order\/(\d+)$/);
    if (request.method === 'PATCH' && orderUpdateMatch) {
      return handleOrderUpdate(request, env, parseInt(orderUpdateMatch[1]));
    }

    if (url.pathname === '/admin') {
      return Response.redirect(new URL('/admin/', request.url).toString(), 302);
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/analytics') {
      return handleAnalytics(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/visitors') {
      return handleGetVisitors(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/leads') {
      return handleAdminLeads(request, env);
    }

    const followupMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/followup$/);
    if (request.method === 'POST' && followupMatch) {
      return handleFollowup(request, env, parseInt(followupMatch[1]));
    }

    const singleLeadMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)$/);
    if (singleLeadMatch) {
      const lid = parseInt(singleLeadMatch[1]);
      if (request.method === 'GET')    return handleGetLead(request, env, lid);
      if (request.method === 'DELETE') return handleDeleteLead(request, env, lid);
    }

    const leadInfoMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/info$/);
    if (request.method === 'PATCH' && leadInfoMatch) {
      return handleUpdateLeadInfo(request, env, parseInt(leadInfoMatch[1]));
    }

    const leadStatusMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/status$/);
    if (request.method === 'PATCH' && leadStatusMatch) {
      return handleLeadStatus(request, env, parseInt(leadStatusMatch[1]));
    }

    const apptsMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/appointments$/);
    if (apptsMatch) {
      const lid = parseInt(apptsMatch[1]);
      if (request.method === 'GET')  return handleGetAppointments(request, env, lid);
      if (request.method === 'POST') return handleCreateAppointment(request, env, lid);
    }

    const apptItemMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/appointments\/(\d+)$/);
    if (apptItemMatch) {
      const lid = parseInt(apptItemMatch[1]), aid = parseInt(apptItemMatch[2]);
      if (request.method === 'PATCH')  return handleUpdateAppointment(request, env, lid, aid);
      if (request.method === 'DELETE') return handleDeleteAppointment(request, env, lid, aid);
    }

    const notesMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/notes$/);
    if (notesMatch) {
      if (request.method === 'GET')  return handleGetNotes(request, env, parseInt(notesMatch[1]));
      if (request.method === 'POST') return handleAddNote(request, env, parseInt(notesMatch[1]));
    }

    const noteItemMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/notes\/(\d+)$/);
    if (request.method === 'DELETE' && noteItemMatch) {
      return handleDeleteNote(request, env, parseInt(noteItemMatch[1]), parseInt(noteItemMatch[2]));
    }

    const followupsMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/followups$/);
    if (followupsMatch) {
      if (request.method === 'GET')  return handleGetFollowups(request, env, parseInt(followupsMatch[1]));
      if (request.method === 'POST') return handleAddFollowup(request, env, parseInt(followupsMatch[1]));
    }

    const followupItemMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)\/followups\/(\d+)$/);
    if (followupItemMatch) {
      if (request.method === 'PATCH')  return handleUpdateFollowup(request, env, parseInt(followupItemMatch[1]), parseInt(followupItemMatch[2]));
      if (request.method === 'DELETE') return handleDeleteFollowup(request, env, parseInt(followupItemMatch[1]), parseInt(followupItemMatch[2]));
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name, email, whatsapp, products, total, ic, address, domain, referrer, browser, device, visitor_id } = body;

  if (!name || !whatsapp) {
    return json({ error: 'name and whatsapp are required' }, 400);
  }

  try {
    await ensureSchema(env);
    const result = await env.DB.prepare(
      `INSERT INTO orders (name, email, whatsapp, products, total_estimate, ic, address, domain, referrer, browser, device, visitor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(name, email || '', whatsapp, JSON.stringify(products || []), total || '',
            ic || '', address || '', domain || '', referrer || '', browser || '', device || '',
            visitor_id || '')
      .run();

    const leadId = result.meta.last_row_id;

    if (visitor_id) {
      try {
        await env.DB.prepare(
          `UPDATE visitors SET converted = 1, lead_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(leadId, visitor_id).run();
      } catch {}
    }

    return json({ success: true, id: leadId });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleOrderUpdate(request, env, id) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const allowed = ['name', 'email', 'whatsapp', 'ic', 'address', 'products', 'total'];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(key === 'total' ? 'total_estimate = ?' : key + ' = ?');
      values.push(key === 'products' ? JSON.stringify(body[key]) : (body[key] || ''));
    }
  }

  if (fields.length === 0) return json({ success: true });

  values.push(id);

  try {
    await ensureSchema(env);
    await env.DB.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

function checkAuth(request) {
  const auth = request.headers.get('Authorization');
  return auth === 'Bearer ' + ADMIN_PASSWORD;
}

async function ensureSchema(env) {
  const stmts = [
    'ALTER TABLE orders ADD COLUMN followup INTEGER DEFAULT 0',
    "ALTER TABLE orders ADD COLUMN domain   TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN referrer TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN browser  TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN device   TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN ic       TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN address  TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN status   TEXT DEFAULT 'new'",
    `CREATE TABLE IF NOT EXISTS lead_notes (
      id         INTEGER  PRIMARY KEY AUTOINCREMENT,
      lead_id    INTEGER  NOT NULL,
      note       TEXT     NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS lead_followups (
      id           INTEGER  PRIMARY KEY AUTOINCREMENT,
      lead_id      INTEGER  NOT NULL,
      type         TEXT     DEFAULT 'manual',
      status       TEXT     DEFAULT 'done',
      note         TEXT     DEFAULT '',
      scheduled_at DATETIME,
      completed_at DATETIME,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS lead_appointments (
      id             INTEGER  PRIMARY KEY AUTOINCREMENT,
      lead_id        INTEGER  NOT NULL,
      title          TEXT     DEFAULT '',
      appointment_at DATETIME NOT NULL,
      status         TEXT     DEFAULT 'scheduled',
      notes          TEXT     DEFAULT '',
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS lead_appointment_logs (
      id             INTEGER  PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER  NOT NULL,
      lead_id        INTEGER  NOT NULL,
      action         TEXT     NOT NULL,
      old_date       DATETIME,
      new_date       DATETIME,
      old_status     TEXT     DEFAULT '',
      note           TEXT     DEFAULT '',
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS page_views (
      id         INTEGER  PRIMARY KEY AUTOINCREMENT,
      page       TEXT     NOT NULL DEFAULT '/',
      referrer   TEXT     DEFAULT '',
      browser    TEXT     DEFAULT '',
      device     TEXT     DEFAULT '',
      session_id TEXT     DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS visitors (
      id         TEXT     PRIMARY KEY,
      first_page TEXT     DEFAULT '',
      last_page  TEXT     DEFAULT '',
      referrer   TEXT     DEFAULT '',
      browser    TEXT     DEFAULT '',
      device     TEXT     DEFAULT '',
      page_count INTEGER  DEFAULT 1,
      converted  INTEGER  DEFAULT 0,
      lead_id    INTEGER  DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    "ALTER TABLE page_views ADD COLUMN session_id TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN page       TEXT DEFAULT ''",
    "ALTER TABLE orders ADD COLUMN visitor_id TEXT DEFAULT ''",
  ];
  for (const sql of stmts) {
    try { await env.DB.prepare(sql).run(); } catch {}
  }
}

async function handleAdminLeads(request, env) {
  if (!checkAuth(request)) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare(
      'SELECT * FROM orders ORDER BY created_at DESC'
    ).all();
    return json(results);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleFollowup(request, env, id) {
  if (!checkAuth(request)) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }
  try {
    await ensureSchema(env);
    const lead = await env.DB.prepare('SELECT followup FROM orders WHERE id = ?').bind(id).first();
    if (!lead) return json({ error: 'Not found' }, 404);
    const newFollowup = lead.followup ? 0 : 1;
    await env.DB.prepare('UPDATE orders SET followup = ? WHERE id = ?').bind(newFollowup, id).run();
    return json({ success: true, followup: newFollowup });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleGetLead(request, env, id) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    const lead = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
    if (!lead) return json({ error: 'Not found' }, 404);
    return json(lead);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleLeadStatus(request, env, id) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const valid = ['new', 'hot', 'warm', 'cold', 'won', 'lost'];
  if (!valid.includes(body.status)) return json({ error: 'Invalid status' }, 400);
  try {
    await ensureSchema(env);
    await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(body.status, id).run();
    return json({ success: true, status: body.status });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleGetNotes(request, env, leadId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare(
      'SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC'
    ).bind(leadId).all();
    return json(results);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleAddNote(request, env, leadId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.note || !String(body.note).trim()) return json({ error: 'Note is required' }, 400);
  try {
    await ensureSchema(env);
    const result = await env.DB.prepare(
      'INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)'
    ).bind(leadId, String(body.note).trim()).run();
    return json({ success: true, id: result.meta.last_row_id });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleDeleteNote(request, env, leadId, noteId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    await env.DB.prepare('DELETE FROM lead_notes WHERE id = ? AND lead_id = ?').bind(noteId, leadId).run();
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleGetFollowups(request, env, leadId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare(
      'SELECT * FROM lead_followups WHERE lead_id = ? ORDER BY created_at DESC'
    ).bind(leadId).all();
    return json(results);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleAddFollowup(request, env, leadId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { type = 'manual', status = 'done', note = '', scheduled_at } = body;
  try {
    await ensureSchema(env);
    const result = await env.DB.prepare(
      'INSERT INTO lead_followups (lead_id, type, status, note, scheduled_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(leadId, type, status, note, scheduled_at || null).run();
    return json({ success: true, id: result.meta.last_row_id });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleUpdateFollowup(request, env, leadId, followupId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const fields = [], values = [];
  if (body.status       !== undefined) { fields.push('status = ?');       values.push(body.status); }
  if (body.note         !== undefined) { fields.push('note = ?');         values.push(body.note); }
  if (body.scheduled_at !== undefined) { fields.push('scheduled_at = ?'); values.push(body.scheduled_at); }
  if (body.completed_at !== undefined) { fields.push('completed_at = ?'); values.push(body.completed_at); }
  if (body.type         !== undefined) { fields.push('type = ?');         values.push(body.type); }
  if (fields.length === 0) return json({ success: true });
  values.push(followupId, leadId);
  try {
    await ensureSchema(env);
    await env.DB.prepare(`UPDATE lead_followups SET ${fields.join(', ')} WHERE id = ? AND lead_id = ?`)
      .bind(...values).run();
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleDeleteFollowup(request, env, leadId, followupId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    await env.DB.prepare('DELETE FROM lead_followups WHERE id = ? AND lead_id = ?').bind(followupId, leadId).run();
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleDeleteLead(request, env, id) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    await env.DB.prepare('DELETE FROM lead_appointment_logs WHERE lead_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM lead_appointments WHERE lead_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM lead_followups WHERE lead_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM lead_notes WHERE lead_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleUpdateLeadInfo(request, env, id) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const allowed = ['name', 'email', 'whatsapp', 'ic', 'address', 'total_estimate', 'status'];
  const fields = [], values = [];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(key + ' = ?'); values.push(body[key] ?? ''); }
  }
  if (body.products !== undefined) { fields.push('products = ?'); values.push(JSON.stringify(body.products)); }
  if (fields.length === 0) return json({ success: true });
  values.push(id);
  try {
    await ensureSchema(env);
    await env.DB.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleGetAppointments(request, env, leadId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    const { results: appts } = await env.DB.prepare(
      'SELECT * FROM lead_appointments WHERE lead_id = ? ORDER BY appointment_at ASC'
    ).bind(leadId).all();
    for (const appt of appts) {
      const { results: logs } = await env.DB.prepare(
        'SELECT * FROM lead_appointment_logs WHERE appointment_id = ? ORDER BY created_at ASC'
      ).bind(appt.id).all();
      appt.logs = logs;
    }
    return json(appts);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleCreateAppointment(request, env, leadId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.appointment_at) return json({ error: 'appointment_at is required' }, 400);
  const { title = '', appointment_at, notes = '' } = body;
  try {
    await ensureSchema(env);
    const result = await env.DB.prepare(
      'INSERT INTO lead_appointments (lead_id, title, appointment_at, status, notes) VALUES (?, ?, ?, ?, ?)'
    ).bind(leadId, title, appointment_at, 'scheduled', notes).run();
    const apptId = result.meta.last_row_id;
    await env.DB.prepare(
      'INSERT INTO lead_appointment_logs (appointment_id, lead_id, action, new_date, note) VALUES (?, ?, ?, ?, ?)'
    ).bind(apptId, leadId, 'created', appointment_at, 'Appointment created').run();
    return json({ success: true, id: apptId });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleUpdateAppointment(request, env, leadId, apptId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  try {
    await ensureSchema(env);
    const old = await env.DB.prepare(
      'SELECT * FROM lead_appointments WHERE id = ? AND lead_id = ?'
    ).bind(apptId, leadId).first();
    if (!old) return json({ error: 'Not found' }, 404);

    const fields = [], values = [];
    if (body.title          !== undefined) { fields.push('title = ?');          values.push(body.title); }
    if (body.appointment_at !== undefined) { fields.push('appointment_at = ?'); values.push(body.appointment_at); }
    if (body.status         !== undefined) { fields.push('status = ?');         values.push(body.status); }
    if (body.notes          !== undefined) { fields.push('notes = ?');          values.push(body.notes); }
    if (fields.length > 0) {
      values.push(apptId, leadId);
      await env.DB.prepare(`UPDATE lead_appointments SET ${fields.join(', ')} WHERE id = ? AND lead_id = ?`)
        .bind(...values).run();
    }

    let action = 'updated';
    if (body.status === 'cancelled')  action = 'cancelled';
    else if (body.status === 'completed') action = 'completed';
    else if (body.status === 'postponed') action = 'postponed';
    else if (body.appointment_at && body.appointment_at !== old.appointment_at) action = 'rescheduled';

    await env.DB.prepare(
      'INSERT INTO lead_appointment_logs (appointment_id, lead_id, action, old_date, new_date, old_status, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(apptId, leadId, action, old.appointment_at, body.appointment_at || old.appointment_at, old.status, body.log_note || '').run();

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleDeleteAppointment(request, env, leadId, apptId) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    await env.DB.prepare('DELETE FROM lead_appointment_logs WHERE appointment_id = ? AND lead_id = ?').bind(apptId, leadId).run();
    await env.DB.prepare('DELETE FROM lead_appointments WHERE id = ? AND lead_id = ?').bind(apptId, leadId).run();
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleVisit(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: true }); }
  const { session_id, page = '/', referrer = '', browser = '', device = '' } = body;
  const sid = String(session_id || '').slice(0, 64);

  try {
    await ensureSchema(env);

    if (sid) {
      await env.DB.prepare(`
        INSERT INTO visitors (id, first_page, last_page, referrer, browser, device, page_count)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          last_page  = excluded.last_page,
          page_count = page_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `).bind(sid,
              String(page).slice(0, 200),
              String(page).slice(0, 200),
              String(referrer).slice(0, 500),
              String(browser).slice(0, 100),
              String(device).slice(0, 100))
        .run();
    }

    await env.DB.prepare('INSERT INTO page_views (page, referrer, browser, device, session_id) VALUES (?, ?, ?, ?, ?)')
      .bind(String(page).slice(0, 200), String(referrer).slice(0, 500), String(browser).slice(0, 100), String(device).slice(0, 100), sid)
      .run();

  } catch {}
  return json({ ok: true });
}

async function handleGetVisitors(request, env) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare(`
      SELECT v.*,
             o.name       AS lead_name,
             o.whatsapp   AS lead_wa
      FROM   visitors v
      LEFT JOIN orders o ON v.lead_id = o.id
      ORDER BY v.created_at DESC
      LIMIT 2000
    `).all();
    return json(results);
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

async function handleAnalytics(request, env) {
  if (!checkAuth(request)) return new Response('Unauthorized', { status: 401, headers: CORS });
  try {
    await ensureSchema(env);

    const [leadsPerDay, statusBreakdown, pageViews, referrers, totalsRow, viewsTotalRow, sessionStatsRow] = await Promise.all([
      env.DB.prepare(`
        SELECT date(created_at) as date, count(*) as count
        FROM orders
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY date(created_at)
        ORDER BY date ASC
      `).all(),
      env.DB.prepare(`
        SELECT COALESCE(NULLIF(status,''),'new') as status, count(*) as count
        FROM orders GROUP BY status
      `).all(),
      env.DB.prepare(`
        SELECT page, count(*) as views
        FROM page_views
        GROUP BY page ORDER BY views DESC LIMIT 30
      `).all(),
      env.DB.prepare(`
        SELECT referrer, count(*) as count
        FROM orders
        GROUP BY referrer ORDER BY count DESC LIMIT 20
      `).all(),
      env.DB.prepare(`
        SELECT count(*) as total_leads,
               count(CASE WHEN followup=1 THEN 1 END) as followed_up
        FROM orders
      `).first(),
      env.DB.prepare('SELECT count(*) as total FROM page_views').first(),
      env.DB.prepare(`
        SELECT count(*) as total_sessions,
               count(CASE WHEN converted=1 THEN 1 END) as converted_sessions
        FROM visitors
      `).first(),
    ]);

    const viewsByPage = {};
    for (const pv of pageViews.results) viewsByPage[pv.page] = pv.views;

    const leadsByPage = {};
    for (const ref of referrers.results) {
      let page = ref.referrer || 'direct';
      if (page !== 'direct') {
        try { page = new URL(page).pathname; } catch {}
      } else {
        page = '/';
      }
      leadsByPage[page] = (leadsByPage[page] || 0) + ref.count;
    }

    const allPages = new Set([...Object.keys(viewsByPage), ...Object.keys(leadsByPage)]);
    const conversionTable = Array.from(allPages).map(function(page) {
      const views = viewsByPage[page] || 0;
      const leads = leadsByPage[page] || 0;
      return { page, views, leads, rate: views > 0 ? Math.round((leads / views) * 1000) / 10 : 0 };
    }).sort(function(a, b) { return b.views - a.views; });

    return json({
      leadsPerDay:     leadsPerDay.results,
      statusBreakdown: statusBreakdown.results,
      pageViews:       pageViews.results,
      referrers:       referrers.results,
      conversionTable,
      summary: {
        totalLeads:        totalsRow?.total_leads           || 0,
        followedUp:        totalsRow?.followed_up           || 0,
        totalViews:        viewsTotalRow?.total             || 0,
        totalSessions:     sessionStatsRow?.total_sessions  || 0,
        convertedSessions: sessionStatsRow?.converted_sessions || 0,
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Database error' }, 500);
  }
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

