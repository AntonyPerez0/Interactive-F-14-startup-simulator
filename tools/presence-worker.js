/* ============================================================
   A tiny "who is online" endpoint, for Cloudflare Workers.

   GitHub Pages cannot run code, so if you want a live visitor count you need
   something small running elsewhere. This is that something. It is free to
   deploy and holds nothing but a list of random ids and timestamps — no
   addresses, no cookies, no analytics.

   Deploy:
     1. npm create cloudflare@latest -- presence
     2. replace src/index.js with this file
     3. add a Durable Object binding named PRESENCE to wrangler.toml:

          [[durable_objects.bindings]]
          name = "PRESENCE"
          class_name = "Presence"

          [[migrations]]
          tag = "v1"
          new_sqlite_classes = ["Presence"]

     4. npx wrangler deploy
     5. paste the resulting URL into src/core/config.js

   Check Cloudflare's current free-tier terms before relying on it.
   Any endpoint that accepts POST {id} and answers {online: n} will do just as
   well if you would rather use something else.
   ============================================================ */

const WINDOW_MS = 60_000;        // treat a visitor as present for this long

export class Presence {
  constructor(state) {
    this.state = state;
    this.seen = new Map();
  }

  async fetch(request) {
    const now = Date.now();
    if (request.method === 'POST') {
      const { id } = await request.json().catch(() => ({}));
      if (id) this.seen.set(String(id).slice(0, 64), now);
    }
    for (const [k, t] of this.seen) if (now - t > WINDOW_MS) this.seen.delete(k);
    return Response.json({ online: this.seen.size });
  }
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const id = env.PRESENCE.idFromName('global');
    const res = await env.PRESENCE.get(id).fetch(request);
    const body = await res.text();
    return new Response(body, { headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
