import {
  CATEGORIES,
  CATEGORY_LABELS,
  COLOR_LABELS,
  COLORS,
  LOCATION_LABELS,
  LOCATIONS,
  MATCH_THRESHOLD,
} from "./constants";
import {
  buildRelationMatrix,
  buildScoreMatrix,
  getRelationPairs,
  groupByCategoryEquivalence,
} from "./matches";
import type {
  BrowseFilters,
  EnrichedClaim,
  MatchResult,
  Profile,
  Report,
  ReportFormInput,
  ReportType,
} from "./types";
import { getTodayDateOnly } from "./validation";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Missing #app root element.");
}

const appElement: HTMLDivElement = appRoot;

export interface ReportFormViewOptions {
  type: ReportType;
  initialValues?: Partial<ReportFormInput>;
  editingReportId?: string | null;
}

export interface MatchesViewOptions {
  matches: MatchResult[];
  selectedReport: Report | null;
  openUserReports: Report[];
  currentUserId: string;
  imageUrls: Record<string, string>;
}

export function setDocument(html: string): void {
  appElement.innerHTML = html;
}

export function showLoading(message = "Loading..."): void {
  setDocument(`
    <main class="app-shell center-shell">
      <section class="panel loading-panel" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="muted">${escapeHtml(message)}</p>
      </section>
    </main>
  `);
}

export function showError(message: string): string {
  return `<div class="notice error" role="alert">${escapeHtml(message)}</div>`;
}

export function showSuccess(message: string): string {
  return `<div class="notice success" role="status">${escapeHtml(message)}</div>`;
}

export function renderLoggedOut(message = ""): void {
  setDocument(`
    <main class="auth-layout">
      <section class="auth-intro">
        <p class="eyebrow">Discrete Mathematics Module 3 Project</p>
        <h1>Campus Lost &amp; Found</h1>
        <p>A secure, deterministic lost-and-found matcher for college students (pre-loaded with demo data, no email verification required).</p>
        <ul class="feature-list">
          <li>Report lost or found items around campus</li>
          <li>Calculate transparent 100-point similarity scores</li>
          <li>Verify ownership privately through claims &amp; questions</li>
          <li>Explore relation matrices &amp; equivalence classes</li>
        </ul>
      </section>
      <section class="auth-panels" aria-label="Authentication forms">
        ${message}
        <section class="panel form-grid">
          <h2>1-Click College Demo Login</h2>
          <p class="muted small-text">Jump right in with pre-populated campus lost &amp; found reports, matches, and claims:</p>
          <div class="action-row">
            <button data-demo-student="1" type="button">Student 1: Pranav B</button>
            <button class="secondary" data-demo-student="2" type="button">Student 2: Mrunmai B</button>
          </div>
        </section>
        <form class="panel form-grid" id="login-form" novalidate>
          <h2>Login (Instant — Any Email)</h2>
          <label for="login-email">Email
            <input id="login-email" name="email" type="email" autocomplete="email" value="student1@campus.edu" placeholder="student1@campus.edu" required />
          </label>
          <label for="login-password">Password
            <input id="login-password" name="password" type="password" autocomplete="current-password" value="password123" minlength="8" required />
          </label>
          <button type="submit" data-original-label="Login">Login</button>
        </form>
        <form class="panel form-grid" id="register-form" novalidate>
          <h2>Register New Student (No Email Verification)</h2>
          <label for="register-name">Full name
            <input id="register-name" name="full_name" type="text" autocomplete="name" minlength="2" maxlength="80" placeholder="Pranav B" required />
          </label>
          <label for="register-email">Email
            <input id="register-email" name="email" type="email" autocomplete="email" placeholder="student@campus.edu" required />
          </label>
          <label for="register-password">Password
            <input id="register-password" name="password" type="password" autocomplete="new-password" minlength="8" value="password123" required />
          </label>
          <button type="submit" data-original-label="Create account">Create account</button>
        </form>
      </section>
    </main>
  `);
}

export function renderShell(
  profile: Profile | null,
  view: string,
  content: string,
  modalHtml = ""
): void {
  const fullName = profile?.full_name.trim() || "Student";
  const firstName = fullName.split(/\s+/)[0] || "Student";
  const isStudent1 = fullName.toLowerCase().includes("pranav");

  setDocument(`
    <div class="app-frame">
      <header class="topbar">
        <button class="brand" data-view="dashboard" type="button">Campus Lost &amp; Found</button>
        <nav aria-label="Main navigation">
          ${navButton("dashboard", "Dashboard", view)}
          ${navButton("browse", "Browse", view)}
          ${navButton("my-reports", "My Reports", view)}
          ${navButton("matches", "Possible Matches", view)}
          ${navButton("claims", "Claims", view)}
          ${navButton("math-view", "Math View", view)}
        </nav>
        <div class="user-strip">
          <span class="user-badge" title="Signed in as ${escapeHtml(fullName)}">${escapeHtml(firstName)}</span>
          <button class="secondary small-button" data-demo-student="${isStudent1 ? "2" : "1"}" type="button" title="Switch demo user to test two-student matching and claims">
            Switch to ${isStudent1 ? "Mrunmai B (User 2)" : "Pranav B (User 1)"}
          </button>
          <button class="secondary small-button" id="reset-demo-button" type="button" title="Restore initial demo dataset">
            Reset Demo Data
          </button>
          <button class="secondary small-button" id="logout-button" type="button">Logout</button>
        </div>
      </header>
      <main class="content-shell">${content}</main>
      <footer class="footer">
        Deterministic matching only (threshold &ge; ${MATCH_THRESHOLD}%). This score indicates similarity based on the application's rules. It does not prove ownership.
      </footer>
      ${modalHtml}
    </div>
  `);
}

