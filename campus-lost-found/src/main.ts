import "./style.css";
import {
  ensureProfile,
  getCurrentSession,
  getCurrentUser,
  listenForAuthChanges,
  login,
  loginAsDemoStudent,
  logout,
  register,
} from "./auth";
import { resetDemoDb } from "./supabase";
import {
  answerClaimQuestion,
  approveClaim,
  createClaim,
  createClaimQuestion,
  getClaimsForMyReports,
  getMyClaims,
  getQuestionsForClaims,
  rejectClaim,
} from "./claims";
import { MATCH_THRESHOLD } from "./constants";
import {
  calculateMatch,
  findMatchesForFoundReport,
  findMatchesForLostReport,
} from "./matches";
import {
  closeReport,
  createReport,
  deleteReport,
  getMyReports,
  getOpenReports,
  getReportById,
  getReportsByIds,
  markReportReturned,
  updateReport,
} from "./reports";
import {
  deleteReportImage,
  resolveReportImageUrls,
  uploadReportImage,
} from "./storage";
import type {
  BrowseFilters,
  CampusLocation,
  Category,
  Claim,
  Color,
  EnrichedClaim,
  Profile,
  Report,
  ReportFormInput,
  ReportType,
} from "./types";
import {
  renderBrowse,
  renderClaims,
  renderDashboard,
  renderLoggedOut,
  renderMathView,
  renderMatches,
  renderMyReports,
  renderReportDetailModal,
  renderReportForm,
  renderReportList,
  renderShell,
  showError,
  showLoading,
  showSuccess,
} from "./ui";
import {
  cleanReportInput,
  validateClaimAnswer,
  validateClaimQuestion,
  validateEmail,
  validateFullName,
  validateImage,
  validatePassword,
  validateReportForm,
} from "./validation";

type ViewName =
  | "dashboard"
  | "report-form"
  | "browse"
  | "my-reports"
  | "matches"
  | "claims"
  | "math-view";

let currentProfile: Profile | null = null;
let currentUserId: string | null = null;
let currentView: ViewName = "dashboard";
let lastRenderedContent = "";
let cachedOpenReports: Report[] = [];
let cachedImageUrls: Record<string, string> = {};
let pendingReportType: ReportType = "lost";
let editingReportId: string | null = null;
let editingReportValues: Partial<ReportFormInput> | undefined = undefined;
let selectedMatchReportId: string | null = null;

const defaultBrowseFilters: BrowseFilters = {
  type: "all",
  category: "",
  color: "",
  location: "",
  search: "",
};

let browseFilters: BrowseFilters = { ...defaultBrowseFilters };

void startApp();

async function startApp(): Promise<void> {
  showLoading("Starting Campus Lost & Found...");
  const session = await getCurrentSession();

  if (!session?.user) {
    renderLoggedOut();
  } else {
    currentUserId = session.user.id;
    currentProfile = await ensureProfile(session.user);
    await setView("dashboard");
  }

  listenForAuthChanges((_event, nextSession) => {
    const nextUserId = nextSession?.user.id ?? null;
    if (nextUserId === currentUserId) {
      return;
    }
    void handleAuthChange(nextSession?.user ?? null);
  });

  document.addEventListener("click", (event) => {
    void handleClick(event);
  });
  document.addEventListener("submit", (event) => {
    void handleSubmit(event);
  });
  document.addEventListener("input", handleInput);
  document.addEventListener("change", (event) => {
    void handleChange(event);
  });
}

async function handleAuthChange(user: Awaited<ReturnType<typeof getCurrentUser>>): Promise<void> {
  if (!user) {
    currentUserId = null;
    currentProfile = null;
    renderLoggedOut();
    return;
  }

  currentUserId = user.id;
  currentProfile = await ensureProfile(user);
  await setView("dashboard");
}

function renderCurrentShell(content: string, modalHtml = ""): void {
  lastRenderedContent = content;
  renderShell(currentProfile, currentView, content, modalHtml);
}

