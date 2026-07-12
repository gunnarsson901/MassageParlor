import { handleOptions, json } from '../_shared/cors.ts';
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

  const { id, token } = body as Record<string, string>;
  if (!id || !token) {
    return json({ error: 'missing-params' }, 400);
  }

  const supabase = supabaseAdmin();
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, token, status, name, email, category, duration, date, time')
    .eq('id', id)
    .maybeSingle();

  if (fetchError || !booking || booking.token !== token) {
    return json({ error: 'invalid' }, 404);
  }
  if (booking.status !== 'pending') {
    return json({ error: 'already-responded', status: booking.status }, 409);
  }

  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', responded_at: new Date().toISOString() })
    .eq('id', id)
    .eq('token', token)
    .eq('status', 'pending')
    .select('name, email, category, duration, date, time')
    .maybeSingle();

  if (updateError || !updated) {
    return json({ error: 'already-responded' }, 409);
  }

  const time = updated.time?.slice(0, 5);

  try {
    await sendEmail(Deno.env.get('EMAILJS_TEMPLATE_ID_CUSTOMER')!, {
      to_name: updated.name,
      to_email: updated.email,
      subject: 'Din bokning är bekräftad - Grundlig Massage',
      accent_color: '#5f7266',
      heading: 'Din bokning är bekräftad!',
      body_html: `
        <p>Kul att du valt Grundlig Massage. Din bokning är bekräftad:</p>
        <table cellpadding="6">
          <tr><td><strong>Behandling:</strong></td><td>${escapeHtml(updated.category)}</td></tr>
          <tr><td><strong>Längd:</strong></td><td>${escapeHtml(updated.duration)}</td></tr>
          <tr><td><strong>Datum:</strong></td><td>${escapeHtml(updated.date)} kl. ${escapeHtml(time)}</td></tr>
        </table>
        <p>Adress: Olivedalsgatan 2, Göteborg</p>
        <p>Välkommen!</p>
      `,
    });
  } catch (err) {
    console.error('confirmation email failed', err);
    // Booking is already confirmed in the DB at this point; surface the email
    // failure separately so the client can still proceed with the calendar step.
    return json({ ok: true, emailSent: false, booking: { ...updated, time } });
  }

  return json({ ok: true, emailSent: true, booking: { ...updated, time } });
});
