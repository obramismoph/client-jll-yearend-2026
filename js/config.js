/* ONE JLL Year-End Party 2026: the only file to edit when connecting the
   backend. Public keys only (the anon key). Never a service-role key or the
   Resend key here: this file is served to every guest. */
window.JLL = {
  // Supabase project (Settings > API). Leave 'YOUR_' values until the project
  // exists; the page then shows "registration opens soon" and refuses saves.
  SUPABASE_URL: 'https://uzioduceglvxbimkgmeu.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_i_YBiHVgXvqH1W9yAuP7MA_7djmLY1C',

  // Confirmation emails are sent server-side (supabase/functions/send-confirmation,
  // through Resend) the moment a row is inserted. This address receives replies
  // and a copy of every confirmation; shown on the page as the contact.
  CONTACT_EMAIL: 'eventmastersxjll@gmail.com',

  // Where the site lives (used in the confirmation email).
  SITE_URL: 'https://www.obramismoph.com/jll_emm2026',

  EVENT: {
    name: 'ONE JLL Year-End Party 2026',
    date_text: 'Friday, December 11, 2026',
    time_text: '5:00 PM to 10:00 PM',
    registration_text: 'Registration starts at 5:00 PM',
    venue: 'Golden Bay Fresh Seafood Restaurant, Pasay City',
    venue_map: 'https://www.google.com/maps/search/?api=1&query=Golden+Bay+Fresh+Seafood+Restaurant+Pasay+City',
    dress: 'Celebrate the holiday in your most creative pastel outfits',
    // Google Calendar needs UTC: 5 pm to 10 pm Manila (+08:00).
    gcal_start: '20261211T090000Z',
    gcal_end: '20261211T140000Z'
  },

  // Exactly the Google Form's dropdown, in its order.
  BUSINESS_LINES: [
    'Business Support',
    'Capital Markets',
    'Leasing Advisory',
    'PDS',
    'Property Management',
    'Research & Strategic Consulting',
    'Workplace Management',
    'VIP Guest',
    'Others'
  ],

  // Tables the committee can assign guests to (dropdown 1..TABLES). Keep equal to the
  // check constraint in supabase/migrations/0005_table_assignment.sql.
  TABLES: 55,

  ID_PREFIX: 'JLL'
};
