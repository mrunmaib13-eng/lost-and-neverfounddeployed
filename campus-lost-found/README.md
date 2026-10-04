# Campus Lost & Found

A responsive college lost-and-found web application built with **Vite**, **TypeScript**, **plain HTML/CSS**, and **Supabase** (`@supabase/supabase-js`), demonstrating **Discrete Mathematics Module 3** concepts (binary relations, relation matrices, equivalence relations, and equivalence classes).

---

## 1. Problem Statement

Students frequently lose or find items across campus, and matching a lost report with a found report is often informal or relies on unorganized group chats that expose private contact details. **Campus Lost & Found** gives authenticated students a structured, privacy-preserving system to report lost/found items, browse open campus reports, compute deterministic similarity scores, and verify ownership privately via claims and verification questions.

---

## 2. Features

- **Authentication**: Email/password registration, login, logout, session restoration, and automatic profile provisioning via Supabase Auth.
- **Lost & Found Reports**: Create, view, edit, close, mark returned, and delete your own open reports.
- **Image Upload & Rollback**: Optional item image upload (`JPEG`, `PNG`, `WebP`, max 5 MB) stored in the private `report-images` Supabase Storage bucket with automatic rollback if database insertion fails and signed URLs for display.
- **Browse & Client-Side Filtering**: Filter open reports by type (`All`, `Lost`, `Found`), `Category`, `Color`, `Location`, and `Item name` search.
- **Deterministic Matching**: Bidirectional matching (`lost ↔ found`) using a transparent 100-point rule with a 60-point threshold (`MATCH_THRESHOLD = 60`), sorted by score, date proximity, and recency.
- **Private Claims & Ownership Verification**: Submit claims on open found reports, ask and answer verification questions (`claim_questions`), and approve (sequentially marking the report `returned`) or reject claims.
- **Discrete Mathematics View (`Math View`)**: Live relation pairs $(l, f) \in R \subseteq L \times F$, zero-one relation matrix $M_R$, and partition of open reports into category equivalence classes.

---

## 3. Technology Stack

- **Frontend**: Vite, TypeScript, plain HTML, plain CSS
- **Backend / BaaS**: Supabase Auth, Supabase PostgreSQL (with Row Level Security), Supabase Storage
- **Testing**: Vitest (`npm test`)

No frontend UI framework (no React/Vue), no custom Node/Express backend, no Edge Functions, and no AI/ML matching service.

---

## 4. Database Schema

The application uses exactly four PostgreSQL tables defined in `supabase/migrations/001_initial_schema.sql`:

1. `public.profiles` (`id`, `full_name`, `created_at`)
2. `public.reports` (`id`, `user_id`, `type`, `item_name`, `category`, `color`, `location`, `event_date`, `description`, `image_path`, `status`, `created_at`)
3. `public.claims` (`id`, `report_id`, `claimant_id`, `status`, `created_at` — with `unique (report_id, claimant_id)`)
4. `public.claim_questions` (`id`, `claim_id`, `question`, `answer`, `created_at`)

There is no `matches` table — matches are derived dynamically from open reports. Row Level Security (RLS) is enabled on all four tables and on `storage.objects` for the `report-images` bucket.

---

## 5. Matching Algorithm

Only reports with `status = 'open'` participate in matching, and comparisons are strictly between `lost` and `found` reports:

| Criterion | Condition | Points |
| :--- | :--- | :--- |
| **Category** | `lost.category === found.category` | `+30` |
| **Color** | `lost.color === found.color` | `+20` |
| **Location** | `lost.location === found.location` | `+20` |
| **Date (`event_date`)** | `0–1` days apart: `+20` · `2–3` days apart: `+10` · `>3` days: `+0` | `+20` |
| **Item Name** | Normalized substring containment (`a.includes(b) \|\| b.includes(a)`) | `+10` |
| **Total** | Maximum possible score | **`100`** |

- **Threshold**: `MATCH_THRESHOLD = 60`
- **Tie-breaking**: Higher score first $\rightarrow$ smaller calendar date difference first $\rightarrow$ newer report `created_at` first (top 10 displayed).
- **Important**: *Match score $\neq$ proof of ownership.* The score indicates similarity based on the application's rules; report owners verify ownership using `claim_questions` before approving a claim.