export function renderDashboard(
  profile: Profile | null,
  reports: Report[],
  possibleMatches: number,
  pendingClaims: number,
  imageUrls: Record<string, string>,
  currentUserId: string
): string {
  const firstName = profile?.full_name.trim().split(/\s+/)[0] || "Student";
  const openReports = reports.filter((report) => report.status === "open").length;
  const recent = reports.slice(0, 3);

  return `
    <section class="page-header">
      <p class="eyebrow">Dashboard</p>
      <h1>Welcome, ${escapeHtml(firstName)}</h1>
      <p>Report a lost or found item, inspect transparent match scores, or review ownership claims.</p>
      <div class="action-row">
        <button data-view="report-form" data-report-type="lost" type="button">Report Lost Item</button>
        <button class="secondary" data-view="report-form" data-report-type="found" type="button">Report Found Item</button>
      </div>
    </section>
    <section class="stats-grid" aria-label="Quick stats">
      ${statCard("My Open Reports", String(openReports), "my-reports")}
      ${statCard("Possible Matches", String(possibleMatches), "matches")}
      ${statCard("Pending Claims", String(pendingClaims), "claims")}
    </section>
    <section class="section-block">
      <div class="section-title">
        <h2>Recent Reports</h2>
        <button class="secondary" data-view="my-reports" type="button">View all</button>
      </div>
      ${
        recent.length
          ? `<div class="card-grid">${recent
              .map((report) => renderReportCard(report, { ownerActions: true, imageUrls, currentUserId }))
              .join("")}</div>`
          : emptyStateWithActions("You have not submitted any reports yet.", "Start by reporting a lost or found item on campus.")
      }
    </section>
  `;
}

export function renderReportForm(options: ReportFormViewOptions): string {
  const { type, initialValues, editingReportId } = options;
  const isEditing = Boolean(editingReportId);
  const title = isEditing
    ? `Edit ${type === "lost" ? "Lost" : "Found"} Report`
    : type === "lost"
      ? "Report Lost Item"
      : "Report Found Item";

  const itemName = initialValues?.item_name ?? "";
  const category = initialValues?.category ?? "";
  const color = initialValues?.color ?? "";
  const location = initialValues?.location ?? "";
  const eventDate = initialValues?.event_date ?? getTodayDateOnly();
  const description = initialValues?.description ?? "";

  return `
    <section class="page-header">
      <p class="eyebrow">${isEditing ? "Update open report" : type === "lost" ? "Lost item" : "Found item"}</p>
      <h1>${escapeHtml(title)}</h1>
      <p>Standardised categories, colors, and campus locations ensure accurate deterministic matching.</p>
    </section>
    <form class="panel form-grid wide-form" id="report-form" enctype="multipart/form-data" novalidate>
      <input type="hidden" name="type" value="${escapeHtml(type)}" />
      ${editingReportId ? `<input type="hidden" name="edit_report_id" value="${escapeHtml(editingReportId)}" />` : ""}
      <label for="report-item-name">Item name
        <input
          id="report-item-name"
          name="item_name"
          type="text"
          minlength="2"
          maxlength="80"
          placeholder="e.g. Black Water Bottle"
          value="${escapeHtml(itemName)}"
          required
        />
      </label>
      ${selectField("category", "Category", CATEGORIES, CATEGORY_LABELS, category)}
      ${selectField("color", "Color", COLORS, COLOR_LABELS, color)}
      ${selectField("location", "Location", LOCATIONS, LOCATION_LABELS, location)}
      <label for="report-event-date">Date ${type === "lost" ? "lost" : "found"}
        <input
          id="report-event-date"
          name="event_date"
          type="date"
          max="${getTodayDateOnly()}"
          value="${escapeHtml(eventDate)}"
          required
        />
      </label>
      <label class="full-span" for="report-description">Description (5–1000 characters)
        <textarea
          id="report-description"
          name="description"
          rows="4"
          minlength="5"
          maxlength="1000"
          placeholder="Describe distinguishing marks, brand, or where near the location it was lost/found."
          required
        >${escapeHtml(description)}</textarea>
      </label>
      ${
        isEditing
          ? `<p class="muted full-span">Editing updates the open report details used for matching.</p>`
          : `<label class="full-span" for="report-image">Optional item image (JPEG, PNG, or WebP, max 5 MB)
              <input id="report-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
            </label>`
      }
      <div class="form-actions full-span">
        <button type="submit" data-original-label="${isEditing ? "Update report" : "Save report"}">${
          isEditing ? "Update report" : "Save report"
        }</button>
        <button class="secondary" data-view="${isEditing ? "my-reports" : "dashboard"}" type="button">Cancel</button>
      </div>
    </form>
  `;
}

