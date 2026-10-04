create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 80),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('lost', 'found')),
  item_name text not null check (char_length(trim(item_name)) between 2 and 80),
  category text not null check (category in (
    'electronics', 'books', 'bags', 'bottles', 'keys', 'id_cards',
    'clothing', 'accessories', 'stationery', 'other'
  )),
  color text not null check (color in (
    'black', 'white', 'gray', 'silver', 'blue', 'red', 'green',
    'yellow', 'orange', 'pink', 'purple', 'brown', 'multicolor', 'other'
  )),
  location text not null check (location in (
    'main_gate', 'library', 'canteen', 'computer_lab', 'classroom_block',
    'laboratory_block', 'auditorium', 'sports_area', 'parking_area', 'hostel', 'other'
  )),
  event_date date not null,
  description text not null check (char_length(trim(description)) between 5 and 1000),
  image_path text,
  status text not null default 'open' check (status in ('open', 'claimed', 'returned', 'closed')),
  created_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  claimant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (report_id, claimant_id)
);

create table public.claim_questions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 5 and 500),
  answer text check (answer is null or char_length(trim(answer)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports(status);
create index reports_type_status_idx on public.reports(type, status);
create index reports_user_id_idx on public.reports(user_id);
create index reports_category_idx on public.reports(category);
create index reports_location_idx on public.reports(location);
create index claims_report_id_idx on public.claims(report_id);
create index claims_claimant_id_idx on public.claims(claimant_id);
create index claim_questions_claim_id_idx on public.claim_questions(claim_id);

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.claims enable row level security;
alter table public.claim_questions enable row level security;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "authenticated users can read reports"
on public.reports
for select
to authenticated
using (true);

create policy "users can create own reports"
on public.reports
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "users can update own reports"
on public.reports
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "users can delete own reports"
on public.reports
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "claimants and report owners can read claims"
on public.claims
for select
to authenticated
using (
  claimant_id = (select auth.uid())
  or exists (
    select 1 from public.reports r
    where r.id = claims.report_id
      and r.user_id = (select auth.uid())
  )
);

create policy "users can create own claims for open found reports"
on public.claims
for insert
to authenticated
with check (
  claimant_id = (select auth.uid())
  and exists (
    select 1 from public.reports r
    where r.id = report_id
      and r.type = 'found'
      and r.status = 'open'
      and r.user_id <> (select auth.uid())
  )
);

create policy "report owners can update claims for their reports"
on public.claims
for update
to authenticated
using (
  exists (
    select 1 from public.reports r
    where r.id = claims.report_id
      and r.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.reports r
    where r.id = claims.report_id
      and r.user_id = (select auth.uid())
  )
);

create policy "claimants and report owners can read claim questions"
on public.claim_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.claims c
    join public.reports r on r.id = c.report_id
    where c.id = claim_questions.claim_id
      and (c.claimant_id = (select auth.uid()) or r.user_id = (select auth.uid()))
  )
);

create policy "report owners can create claim questions"
on public.claim_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.claims c
    join public.reports r on r.id = c.report_id
    where c.id = claim_id
      and r.user_id = (select auth.uid())
  )
);

create policy "claimants can answer claim questions"
on public.claim_questions
for update
to authenticated
using (
  exists (
    select 1 from public.claims c
    where c.id = claim_questions.claim_id
      and c.claimant_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.claims c
    where c.id = claim_questions.claim_id
      and c.claimant_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public)
values ('report-images', 'report-images', false)
on conflict (id) do nothing;

create policy "authenticated users can read report images"
on storage.objects
for select
to authenticated
using (bucket_id = 'report-images');

create policy "users can upload report images to own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "users can update report images in own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'report-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'report-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "users can delete report images in own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