async function setView(view: ViewName, message = ""): Promise<void> {
  currentView = view;
  const user = await getCurrentUser();

  if (!user) {
    currentUserId = null;
    currentProfile = null;
    renderLoggedOut(showError("You must be logged in to view this page."));
    return;
  }

  currentUserId = user.id;
  if (!currentProfile) {
    currentProfile = await ensureProfile(user);
  }

  try {
    if (view === "dashboard") {
      renderCurrentShell(`<p class="muted">Loading dashboard...</p>`);
      const [myReports, openReports, myClaims, ownerClaims] = await Promise.all([
        getMyReports(user.id),
        getOpenReports(),
        getMyClaims(user.id),
        getClaimsForMyReports(user.id),
      ]);
      cachedOpenReports = openReports;
      const recentReports = myReports.slice(0, 3);
      const imageUrls = await resolveReportImageUrls(recentReports);
      cachedImageUrls = { ...cachedImageUrls, ...imageUrls };

      const possibleMatches = countUniquePossibleMatches(myReports, openReports);
      const pendingClaims =
        myClaims.filter((c) => c.status === "pending").length +
        ownerClaims.filter((c) => c.status === "pending").length;

      renderCurrentShell(
        `${message}${renderDashboard(
          currentProfile,
          myReports,
          possibleMatches,
          pendingClaims,
          cachedImageUrls,
          user.id
        )}`
      );
      return;
    }

    if (view === "report-form") {
      renderCurrentShell(
        `${message}${renderReportForm({
          type: pendingReportType,
          initialValues: editingReportValues,
          editingReportId,
        })}`
      );
      return;
    }

    if (view === "browse") {
      renderCurrentShell(`<p class="muted">Loading reports...</p>`);
      cachedOpenReports = await getOpenReports();
      const imageUrls = await resolveReportImageUrls(cachedOpenReports);
      cachedImageUrls = { ...cachedImageUrls, ...imageUrls };
      const filtered = applyBrowseFilters(cachedOpenReports, browseFilters);
      renderCurrentShell(
        `${message}${renderBrowse(filtered, browseFilters, cachedImageUrls, user.id)}`
      );
      return;
    }

    if (view === "my-reports") {
      renderCurrentShell(`<p class="muted">Loading your reports...</p>`);
      const myReports = await getMyReports(user.id);
      const imageUrls = await resolveReportImageUrls(myReports);
      cachedImageUrls = { ...cachedImageUrls, ...imageUrls };
      renderCurrentShell(
        `${message}${renderMyReports(myReports, cachedImageUrls, user.id)}`
      );
      return;
    }

    if (view === "matches") {
      renderCurrentShell(`<p class="muted">Finding matches...</p>`);
      const myReports = await getMyReports(user.id);
      const openUserReports = myReports.filter((r) => r.status === "open");

      if (!openUserReports.length) {
        renderCurrentShell(
          `${message}${renderMatches({
            matches: [],
            selectedReport: null,
            openUserReports: [],
            currentUserId: user.id,
            imageUrls: cachedImageUrls,
          })}`
        );
        return;
      }

      const selectedReport =
        openUserReports.find((r) => r.id === selectedMatchReportId) ??
        openUserReports.find((r) => r.type === "lost") ??
        openUserReports[0];

      selectedMatchReportId = selectedReport.id;

      const matches =
        selectedReport.type === "lost"
          ? await findMatchesForLostReport(selectedReport)
          : await findMatchesForFoundReport(selectedReport);

      const candidateReports = matches.map((m) =>
        selectedReport.type === "lost" ? m.foundReport : m.lostReport
      );
      const imageUrls = await resolveReportImageUrls(candidateReports);
      cachedImageUrls = { ...cachedImageUrls, ...imageUrls };

      renderCurrentShell(
        `${message}${renderMatches({
          matches,
          selectedReport,
          openUserReports,
          currentUserId: user.id,
          imageUrls: cachedImageUrls,
        })}`
      );
      return;
    }

    if (view === "claims") {
      renderCurrentShell(`<p class="muted">Loading claims...</p>`);
      const [myClaims, ownerClaims] = await Promise.all([
        getMyClaims(user.id),
        getClaimsForMyReports(user.id),
      ]);

      const allClaims = [...myClaims, ...ownerClaims];
      const reportIds = Array.from(new Set(allClaims.map((c) => c.report_id)));
      const claimIds = Array.from(new Set(allClaims.map((c) => c.id)));

      const [reportsById, questionsByClaimId] = await Promise.all([
        getReportsByIds(reportIds),
        getQuestionsForClaims(claimIds),
      ]);

      const enrich = (claims: Claim[]): EnrichedClaim[] =>
        claims.map((claim) => ({
          claim,
          report: reportsById[claim.report_id] ?? null,
          questions: questionsByClaimId[claim.id] ?? [],
        }));

      renderCurrentShell(
        `${message}${renderClaims(enrich(myClaims), enrich(ownerClaims))}`
      );
      return;
    }

    if (view === "math-view") {
      renderCurrentShell(`<p class="muted">Calculating relation matrices &amp; equivalence classes...</p>`);
      cachedOpenReports = await getOpenReports();
      renderCurrentShell(`${message}${renderMathView(cachedOpenReports)}`);
      return;
    }
  } catch (error) {
    renderCurrentShell(showError(readError(error)));
  }
}

