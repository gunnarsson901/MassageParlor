import { handleOptions, json } from '../_shared/cors.ts';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return json({ error: 'method-not-allowed' }, 405);
  }

  const today = new Date();
  const start = today.toISOString().split('T')[0];
  const end = new Date(today);
  end.setMonth(end.getMonth() + 3);
  const endStr = end.toISOString().split('T')[0];

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('bookings')
    .select('date, time, duration')
    .in('status', ['pending', 'confirmed'])
    .gte('date', start)
    .lte('date', endStr);

  if (error) {
    console.error('busy-times query failed', error);
    return json({ error: 'query-failed' }, 500);
  }

  return json({
    ok: true,
    busy: (data ?? []).map((row) => ({
      date: row.date,
      time: row.time?.slice(0, 5),
      duration: row.duration,
    })),
  });
});
