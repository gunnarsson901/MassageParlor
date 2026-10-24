import { supabaseAdmin } from './supabaseAdmin.ts';

// Validates the caller's Supabase Auth session token (not the anon key) and
// checks it belongs to the one admin account, gated by the ADMIN_EMAIL secret.
export async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; status: number }> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, status: 401 };

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  const allowedAdmins = new Set([
    'info@grundligmassage.se',
    'gunnarsson901@gmail.com',
    ...(Deno.env.get('ADMIN_EMAIL') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ]);
  const userEmail = data.user?.email?.toLowerCase() ?? '';
  if (error || !data.user || !allowedAdmins.has(userEmail)) {
    return { ok: false, status: 403 };
  }
  return { ok: true };
}