function countUniquePossibleMatches(myReports: Report[], openReports: Report[]): number {
  const myOpen = myReports.filter((r) => r.status === "open");
  if (!myOpen.length) return 0;

  const openLost = openReports.filter((r) => r.type === "lost" && r.status === "open");
  const openFound = openReports.filter((r) => r.type === "found" && r.status === "open");

  let count = 0;
  for (const mine of myOpen) {
    if (mine.type === "lost") {
      for (const found of openFound) {
        if (calculateMatch(mine, found).score >= MATCH_THRESHOLD) {
          count += 1;
        }
      }
    } else {
      for (const lost of openLost) {
        if (calculateMatch(lost, mine).score >= MATCH_THRESHOLD) {
          count += 1;
        }
      }
    }
  }
  return count;
}

function applyBrowseFilters(reports: Report[], filters: BrowseFilters): Report[] {
  const query = filters.search.trim().toLowerCase();
  return reports.filter((report) => {
    if (filters.type !== "all" && report.type !== filters.type) return false;
    if (filters.category && report.category !== filters.category) return false;
    if (filters.color && report.color !== filters.color) return false;
    if (filters.location && report.location !== filters.location) return false;
    if (query && !report.item_name.toLowerCase().includes(query)) return false;
    return true;
  });
}

function updateBrowseResultsDom(): void {
  if (currentView !== "browse" || !currentUserId) return;
  const resultsEl = document.querySelector<HTMLElement>("#browse-results");
  if (!resultsEl) return;

  const filtered = applyBrowseFilters(cachedOpenReports, browseFilters);
  resultsEl.innerHTML = renderReportList(filtered, cachedImageUrls, currentUserId);
}

