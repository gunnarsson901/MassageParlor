import { handleOptions, json } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return json({ error: 'method-not-allowed' }, 405);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const token = url.searchParams.get('token');
  if (!id || !token) {
    return json({ error: 'missing-params' }, 400);
  }

  const supabase = supabaseAdmin();
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, token, status, name, email, category, duration, date, time, message')
    .eq('id', id)
    .maybeSingle();

  if (error || !booking || booking.token !== token) {
    return json({ error: 'invalid' }, 404);
  }

  if (booking.status !== 'pending') {
    return json({ error: 'already-responded', status: booking.status }, 409);
  }

  return json({
    ok: true,
    booking: {
      name: booking.name,
      email: booking.email,
      category: booking.category,
      duration: booking.duration,
      date: booking.date,
      time: booking.time?.slice(0, 5),
      message: booking.message,
    },
  });
});