export function renderBrowse(
  reports: Report[],
  filters: BrowseFilters,
  imageUrls: Record<string, string>,
  currentUserId: string
): string {
  return `
    <section class="page-header">
      <p class="eyebrow">Open campus reports</p>
      <h1>Browse Reports</h1>
      <p>Filter active lost and found reports by type, category, color, campus location, or item name.</p>
    </section>
    <section class="panel filter-panel" id="browse-filters" aria-label="Browse filters">
      <div class="filter-top-row">
        <div class="segmented" role="tablist" aria-label="Report type filter">
          <button class="${filters.type === "all" ? "active" : ""}" role="tab" aria-selected="${filters.type === "all"}" data-filter-type="all" type="button">All</button>
          <button class="${filters.type === "lost" ? "active" : ""}" role="tab" aria-selected="${filters.type === "lost"}" data-filter-type="lost" type="button">Lost</button>
          <button class="${filters.type === "found" ? "active" : ""}" role="tab" aria-selected="${filters.type === "found"}" data-filter-type="found" type="button">Found</button>
        </div>
        <div class="search-box">
          <label class="sr-only" for="browse-search">Search item name</label>
          <input
            id="browse-search"
            type="search"
            placeholder="Search item name..."
            aria-label="Search item name"
            value="${escapeHtml(filters.search)}"
          />
        </div>
      </div>
      <div class="filter-select-row">
        ${filterSelectField("browse-category", "Category", CATEGORIES, CATEGORY_LABELS, filters.category)}
        ${filterSelectField("browse-color", "Color", COLORS, COLOR_LABELS, filters.color)}
        ${filterSelectField("browse-location", "Location", LOCATIONS, LOCATION_LABELS, filters.location)}
        <button class="secondary" id="browse-reset" type="button">Reset filters</button>
      </div>
    </section>
    <section id="browse-results">
      ${renderReportList(reports, imageUrls, currentUserId)}
    </section>
  `;
}

export function renderMyReports(
  reports: Report[],
  imageUrls: Record<string, string>,
  currentUserId: string
): string {
  return `
    <section class="page-header">
      <p class="eyebrow">Manage your submissions</p>
      <h1>My Reports</h1>
      <div class="action-row">
        <button data-view="report-form" data-report-type="lost" type="button">Report Lost Item</button>
        <button class="secondary" data-view="report-form" data-report-type="found" type="button">Report Found Item</button>
      </div>
    </section>
    ${
      reports.length
        ? `<div class="card-grid">${reports
            .map((report) => renderReportCard(report, { ownerActions: true, imageUrls, currentUserId }))
            .join("")}</div>`
        : emptyStateWithActions(
            "You have not submitted any reports yet.",
            "Report a lost or found item to start finding matches."
          )
    }
  `;
}

export function renderMatches(options: MatchesViewOptions): string {
  const { matches, selectedReport, openUserReports, currentUserId, imageUrls } = options;

  if (!openUserReports.length) {
    return `
      <section class="page-header">
        <p class="eyebrow">Possible matches</p>
        <h1>Possible Matches</h1>
        <p class="ownership-disclaimer">
          <strong>MATCH SCORE &ne; PROOF OF OWNERSHIP:</strong> This score indicates similarity based on the application's rules. It does not prove ownership.
        </p>
      </section>
      ${emptyStateWithActions(
        "No open reports to match yet.",
        "Create an open lost or found report first so the matcher can compare it against campus reports."
      )}
    `;
  }

  const activeReport = selectedReport ?? openUserReports[0];

  return `
    <section class="page-header">
      <p class="eyebrow">Deterministic matcher (threshold &ge; ${MATCH_THRESHOLD}%)</p>
      <h1>Possible Matches</h1>
      <div class="disclaimer-banner" role="note">
        <strong>MATCH SCORE &ne; PROOF OF OWNERSHIP:</strong>
        This score indicates similarity based on the application's rules. It does not prove ownership.
      </div>
    </section>

    <section class="panel source-selector-panel" aria-label="Selected report for matching">
      <div class="source-selector-header">
        <div>
          <span class="eyebrow">Matching for your open ${escapeHtml(activeReport.type)} report</span>
          <h2>${escapeHtml(activeReport.item_name)}</h2>
          <p class="muted">
            ${CATEGORY_LABELS[activeReport.category]} &bull; ${COLOR_LABELS[activeReport.color]} &bull; ${LOCATION_LABELS[activeReport.location]} &bull; Date: ${escapeHtml(activeReport.event_date)}
          </p>
        </div>
        ${
          openUserReports.length > 1
            ? `<label for="match-source-select">Switch report
                <select id="match-source-select" aria-label="Choose your open report to match">
                  ${openUserReports
                    .map(
                      (r) =>
                        `<option value="${escapeHtml(r.id)}" ${r.id === activeReport.id ? "selected" : ""}>[${r.type.toUpperCase()}] ${escapeHtml(r.item_name)} (${escapeHtml(r.event_date)})</option>`
                    )
                    .join("")}
                </select>
              </label>`
            : ""
        }
      </div>
    </section>

    ${
      matches.length
        ? `<div class="match-list">${matches
            .map((match) => renderMatchCard(match, activeReport, currentUserId, imageUrls))
            .join("")}</div>`
        : emptyState(
            "No possible matches found yet.",
            "Try checking again later as new reports are submitted."
          )
    }
  `;
}

