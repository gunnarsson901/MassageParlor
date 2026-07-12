// Delad Supabase-konfiguration för index.html, accept.html och decline.html.
// SUPABASE_URL och SUPABASE_ANON_KEY är publika värden - säkra att exponera i klientkod.
// Skydd sker i backend: edge-funktionerna kontrollerar tokens/status innan de gör något,
// och databasen har ingen direkt åtkomst för anon-nyckeln (RLS utan policies).
const SUPABASE_URL = 'https://ynhjnwaeqofrwunqtuiw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaGpud2FlcW9mcnd1bnF0dWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3OTg3MTksImV4cCI6MjA5OTM3NDcxOX0.Q6L-9QqsvXPFFgm85p7GDkLK6SZtAQM-u5T6vvP1Gpo';

// Google-kalenderns publika ID, används för att skriva nya händelser automatiskt
// när admin bekräftar en bokning (accept.html).
const GOOGLE_CALENDAR_ID = '698a734a0122a9924d2090aacce622aa9e105a8b2d7e50b5586cab84c4e2f531@group.calendar.google.com';

// OAuth 2.0 Client ID (Web application), används på accept.html för att admin ska kunna
// logga in med sitt Google-konto och skapa kalenderhändelser automatiskt vid bekräftelse.
const GOOGLE_OAUTH_CLIENT_ID = '308235981541-kikc6mpasshi6h9o7tvrk1o5l97hojdu.apps.googleusercontent.com';