---

## 6. Discrete Mathematics Explanation (Module 3)

### Binary Matching Relation ($R \subseteq L \times F$)

Let $L$ be the set of open lost reports and $F$ be the set of open found reports. The matching relation $R$ is a subset of the Cartesian product $L \times F$:

$$R = \{ (l, f) \in L \times F \mid \text{score}(l, f) \ge 60 \}$$

Its zero-one relation matrix $M_R$ has entries:

$$M_R[i, j] = \begin{cases} 1 & \text{if } \text{score}(l_i, f_j) \ge 60 \\ 0 & \text{if } \text{score}(l_i, f_j) < 60 \end{cases}$$

Because $R$ relates elements between two disjoint sets ($L$ and $F$), $R$ is **not** an equivalence relation.

### Category Equivalence Relation ($\sim$) & Equivalence Classes

On the set of reports $S$, define the relation $\sim$ by:

$$r_1 \sim r_2 \iff \text{category}(r_1) = \text{category}(r_2)$$

This relation is an **equivalence relation** because it is:
1. **Reflexive**: $\forall r \in S,\ \text{category}(r) = \text{category}(r) \implies r \sim r$.
2. **Symmetric**: If $r_1 \sim r_2$, then $\text{category}(r_1) = \text{category}(r_2) \implies \text{category}(r_2) = \text{category}(r_1) \implies r_2 \sim r_1$.
3. **Transitive**: If $r_1 \sim r_2$ and $r_2 \sim r_3$, then $\text{category}(r_1) = \text{category}(r_2) = \text{category}(r_3) \implies r_1 \sim r_3$.

Therefore, $\sim$ partitions the reports into disjoint **equivalence classes**:
`[Electronics]`, `[Books]`, `[Bags]`, `[Bottles]`, `[Keys]`, `[ID Cards]`, `[Clothing]`, `[Accessories]`, `[Stationery]`, and `[Other]`.

---

## 7. Setup, Environment Variables & Supabase Configuration

1. Install dependencies:
   ```bash
   cd campus-lost-found
   npm install
   ```
2. Create `.env` from `.env.example`:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
   ```
   *(Never place a Supabase `service_role` key in `.env` or any frontend file.)*
3. Apply `supabase/migrations/001_initial_schema.sql` in your Supabase project's SQL Editor (or via the Supabase CLI).
4. Start the local dev server:
   ```bash
   npm run dev
   ```

---

## 8. Testing & Verification

Run automated unit tests for the deterministic matcher, relation matrix, equivalence classes, and validation:

```bash
npm test
```

Run TypeScript type checking and production build:

```bash
npm run typecheck
npm run build
```

### Classroom Demo Walkthrough (Two-User Test)

1. **User 1** registers and submits a **Lost** report:
   - Item: `Black Bottle`, Category: `Bottles`, Color: `Black`, Location: `Library`, Date: `2026-10-04`
2. **User 2** registers and submits a **Found** report:
   - Item: `Black Bottle`, Category: `Bottles`, Color: `Black`, Location: `Library`, Date: `2026-10-04`
   - **Expected Match Score**: `30 + 20 + 20 + 20 + 10 = 100%` (Match)
3. **User 2** edits the found report's location to `Canteen`:
   - **Expected Match Score**: `80%` (Match)
4. **User 2** edits the found report's category to `Books`:
   - **Expected Match Score**: `50%` (Below `60%` threshold $\rightarrow$ Not a match)

---

## 9. Deployment

1. Build the static bundle:
   ```bash
   npm run build
   ```
2. Deploy the `dist/` directory to any static host (Netlify, Vercel, Cloudflare Pages) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured.

---

## 10. Known Limitations

- Claim approval updates the claim status (`approved`) and report status (`returned`) sequentially from the client under owner RLS authorization rather than inside a single database stored procedure.
- Claims provide single-step ownership verification questions (`claim_questions`) rather than real-time chat.
- Designed and scoped as a college Discrete Mathematics and software engineering demonstration project.