async function handleClick(event: MouseEvent): Promise<void> {
  const target = event.target as HTMLElement;

  if (
    target.id === "report-modal-backdrop" ||
    target.closest<HTMLElement>("[data-close-modal]")
  ) {
    renderShell(currentProfile, currentView, lastRenderedContent, "");
    return;
  }

  const viewButton = target.closest<HTMLElement>("[data-view]");
  if (viewButton) {
    const view = viewButton.dataset.view as ViewName;
    const reportType = viewButton.dataset.reportType as ReportType | undefined;
    if (view === "report-form") {
      editingReportId = null;
      editingReportValues = undefined;
      if (reportType) {
        pendingReportType = reportType;
      }
    }
    await setView(view);
    return;
  }

  const filterTypeButton = target.closest<HTMLElement>("[data-filter-type]");
  if (filterTypeButton && currentView === "browse") {
    const nextType = filterTypeButton.dataset.filterType as BrowseFilters["type"];
    browseFilters.type = nextType;
    document.querySelectorAll<HTMLElement>("[data-filter-type]").forEach((btn) => {
      const isSelected = btn.dataset.filterType === nextType;
      btn.classList.toggle("active", isSelected);
      btn.setAttribute("aria-selected", String(isSelected));
    });
    updateBrowseResultsDom();
    return;
  }

  if (target.closest("#browse-reset") && currentView === "browse") {
    browseFilters = { ...defaultBrowseFilters };
    if (currentUserId) {
      renderCurrentShell(
        renderBrowse(cachedOpenReports, browseFilters, cachedImageUrls, currentUserId)
      );
    }
    return;
  }

  const demoStudentButton = target.closest<HTMLButtonElement>("[data-demo-student]");
  if (demoStudentButton?.dataset.demoStudent) {
    const num = demoStudentButton.dataset.demoStudent === "2" ? 2 : 1;
    const user = await loginAsDemoStudent(num);
    currentUserId = user.id;
    currentProfile = await ensureProfile(user);
    selectedMatchReportId = null;
    await setView(
      currentView,
      showSuccess(`Signed in as ${currentProfile?.full_name ?? "Demo Student"}.`)
    );
    return;
  }

  const resetDemoButton = target.closest<HTMLButtonElement>("#reset-demo-button");
  if (resetDemoButton) {
    if (!confirm("Reset all demo reports, claims, and verification questions back to initial sample data?")) {
      return;
    }
    await resetDemoDb();
    selectedMatchReportId = null;
    const user = await getCurrentUser();
    if (user) {
      currentProfile = await ensureProfile(user);
    }
    await setView(currentView, showSuccess("Demo data restored to initial state."));
    return;
  }

  const logoutButton = target.closest<HTMLButtonElement>("#logout-button");
  if (logoutButton) {
    setButtonBusy(logoutButton, true, "Logging out...");
    try {
      await logout();
      currentUserId = null;
      currentProfile = null;
      renderLoggedOut(showSuccess("You have logged out."));
    } catch (error) {
      setButtonBusy(logoutButton, false);
      renderCurrentShell(`${showError(readError(error))}${lastRenderedContent}`);
    }
    return;
  }

  const viewReportButton = target.closest<HTMLButtonElement>("[data-view-report]");
  if (viewReportButton?.dataset.viewReport) {
    await openReportModal(viewReportButton.dataset.viewReport, viewReportButton);
    return;
  }

  const findButton = target.closest<HTMLButtonElement>("[data-find-matches]");
  if (findButton?.dataset.findMatches) {
    selectedMatchReportId = findButton.dataset.findMatches;
    await setView("matches");
    return;
  }

  const editButton = target.closest<HTMLButtonElement>("[data-edit-report]");
  if (editButton?.dataset.editReport) {
    await startEditingReport(editButton.dataset.editReport, editButton);
    return;
  }

  const returnedButton = target.closest<HTMLButtonElement>("[data-mark-returned]");
  if (returnedButton?.dataset.markReturned) {
    if (!confirm("Mark this report as returned? It will no longer participate in new matches.")) {
      return;
    }
    setButtonBusy(returnedButton, true, "Updating...");
    try {
      await markReportReturned(returnedButton.dataset.markReturned);
      await setView("my-reports", showSuccess("Report marked as returned."));
    } catch (error) {
      setButtonBusy(returnedButton, false);
      await setView("my-reports", showError(readError(error)));
    }
    return;
  }

  const closeButton = target.closest<HTMLButtonElement>("[data-close-report]");
  if (closeButton?.dataset.closeReport) {
    if (!confirm("Close this open report? Closed reports do not participate in matching.")) {
      return;
    }
    setButtonBusy(closeButton, true, "Closing...");
    try {
      await closeReport(closeButton.dataset.closeReport);
      await setView("my-reports", showSuccess("Report closed."));
    } catch (error) {
      setButtonBusy(closeButton, false);
      await setView("my-reports", showError(readError(error)));
    }
    return;
  }

  const deleteButton = target.closest<HTMLButtonElement>("[data-delete-report]");
  if (deleteButton?.dataset.deleteReport) {
    if (!confirm("Delete this open report permanently?")) {
      return;
    }
    const reportId = deleteButton.dataset.deleteReport;
    setButtonBusy(deleteButton, true, "Deleting...");
    try {
      const existing = await getReportById(reportId);
      await deleteReport(reportId);
      if (existing?.image_path) {
        await deleteReportImage(existing.image_path).catch((err: unknown) =>
          console.error("Image cleanup after report deletion failed", err)
        );
      }
      await setView("my-reports", showSuccess("Report deleted."));
    } catch (error) {
      setButtonBusy(deleteButton, false);
      await setView("my-reports", showError(readError(error)));
    }
    return;
  }

  const claimButton = target.closest<HTMLButtonElement>("[data-submit-claim]");
  if (claimButton?.dataset.submitClaim) {
    const user = await getCurrentUser();
    if (!user) {
      renderLoggedOut(showError("You must be logged in to submit a claim."));
      return;
    }
    setButtonBusy(claimButton, true, "Submitting claim...");
    try {
      await createClaim(claimButton.dataset.submitClaim, user.id);
      await setView(
        "claims",
        showSuccess("Claim submitted. The found-report owner can now review it.")
      );
    } catch (error) {
      setButtonBusy(claimButton, false);
      renderCurrentShell(`${showError(readError(error))}${lastRenderedContent}`);
    }
    return;
  }

  const approveButton = target.closest<HTMLButtonElement>("[data-approve-claim]");
  if (approveButton?.dataset.approveClaim && approveButton.dataset.reportId) {
    if (!confirm("Approve this claim and mark the found report as returned?")) {
      return;
    }
    setButtonBusy(approveButton, true, "Approving...");
    try {
      await approveClaim(approveButton.dataset.approveClaim, approveButton.dataset.reportId);
      await setView("claims", showSuccess("Claim approved and report marked returned."));
    } catch (error) {
      setButtonBusy(approveButton, false);
      await setView("claims", showError(readError(error)));
    }
    return;
  }

  const rejectButton = target.closest<HTMLButtonElement>("[data-reject-claim]");
  if (rejectButton?.dataset.rejectClaim) {
    if (!confirm("Reject this claim? The report will remain open.")) {
      return;
    }
    setButtonBusy(rejectButton, true, "Rejecting...");
    try {
      await rejectClaim(rejectButton.dataset.rejectClaim);
      await setView("claims", showSuccess("Claim rejected."));
    } catch (error) {
      setButtonBusy(rejectButton, false);
      await setView("claims", showError(readError(error)));
    }
  }
}

