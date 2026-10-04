# Campus Lost-and-Found Matcher
## Implementation Specification for Codex

> Build this document as the single source of truth. Do not add technologies, features, tables, routes, or abstractions that are not specified here unless they are required to make the specified system work.
>
> Goal: build a simple, reliable college project using **Vite + TypeScript + plain HTML/CSS + Supabase**. No React, no Node/Express backend, no Supabase Edge Functions, no AI, no external matching API.

---

# 1. Product goal

Build a responsive web app called **Campus Lost & Found**.

The app lets authenticated college students:

1. Register and log in.
2. Report an item as **lost** or **found**.
3. Browse open lost/found reports.
4. Automatically calculate possible matches between a lost report and found reports.
5. See a transparent matching score and exactly which fields matched.
6. Submit a private claim/request for a possible match.
7. View their own reports.
8. Mark their own report as returned/closed after the item is resolved.
9. Upload an optional item image.
10. Log out.

The application must demonstrate Discrete Mathematics Module 3 through:
- relations,
- relation pairs,
- equivalence relations,
- equivalence classes,
- a matching relation,
- and a transparent scoring rule.

The app is a college project, not a production-grade marketplace.

---

# 2. Non-goals: keep the implementation simple

Do NOT implement:

- React
- Next.js
- Express
- a custom backend server
- Supabase Edge Functions
- AI/ML matching
- vector embeddings
- external maps
- push notifications
- SMS
- payment systems
- social login
- admin dashboard in the first version
- chat system
- public user profiles
- phone-number sharing
- automatic confirmation that an item belongs to someone
- automatic marking of an item as returned because of a high score

The matching algorithm must be deterministic and understandable.

---

# 3. Technology stack

Use exactly:

- Vite
- TypeScript
- plain HTML
- plain CSS
- `@supabase/supabase-js`
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage

Do not introduce a frontend framework.

Use npm.

Expected initial setup:

```bash
npm create vite@latest campus-lost-found -- --template vanilla-ts
cd campus-lost-found
npm install
npm install @supabase/supabase-js
npm run dev
```

Use the current stable versions installed by npm.

---

# 4. Project structure

Use this structure:

```text
campus-lost-found/
├── index.html
├── package.json
├── tsconfig.json
├── .env
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── main.ts
│   ├── style.css
│   ├── types.ts
│   ├── constants.ts
│   ├── supabase.ts
│   ├── auth.ts
│   ├── reports.ts
│   ├── matches.ts
│   ├── claims.ts
│   ├── storage.ts
│   ├── ui.ts
│   └── validation.ts
└── supabase/
    ├── config.toml
    ├── migrations/
    │   └── 001_initial_schema.sql
    └── seed.sql
```

Do not create unnecessary files.

---

# 5. Environment variables

Create `.env.example`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

The actual `.env` must never be committed.

`.gitignore` must include:

```gitignore
node_modules
dist
.env
.DS_Store
```

Only the browser-safe Supabase URL and public/publishable key belong in the frontend.

NEVER put a Supabase service-role key in:
- `.env` used by the frontend,
- TypeScript source,
- HTML,
- CSS,
- Git,
- or any browser-accessible file.

---

# 6. Supabase architecture

Use one Supabase project.

Use:

- Supabase Auth for accounts.
- PostgreSQL for application data.
- Supabase Storage for optional report images.
- Row Level Security for database access.

Do not create a custom backend.

Use database migrations as the source of truth for the schema.

Do not manually create application tables in the remote dashboard and then separately create conflicting migrations.

The intended workflow is:

```text
migration SQL
      ↓
local Supabase database
      ↓
test
      ↓
remote Supabase database
```

If local Supabase is used, keep all schema changes in `supabase/migrations/`.

---

# 7. Database schema

Use exactly four application tables:

1. `profiles`
2. `reports`
3. `claims`
4. `claim_questions`

Do not create a `matches` table.

Matches are derived from reports by TypeScript. This avoids duplicated data and avoids consistency problems.

---

# 8. Profiles table

Create:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);
```

The `id` is exactly the authenticated user's UUID.

Do not create a second user ID.

Do not store passwords in this table.

The authentication email remains in Supabase Auth.

---

# 9. Reports table

Create:

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  type text not null
    check (type in ('lost', 'found')),

  item_name text not null
    check (char_length(trim(item_name)) between 2 and 80),

  category text not null
    check (category in (
      'electronics',
      'books',
      'bags',
      'bottles',
      'keys',
      'id_cards',
      'clothing',
      'accessories',
      'stationery',
      'other'
    )),

  color text not null
    check (color in (
      'black',
      'white',
      'gray',
      'silver',
      'blue',
      'red',
      'green',
      'yellow',
      'orange',
      'pink',
      'purple',
      'brown',
      'multicolor',
      'other'
    )),

  location text not null
    check (location in (
      'main_gate',
      'library',
      'canteen',
      'computer_lab',
      'classroom_block',
      'laboratory_block',
      'auditorium',
      'sports_area',
      'parking_area',
      'hostel',
      'other'
    )),

  event_date date not null,

  description text not null
    check (char_length(trim(description)) between 5 and 1000),

  image_path text,

  status text not null default 'open'
    check (status in ('open', 'claimed', 'returned', 'closed')),

  created_at timestamptz not null default now()
);
```

