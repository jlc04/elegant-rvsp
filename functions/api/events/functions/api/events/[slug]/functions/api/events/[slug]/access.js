import { json, newId, nowIso } from '../../../lib/util.js';

export async function onRequestGet({ params, env }) {
  const event = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(params.slug).first();
  if (!event) return json({ error: 'not found' }, 404);
  const { results } = await env.DB.prepare('SELECT email FROM dashboard_access WHERE event_id = ? ORDER BY added_at')
    .bind(event.id).all();
  return json({ emails: results.map((r) => r.email) });
}

export async function onRequestPost({ params, request, env }) {
  const event = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(params.slug).first();
  if (!event) return json({ error: 'not found' }, 404);
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return json({ error: 'valid email required' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM dashboard_access WHERE event_id = ? AND email = ?')
    .bind(event.id, email).first();
  if (!existing) {
    await env.DB.prepare('INSERT INTO dashboard_access (id, event_id, email, added_at) VALUES (?, ?, ?, ?)')
      .bind(newId('acc'), event.id, email, nowIso()).run();
  }
  return json({ ok: true });
}

export async function onRequestDelete({ params, request, env }) {
  const event = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(params.slug).first();
  if (!event) return json({ error: 'not found' }, 404);
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  await env.DB.prepare('DELETE FROM dashboard_access WHERE event_id = ? AND email = ?').bind(event.id, email).run();
  return json({ ok: true });
}
