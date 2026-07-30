// /api/events
// GET  -> list all events (id, slug, name, status, date, response_count)
// POST -> create a new event, returns the created event

import { json, newId, slugify, nowIso } from '../../lib/util.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.slug, e.name, e.event_date, e.event_time, e.status, e.owner_email,
            (SELECT COUNT(*) FROM responses r WHERE r.event_id = e.id) AS response_count
     FROM events e ORDER BY e.updated_at DESC`
  ).all();
  return json({ events: results });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || 'Untitled Event').trim();
  const id = newId('ev');

  // Ensure slug uniqueness by appending a short suffix if needed
  let slug = slugify(name);
  const existing = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(slug).first();
  if (existing) slug = slug + '-' + Math.random().toString(36).slice(2, 6);

  const now = nowIso();
  const defaultTheme = JSON.stringify({ presetId: 'forest', custom: null });
  const defaultQuestions = JSON.stringify([
    { id: 'q_name', type: 'short_answer', title: 'Full Name', required: true, help: '', options: [], condition: null },
    { id: 'q_attend', type: 'yes_no_maybe', title: 'Will you attend?', required: true, help: '', options: [], condition: null },
  ]);

  await env.DB.prepare(
    `INSERT INTO events (id, slug, name, event_date, event_time, venue_name, venue_address, theme_json, questions_json, status, owner_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
  )
    .bind(
      id, slug, name,
      body.event_date || '', body.event_time || '',
      body.venue_name || '', body.venue_address || '',
      defaultTheme, defaultQuestions,
      body.owner_email || '', now, now
    )
    .run();

  const created = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  return json({ event: created }, 201);
}