Important distinction:

- `event_date` means the date the item was lost/found.
- `created_at` means when the report was submitted.

The matching algorithm must use `event_date`, not `created_at`.

---

# 10. Claims table

A claim is a private request from one student saying:

> "I believe this found item may be my lost item."

Create:

```sql
create table public.claims (
  id uuid primary key default gen_random_uuid(),

  report_id uuid not null
    references public.reports(id)
    on delete cascade,

  claimant_id uuid not null
    references public.profiles(id)
    on delete cascade,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),

  created_at timestamptz not null default now(),

  unique (report_id, claimant_id)
);
```

Do not store arbitrary contact information in this table.

The report owner can see claims submitted for their report.

The claimant can see their own claims.

---

# 11. Claim questions table

Do not immediately expose the full identifying details of a found item.

Instead, allow the finder/report owner to ask an ownership-verification question.

Create:

```sql
create table public.claim_questions (
  id uuid primary key default gen_random_uuid(),

  claim_id uuid not null
    references public.claims(id)
    on delete cascade,

  question text not null
    check (char_length(trim(question)) between 5 and 500),

  answer text
    check (
      answer is null
      or char_length(trim(answer)) between 1 and 1000
    ),

  created_at timestamptz not null default now()
);
```

For the first version, only the report owner can create a question and only the claimant can answer it.

This is enough to demonstrate a basic verification workflow without implementing chat.

---

# 12. Profile creation

When a user registers:

1. Call Supabase Auth sign-up.
2. Create the profile row using the authenticated user's ID.
3. Save only the full name in `profiles`.

Do not rely on the frontend to invent the user ID.

The user ID must come from:

```ts
const {
  data: { user }
} = await supabase.auth.getUser();
```

Use `user.id`.

Prefer a database trigger to automatically create the profile after a successful Auth user creation if implementing it cleanly.

If using a trigger, the trigger must only copy safe information such as the user's ID. The frontend still collects `full_name` and must create/update the profile explicitly.

For simplicity, use explicit profile creation after sign-up and handle failures carefully.

Important: if profile creation fails after Auth registration succeeds, the UI must tell the user that the account exists but profile setup failed. Do not create a second Auth account automatically.

---

# 13. Supabase Auth

Implement:

- sign up
- sign in
- sign out
- session restoration
- auth-state changes

Use the current Supabase JS API:

```ts
supabase.auth.signUp({
  email,
  password
});
```

and:

```ts
supabase.auth.signInWithPassword({
  email,
  password
});
```

and:

```ts
supabase.auth.signOut();
```

Listen for auth changes using:

```ts
supabase.auth.onAuthStateChange(...)
```

On page load, retrieve the current session/user and render the appropriate screen.

Do not store the access token manually in localStorage.

Let Supabase Auth manage its session.

---

# 14. Authentication UI

The application has two authentication states.

## Logged out

Show:

- application name
- short explanation
- Login form
- Register form

## Logged in

Show:

- dashboard
- report buttons
- browse reports
- my reports
- possible matches
- claims
- logout

If there is no authenticated user, do not render authenticated application screens.

---

# 15. Report form

Create one reusable form for both:

- Report Lost Item
- Report Found Item

The only difference is `type`.

Fields:

```text
type
item_name
category
color
location
event_date
description
image
```

Do not allow the user to type arbitrary category/color/location values.

Use `<select>` for those fields.

This is important because the matching system depends on standardised values.

---

# 16. Form validation

Perform client-side validation before sending data to Supabase.

Rules:

### item_name

- required
- trim whitespace
- 2–80 characters

### category

- must be one of the predefined category values

### color

- must be one of the predefined color values

### location

- must be one of the predefined location values

### event_date

- required
- valid date
- do not allow a date far in the future
- allow today's date
- allow past dates

For a simple project, reject dates later than today.

### description

- required
- 5–1000 characters
- trim whitespace

Never rely only on client-side validation. The database CHECK constraints are the final validation layer.

---

# 17. Image handling

Images are optional.

Use one Supabase Storage bucket:

```text
report-images
```

The bucket should not be publicly writable.

Store only the file path in:

```text
reports.image_path
```

Do NOT store the actual image binary in PostgreSQL.

File rules:

- optional
- maximum 5 MB
- JPEG, PNG, or WebP only
- one image per report

Before upload:

1. Check file type.
2. Check file size.
3. Generate a unique path.

Use:

```text
userId/reportId.extension
```

The report ID must be generated before uploading the image.

If image upload fails:

