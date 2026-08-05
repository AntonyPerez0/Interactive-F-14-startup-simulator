/* ============================================================
   Visitor counts, as a Cloudflare Pages Function.

   One row per browser: a random id it generates for itself, and the time it was
   last seen. From that one table:

     online  seen in the last few minutes
     month   seen in the last 30 days
     total   ever seen

   No addresses, no cookies, nothing that identifies anybody. The id means
   nothing outside this table.

   The counts are only worked out when asked for, because the heartbeat runs
   every 45 seconds and the hangar screen opens once. Setup is in DEPLOY.md.
   ============================================================ */

const ONLINE_MS = 150_000;              // "here now"
const MONTH_MS  = 30 * 864e5;           // "this month"
const KEEP_MS   = 400 * 864e5;          // drop rows older than about a year
const SWEEP_ODDS = 0.01;

export async function onRequestPost({ request, env }) {
  if (!env.PRESENCE) return json({ online: 0 });

  let id, wantStats = false;
  try {
    const body = await request.json();
    id = body.id;
    wantStats = !!body.stats;
  } catch (e) { /* ignore */ }
  if (typeof id !== 'string' || !id) return json({ online: 0 });
  id = id.slice(0, 64);

  const now = Date.now();

  try {
    await env.PRESENCE.prepare(
      'INSERT INTO presence (id, seen) VALUES (?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET seen = excluded.seen'
    ).bind(id, now).run();

    const online = (await env.PRESENCE.prepare(
      'SELECT COUNT(*) AS n FROM presence WHERE seen > ?'
    ).bind(now - ONLINE_MS).first())?.n ?? 1;

    if (!wantStats) return json({ online });

    // only on the hangar screen, so the per-beat cost stays at one count
    const month = (await env.PRESENCE.prepare(
      'SELECT COUNT(*) AS n FROM presence WHERE seen > ?'
    ).bind(now - MONTH_MS).first())?.n ?? 0;

    const total = (await env.PRESENCE.prepare(
      'SELECT COUNT(*) AS n FROM presence'
    ).first())?.n ?? 0;

    if (Math.random() < SWEEP_ODDS) {
      await env.PRESENCE.prepare('DELETE FROM presence WHERE seen < ?')
        .bind(now - KEEP_MS).run();
    }

    return json({ online, month, total });
  } catch (e) {
    return json({ online: 0 });
  }
}

export const onRequestOptions = () =>
  new Response(null, { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }});

const json = body => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
             'Access-Control-Allow-Origin': '*' },
});