export function renderClaims(
  myClaims: EnrichedClaim[],
  reportClaims: EnrichedClaim[]
): string {
  return `
    <section class="page-header">
      <p class="eyebrow">Private ownership verification</p>
      <h1>Claims</h1>
      <div class="disclaimer-banner" role="note">
        <strong>MATCH SCORE &ne; PROOF OF OWNERSHIP:</strong>
        This score indicates similarity based on the application's rules. It does not prove ownership. Report owners may ask a verification question before approving a claim.
      </div>
    </section>
    <section class="two-column">
      <div class="panel claim-column">
        <h2>Claims I Submitted</h2>
        <p class="muted">Requests you have submitted for found items you believe are yours.</p>
        ${
          myClaims.length
            ? `<div class="claim-stack">${myClaims.map(renderClaimantCard).join("")}</div>`
            : `<div class="empty-inline"><p class="muted">You do not have any pending claims.</p></div>`
        }
      </div>
      <div class="panel claim-column">
        <h2>Claims for My Reports</h2>
        <p class="muted">Review claims on your found reports, ask a verification question, and approve or reject.</p>
        ${
          reportClaims.length
            ? `<div class="claim-stack">${reportClaims.map(renderOwnerClaimCard).join("")}</div>`
            : `<div class="empty-inline"><p class="muted">You do not have any pending claims.</p></div>`
        }
      </div>
    </section>
  `;
}

