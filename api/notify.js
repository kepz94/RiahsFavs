// Emails the kitchen when a new catering request comes in.
// Lives at /api/notify — Vercel picks it up automatically.
//
// Required environment variables (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY  — from resend.com
//   NOTIFY_TO       — where the alert email goes (e.g. riahsfavs@gmail.com)
//   NOTIFY_FROM     — optional; defaults to Resend's shared onboarding sender

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  try {
    const b = req.body || {};
    const s = (v, n) => String(v == null ? '' : v).slice(0, n);
    const list = (v, n) => (Array.isArray(v) ? v : []).map(x => s(x && x.label ? x.label : x, 40)).slice(0, n).join(', ');

    const name    = s(b.name, 80) || 'Someone';
    const phone   = s(b.phone, 20);
    const guests  = s(b.guests, 8);
    const day     = s(b.dayLabel, 40);
    const when    = s(b.window, 40);
    const styles  = list(b.styles, 5) || '—';
    const pkg     = s(b.packageLabel, 60);
    const service = s(b.serviceLabel, 40);
    const sides   = list(b.sides, 12);
    const addons  = list(b.addons, 12);
    const occ     = s(b.occasion, 40);
    const venue   = s(b.venue, 120);
    const addr    = s(b.address, 160);
    const notes   = s(b.notes, 600);
    const est     = b.estimate ? '$' + Number(b.estimate).toFixed(2) : 'none — quote by head count';
    const rush    = b.shortNotice ? '⏱ RUSH — ' : '';

    const text =
`${rush}New catering request!

Who:      ${name} · ${phone}
When:     ${day} · ${when}
Guests:   ${guests}${occ ? ' · ' + occ : ''}
Chicken:  ${styles}
${pkg ? 'Package:  ' + pkg + '\n' : ''}Service:  ${service}
${sides  ? 'Sides:    ' + sides + '\n'  : ''}${addons ? 'Add-ons:  ' + addons + '\n' : ''}Where:    ${venue ? venue + ' · ' : ''}${addr}
Estimate: ${est}
${notes ? '\nNotes: "' + notes + '"\n' : ''}
Open your admin to quote it:
https://${req.headers.host}/admin.html`;

    const to = process.env.NOTIFY_TO;
    if (!to || !process.env.RESEND_API_KEY) {
      // Not configured yet — never surface this to the customer.
      return res.status(200).json({ ok: false, reason: 'notify not configured' });
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || "Riah's Fav's <onboarding@resend.dev>",
        to: [to],
        subject: `🍗 ${rush}New request — ${name} · ${day} · ${guests} guests`,
        text
      })
    });

    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    // A broken notification must never break the customer's submission.
    return res.status(200).json({ ok: false });
  }
}