- do not create a report that claims to have an image;
- either delete any partial upload and show an error,
- or save the report with `image_path = null` and clearly tell the user that the image upload failed.

Prefer the first behavior for consistency.

When displaying an image, use a signed URL or another access method compatible with the bucket's security policy.

Do not put arbitrary user-supplied URLs into `<img src>`.

---

# 18. Report creation flow

Implement this exact order:

```text
User fills form
       ↓
Validate fields
       ↓
Get authenticated user
       ↓
Generate report ID
       ↓
Upload optional image
       ↓
Insert report row
       ↓
If database insert fails:
    delete uploaded image
       ↓
Show success
       ↓
Navigate to My Reports
```

Do not upload an image before validating the form.

Do not insert the report before the image path is known.

Do not create the report twice if the user double-clicks Submit.

Disable the Submit button while submission is in progress.

---

# 19. Report status

Use these statuses:

```text
open
claimed
returned
closed
```

Meaning:

### open

The report is active and should participate in matching.

### claimed

Someone has submitted a claim.

The report still exists and should remain visible to the owner.

For matching purposes, it can still be considered until the owner resolves the claim.

### returned

The item has been returned.

It should NOT participate in new matches.

### closed

The report is no longer active.

It should NOT participate in matching.

---

# 20. Who can update a report

Normal users may:

- edit their own open report
- delete their own open report
- change their own report to `returned`
- close their own report

Normal users must NOT:

- edit someone else's report
- change someone else's owner ID
- change someone else's status
- delete someone else's report

Do not expose an admin bypass in the client.

---

# 21. Row Level Security

Enable RLS on all four application tables.

```sql
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.claims enable row level security;
alter table public.claim_questions enable row level security;
```

---

# 22. Profiles RLS

Users should be able to read their own profile and update their own profile.

Example policies:

```sql
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
```

Do not create a public profile directory.

---

# 23. Reports RLS

All authenticated users can read reports because the application needs to compare lost and found reports.

However, only the owner can modify their report.

Use:

```sql
create policy "authenticated users can read reports"
on public.reports
for select
to authenticated
using (true);
```

Insert:

```sql
create policy "users can create own reports"
on public.reports
for insert
to authenticated
with check (user_id = (select auth.uid()));
```

Update:

```sql
create policy "users can update own reports"
on public.reports
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
```

Delete:

```sql
create policy "users can delete own reports"
on public.reports
for delete
to authenticated
using (user_id = (select auth.uid()));
```

Important: because reports are readable by all authenticated users, do not store private phone numbers, home addresses, private emails, or secrets in `reports`.

---

# 24. Claims RLS

A claimant can:

- create a claim for themselves
- read their own claims

The report owner can:

- read claims against their report
- approve/reject claims against their report

A claimant cannot modify another user's claim.

Implement policies based on:

```sql
claimant_id = (select auth.uid())
```

or:

```sql
exists (
  select 1
  from public.reports r
  where r.id = claims.report_id
    and r.user_id = (select auth.uid())
)
```

Use the same ownership logic for `claim_questions`.

Do not attempt to solve claim permissions in TypeScript only. RLS must enforce them in PostgreSQL.

---

# 25. Matching system

This is the central mathematical and application feature.

Do not use AI.

Do not use fuzzy machine learning.

Use a deterministic scoring function.

---

# 26. Matching sets

Define:

```text
L = set of open lost reports
F = set of open found reports
```

Only compare:

```text
lost report ↔ found report
```

Never compare:

```text
lost ↔ lost
found ↔ found
```

Only reports with:

```text
status = 'open'
```

participate in new matching.

---

# 27. Matching relation

Define a relation:

```text
R ⊆ L × F
```

For lost report `l` and found report `f`:

```text
(l, f) ∈ R
```

when the calculated score is at least the matching threshold.

Use:

```text
MATCH_THRESHOLD = 60
```

This threshold is a project rule.

---

# 28. Matching score

Maximum score = 100.

Use exactly:

```text
Category      30 points
Color         20 points
Location      20 points
Date          20 points
Item name     10 points
-----------------------
Total        100 points
```

Do not add description scoring in the first version.

This keeps the algorithm explainable and predictable.

---

# 29. Category score

```ts
if (lost.category === found.category) {
  score += 30;
}
```

Otherwise:

```text
0
```

---

# 30. Color score

```ts
if (lost.color === found.color) {
  score += 20;
}
```

Otherwise:

```text
0
```

---

# 31. Location score

```ts
if (lost.location === found.location) {
  score += 20;
}
```

Otherwise:

```text
0
```

---

# 32. Date score

Calculate absolute difference between the two `event_date` values.

Rules:

```text
0–1 days     = 20 points
2–3 days     = 10 points
more than 3  = 0 points
```

Use UTC-safe date parsing so timezone conversion does not unexpectedly change the calendar date.

Because the database field is a PostgreSQL `date`, treat it as a calendar date rather than a JavaScript timestamp.

