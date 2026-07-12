import { handleOptions, json } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/emailjs.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requireAdmin } from '../_shared/requireAdmin.ts';
import { escapeHtml } from '../_shared/html.ts';

const EDITABLE_FIELDS = ['name', 'email', 'category', 'duration', 'date', 'time', 'message'] as const;

function formatBooking(row: Record<string, unknown>) {
  return { ...row, time: typeof row.time === 'string' ? row.time.slice(0, 5) : row.time };
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return json({ error: 'unauthorized' }, auth.status);
  }

  const supabase = supabaseAdmin();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const action = url.searchParams.get('action') ?? 'list';
    if (action !== 'list') {
      return json({ error: 'unknown-action' }, 400);
    }
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('list bookings failed', error);
      return json({ error: 'query-failed' }, 500);
    }
    return json({ ok: true, bookings: (data ?? []).map(formatBooking) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method-not-allowed' }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }

  const { action, id } = body as Record<string, string>;
  if (!action || !id) {
    return json({ error: 'missing-params' }, 400);
  }

  if (action === 'accept') {
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !booking) return json({ error: 'not-found' }, 404);
    if (booking.status !== 'pending') return json({ error: 'invalid-status' }, 409);

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('name, email, category, duration, date, time')
      .maybeSingle();
    if (updateError || !updated) return json({ error: 'invalid-status' }, 409);

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
      console.error('accept confirmation email failed', err);
      return json({ ok: true, emailSent: false });
    }
    return json({ ok: true, emailSent: true });
  }

  if (action === 'decline') {
    const { suggestedDate, suggestedTime, note } = body as Record<string, string>;
    if (!suggestedDate || !suggestedTime) return json({ error: 'missing-params' }, 400);

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !booking) return json({ error: 'not-found' }, 404);
    if (booking.status !== 'pending') return json({ error: 'invalid-status' }, 409);

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
      .eq('status', 'pending')
      .select('name, email, category, duration, date, time')
      .maybeSingle();
    if (updateError || !updated) return json({ error: 'invalid-status' }, 409);

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
  }

  if (action === 'cancel') {
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !booking) return json({ error: 'not-found' }, 404);
    if (booking.status !== 'confirmed') return json({ error: 'invalid-status' }, 409);

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'confirmed')
      .select('name, email, category, duration, date, time')
      .maybeSingle();
    if (updateError || !updated) return json({ error: 'invalid-status' }, 409);

    const time = updated.time?.slice(0, 5);
    try {
      await sendEmail(Deno.env.get('EMAILJS_TEMPLATE_ID_CUSTOMER')!, {
        to_name: updated.name,
        to_email: updated.email,
        subject: 'Din bokning har avbokats - Grundlig Massage',
        accent_color: '#a1443a',
        heading: 'Din bokning har avbokats',
        body_html: `
          <p>Din bokning har tyvärr avbokats:</p>
          <table cellpadding="6">
            <tr><td><strong>Behandling:</strong></td><td>${escapeHtml(updated.category)}</td></tr>
            <tr><td><strong>Längd:</strong></td><td>${escapeHtml(updated.duration)}</td></tr>
            <tr><td><strong>Datum:</strong></td><td>${escapeHtml(updated.date)} kl. ${escapeHtml(time)}</td></tr>
          </table>
          <p>Hör gärna av dig om du vill boka en ny tid.</p>
        `,
      });
    } catch (err) {
      console.error('cancel email failed', err);
      return json({ ok: true, emailSent: false });
    }
    return json({ ok: true, emailSent: true });
  }

  if (action === 'update') {
    const patch = (body.patch ?? {}) as Record<string, unknown>;
    const cleanPatch: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (patch[key] !== undefined) cleanPatch[key] = patch[key];
    }
    if (Object.keys(cleanPatch).length === 0) {
      return json({ error: 'missing-params' }, 400);
    }

    const { error } = await supabase.from('bookings').update(cleanPatch).eq('id', id);
    if (error) {
      console.error('update booking failed', error);
      return json({ error: 'update-failed' }, 500);
    }
    return json({ ok: true });
  }

  if (action === 'delete') {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) {
      console.error('delete booking failed', error);
      return json({ error: 'delete-failed' }, 500);
    }
    return json({ ok: true });
  }

  return json({ error: 'unknown-action' }, 400);
});
