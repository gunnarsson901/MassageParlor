// Booking fields (category/duration/date/time/message/note) originate from an
// unauthenticated public endpoint and get interpolated into HTML email bodies,
// so escape them first to prevent injecting markup/links into transactional email.
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string));
}