async function openReportModal(reportId: string, triggerButton: HTMLButtonElement): Promise<void> {
  if (!currentUserId) return;
  setButtonBusy(triggerButton, true, "Loading...");
  try {
    const report =
      cachedOpenReports.find((r) => r.id === reportId) ?? (await getReportById(reportId));
    if (!report) {
      renderCurrentShell(`${showError("Report not found.")}${lastRenderedContent}`);
      return;
    }
    const imageUrls = await resolveReportImageUrls([report]);
    cachedImageUrls = { ...cachedImageUrls, ...imageUrls };
    const modalHtml = renderReportDetailModal(report, cachedImageUrls, currentUserId);
    renderShell(currentProfile, currentView, lastRenderedContent, modalHtml);
  } catch (error) {
    renderCurrentShell(`${showError(readError(error))}${lastRenderedContent}`);
  } finally {
    setButtonBusy(triggerButton, false);
  }
}

async function startEditingReport(
  reportId: string,
  triggerButton: HTMLButtonElement
): Promise<void> {
  setButtonBusy(triggerButton, true, "Loading...");
  try {
    const report = await getReportById(reportId);
    if (!report || report.status !== "open") {
      await setView("my-reports", showError("Only open reports can be edited."));
      return;
    }

    pendingReportType = report.type;
    editingReportId = report.id;
    editingReportValues = {
      type: report.type,
      item_name: report.item_name,
      category: report.category,
      color: report.color,
      location: report.location,
      event_date: report.event_date,
      description: report.description,
    };
    await setView("report-form");
  } catch (error) {
    await setView("my-reports", showError(readError(error)));
  } finally {
    setButtonBusy(triggerButton, false);
  }
}