Do not use `new Date("YYYY-MM-DD")` in a way that can shift the displayed day because of timezone conversion.

Implement a small date-only helper that parses:

```text
YYYY-MM-DD
```

into numeric year/month/day components and calculates day difference consistently.

---

# 33. Item name score

Normalise both names:

1. trim
2. lowercase
3. collapse repeated whitespace

Then check whether one normalised name contains the other.

Example:

```text
"water bottle"
"black water bottle"
```

=> 10 points.

Example:

```text
"calculator"
"water bottle"
```

=> 0 points.

Do not implement complex fuzzy matching in version 1.

---

# 34. Match result object

The matching function should return more than just a number.

Use this TypeScript shape:

```ts
export interface MatchResult {
  lostReport: Report;
  foundReport: Report;
  score: number;
  breakdown: {
    category: number;
    color: number;
    location: number;
    date: number;
    itemName: number;
  };
}
```

This allows the UI to explain the score.

Example:

```text
Possible Match: 90%

Category      +30
Color         +20
Location      +20
Date          +20
Item Name      +0
-----------------
Total          90
```

---

# 35. Matching function

Implement:

```ts
export function calculateMatch(
  lost: Report,
  found: Report
): MatchResult
```

It must:

1. Verify `lost.type === "lost"`.
2. Verify `found.type === "found"`.
3. Calculate each component independently.
4. Sum the components.
5. Return the breakdown.
6. Never mutate either report.

If either report is not `open`, the function should return a score of 0 or the caller should never pass it in.

Prefer filtering reports before calling the function.

---

# 36. Finding matches

For a selected lost report:

1. Fetch open found reports.
2. Run `calculateMatch()` against every found report.
3. Keep scores >= 60.
4. Sort descending by score.
5. If scores are equal, sort by smaller date difference first.
6. If still equal, sort by newest report first.
7. Display the top 10 results.

For a selected found report, perform the reverse:

1. Fetch open lost reports.
2. Run the same function.
3. Keep scores >= 60.
4. Sort.
5. Display top 10.

The same matching function must be used in both directions.

---

# 37. Avoid unnecessary database calls

Do not fetch the database separately for every candidate.

Bad:

```text
for each report:
    query Supabase
```

Good:

```text
one query for relevant open reports
        ↓
calculate all scores locally
        ↓
sort in TypeScript
```

For the college project's expected dataset size, this is simple and sufficient.

When querying reports, select only fields needed by the UI and matcher.

---

# 38. Matches page

Create a page/view:

```text
Possible Matches
```

For each match display:

```text
Match Score: 90%

Found Item
Black Water Bottle

Category: Bottle
Color: Black
Location: Library
Date: 2026-10-04

Why this matches:
✓ Same category       +30
✓ Same color          +20
✓ Same location       +20
✓ Date within 1 day   +20
✗ Similar item name    +0

[View Report]
[Submit Claim]
```

Do not show the report owner's email or phone number.

---

# 39. Browse page

Create:

```text
Browse Reports
```

Tabs:

```text
All
Lost
Found
```

Filters:

```text
Category
Color
Location
```

Search:

```text
Item name
```

Use client-side filtering after fetching the current report set.

For a small college project this is simpler than building a complicated server-side search system.

Only show:

- item name
- type
- category
- color
- location
- event date
- description
- image if available
- status

Do not show owner IDs.

---

# 40. My Reports page

Show only the authenticated user's reports.

Each card should show:

```text
Item
Type
Category
Location
Date
Status
Created date

[View]
[Edit]
[Delete]
[Mark Returned]
```

For reports with possible matches:

```text
[Find Matches]
```

Do not allow editing a returned/closed report unless explicitly re-opening is implemented. Do not implement reopening in version 1.

---

# 41. Claims flow

Implement the following simple workflow.

### Step 1

Student sees a possible match.

### Step 2

Student clicks:

```text
Submit Claim
```

### Step 3

Create:

```text
claims.report_id = found report ID
claims.claimant_id = current user ID
claims.status = pending
```

The unique constraint prevents the same claimant from submitting duplicate claims for the same report.

### Step 4

The owner of the found report sees:

```text
New Claim
```

They can:

```text
Approve
Reject
```

### Step 5

If approved:

- claim status becomes `approved`
- report status becomes `returned`

If rejected:

- claim status becomes `rejected`
- report remains `open`

The update should happen in a way that prevents unauthorized users from changing either record.

Because two related rows are being updated, do not pretend that two independent browser requests form a database transaction.

For a simple project, keep the operation owner-authorized and verify the resulting state. If strict atomicity is required later, move this small operation into a PostgreSQL function/RPC with appropriate security.

Do NOT create a complex RPC just for the first MVP.

---

# 42. Claim verification question

When the found-item owner receives a claim, they may optionally create a question such as:

```text
What sticker is on the side of the bottle?
```

The claimant answers:

```text
A small red star sticker.
```

The owner sees the answer.

