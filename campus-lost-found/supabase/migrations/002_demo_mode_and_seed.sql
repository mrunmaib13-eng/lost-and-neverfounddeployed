-- ============================================================================
-- 002_demo_mode_and_seed.sql
-- Enables instant no-email-verification demo auth against real Supabase tables
-- and seeds initial profiles, reports, claims, and verification questions.
-- ============================================================================

-- 1. Confirm any users you already tried to register so they aren't stuck unconfirmed
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

-- 2. Allow public.profiles to store demo/student profiles directly without
--    being blocked by Supabase Auth's 3-emails/hour signup rate limit
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add column if not exists email text;

-- 3. Update RLS policies for College Demo Mode so the browser client can
--    read/write profiles, reports, claims, claim_questions, and images directly
--    in your Supabase database without requiring email confirmation
drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can insert own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "demo profiles access" on public.profiles;

create policy "demo profiles access"
on public.profiles
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can read reports" on public.reports;
drop policy if exists "users can create own reports" on public.reports;
drop policy if exists "users can update own reports" on public.reports;
drop policy if exists "users can delete own reports" on public.reports;
drop policy if exists "demo reports access" on public.reports;

create policy "demo reports access"
on public.reports
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "claimants and report owners can read claims" on public.claims;
drop policy if exists "users can create own claims for open found reports" on public.claims;
drop policy if exists "report owners can update claims for their reports" on public.claims;
drop policy if exists "demo claims access" on public.claims;

create policy "demo claims access"
on public.claims
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "claimants and report owners can read claim questions" on public.claim_questions;
drop policy if exists "report owners can create claim questions" on public.claim_questions;
drop policy if exists "claimants can answer claim questions" on public.claim_questions;
drop policy if exists "demo claim questions access" on public.claim_questions;

create policy "demo claim questions access"
on public.claim_questions
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can read report images" on storage.objects;
drop policy if exists "users can upload report images to own folder" on storage.objects;
drop policy if exists "users can update report images in own folder" on storage.objects;
drop policy if exists "users can delete report images in own folder" on storage.objects;
drop policy if exists "demo report images access" on storage.objects;

create policy "demo report images access"
on storage.objects
for all
to anon, authenticated
using (bucket_id = 'report-images')
with check (bucket_id = 'report-images');

