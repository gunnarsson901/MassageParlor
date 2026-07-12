// Delad hjälpfunktion för att anropa Supabase Edge Functions från
// index.html, accept.html och decline.html.
async function callBookingFunction(name, { method = 'GET', body, query } = {}) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${name}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'request-failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

// Booking data (name/email/category/etc.) originates from an unauthenticated
// public form, so escape it before inserting into innerHTML anywhere.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