This helps demonstrate that a matching score is not proof of ownership.

The application should make this distinction clear:

```text
MATCH SCORE ≠ PROOF OF OWNERSHIP
```

---

# 43. Equivalence classes

The app must have a small mathematical explanation panel for the project.

Use category equivalence.

Define relation `~`:

```text
r1 ~ r2
iff
category(r1) = category(r2)
```

This is an equivalence relation because it is:

### Reflexive

Every report has the same category as itself.

### Symmetric

If report A has the same category as B, B has the same category as A.

### Transitive

If A has the same category as B, and B has the same category as C, then A has the same category as C.

Therefore, reports can be divided into equivalence classes:

```text
[Electronics]
[Books]
[Bags]
[Bottles]
[Keys]
[ID Cards]
...
```

This should be explained in the README/project documentation.

Do not falsely claim that the lost-to-found matching relation itself is an equivalence relation. It is not.

---

# 44. Relation matrix demonstration

Add an optional "Math View" page for the college demonstration.

It can show a small relation matrix for the currently selected lost report and top found reports.

Example:

```text
                 Found 1   Found 2   Found 3
Lost 1              1         0         1
Lost 2              0         1         0
```

Where:

```text
1 = score >= 60
0 = score < 60
```

This is derived from the matching relation.

Do not store this matrix in Supabase.

Calculate it dynamically from the reports.

---

# 45. UI design

Keep the UI simple.

Use:

- responsive layout
- clean cards
- clear buttons
- accessible labels
- readable typography
- consistent spacing
- mobile-first layout

Suggested sections:

```text
Header
    Logo / App name
    Dashboard
    My Reports
    Claims
    Logout

Main content

Footer
```

Do not spend most of the project time on animations.

Functionality is more important.

---

# 46. Application views

Implement these views:

```text
login
register
dashboard
report-form
browse
my-reports
matches
claims
math-view
```

Use simple client-side view switching.

Do not install a router unless genuinely needed.

For a small Vite application, a simple:

```ts
setView("dashboard")
```

style architecture is sufficient.

---

# 47. Dashboard

After login, show:

```text
Welcome, <first name>

[Report Lost Item]
[Report Found Item]

Quick stats:

My Open Reports
Possible Matches
Pending Claims

Recent Reports
```

Stats can be calculated from already-fetched data.

Do not create a separate statistics table.

---

# 48. Error handling

Every Supabase operation must use:

```ts
try {
  ...
} catch (error) {
  ...
}
```

and also inspect Supabase's returned `error`.

Never silently ignore database errors.

Display human-readable errors.

Examples:

```text
Unable to sign in. Please check your email and password.
```

```text
Unable to save the report. Please try again.
```

```text
You must be logged in to submit a report.
```

Do not show raw PostgreSQL errors to normal users.

Log useful debugging information to the console during development.

---

# 49. Loading states

Every asynchronous operation needs a loading state.

Examples:

```text
Signing in...
Saving report...
Uploading image...
Finding matches...
Loading reports...
Submitting claim...
```

Disable the relevant button during the operation.

This prevents duplicate submissions.

---

# 50. Empty states

Do not leave pages blank.

Examples:

### My Reports

```text
You have not submitted any reports yet.

[Report Lost Item]
[Report Found Item]
```

### Matches

```text
No possible matches found yet.
Try checking again later as new reports are submitted.
```

### Claims

```text
You do not have any pending claims.
```

### Browse

```text
No reports match your filters.
```

---

# 51. Security rules for Storage

Create a bucket:

```text
report-images
```

Use Storage policies so authenticated users can upload only to paths beginning with their own user ID.

Expected path:

```text
<user_id>/<report_id>.<extension>
```

A user must not be able to upload to another user's directory.

For deletion, only allow the owner to delete their own image path.

Do not make the entire bucket publicly writable.

---

# 52. Important Supabase rules

Do NOT:

- expose service-role keys
- disable RLS
- use `using (true)` for INSERT/UPDATE/DELETE
- trust a user-supplied `user_id`
- store passwords yourself
- create duplicate application user IDs
- manually modify the remote schema after migrations are established
- create a `matches` table when matches are derived
- call Supabase inside every matching-loop iteration
- assume a high score proves ownership

The `user_id` in an INSERT must be checked by RLS against:

```sql
(select auth.uid())
```

---

# 53. TypeScript types

Create `src/types.ts`.

Define:

```ts
export type ReportType = "lost" | "found";

export type ReportStatus =
  | "open"
  | "claimed"
  | "returned"
  | "closed";

export type ClaimStatus =
  | "pending"
  | "approved"
  | "rejected";

export interface Report {
  id: string;
  user_id: string;
  type: ReportType;
  item_name: string;
  category: string;
  color: string;
  location: string;
  event_date: string;
  description: string;
  image_path: string | null;
  status: ReportStatus;
  created_at: string;
}
```

Add interfaces for:

