// Sends email server-side via EmailJS's REST API using the account's private
// access token, so the public key/service/template IDs never need to reach the browser.
export async function sendEmail(templateId: string, templateParams: Record<string, unknown>) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: Deno.env.get('EMAILJS_SERVICE_ID'),
      template_id: templateId,
      user_id: Deno.env.get('EMAILJS_PUBLIC_KEY'),
      accessToken: Deno.env.get('EMAILJS_PRIVATE_KEY'),
      template_params: templateParams,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EmailJS send failed (${response.status}): ${text}`);
  }
}
