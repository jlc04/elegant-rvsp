import { json, nowIso } from '../../lib/util.js';

export async function onRequestGet({ params, env }) {
  const event = await env.DB.prepare('SELECT * FROM events WHERE slug = ?').bind(params.slug).first();
  if (!event) return json({ error: 'not found' }, 404);
  return json({ event });
}

export async function onRequestPut({ params, request, env }) {
  const event = await env.DB.prepare('SELECT * FROM events WHERE slug = ?').bind(params.slug).first();
  if (!event) return json({ error: 'not found' }, 404);
  const body = await request.json().catch(() => ({}));

  const next = {
    name: body.name ?? event.name,
    event_date: body.event_date ?? event.event_date,
    event_time: body.event_time ?? event.event_time,
    venue_name: body.venue_name ?? event.venue_name,
    venue_address: body.venue_address ?? event.venue_address,
    theme_json: body.theme_json ?? event.theme_json,
    questions_json: body.questions_json ?? event.questions_json,
    status: body.status ?? event.status,
    google_sheet_id: body.google_sheet_id ?? event.google_sheet_id,
  };

  await env.DB.prepare(
    `UPDATE events SET name=?, event_date=?, event_time=?, venue_name=?, venue_address=?,
       theme_json=?, questions_json=?, status=?, google_sheet_id=?, updated_at=?
     WHERE slug = ?`
  )
    .bind(
      next.name, next.event_date, next.event_time, next.venue_name, next.venue_address,
      next.theme_json, next.questions_json, next.status, next.google_sheet_id, nowIso(),
      params.slug
    )
    .run();

  const updated = await env.DB.prepare('SELECT * FROM events WHERE slug = ?').bind(params.slug).first();
  return json({ event: updated });
}

export async function onRequestDelete({ params, env }) {
  const event = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(params.slug).first();
  if (!event) return json({ error: 'not found' }, 404);
  await env.DB.prepare('DELETE FROM responses WHERE event_id = ?').bind(event.id).run();
  await env.DB.prepare('DELETE FROM dashboard_access WHERE event_id = ?').bind(event.id).run();
  await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(event.id).run();
  return json({ ok: true });
}
