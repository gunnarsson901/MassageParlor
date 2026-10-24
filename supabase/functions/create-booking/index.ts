import { corsHeaders, handleOptions, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/emailjs.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { escapeHtml } from '../_shared/html.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ error: 'method-not-allowed' }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }

  const { name, email, category, duration, date, time, message } = body as Record<string, string>;
  if (!name || !email || !category || !duration || !date || !time) {
    return json({ error: 'missing-fields' }, 400);
  }

  const ALLOWED_CATEGORIES = ['Idrottsmassage', 'Klassisk Massage', 'Fasciabehandling'];
  const ALLOWED_DURATIONS = ['40 min', '60 min', '90 min'];
  if (!ALLOWED_CATEGORIES.includes(category) || !ALLOWED_DURATIONS.includes(duration)) {
    return json({ error: 'invalid-fields' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return json({ error: 'invalid-fields' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'invalid-fields' }, 400);
  }
  if (name.length > 200 || email.length > 200 || (message && message.length > 2000)) {
    return json({ error: 'invalid-fields' }, 400);
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('bookings')
    .insert({ name, email, category, duration, date, time, message: message || null })
    .select('id, token')
    .single();

  if (error || !data) {
    console.error('insert booking failed', error);
    return json({ error: 'insert-failed' }, 500);
  }

  // Bokningsförfrågan mailas till båda adresserna. Kräver att EmailJS-mallen
  // EMAILJS_TEMPLATE_ID_REQUEST har "To Email" satt till {{admin_email}}.
  const adminEmail = Deno.env.get('BOOKING_EMAIL') ??
    'gunnarsson901@gmail.com, info@grundligmassage.se';

  const siteOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '';
  const linkParams = new URLSearchParams({ id: data.id, token: data.token }).toString();
  const acceptLink = `${siteOrigin}/accept.html?${linkParams}`;
  const declineLink = `${siteOrigin}/decline.html?${linkParams}`;

  try {
    await Promise.all([
      sendEmail(Deno.env.get('EMAILJS_TEMPLATE_ID_REQUEST')!, {
        admin_email: adminEmail,
        from_name: name,
        from_email: email,
        category,
        duration,
        date,
        time,
        message: message || '',
        accept_link: acceptLink,
        decline_link: declineLink,
      }),
      sendEmail(Deno.env.get('EMAILJS_TEMPLATE_ID_CUSTOMER')!, {
        to_name: name,
        to_email: email,
        subject: 'Tack för din bokningsförfrågan - Grundlig Massage',
        accent_color: '#5f7266',
        heading: 'Tack för din bokningsförfrågan!',
        body_html: `
          <p>Vi har tagit emot din bokningsförfrågan:</p>
          <table cellpadding="6">
            <tr><td><strong>Behandling:</strong></td><td>${escapeHtml(category)}</td></tr>
            <tr><td><strong>Längd:</strong></td><td>${escapeHtml(duration)}</td></tr>
            <tr><td><strong>Önskat datum:</strong></td><td>${escapeHtml(date)} kl. ${escapeHtml(time)}</td></tr>
          </table>
          <p>Jag återkommer så snart som möjligt med en bekräftelse.</p>
        `,
      }),
    ]);
  } catch (err) {
    console.error('email send failed', err);
    return json({ error: 'email-failed' }, 502);
  }

  return json({ ok: true });
});