export function renderMathView(reports: Report[]): string {
  const lostAll = reports.filter((report) => report.type === "lost" && report.status === "open");
  const foundAll = reports.filter((report) => report.type === "found" && report.status === "open");
  const lostMatrixSet = lostAll.slice(0, 5);
  const foundMatrixSet = foundAll.slice(0, 5);
  const relationPairs = getRelationPairs(lostAll, foundAll);
  const equivalenceClasses = groupByCategoryEquivalence(reports);

  return `
    <section class="page-header">
      <p class="eyebrow">Discrete Mathematics Module 3</p>
      <h1>Math View: Relations &amp; Equivalence Classes</h1>
      <p>Live mathematical representation derived dynamically from the current set of open campus reports.</p>
    </section>

    <section class="panel math-panel">
      <h2>1. Matching Sets &amp; Binary Relation (R &sube; L &times; F)</h2>
      <p>
        Let <strong>L</strong> be the set of open lost reports (<strong>|L| = ${lostAll.length}</strong>) and
        <strong>F</strong> be the set of open found reports (<strong>|F| = ${foundAll.length}</strong>).
        The Cartesian product <strong>L &times; F</strong> contains <strong>${lostAll.length * foundAll.length}</strong> ordered pairs.
      </p>
      <div class="formula-box">
        <code>R = { (l, f) &isin; L &times; F &mid; score(l, f) &ge; ${MATCH_THRESHOLD} }</code>
        <span class="muted">score(l, f) = Category(30) + Color(20) + Location(20) + Date(20) + ItemName(10) &isin; [0, 100]</span>
      </div>
      <p class="muted">
        <strong>Note:</strong> The matching relation <code>R &sube; L &times; F</code> is a binary relation between two disjoint sets (lost reports and found reports), so <code>R</code> itself is <em>not</em> an equivalence relation.
      </p>

      <h3>Pairs Currently in R (|R| = ${relationPairs.length})</h3>
      ${
        relationPairs.length
          ? `<div class="relation-pairs-list">
              ${relationPairs
                .slice(0, 10)
                .map(
                  (pair) => `
                    <div class="relation-pair-item">
                      <div>
                        <strong>(${escapeHtml(pair.lostReport.item_name)}, ${escapeHtml(pair.foundReport.item_name)}) &isin; R</strong>
                        <span class="muted">
                          Lost at ${LOCATION_LABELS[pair.lostReport.location]} (${escapeHtml(pair.lostReport.event_date)})
                          &harr; Found at ${LOCATION_LABELS[pair.foundReport.location]} (${escapeHtml(pair.foundReport.event_date)})
                        </span>
                      </div>
                      <div class="pair-score-pill">
                        ${pair.breakdown.category} + ${pair.breakdown.color} + ${pair.breakdown.location} + ${pair.breakdown.date} + ${pair.breakdown.itemName} = <strong>${pair.score}%</strong>
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>`
          : `<p class="muted">No open (l, f) pairs currently reach the threshold of ${MATCH_THRESHOLD}. Add matching open lost and found reports to populate R.</p>`
      }
    </section>

    <section class="panel math-panel">
      <h2>2. Zero-One Relation Matrix M<sub>R</sub></h2>
      <p>
        For row <em>i</em> (lost report <code>l<sub>i</sub> &isin; L</code>) and column <em>j</em> (found report <code>f<sub>j</sub> &isin; F</code>),
        matrix entry <code>M<sub>R</sub>[i, j] = 1</code> if <code>score(l<sub>i</sub>, f<sub>j</sub>) &ge; ${MATCH_THRESHOLD}</code>, and <code>0</code> otherwise.
      </p>
      ${
        lostMatrixSet.length && foundMatrixSet.length
          ? renderMatrix(lostMatrixSet, foundMatrixSet)
          : `<p class="muted">Add at least one open lost report and one open found report to generate the dynamic relation matrix.</p>`
      }
    </section>

    <section class="panel math-panel">
      <h2>3. Category Equivalence Relation (~) &amp; Equivalence Classes</h2>
      <p>
        On the set of reports <strong>S</strong>, define the binary relation <code>r<sub>1</sub> ~ r<sub>2</sub></code> if and only if
        <code>category(r<sub>1</sub>) = category(r<sub>2</sub>)</code>.
      </p>
      <div class="properties-grid">
        <div class="mini-card">
          <strong>Reflexive (r ~ r)</strong>
          <p class="muted">Every report has the same category as itself: category(r) = category(r).</p>
        </div>
        <div class="mini-card">
          <strong>Symmetric (r<sub>1</sub> ~ r<sub>2</sub> &rArr; r<sub>2</sub> ~ r<sub>1</sub>)</strong>
          <p class="muted">If category(r<sub>1</sub>) = category(r<sub>2</sub>), then category(r<sub>2</sub>) = category(r<sub>1</sub>).</p>
        </div>
        <div class="mini-card">
          <strong>Transitive (r<sub>1</sub> ~ r<sub>2</sub> &and; r<sub>2</sub> ~ r<sub>3</sub> &rArr; r<sub>1</sub> ~ r<sub>3</sub>)</strong>
          <p class="muted">If r<sub>1</sub> and r<sub>2</sub> share a category and r<sub>2</sub> and r<sub>3</sub> share a category, then r<sub>1</sub> and r<sub>3</sub> share that category.</p>
        </div>
      </div>
      <h3>Partition of Open Reports into Equivalence Classes</h3>
      <div class="classes-grid">
        ${CATEGORIES.map((category) => {
          const items = equivalenceClasses[category] ?? [];
          return `
            <article class="mini-card equivalence-card ${items.length ? "has-items" : ""}">
              <div class="card-top">
                <strong>[${CATEGORY_LABELS[category]}]</strong>
                <span class="status">${items.length} ${items.length === 1 ? "report" : "reports"}</span>
              </div>
              ${
                items.length
                  ? `<ul class="class-item-list">
                      ${items
                        .map(
                          (item) =>
                            `<li><span class="pill ${item.type}">${item.type === "lost" ? "L" : "F"}</span> ${escapeHtml(item.item_name)} <span class="muted">(${COLOR_LABELS[item.color]})</span></li>`
                        )
                        .join("")}
                    </ul>`
                  : `<p class="muted small-text">&empty; (Empty class)</p>`
              }
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function renderReportList(
  reports: Report[],
  imageUrls: Record<string, string>,
  currentUserId: string
): string {
  return reports.length
    ? `<div class="card-grid">${reports
        .map((report) => renderReportCard(report, { ownerActions: false, imageUrls, currentUserId }))
        .join("")}</div>`
    : emptyState("No reports match your filters.", "Try adjusting your filters or search query.");
}

export function renderReportDetailModal(
  report: Report,
  imageUrls: Record<string, string>,
  currentUserId: string
): string {
  const isOwner = report.user_id === currentUserId;
  const imageUrl = report.image_path ? imageUrls[report.image_path] : null;
  const canClaim = report.type === "found" && report.status === "open" && !isOwner;

  return `
    <div class="modal-backdrop" id="report-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-report-title">
      <article class="panel modal-card">
        <div class="card-top">
          <div>
            <span class="pill ${report.type}">${report.type === "lost" ? "Lost Item" : "Found Item"}</span>
            <span class="status status-${report.status}">${escapeHtml(report.status)}</span>
          </div>
          <button class="secondary" data-close-modal="true" type="button" aria-label="Close report details">Close</button>
        </div>
        <h2 id="modal-report-title">${escapeHtml(report.item_name)}</h2>
        ${
          imageUrl
            ? `<div class="report-image-frame modal-image-frame">
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(report.item_name)}" loading="lazy" />
              </div>`
            : ""
        }
        <dl class="detail-grid">
          <div><dt>Category</dt><dd>${CATEGORY_LABELS[report.category]}</dd></div>
          <div><dt>Color</dt><dd>${COLOR_LABELS[report.color]}</dd></div>
          <div><dt>Location</dt><dd>${LOCATION_LABELS[report.location]}</dd></div>
          <div><dt>Date ${report.type === "lost" ? "Lost" : "Found"}</dt><dd>${escapeHtml(report.event_date)}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(report.status)}</dd></div>
          <div><dt>Reported On</dt><dd>${escapeHtml(formatCalendarTimestamp(report.created_at))}</dd></div>
        </dl>
        <div class="description-box">
          <h3>Description</h3>
          <p>${escapeHtml(report.description)}</p>
        </div>
        <div class="card-actions">
          ${
            canClaim
              ? `<button data-submit-claim="${escapeHtml(report.id)}" type="button">Submit Claim</button>`
              : ""
          }
          ${
            isOwner && report.status === "open"
              ? `
                <button class="secondary" data-find-matches="${escapeHtml(report.id)}" type="button">Find Matches</button>
                <button class="secondary" data-edit-report="${escapeHtml(report.id)}" type="button">Edit</button>
                <button class="secondary" data-mark-returned="${escapeHtml(report.id)}" type="button">Mark Returned</button>
              `
              : ""
          }
          <button class="secondary" data-close-modal="true" type="button">Done</button>
        </div>
      </article>
    </div>
  `;
}

interface ReportCardOptions {
  ownerActions: boolean;
  imageUrls: Record<string, string>;
  currentUserId: string;
}

function renderReportCard(report: Report, options: ReportCardOptions): string {
  const { ownerActions, imageUrls, currentUserId } = options;
  const label = report.type === "lost" ? "Lost" : "Found";
  const imageUrl = report.image_path ? imageUrls[report.image_path] : null;
  const isOwner = report.user_id === currentUserId;
  const canClaimInBrowse = !ownerActions && report.type === "found" && report.status === "open" && !isOwner;

  const actionsHtml = ownerActions
    ? `<div class="card-actions">
        <button class="secondary" data-view-report="${escapeHtml(report.id)}" type="button">View</button>
        ${
          report.status === "open"
            ? `
              <button data-find-matches="${escapeHtml(report.id)}" type="button">Find Matches</button>
              <button class="secondary" data-edit-report="${escapeHtml(report.id)}" type="button">Edit</button>
              <button class="secondary" data-mark-returned="${escapeHtml(report.id)}" type="button">Mark Returned</button>
              <button class="secondary" data-close-report="${escapeHtml(report.id)}" type="button">Close</button>
              <button class="danger" data-delete-report="${escapeHtml(report.id)}" type="button">Delete</button>
            `
            : ""
        }
      </div>`
    : `<div class="card-actions">
        <button class="secondary" data-view-report="${escapeHtml(report.id)}" type="button">View Report</button>
        ${
          canClaimInBrowse
            ? `<button data-submit-claim="${escapeHtml(report.id)}" type="button">Submit Claim</button>`
            : ""
        }
      </div>`;

  return `
    <article class="report-card" data-report-type="${escapeHtml(report.type)}" data-report-name="${escapeHtml(report.item_name.toLowerCase())}">
      <div class="card-top">
        <span class="pill ${report.type}">${label}</span>
        <span class="status status-${report.status}">${escapeHtml(report.status)}</span>
      </div>
      ${
        imageUrl
          ? `<div class="report-image-frame">
              <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(report.item_name)}" loading="lazy" />
            </div>`
          : ""
      }
      <h3>${escapeHtml(report.item_name)}</h3>
      <dl>
        <div><dt>Category</dt><dd>${CATEGORY_LABELS[report.category]}</dd></div>
        <div><dt>Color</dt><dd>${COLOR_LABELS[report.color]}</dd></div>
        <div><dt>Location</dt><dd>${LOCATION_LABELS[report.location]}</dd></div>
        <div><dt>Date</dt><dd>${escapeHtml(report.event_date)}</dd></div>
        ${
          ownerActions
            ? `<div class="full-span-dl"><dt>Created</dt><dd>${escapeHtml(formatCalendarTimestamp(report.created_at))}</dd></div>`
            : ""
        }
      </dl>
      <p class="card-description">${escapeHtml(report.description)}</p>
      ${actionsHtml}
    </article>
  `;
}

function renderMatchCard(
  match: MatchResult,
  sourceReport: Report,
  currentUserId: string,
  imageUrls: Record<string, string>
): string {
  const candidate = sourceReport.type === "lost" ? match.foundReport : match.lostReport;
  const candidateRoleLabel = candidate.type === "found" ? "Found Item" : "Lost Item";
  const imageUrl = candidate.image_path ? imageUrls[candidate.image_path] : null;
  const b = match.breakdown;

  const canClaimFoundReport =
    match.foundReport.status === "open" && match.foundReport.user_id !== currentUserId;

  const dateExplanation =
    b.date === 20
      ? `✓ Date within 1 day (${match.dateDifference}d diff)`
      : b.date === 10
        ? `✓ Date within 2–3 days (${match.dateDifference}d diff)`
        : `✗ Date more than 3 days apart (${match.dateDifference}d diff)`;

  return `
    <article class="report-card match-card">
      <div class="match-card-header">
        <div>
          <span class="pill ${candidate.type}">${candidateRoleLabel}</span>
          <h3>${escapeHtml(candidate.item_name)}</h3>
        </div>
        <div class="score-badge" aria-label="Match Score ${match.score} percent">
          <span>Match Score</span>
          <strong>${match.score}%</strong>
        </div>
      </div>
      ${
        imageUrl
          ? `<div class="report-image-frame">
              <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(candidate.item_name)}" loading="lazy" />
            </div>`
          : ""
      }
      <dl>
        <div><dt>Category</dt><dd>${CATEGORY_LABELS[candidate.category]}</dd></div>
        <div><dt>Color</dt><dd>${COLOR_LABELS[candidate.color]}</dd></div>
        <div><dt>Location</dt><dd>${LOCATION_LABELS[candidate.location]}</dd></div>
        <div><dt>Date</dt><dd>${escapeHtml(candidate.event_date)}</dd></div>
      </dl>
      <p class="card-description">${escapeHtml(candidate.description)}</p>
      <div class="breakdown-box">
        <h4>Why this matches:</h4>
        <ul class="breakdown">
          <li class="${b.category > 0 ? "matched" : "unmatched"}">
            <span>${b.category > 0 ? "✓ Same category" : "✗ Different category"}</span>
            <strong>+${b.category}</strong>
          </li>
          <li class="${b.color > 0 ? "matched" : "unmatched"}">
            <span>${b.color > 0 ? "✓ Same color" : "✗ Different color"}</span>
            <strong>+${b.color}</strong>
          </li>
          <li class="${b.location > 0 ? "matched" : "unmatched"}">
            <span>${b.location > 0 ? "✓ Same location" : "✗ Different location"}</span>
            <strong>+${b.location}</strong>
          </li>
          <li class="${b.date > 0 ? "matched" : "unmatched"}">
            <span>${escapeHtml(dateExplanation)}</span>
            <strong>+${b.date}</strong>
          </li>
          <li class="${b.itemName > 0 ? "matched" : "unmatched"}">
            <span>${b.itemName > 0 ? "✓ Similar item name" : "✗ Different item name"}</span>
            <strong>+${b.itemName}</strong>
          </li>
          <li class="breakdown-total">
            <span>Total Similarity Score</span>
            <strong>${match.score} / 100</strong>
          </li>
        </ul>
      </div>
      <div class="card-actions">
        <button class="secondary" data-view-report="${escapeHtml(candidate.id)}" type="button">View Report</button>
        ${
          canClaimFoundReport
            ? `<button data-submit-claim="${escapeHtml(match.foundReport.id)}" type="button">Submit Claim</button>`
            : `<span class="muted small-text">You own the found report in this pair. The lost-item owner can submit a claim.</span>`
        }
      </div>
    </article>
  `;
}

function renderClaimantCard(enriched: EnrichedClaim): string {
  const { claim, report, questions } = enriched;
  const reportTitle = report ? report.item_name : `Report ${claim.report_id.slice(0, 8)}`;

  return `
    <article class="mini-card claim-card">
      <div class="card-top">
        <span class="status status-${claim.status}">Claim: ${escapeHtml(claim.status)}</span>
        <span class="muted small-text">${escapeHtml(formatCalendarTimestamp(claim.created_at))}</span>
      </div>
      <h3>${escapeHtml(reportTitle)}</h3>
      ${
        report
          ? `<p class="muted small-text">
              ${CATEGORY_LABELS[report.category]} &bull; ${COLOR_LABELS[report.color]} &bull; ${LOCATION_LABELS[report.location]} &bull; Date: ${escapeHtml(report.event_date)} &bull; Report status: <strong>${escapeHtml(report.status)}</strong>
            </p>`
          : ""
      }
      <div class="question-section">
        <h4>Verification Questions</h4>
        ${
          questions.length
            ? questions
                .map(
                  (q) => `
                    <div class="qa-block">
                      <p class="qa-question"><strong>Owner asks:</strong> ${escapeHtml(q.question)}</p>
                      ${
                        q.answer
                          ? `<p class="qa-answer"><strong>Your answer:</strong> ${escapeHtml(q.answer)}</p>`
                          : claim.status === "pending"
                            ? `<form class="claim-answer-form form-grid" data-question-id="${escapeHtml(q.id)}">
                                <label>Your verification answer
                                  <input name="answer" type="text" minlength="1" maxlength="1000" placeholder="e.g. A small red star sticker on the base." required />
                                </label>
                                <button type="submit" data-original-label="Submit Answer">Submit Answer</button>
                              </form>`
                            : `<p class="muted small-text">No answer submitted.</p>`
                      }
                    </div>
                  `
                )
                .join("")
            : `<p class="muted small-text">The report owner has not asked a verification question yet.</p>`
        }
      </div>
      ${
        report
          ? `<div class="card-actions">
              <button class="secondary" data-view-report="${escapeHtml(report.id)}" type="button">View Report</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderOwnerClaimCard(enriched: EnrichedClaim): string {
  const { claim, report, questions } = enriched;
  const reportTitle = report ? report.item_name : `Report ${claim.report_id.slice(0, 8)}`;

  return `
    <article class="mini-card claim-card">
      <div class="card-top">
        <span class="status status-${claim.status}">${claim.status === "pending" ? "New Claim (pending)" : `Claim: ${escapeHtml(claim.status)}`}</span>
        <span class="muted small-text">${escapeHtml(formatCalendarTimestamp(claim.created_at))}</span>
      </div>
      <h3>${escapeHtml(reportTitle)}</h3>
      ${
        report
          ? `<p class="muted small-text">
              ${CATEGORY_LABELS[report.category]} &bull; ${COLOR_LABELS[report.color]} &bull; ${LOCATION_LABELS[report.location]} &bull; Date: ${escapeHtml(report.event_date)} &bull; Report status: <strong>${escapeHtml(report.status)}</strong>
            </p>`
          : ""
      }

      <div class="question-section">
        <h4>Ownership Verification Q&amp;A</h4>
        ${
          questions.length
            ? questions
                .map(
                  (q) => `
                    <div class="qa-block">
                      <p class="qa-question"><strong>Question:</strong> ${escapeHtml(q.question)}</p>
                      ${
                        q.answer
                          ? `<p class="qa-answer"><strong>Claimant's answer:</strong> ${escapeHtml(q.answer)}</p>`
                          : `<p class="muted small-text">Awaiting claimant's answer...</p>`
                      }
                    </div>
                  `
                )
                .join("")
            : `<p class="muted small-text">No verification question asked yet.</p>`
        }

        ${
          claim.status === "pending"
            ? `<form class="claim-question-form form-grid" data-claim-id="${escapeHtml(claim.id)}">
                <label>Ask an ownership-verification question (5–500 chars)
                  <input name="question" type="text" minlength="5" maxlength="500" placeholder="What sticker is on the side of the bottle?" required />
                </label>
                <button class="secondary" type="submit" data-original-label="Send Question">Send Question</button>
              </form>`
            : ""
        }
      </div>

      ${
        claim.status === "pending"
          ? `<div class="card-actions">
              <button data-approve-claim="${escapeHtml(claim.id)}" data-report-id="${escapeHtml(claim.report_id)}" type="button">Approve &amp; Mark Returned</button>
              <button class="secondary" data-reject-claim="${escapeHtml(claim.id)}" type="button">Reject</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderMatrix(lost: Report[], found: Report[]): string {
  const binaryMatrix = buildRelationMatrix(lost, found);
  const scoreMatrix = buildScoreMatrix(lost, found);

  const header = found
    .map(
      (f, index) =>
        `<th scope="col">Found ${index + 1}<span class="matrix-sub">${escapeHtml(f.item_name)}</span></th>`
    )
    .join("");

  const rows = lost
    .map((l, rowIndex) => {
      const cells = found
        .map((_, colIndex) => {
          const bit = binaryMatrix[rowIndex][colIndex];
          const score = scoreMatrix[rowIndex][colIndex];
          return `<td class="${bit === 1 ? "matrix-one" : "matrix-zero"}" data-matrix-cell="${escapeHtml(l.id)}">
            <strong>${bit}</strong>
            <span class="matrix-sub">(${score}%)</span>
          </td>`;
        })
        .join("");
      return `<tr><th scope="row">Lost ${rowIndex + 1}<span class="matrix-sub">${escapeHtml(l.item_name)}</span></th>${cells}</tr>`;
    })
    .join("");

  return `
    <div class="table-wrap">
      <table class="matrix-table">
        <thead>
          <tr>
            <th>R &sube; L &times; F</th>
            ${header}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted small-text">1 = score &ge; ${MATCH_THRESHOLD} (pair belongs to relation R); 0 = score &lt; ${MATCH_THRESHOLD}.</p>
  `;
}

function navButton(target: string, label: string, current: string): string {
  const isActive = target === current;
  return `<button class="nav-button ${isActive ? "active" : ""}" ${isActive ? 'aria-current="page"' : ""} data-view="${target}" type="button">${label}</button>`;
}

function statCard(label: string, value: string, targetView: string): string {
  return `
    <article class="stat-card">
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
      <button class="secondary small-button" data-view="${escapeHtml(targetView)}" type="button">Open</button>
    </article>
  `;
}

function selectField(
  name: string,
  label: string,
  values: readonly string[],
  labels: Record<string, string>,
  selectedValue = ""
): string {
  return `
    <label for="field-${escapeHtml(name)}">${escapeHtml(label)}
      <select id="field-${escapeHtml(name)}" name="${escapeHtml(name)}" required>
        <option value="">Choose ${escapeHtml(label.toLowerCase())}</option>
        ${values
          .map(
            (value) =>
              `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(labels[value])}</option>`
          )
          .join("")}
      </select>
    </label>
  `;
}

function filterSelectField(
  id: string,
  label: string,
  values: readonly string[],
  labels: Record<string, string>,
  selectedValue = ""
): string {
  return `
    <label for="${escapeHtml(id)}">${escapeHtml(label)}
      <select id="${escapeHtml(id)}">
        <option value="">All ${escapeHtml(label.toLowerCase())}s</option>
        ${values
          .map(
            (value) =>
              `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(labels[value])}</option>`
          )
          .join("")}
      </select>
    </label>
  `;
}

function emptyState(title: string, body: string): string {
  return `<div class="empty-state"><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(body)}</p></div>`;
}

function emptyStateWithActions(title: string, body: string): string {
  return `
    <div class="empty-state">
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">${escapeHtml(body)}</p>
      <div class="action-row center-actions">
        <button data-view="report-form" data-report-type="lost" type="button">Report Lost Item</button>
        <button class="secondary" data-view="report-form" data-report-type="found" type="button">Report Found Item</button>
      </div>
    </div>
  `;
}

function formatCalendarTimestamp(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char
  );
}