```text
Profile
Claim
ClaimQuestion
MatchResult
MatchBreakdown
```

Keep database field names in snake_case so they match PostgreSQL exactly.

Do not silently rename fields between database and application.

---

# 54. Generate database TypeScript types

After the database schema exists, generate Supabase TypeScript types rather than manually maintaining a second full database schema definition.

Use the Supabase CLI type generation command appropriate to the environment.

The goal is:

```text
PostgreSQL schema
      ↓
Supabase generated types
      ↓
TypeScript client code
```

Whenever the database schema changes:

1. update the migration,
2. apply/reset the database,
3. regenerate types,
4. run TypeScript checks.

Do not allow handwritten types to drift from the actual schema.

---

# 55. Supabase client

Create `src/supabase.ts`.

Use:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables.");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
```

Do not hardcode project credentials.

---

# 56. Constants

Create `src/constants.ts`.

Store the allowed values in one place:

```ts
export const CATEGORIES = [
  "electronics",
  "books",
  "bags",
  "bottles",
  "keys",
  "id_cards",
  "clothing",
  "accessories",
  "stationery",
  "other",
] as const;
```

Similarly define:

```text
COLORS
LOCATIONS
MATCH_THRESHOLD
MAX_IMAGE_SIZE
ALLOWED_IMAGE_TYPES
```

The UI should derive dropdown options from these constants.

The database CHECK constraints remain the final source of validation.

---

# 57. Validation module

Create `src/validation.ts`.

Implement:

```ts
validateReportForm()
validateImage()
validateEmail()
validatePassword()
validateFullName()
```

Validation functions should return structured errors rather than directly manipulating the DOM.

Example:

```ts
interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
```

The UI decides how to display those errors.

---

# 58. Auth module

Create `src/auth.ts`.

Responsibilities:

```text
register
login
logout
getCurrentUser
listenForAuthChanges
```

Do not put UI code inside the auth module.

The auth module talks to Supabase.

The UI module displays the result.

---

# 59. Reports module

Create `src/reports.ts`.

Responsibilities:

```text
createReport
getOpenReports
getReportById
getMyReports
updateReport
deleteReport
markReportReturned
```

Do not put HTML manipulation inside this file.

It should only handle report data and Supabase operations.

---

# 60. Matching module

Create `src/matches.ts`.

Responsibilities:

```text
calculateDateDifference
calculateMatch
findMatchesForLostReport
findMatchesForFoundReport
sortMatches
```

This file should have no Supabase UI code.

Ideally, `calculateMatch()` should be a pure function.

That makes it easy to test.

---

# 61. Claims module

Create `src/claims.ts`.

Responsibilities:

```text
createClaim
getMyClaims
getClaimsForMyReports
approveClaim
rejectClaim
createClaimQuestion
answerClaimQuestion
```

Keep authorization in RLS as well as in the UI.

The UI hiding a button is NOT a security feature.

---

# 62. Storage module

Create `src/storage.ts`.

Responsibilities:

```text
uploadReportImage
deleteReportImage
getReportImageUrl
```

Do not spread Storage calls across the application.

---

# 63. UI module

Create `src/ui.ts`.

Responsibilities:

```text
renderLogin
renderRegister
renderDashboard
renderReportForm
renderBrowse
renderMyReports
renderMatches
renderClaims
renderMathView
showLoading
showError
showSuccess
```

Do not put SQL or Supabase policy logic here.

---

# 64. Main application flow

`main.ts` is the coordinator.

Conceptually:

```text
start app
   ↓
load session
   ↓
if logged out:
    render auth screen
else:
    render dashboard
   ↓
listen for auth changes
   ↓
user chooses a view
   ↓
load required data
   ↓
render view
```

Do not run all database queries immediately on page load.

Load data when the relevant view opens.

---

# 65. Initial startup

The application must not flash authenticated content to a logged-out user.

Startup:

```text
show loading screen
       ↓
get current session
       ↓
session exists?
   /           \
 yes            no
  ↓              ↓
dashboard      login
```

After startup, subscribe to auth state changes.

---

# 66. Database migration

Create one initial migration:

```text
supabase/migrations/001_initial_schema.sql
```

It should contain:

1. extensions/functions needed by the schema
2. tables
3. constraints
4. indexes
5. RLS enablement
6. RLS policies
7. Storage policies if managed through SQL

Keep the schema in one migration for this small project.

Do not create multiple conflicting definitions of the same table.

If a schema change is needed later, create a second migration instead of editing an already-applied production migration.

---

# 67. Useful indexes

Create indexes for common report queries:

```sql
create index reports_status_idx
on public.reports(status);

create index reports_type_status_idx
on public.reports(type, status);

create index reports_user_id_idx
on public.reports(user_id);

create index reports_category_idx
on public.reports(category);

create index reports_location_idx
on public.reports(location);

create index claims_report_id_idx
on public.claims(report_id);

