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

  const { id, token, suggestedDate, suggestedTime, note } = body as Record<string, string>;
  if (!id || !token || !suggestedDate || !suggestedTime) {
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
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
      decline_suggested_date: suggestedDate,
      decline_suggested_time: suggestedTime,
      decline_note: note || null,
    })
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
      subject: 'Ang. din bokningsförfrågan - Grundlig Massage',
      accent_color: '#b8734a',
      heading: 'Vi behöver hitta en ny tid',
      body_html: `
        <p>Tyvärr har jag inte möjlighet ${escapeHtml(updated.date)} kl. ${escapeHtml(time)} för ${escapeHtml(updated.category)} (${escapeHtml(updated.duration)}).</p>
        <p><strong>Förslag på ny tid:</strong> ${escapeHtml(suggestedDate)} kl. ${escapeHtml(suggestedTime)}</p>
        <p>${escapeHtml(note)}</p>
        <p>Hör gärna av dig om tiden passar, eller om du vill föreslå en annan!</p>
      `,
    });
  } catch (err) {
    console.error('decline email failed', err);
    return json({ ok: true, emailSent: false });
  }

  return json({ ok: true, emailSent: true });
});