-- 4. Seed Demo Profiles (Student 1: Pranav B, Student 2: Mrunmai B)
insert into public.profiles (id, full_name, created_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Pranav B', '2026-10-01T09:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222222', 'Mrunmai B', '2026-10-01T09:05:00.000Z')
on conflict (id) do update
set full_name = excluded.full_name;

-- 5. Seed Demo Lost & Found Reports
insert into public.reports (
  id, user_id, type, item_name, category, color, location, event_date, description, image_path, status, created_at
)
values
  (
    'a0000001-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'lost',
    'Black Water Bottle',
    'bottles',
    'black',
    'library',
    '2026-10-04',
    'Matte black 1L insulated steel water bottle with a small red star sticker near the base. Left on the 2nd floor reading table.',
    null,
    'open',
    '2026-10-04T10:15:00.000Z'
  ),
  (
    'a0000002-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'lost',
    'Casio Scientific Calculator',
    'electronics',
    'gray',
    'computer_lab',
    '2026-10-03',
    'Casio fx-991EX scientific calculator in a dark gray slide cover. Lost after the afternoon programming lab session.',
    null,
    'open',
    '2026-10-03T16:30:00.000Z'
  ),
  (
    'a0000003-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'lost',
    'Discrete Mathematics Textbook',
    'books',
    'blue',
    'classroom_block',
    '2026-10-02',
    'Blue hardcover Discrete Mathematics textbook (Rosen 8th Edition) with yellow index tabs on the Relations chapter.',
    null,
    'open',
    '2026-10-02T14:20:00.000Z'
  ),
  (
    'a0000004-0000-4000-8000-000000000004',
    '11111111-1111-4111-8111-111111111111',
    'found',
    'Silver Hostel Keys',
    'keys',
    'silver',
    'canteen',
    '2026-10-04',
    'Found a keyring with two silver keys and a numbered metal token on a table near the juice counter.',
    null,
    'open',
    '2026-10-04T13:10:00.000Z'
  ),
  (
    'b0000001-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222',
    'found',
    'Black Water Bottle',
    'bottles',
    'black',
    'library',
    '2026-10-04',
    'Found a black insulated metal water bottle by the second-floor study cubicles in the central library.',
    null,
    'open',
    '2026-10-04T11:45:00.000Z'
  ),
  (
    'b0000002-0000-4000-8000-000000000002',
    '22222222-2222-4222-8222-222222222222',
    'found',
    'Water Bottle',
    'bottles',
    'black',
    'canteen',
    '2026-10-03',
    'Black metal water bottle found near the main canteen seating area on Saturday afternoon.',
    null,
    'open',
    '2026-10-03T17:00:00.000Z'
  ),
  (
    'b0000003-0000-4000-8000-000000000003',
    '22222222-2222-4222-8222-222222222222',
    'found',
    'Scientific Calculator',
    'electronics',
    'gray',
    'computer_lab',
    '2026-10-01',
    'Found a gray Casio scientific calculator next to workstation #14 in the main computer lab.',
    null,
    'open',
    '2026-10-03T18:00:00.000Z'
  ),
  (
    'b0000004-0000-4000-8000-000000000004',
    '22222222-2222-4222-8222-222222222222',
    'found',
    'Discrete Mathematics Book',
    'books',
    'blue',
    'library',
    '2026-10-02',
    'Blue hardcover Discrete Mathematics book found near the library return desk.',
    null,
    'open',
    '2026-10-02T17:30:00.000Z'
  ),
  (
    'b0000005-0000-4000-8000-000000000005',
    '22222222-2222-4222-8222-222222222222',
    'lost',
    'Hostel Keys',
    'keys',
    'silver',
    'canteen',
    '2026-10-02',
    'Lost my hostel room keyring with two silver keys while having lunch at the campus canteen.',
    null,
    'open',
    '2026-10-04T14:00:00.000Z'
  ),
  (
    'b0000006-0000-4000-8000-000000000006',
    '22222222-2222-4222-8222-222222222222',
    'found',
    'Student ID Card Holder',
    'id_cards',
    'blue',
    'main_gate',
    '2026-10-04',
    'Blue neck lanyard with a transparent ID card holder found near the main gate security desk.',
    null,
    'open',
    '2026-10-04T09:30:00.000Z'
  ),
  (
    'b0000007-0000-4000-8000-000000000007',
    '22222222-2222-4222-8222-222222222222',
    'found',
    'Black Canvas Backpack',
    'bags',
    'black',
    'auditorium',
    '2026-10-03',
    'Black canvas backpack found in row D of the main auditorium after the seminar.',
    null,
    'open',
    '2026-10-03T19:00:00.000Z'
  )
on conflict (id) do nothing;

-- 6. Seed Sample Claims & Ownership Verification Questions
insert into public.claims (id, report_id, claimant_id, status, created_at)
values
  (
    'c0000001-0000-4000-8000-000000000001',
    'b0000003-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'pending',
    '2026-10-04T12:00:00.000Z'
  ),
  (
    'c0000002-0000-4000-8000-000000000002',
    'a0000004-0000-4000-8000-000000000004',
    '22222222-2222-4222-8222-222222222222',
    'pending',
    '2026-10-04T14:30:00.000Z'
  )
on conflict (report_id, claimant_id) do nothing;

insert into public.claim_questions (id, claim_id, question, answer, created_at)
values
  (
    'd0000001-0000-4000-8000-000000000001',
    'c0000001-0000-4000-8000-000000000001',
    'What initials or roll-number digits are scratched inside the slide cover?',
    null,
    '2026-10-04T12:15:00.000Z'
  ),
  (
    'd0000002-0000-4000-8000-000000000002',
    'c0000002-0000-4000-8000-000000000002',
    'What room number is stamped on the metal token attached to the keyring?',
    'Hostel Block B, Room 204',
    '2026-10-04T14:40:00.000Z'
  )
on conflict (id) do nothing;