async function handleSubmit(event: SubmitEvent): Promise<void> {
  const form = event.target as HTMLFormElement;

  if (form.id === "login-form") {
    event.preventDefault();
    await submitLogin(form);
    return;
  }

  if (form.id === "register-form") {
    event.preventDefault();
    await submitRegister(form);
    return;
  }

  if (form.id === "report-form") {
    event.preventDefault();
    await submitReport(form);
    return;
  }

  if (form.classList.contains("claim-question-form")) {
    event.preventDefault();
    await submitClaimQuestion(form);
    return;
  }

  if (form.classList.contains("claim-answer-form")) {
    event.preventDefault();
    await submitClaimAnswer(form);
  }
}

function handleInput(event: Event): void {
  const target = event.target as HTMLElement;
  if (currentView === "browse" && target.id === "browse-search") {
    browseFilters.search = (target as HTMLInputElement).value;
    updateBrowseResultsDom();
  }
}

async function handleChange(event: Event): Promise<void> {
  const target = event.target as HTMLElement;

  if (currentView === "browse") {
    if (target.id === "browse-category") {
      browseFilters.category = (target as HTMLSelectElement).value;
      updateBrowseResultsDom();
      return;
    }
    if (target.id === "browse-color") {
      browseFilters.color = (target as HTMLSelectElement).value;
      updateBrowseResultsDom();
      return;
    }
    if (target.id === "browse-location") {
      browseFilters.location = (target as HTMLSelectElement).value;
      updateBrowseResultsDom();
      return;
    }
  }

  if (currentView === "matches" && target.id === "match-source-select") {
    selectedMatchReportId = (target as HTMLSelectElement).value;
    await setView("matches");
  }
}

async function submitLogin(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const email = String(data.get("email") ?? "");
  const password = String(data.get("password") ?? "");
  const errors = { ...validateEmail(email).errors, ...validatePassword(password).errors };

  if (Object.keys(errors).length) {
    renderLoggedOut(showError(Object.values(errors)[0]));
    return;
  }

  setFormBusy(form, true, "Signing in...");
  try {
    const user = await login(email, password);
    currentUserId = user.id;
    currentProfile = await ensureProfile(user);
    await setView("dashboard");
  } catch (error) {
    renderLoggedOut(showError(readError(error)));
  } finally {
    setFormBusy(form, false);
  }
}

async function submitRegister(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const fullName = String(data.get("full_name") ?? "");
  const email = String(data.get("email") ?? "");
  const password = String(data.get("password") ?? "");
  const errors = {
    ...validateFullName(fullName).errors,
    ...validateEmail(email).errors,
    ...validatePassword(password).errors,
  };

  if (Object.keys(errors).length) {
    renderLoggedOut(showError(Object.values(errors)[0]));
    return;
  }

  setFormBusy(form, true, "Creating account...");
  try {
    const result = await register(email, password, fullName);
    if (result.needsEmailConfirmation) {
      renderLoggedOut(
        showSuccess(
          "Account created. Please check your email to confirm your account, then sign in."
        )
      );
    } else {
      if (result.user) {
        currentUserId = result.user.id;
        currentProfile = await ensureProfile(result.user);
      }
      await setView("dashboard", showSuccess("Account created. Welcome to Campus Lost & Found!"));
    }
  } catch (error) {
    renderLoggedOut(showError(readError(error)));
  } finally {
    setFormBusy(form, false);
  }
}

