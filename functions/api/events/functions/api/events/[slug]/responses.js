import { json, newId, nowIso } from '../../../lib/util.js';
import { appendRowToSheet } from '../../../lib/sheets.js';

export async function onRequestGet({ params, env }) {
  const event = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(params.slug).first();
  if (!event) return json({ error: 'not found' }, 404);
  const { results } = await env.DB.prepare(
    'SELECT id, answers_json, submitted_at FROM responses WHERE event_id = ? ORDER BY submitted_at DESC'
  ).bind(event.id).all();
  const responses = results.map((r) => ({ id: r.id, answers: JSON.parse(r.answers_json), submitted_at: r.submitted_at }));
  return json({ responses });
}

export async function onRequestPost({ params, request, env }) {
  const event = await env.DB.prepare('SELECT * FROM events WHERE slug = ?').bind(params.slug).first();
  if (!event) return json({ error: 'not found' }, 404);

  const body = await request.json().catch(() => ({}));
  const answers = body.answers || {};
  const id = newId('r');
  const submittedAt = nowIso();

  await env.DB.prepare('INSERT INTO responses (id, event_id, answers_json, submitted_at) VALUES (?, ?, ?, ?)')
    .bind(id, event.id, JSON.stringify(answers), submittedAt)
    .run();

  if (event.google_sheet_id && env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const questions = JSON.parse(event.questions_json || '[]');
      const row = questions
        .filter((q) => !['section_divider', 'title_block'].includes(q.type))
        .map((q) => {
          const v = answers[q.id];
          return Array.isArray(v) ? v.join(', ') : v || '';
        });
      await appendRowToSheet(env, event.google_sheet_id, [submittedAt, ...row]);
    } catch (err) {
      console.error('Google Sheets sync failed:', err.message);
    }
  }

  return json({ ok: true, id }, 201);
}