create index claims_claimant_id_idx
on public.claims(claimant_id);
```

These are simple and directly support the application's queries.

---

# 68. Query strategy

For matching:

```text
select open found reports
```

or:

```text
select open lost reports
```

Do not fetch returned/closed reports.

For "My Reports":

```text
user_id = current user's ID
```

For "Claims for my reports":

retrieve claims whose report belongs to the current user.

Use Supabase/PostgREST queries rather than raw SQL in the frontend.

---

# 69. Do not trust client-side filtering for security

This is wrong:

```ts
const reports = allReports.filter(
  report => report.user_id === currentUser.id
);
```

and then assuming that means the data is private.

RLS must enforce ownership at the database level.

Client-side filtering is only for presentation.

---

# 70. Test account strategy

Create at least two test users:

```text
student1@example.com
student2@example.com
```

Use strong temporary passwords.

Do not commit test passwords.

Test:

### User 1

Reports:

```text
Lost
Black
Bottle
Library
2026-10-04
```

### User 2

Reports:

```text
Found
Black
Bottle
Library
2026-10-04
```

Expected score:

```text
30 + 20 + 20 + 20 + 10
= 100
```

Then change the found item's location:

```text
Canteen
```

Expected score:

```text
80
```

Then change category:

```text
Books
```

Expected score:

```text
50
```

Since threshold is 60:

```text
100 → match
80  → match
50  → not a match
```

This gives a very easy demonstration.

---

# 71. Automated tests

At minimum, test the matching algorithm.

Test:

```text
same category = +30
different category = +0

same color = +20
different color = +0

same location = +20
different location = +0

same date = +20
one-day difference = +20
two/three-day difference = +10
four-day difference = +0

matching item name = +10
different item name = +0
```

Also test:

```text
maximum score = 100
minimum score = 0
```

Test that the matcher never mutates the input objects.

Test that lost/lost and found/found pairs are rejected.

---

# 72. Manual security tests

With User 1 logged in:

- User 1 can create a report.
- User 1 can edit their report.
- User 1 can delete their report.
- User 1 can mark their report returned.

With User 2 logged in:

- User 2 can read reports.
- User 2 can NOT edit User 1's report.
- User 2 can NOT delete User 1's report.
- User 2 can submit a claim against User 1's found report.
- User 2 cannot edit User 1's claim.
- User 2 cannot change User 1's report owner ID.

Do not consider the project finished until these are tested.

---

# 73. Important race/duplicate protection

Prevent duplicate submissions at the UI level by disabling buttons during requests.

For claims, the database already provides:

```sql
unique (report_id, claimant_id)
```

So even if the UI accidentally submits twice, PostgreSQL prevents duplicate claims.

Handle that database error and display:

```text
You have already submitted a claim for this report.
```

---

# 74. Date handling

This is important.

PostgreSQL `date` is a calendar date.

Do not convert report dates to full timestamps unnecessarily.

Keep:

```text
event_date = "2026-10-04"
```

Use date-only arithmetic in the matcher.

Display dates in a readable form in the UI.

Do not let browser timezone differences turn:

```text
2026-10-04
```

into:

```text
2026-10-03
```

---

# 75. Matching explanation

The UI should explicitly state:

```text
This score indicates similarity based on the application's rules.
It does not prove ownership.
```

This is important both technically and for the project demonstration.

---

# 76. README requirements

Create a README containing:

1. Project title.
2. Problem statement.
3. Features.
4. Technology stack.
5. Database schema.
6. Matching algorithm.
7. Discrete mathematics explanation.
8. Setup instructions.
9. Supabase configuration.
10. Environment variables.
11. Local development instructions.
12. Testing instructions.
13. Deployment instructions.
14. Known limitations.

Include the mathematical definition:

```text
R ⊆ L × F
```

and the equivalence relation:

```text
r1 ~ r2 iff category(r1) = category(r2)
```

---

# 77. Setup workflow

The developer should be able to clone the project and perform approximately:

```bash
npm install
```

Then create `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Then:

```bash
npm run dev
```

If using the Supabase CLI/local database, initialize and run the local stack, apply the migrations, and use the generated local credentials.

The repository must include the migration files so the database can be reproduced rather than relying on undocumented Dashboard changes.

---

# 78. Supabase migration workflow

Use migrations as the source of truth.

When changing the database:

```text
create migration
      ↓
apply/reset locally
      ↓
test
      ↓
generate TypeScript types
      ↓
run typecheck
      ↓
deploy migration
```

Do not manually modify production schema and then try to make the migration history catch up.

---

# 79. Required npm scripts