async function submitReport(form: HTMLFormElement): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    renderLoggedOut(showError("You must be logged in to submit a report."));
    return;
  }

  const data = new FormData(form);
  const editId = String(data.get("edit_report_id") ?? "").trim() || null;
  const rawInput: ReportFormInput = {
    type: String(data.get("type") ?? "lost") as ReportType,
    item_name: String(data.get("item_name") ?? ""),
    category: String(data.get("category") ?? ""),
    color: String(data.get("color") ?? ""),
    location: String(data.get("location") ?? ""),
    event_date: String(data.get("event_date") ?? ""),
    description: String(data.get("description") ?? ""),
  };
  const input = cleanReportInput(rawInput);
  const image =
    !editId && data.get("image") instanceof File && (data.get("image") as File).size > 0
      ? (data.get("image") as File)
      : null;

  const validation = validateReportForm(input);
  const imageValidation = validateImage(image);
  const errors = { ...validation.errors, ...imageValidation.errors };

  if (Object.keys(errors).length) {
    editingReportId = editId;
    editingReportValues = rawInput;
    renderCurrentShell(
      `${showError(Object.values(errors)[0])}${renderReportForm({
        type: input.type,
        initialValues: rawInput,
        editingReportId: editId,
      })}`
    );
    return;
  }

  if (!currentProfile) {
    currentProfile = await ensureProfile(user);
  }

  if (editId) {
    setFormBusy(form, true, "Updating report...");
    try {
      await updateReport(editId, {
        item_name: input.item_name,
        category: input.category as Category,
        color: input.color as Color,
        location: input.location as CampusLocation,
        event_date: input.event_date,
        description: input.description,
      });
      editingReportId = null;
      editingReportValues = undefined;
      await setView("my-reports", showSuccess("Report updated."));
    } catch (error) {
      renderCurrentShell(
        `${showError(readError(error))}${renderReportForm({
          type: input.type,
          initialValues: rawInput,
          editingReportId: editId,
        })}`
      );
    } finally {
      setFormBusy(form, false);
    }
    return;
  }

  setFormBusy(form, true, image ? "Uploading image..." : "Saving report...");
  const reportId = crypto.randomUUID();
  let imagePath: string | null = null;

  try {
    if (image) {
      imagePath = await uploadReportImage(user.id, reportId, image);
    }

    await createReport({
      id: reportId,
      user_id: user.id,
      type: input.type,
      item_name: input.item_name,
      category: input.category as Category,
      color: input.color as Color,
      location: input.location as CampusLocation,
      event_date: input.event_date,
      description: input.description,
      image_path: imagePath,
    });

    editingReportId = null;
    editingReportValues = undefined;
    await setView("my-reports", showSuccess("Report saved."));
  } catch (error) {
    if (imagePath) {
      await deleteReportImage(imagePath).catch((deleteError: unknown) =>
        console.error("Rollback image delete failed", deleteError)
      );
    }
    renderCurrentShell(
      `${showError(readError(error))}${renderReportForm({
        type: input.type,
        initialValues: rawInput,
        editingReportId: null,
      })}`
    );
  } finally {
    setFormBusy(form, false);
  }
}

async function submitClaimQuestion(form: HTMLFormElement): Promise<void> {
  const claimId = form.dataset.claimId;
  if (!claimId) return;

  const data = new FormData(form);
  const question = String(data.get("question") ?? "");
  const validation = validateClaimQuestion(question);

  if (!validation.valid) {
    await setView("claims", showError(Object.values(validation.errors)[0]));
    return;
  }

  setFormBusy(form, true, "Sending question...");
  try {
    await createClaimQuestion(claimId, question);
    await setView("claims", showSuccess("Verification question sent to the claimant."));
  } catch (error) {
    await setView("claims", showError(readError(error)));
  } finally {
    setFormBusy(form, false);
  }
}

async function submitClaimAnswer(form: HTMLFormElement): Promise<void> {
  const questionId = form.dataset.questionId;
  if (!questionId) return;

  const data = new FormData(form);
  const answer = String(data.get("answer") ?? "");
  const validation = validateClaimAnswer(answer);

  if (!validation.valid) {
    await setView("claims", showError(Object.values(validation.errors)[0]));
    return;
  }

  setFormBusy(form, true, "Submitting answer...");
  try {
    await answerClaimQuestion(questionId, answer);
    await setView("claims", showSuccess("Your verification answer has been submitted."));
  } catch (error) {
    await setView("claims", showError(readError(error)));
  } finally {
    setFormBusy(form, false);
  }
}

function setFormBusy(form: HTMLFormElement, busy: boolean, label = "Working..."): void {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) return;
  setButtonBusy(button, busy, label);
}

function setButtonBusy(button: HTMLButtonElement, busy: boolean, label = "Working..."): void {
  if (busy && !button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent ?? "";
  }
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.originalLabel ?? button.textContent;
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