Configure:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  }
}
```

If the generated Vite template has a different valid TypeScript configuration, preserve its required build setup while ensuring these commands work.

The final project must pass:

```bash
npm run typecheck
npm run build
```

with zero TypeScript errors.

---

# 80. Definition of done

The application is complete only when ALL of the following work.

## Authentication

- [ ] Register
- [ ] Login
- [ ] Logout
- [ ] Session restoration
- [ ] Auth state handling

## Reports

- [ ] Create lost report
- [ ] Create found report
- [ ] Edit own report
- [ ] Delete own report
- [ ] View own reports
- [ ] Browse reports
- [ ] Filter reports
- [ ] Optional image upload
- [ ] Mark report returned

## Matching

- [ ] Lost ↔ found only
- [ ] Category scoring
- [ ] Color scoring
- [ ] Location scoring
- [ ] Date scoring
- [ ] Item-name scoring
- [ ] 100-point maximum
- [ ] 60-point threshold
- [ ] Sorted results
- [ ] Transparent breakdown

## Claims

- [ ] Submit claim
- [ ] Prevent duplicate claim
- [ ] Report owner can view claim
- [ ] Claimant can view own claim
- [ ] Approve
- [ ] Reject
- [ ] Optional verification question
- [ ] Answer verification question

## Security

- [ ] RLS enabled on every application table
- [ ] Users cannot edit other users' reports
- [ ] Users cannot delete other users' reports
- [ ] Users cannot impersonate another owner
- [ ] Users cannot modify another user's claims
- [ ] Storage upload ownership enforced
- [ ] No service-role key in frontend

## Maths

- [ ] Matching relation implemented
- [ ] Relation threshold defined
- [ ] Equivalence relation explained
- [ ] Equivalence classes explained
- [ ] Relation matrix demonstration available
- [ ] Matching score can be explained field by field

## Quality

- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Mobile responsive
- [ ] No console errors
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] RLS tests performed
- [ ] Two-user matching test performed

---

# 81. Final implementation order

Codex must implement in this order.

## Phase 1 — Project setup

1. Create Vite vanilla TypeScript project.
2. Install Supabase JS.
3. Create folder structure.
4. Create `.env.example`.
5. Create Supabase client.
6. Make `npm run dev`, `npm run typecheck`, and `npm run build` work.

## Phase 2 — Database

1. Create migration.
2. Create profiles table.
3. Create reports table.
4. Create claims table.
5. Create claim_questions table.
6. Add constraints.
7. Add indexes.
8. Enable RLS.
9. Add policies.
10. Configure Storage.
11. Test migration.

## Phase 3 — Authentication

1. Register.
2. Login.
3. Logout.
4. Session restore.
5. Auth listener.
6. Profile creation.
7. Protected application views.

## Phase 4 — Reports

1. Report form.
2. Validation.
3. Image upload.
4. Report creation.
5. Browse.
6. My Reports.
7. Edit.
8. Delete.
9. Mark returned.

## Phase 5 — Matching

1. Create TypeScript types.
2. Implement date-only difference.
3. Implement category scoring.
4. Implement color scoring.
5. Implement location scoring.
6. Implement date scoring.
7. Implement item-name scoring.
8. Implement total score.
9. Implement threshold.
10. Implement sorting.
11. Implement matches view.
12. Implement score breakdown.

## Phase 6 — Claims

1. Submit claim.
2. Prevent duplicate claim.
3. Display claimant's claims.
4. Display report owner's claims.
5. Approve.
6. Reject.
7. Verification question.
8. Verification answer.

## Phase 7 — Maths view

1. Explain matching relation.
2. Show sample relation pairs.
3. Explain equivalence relation.
4. Show equivalence classes.
5. Generate relation matrix.

## Phase 8 — Polish

1. Responsive CSS.
2. Loading states.
3. Empty states.
4. Error messages.
5. Confirmation dialogs.
6. Accessibility labels.
7. Remove console debugging.
8. Final typecheck.
9. Final production build.

## Phase 9 — Final testing

Test with two users.

Test matching scores.

Test unauthorized database operations.

Test image upload.

Test claim workflow.

Test mobile layout.

Then deploy.

---

# 82. Critical instructions to Codex

Before writing implementation code:

1. Read this entire specification.
2. Do not introduce React.
3. Do not introduce a custom backend.
4. Do not introduce an AI matching service.
5. Do not create a `matches` table.
6. Do not create duplicate user tables.
7. Do not use a Supabase service-role key in browser code.
8. Do not disable RLS.
9. Do not rely on frontend checks for authorization.
10. Keep PostgreSQL field names and TypeScript database fields consistent.
11. Use migrations for schema changes.
12. Keep the matching algorithm deterministic.
13. Keep date calculations timezone-safe.
14. Keep the UI simple.
15. Run `npm run typecheck`.
16. Run `npm run build`.
17. Fix all errors before considering implementation complete.

If an implementation choice is not specified, choose the simplest option that preserves these requirements.

Do not add complexity merely because it is possible.

The primary success criteria are:

```text
RELIABLE SUPABASE DATABASE
        +
SECURE AUTH/RLS
        +
WORKING LOST/FOUND REPORTS
        +
DETERMINISTIC MATCHING
        +
CLEAR DISCRETE MATHEMATICS CONNECTION
        =
COMPLETED PROJECT
```
