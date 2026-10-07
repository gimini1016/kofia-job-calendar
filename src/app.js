import { DATA_SNAPSHOT_DATE, KOFIA_BOARD_URL, jobs } from "./jobs.js";
import { TRACKS, capstones, portfolioPhases } from "./capstones.js";
import { CareerDecisionAgent, supportsLocalAgent } from "./agent-runtime.js";
import { formatAgentMarkdown } from "./agent-tools.js";
import {
  buildCalendarDays,
  deadlineLabel,
  daysUntil,
  filterJobs,
  formatKoreanDate,
  isClosingSoon,
  isOpen,
  jobAvailability,
  jobsInMonth,
  sortByDeadline,
  sortJobsForAvailability,
  toISODate,
} from "./job-utils.js";

const today = new Date();
const storageKey = "career-portfolio-lab:saved-jobs";

const state = {
  track: "finance",
  showAllProjects: false,
  selectedProjectId: new URLSearchParams(window.location.search).get("project"),
  month: new Date(today.getFullYear(), today.getMonth(), 1),
  query: "",
  experience: "all",
  roleGroup: "all",
  availability: "open",
  savedOnly: false,
  view: "list",
  listLimit: 18,
  savedIds: loadSavedIds(),
};

const elements = {
  heroTrack: document.querySelector("#hero-track"),
  heroProjectCompany: document.querySelector("#hero-project-company"),
  heroProjectTitle: document.querySelector("#hero-project-title"),
  heroProjectScore: document.querySelector("#hero-project-score"),
  heroProjectReason: document.querySelector("#hero-project-reason"),
  heroJobCount: document.querySelector("#hero-job-count"),
  heroSnapshotDate: document.querySelector("#hero-snapshot-date"),
  metricJobCount: document.querySelector("#metric-job-count"),
  metricBackofficeCount: document.querySelector("#metric-backoffice-count"),
  metricCareerCount: document.querySelector("#metric-career-count"),
  agentJobCount: document.querySelector("#agent-job-count"),
  trendJobCount: document.querySelector("#trend-job-count"),
  footerSnapshotDate: document.querySelector("#footer-snapshot-date"),
  trackSelector: document.querySelector("#track-selector"),
  trackSummaryTitle: document.querySelector("#track-summary-title"),
  trackSummaryDescription: document.querySelector("#track-summary-description"),
  topPick: document.querySelector("#top-pick"),
  rankingLabel: document.querySelector("#ranking-label"),
  projectRanking: document.querySelector("#project-ranking"),
  toggleProjects: document.querySelector("#toggle-projects"),
  briefingPanel: document.querySelector("#briefing"),
  agentLoadModel: document.querySelector("#agent-load-model"),
  agentProgressBar: document.querySelector("#agent-progress-bar"),
  agentModelStatus: document.querySelector("#agent-model-status"),
  agentInput: document.querySelector("#agent-input"),
  agentRun: document.querySelector("#agent-run"),
  agentTrace: document.querySelector("#agent-trace"),
  agentResult: document.querySelector("#agent-result"),
  agentCopy: document.querySelector("#agent-copy"),
  agentPrompts: document.querySelectorAll("[data-agent-prompt]"),
  trendChart: document.querySelector("#trend-chart"),
  portfolioTimeline: document.querySelector("#portfolio-timeline"),
  openCount: document.querySelector("#open-count"),
  closingCount: document.querySelector("#closing-count"),
  unknownCount: document.querySelector("#unknown-count"),
  savedCount: document.querySelector("#saved-count"),
  searchInput: document.querySelector("#search-input"),
  roleFilter: document.querySelector("#role-filter"),
  experienceFilter: document.querySelector("#experience-filter"),
  savedFilter: document.querySelector("#saved-filter"),
  previousMonth: document.querySelector("#previous-month"),
  nextMonth: document.querySelector("#next-month"),
  todayButton: document.querySelector("#today-button"),
  listContext: document.querySelector("#list-context"),
  monthNavigation: document.querySelector("#month-navigation"),
  monthTitle: document.querySelector("#month-title"),
  jobStatusTabs: document.querySelector("#job-status-tabs"),
  jobStatusHelp: document.querySelector("#job-status-help"),
  statusButtons: document.querySelectorAll("[data-job-status]"),
  statusOpenCount: document.querySelector("#status-open-count"),
  statusUnknownCount: document.querySelector("#status-unknown-count"),
  statusClosedCount: document.querySelector("#status-closed-count"),
  statusAllCount: document.querySelector("#status-all-count"),
  resultSummary: document.querySelector("#result-summary"),
  calendarGrid: document.querySelector("#calendar-grid"),
  calendarView: document.querySelector("#calendar-view"),
  listView: document.querySelector("#list-view"),
  loadMore: document.querySelector("#load-more"),
  viewButtons: document.querySelectorAll("[data-view]"),
  dialog: document.querySelector("#job-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
  dialogClose: document.querySelector("#dialog-close"),
  menuButton: document.querySelector("#menu-button"),
  mainNav: document.querySelector("#main-nav"),
};

function loadSavedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  } catch {
    return new Set();
  }
}

function persistSavedIds() {
  localStorage.setItem(storageKey, JSON.stringify([...state.savedIds]));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const agentToolLabels = {
  search_jobs: "실제 KOFIA 공고 검색",
  analyze_job_trends: "채용 키워드 트렌드 계산",
  compare_capstones: "캡스톤 14개 조건별 비교",
  get_project_detail: "설명회 검증 정보 조회",
  build_portfolio_plan: "12주 포트폴리오 계획 작성",
};

let latestAgentResult = null;
let agentToolStep = 0;
let agentBusy = false;

function summarizeToolArguments(args = {}) {
  return Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== "" && (!Array.isArray(value) || value.length))
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(" · ") : value}`)
    .join(" / ") || "기본 조건";
}

function appendAgentTrace({ tool, args, mode }) {
  if (agentToolStep === 0) elements.agentTrace.innerHTML = "";
  agentToolStep += 1;
  elements.agentTrace.insertAdjacentHTML("beforeend", `
    <div class="agent-trace-row">
      <span>${String(agentToolStep).padStart(2, "0")}</span>
      <div>
        <strong>${escapeHtml(agentToolLabels[tool] || tool)}</strong>
        <small>${escapeHtml(summarizeToolArguments(args))}</small>
      </div>
      <em>${mode === "local-ai" ? "AI 선택" : "호환 실행"}</em>
    </div>
  `);
}

function renderAgentResult(result) {
  const modeLabel = result.mode === "local-ai" ? "LOCAL AI" : "COMPATIBILITY";
  const recommendations = (result.recommendations || []).map((item, index) => `
    <article class="agent-recommendation">
      <div class="agent-recommendation-rank"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.score ?? "-")}</strong></div>
      <div>
        <p>${escapeHtml(item.company)}</p>
        <h4>${escapeHtml(item.project)}</h4>
        <strong class="agent-reason">${escapeHtml(item.reason)}</strong>
        <small>${escapeHtml(item.evidence)}</small>
        <p class="agent-caution">확인할 점 · ${escapeHtml(item.caution)}</p>
        <button type="button" data-agent-project="${escapeHtml(item.projectId)}">설명회 근거 보기 →</button>
      </div>
    </article>
  `).join("");

  const jobEvidence = (result.jobEvidence || []).map((job) => `
    <a href="${escapeHtml(job.sourceUrl)}" target="_blank" rel="noreferrer">
      <span>${escapeHtml(job.company)}</span>
      <strong>${escapeHtml(job.title)}</strong>
      <small>${escapeHtml(job.reason)}</small>
    </a>
  `).join("");

  const skillGaps = (result.skillGaps || []).map((gap) => `<li>${escapeHtml(gap)}</li>`).join("");
  const plan = (result.plan || []).map((phase) => `
    <article>
      <time>${escapeHtml(phase.period)}</time>
      <h4>${escapeHtml(phase.title)}</h4>
      <p>${escapeHtml(phase.deliverable || phase.action)}</p>
    </article>
  `).join("");

  elements.agentResult.innerHTML = `
    <header class="agent-result-head">
      <span class="agent-mode agent-mode--${escapeHtml(result.mode)}">${modeLabel}</span>
      ${result.model ? `<small>${escapeHtml(result.model)}</small>` : ""}
    </header>
    <h3>${escapeHtml(result.summary)}</h3>
    <section class="agent-result-section">
      <p class="agent-result-label">추천 프로젝트</p>
      <div class="agent-recommendations">${recommendations}</div>
    </section>
    <div class="agent-evidence-grid">
      <section class="agent-result-section">
        <p class="agent-result-label">실제 공고 근거</p>
        <div class="agent-job-evidence">${jobEvidence || "<p>조건에 맞는 공고 근거가 없습니다.</p>"}</div>
      </section>
      <section class="agent-result-section">
        <p class="agent-result-label">보완할 역량</p>
        <ul class="agent-skill-gaps">${skillGaps || "<li>목표 직무를 더 구체적으로 입력해 주세요.</li>"}</ul>
      </section>
    </div>
    <section class="agent-result-section">
      <p class="agent-result-label">12주 실행 계획</p>
      <div class="agent-plan">${plan}</div>
    </section>
    <div class="agent-next-question"><span>NEXT QUESTION</span><p>${escapeHtml(result.nextQuestion)}</p></div>
  `;
}

const careerAgent = new CareerDecisionAgent({
  onStatus: (message) => {
    elements.agentModelStatus.textContent = message;
  },
  onProgress: ({ progress = 0, text, model, vramMB }) => {
    elements.agentProgressBar.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    const memory = vramMB ? ` · 예상 VRAM ${Math.round(vramMB)}MB` : "";
    elements.agentModelStatus.textContent = `${text || "모델 준비 중"}${model ? ` · ${model}` : ""}${memory}`;
  },
  onTool: appendAgentTrace,
});

function experienceLabel(value) {
  return {
    new: "신입",
    career: "경력",
    both: "신입·경력",
    unknown: "경력 미분류",
  }[value] || "경력 미분류";
}

function rankedProjects() {
  return [...capstones].sort((a, b) => b.scores[state.track] - a.scores[state.track]);
}

function statusClass(level) {
  return ["good", "warn", "bad"].includes(level) ? `status--${level}` : "status--neutral";
}

function renderBriefing(project) {
  const info = project.briefing;
  elements.briefingPanel.innerHTML = `
    <header class="briefing-head">
      <div>
        <p class="briefing-eyebrow">10.02 COMPANY BRIEFING · 직접 확인</p>
        <h3>${escapeHtml(project.company)} <span>· ${escapeHtml(project.title)}</span></h3>
      </div>
      <span class="stage-badge stage-badge--${escapeHtml(info.stageLevel)}">${escapeHtml(info.stage)}</span>
    </header>
    <p class="briefing-summary">${escapeHtml(info.scope)}</p>
    <div class="briefing-grid">
      <section><span>실제 데이터</span><p>${escapeHtml(info.data)}</p></section>
      <section><span>멘토링</span><p>${escapeHtml(info.mentoring)}</p></section>
      <section><span>근무·지원</span><p>${escapeHtml(info.workstyle)}</p></section>
      <section class="briefing-status ${statusClass(info.portfolioLevel)}">
        <span>포트폴리오</span><strong>${escapeHtml(info.portfolio)}</strong><p>${escapeHtml(info.portfolioDetail)}</p>
      </section>
      <section class="briefing-status ${statusClass(info.hiringLevel)}">
        <span>채용 신호</span><strong>${escapeHtml(info.hiring)}</strong><p>${escapeHtml(info.hiringDetail)}</p>
      </section>
      <section class="briefing-risk"><span>반드시 확인</span><p>${escapeHtml(info.risk)}</p></section>
    </div>
    <footer class="briefing-source">
      <span>근거: 2026년 10월 2일 기업설명회 녹음 전사</span>
      <span>자동 전사 오류 가능 · 회사가 말한 목표와 가능성은 보장값이 아님</span>
    </footer>
  `;
}

function renderTrackSelector() {
  elements.trackSelector.innerHTML = Object.entries(TRACKS)
    .map(([key, track]) => `
      <button
        type="button"
        role="tab"
        data-track="${key}"
        aria-selected="${state.track === key}"
      >${escapeHtml(track.shortLabel)}</button>
    `)
    .join("");
}

function renderProjectMatcher() {
  const track = TRACKS[state.track];
  const ranked = rankedProjects();
  const top = ranked[0];
  const visible = state.showAllProjects ? ranked : ranked.slice(0, 5);
  const selected = capstones.find((project) => project.id === state.selectedProjectId) || top;
  state.selectedProjectId = selected.id;

  elements.trackSummaryTitle.textContent = track.label;
  elements.trackSummaryDescription.textContent = track.description;
  elements.rankingLabel.textContent = `${track.label} 프로젝트 순위`;
  elements.toggleProjects.textContent = state.showAllProjects ? "상위 5개만 보기 −" : "14개 모두 보기 +";

  elements.heroTrack.textContent = track.shortLabel;
  elements.heroProjectCompany.textContent = top.company;
  elements.heroProjectTitle.textContent = top.title;
  elements.heroProjectScore.textContent = top.scores[state.track];
  elements.heroProjectReason.textContent = top.strength;

  elements.topPick.innerHTML = `
    <span class="pick-badge">BEST MATCH · ${escapeHtml(track.shortLabel)}</span>
    <p class="pick-company">${escapeHtml(top.company)}</p>
    <h3>${escapeHtml(top.title)}</h3>
    <div class="pick-score">
      <strong>${top.scores[state.track]}</strong>
      <span>/ 100<br />직무 연결 점수</span>
    </div>
    <blockquote>${escapeHtml(top.strength)}</blockquote>
    <div class="pick-keywords">
      ${top.keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join("")}
    </div>
    <button class="pick-detail-button" type="button" data-project-detail="${escapeHtml(top.id)}">설명회에서 확인된 조건 보기 ↓</button>
  `;

  elements.projectRanking.innerHTML = visible
    .map((project, index) => `
      <button class="ranking-row${selected.id === project.id ? " ranking-row--selected" : ""}" type="button" data-project-id="${escapeHtml(project.id)}" aria-pressed="${selected.id === project.id}">
        <span class="rank-number">${String(index + 1).padStart(2, "0")}</span>
        <div class="rank-project">
          <strong>${escapeHtml(project.company)} · ${escapeHtml(project.title)}</strong>
          <small title="${escapeHtml(project.caution)}">${escapeHtml(project.caution)}</small>
        </div>
        <div class="rank-bar" aria-hidden="true"><i style="width: ${project.scores[state.track]}%"></i></div>
        <strong class="rank-score">${project.scores[state.track]}</strong>
      </button>
    `)
    .join("");

  renderBriefing(selected);
}

function renderTrends() {
  const counts = new Map();
  jobs.forEach((job) => job.roles.forEach((role) => counts.set(role, (counts.get(role) || 0) + 1)));
  const visibleTrends = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(...visibleTrends.map(([, count]) => count));
  elements.trendChart.innerHTML = visibleTrends
    .map(([label, count]) => `
      <div class="trend-row">
        <span>${escapeHtml(label)}</span>
        <div class="trend-bar" aria-hidden="true"><i style="width: ${Math.round((count / max) * 100)}%"></i></div>
        <strong>${count}</strong>
      </div>
    `)
    .join("");
}

function renderPortfolio() {
  elements.portfolioTimeline.innerHTML = portfolioPhases
    .map(([period, title, description]) => `
      <article class="phase">
        <time>${escapeHtml(period)}</time>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </article>
    `)
    .join("");
}

function renderStats() {
  elements.openCount.textContent = jobs.filter((job) => isOpen(job, today)).length;
  elements.closingCount.textContent = jobs.filter((job) => isClosingSoon(job, today)).length;
  elements.unknownCount.textContent = jobs.filter((job) => !job.endDate).length;
  elements.savedCount.textContent = state.savedIds.size;
}

function renderDatasetSummary() {
  const formattedSnapshot = DATA_SNAPSHOT_DATE.replaceAll("-", ".");
  const backofficeCount = filterJobs(jobs, { roleGroup: "backoffice" }).length;
  const careerCount = jobs.filter((job) => ["career", "both"].includes(job.experience)).length;
  [elements.heroJobCount, elements.metricJobCount, elements.agentJobCount, elements.trendJobCount]
    .forEach((element) => { element.textContent = jobs.length; });
  [elements.heroSnapshotDate, elements.footerSnapshotDate]
    .forEach((element) => { element.textContent = formattedSnapshot; });
  elements.metricBackofficeCount.textContent = backofficeCount;
  elements.metricCareerCount.textContent = careerCount;
}

function baseFilteredJobs() {
  return filterJobs(jobs, {
    query: state.query,
    experience: state.experience,
    roleGroup: state.roleGroup,
    savedOnly: state.savedOnly,
    savedIds: state.savedIds,
  });
}

function jobsForSelectedAvailability(filteredJobs) {
  if (state.availability === "all") return filteredJobs;
  return filteredJobs.filter((job) => jobAvailability(job, today) === state.availability);
}

function renderAvailabilityTabs(filteredJobs) {
  const counts = filteredJobs.reduce((result, job) => {
    result[jobAvailability(job, today)] += 1;
    return result;
  }, { open: 0, unknown: 0, closed: 0 });
  elements.statusOpenCount.textContent = counts.open;
  elements.statusUnknownCount.textContent = counts.unknown;
  elements.statusClosedCount.textContent = counts.closed;
  elements.statusAllCount.textContent = filteredJobs.length;
  elements.statusButtons.forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.jobStatus === state.availability));
  });
  elements.jobStatusHelp.textContent = {
    open: "마감일이 오늘 이후로 확인된 공고만 보여줍니다. 마감이 가까운 순서입니다.",
    unknown: "상시채용·채용 시 마감일 수 있으므로 지원 전에 KOFIA 원문을 확인하세요.",
    closed: "최근 마감된 순서입니다. 직무와 우대사항 트렌드를 참고하는 아카이브로 활용하세요.",
    all: "지원 가능, 마감일 미정, 마감 공고를 한 번에 검색합니다.",
  }[state.availability];
}

function chipClass(job) {
  if (!isOpen(job, today)) return "job-chip job-chip--closed";
  if (isClosingSoon(job, today)) return "job-chip job-chip--urgent";
  return "job-chip";
}

function renderCalendar(filteredJobs) {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  const todayKey = toISODate(today);

  elements.calendarGrid.innerHTML = buildCalendarDays(year, month)
    .map((day) => {
      const dayJobs = sortByDeadline(filteredJobs.filter((job) => job.endDate === day.key));
      const classes = ["calendar-day"];
      if (!day.inCurrentMonth) classes.push("calendar-day--outside");
      if (day.key === todayKey) classes.push("calendar-day--today");

      return `
        <article class="${classes.join(" ")}" aria-label="${formatKoreanDate(day.date)}">
          <span class="day-number">${day.date.getDate()}</span>
          ${dayJobs
            .slice(0, 3)
            .map((job) => `
              <button class="${chipClass(job)}" type="button" data-job-id="${escapeHtml(job.id)}">
                <strong>${escapeHtml(job.company)}</strong>
                <small>${escapeHtml(job.title)}</small>
              </button>
            `)
            .join("")}
          ${dayJobs.length > 3 ? `<span class="more-jobs">+${dayJobs.length - 3}개 더 보기</span>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderList(filteredJobs) {
  const sortedJobs = sortJobsForAvailability(filteredJobs, state.availability, today);
  const visibleJobs = sortedJobs.slice(0, state.listLimit);

  if (!visibleJobs.length) {
    elements.listView.innerHTML = `
      <div class="empty-state">
        <strong>조건에 맞는 공고가 없습니다.</strong>
        검색어나 직무·경력 필터를 바꿔보세요.
      </div>
    `;
    elements.loadMore.hidden = true;
    return;
  }

  elements.listView.innerHTML = visibleJobs
    .map((job) => {
      const isSaved = state.savedIds.has(job.id);
      return `
        <article class="list-item list-item--${jobAvailability(job, today)}">
          <div class="deadline-block">
            <strong>${job.endDate ? escapeHtml(formatKoreanDate(job.endDate)) : "상시·미정"}</strong>
            <small>${escapeHtml(deadlineLabel(job.endDate, today))}</small>
          </div>
          <div class="job-info">
            <p>${escapeHtml(job.company)}</p>
            <h3>${escapeHtml(job.title)}</h3>
            <div class="tag-row">
              <span class="tag">${experienceLabel(job.experience)}</span>
              <span class="tag">${escapeHtml(job.employment)}</span>
              ${job.roles.slice(0, 3).map((role) => `<span class="tag">${escapeHtml(role)}</span>`).join("")}
            </div>
          </div>
          <div class="list-actions">
            <button class="detail-button" type="button" data-job-id="${escapeHtml(job.id)}">상세 보기</button>
            <button
              class="save-button"
              type="button"
              data-save-id="${escapeHtml(job.id)}"
              aria-label="${escapeHtml(job.company)} 관심 공고 ${isSaved ? "해제" : "저장"}"
              aria-pressed="${isSaved}"
            >${isSaved ? "★" : "☆"}</button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.loadMore.hidden = state.view !== "list" || visibleJobs.length >= sortedJobs.length;
  elements.loadMore.textContent = `공고 더 보기 · ${sortedJobs.length - visibleJobs.length}건 남음`;
}

function renderJobs() {
  const filteredJobs = baseFilteredJobs();
  const listJobs = jobsForSelectedAvailability(filteredJobs);
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  const monthJobs = jobsInMonth(filteredJobs, year, month);

  elements.monthTitle.textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(state.month);

  elements.resultSummary.textContent = state.view === "calendar"
    ? `${year}년 ${month + 1}월 마감 ${monthJobs.length}건 · 마감일 미정 공고는 목록에서 확인`
    : `${({ open: "지원 가능", unknown: "마감일 미정", closed: "마감 공고", all: "전체" })[state.availability]} ${listJobs.length}건 · 마지막 자동 확인 ${DATA_SNAPSHOT_DATE}`;

  elements.savedFilter.setAttribute("aria-pressed", String(state.savedOnly));
  elements.savedFilter.querySelector("span").textContent = state.savedOnly ? "★" : "☆";
  renderAvailabilityTabs(filteredJobs);
  renderStats();
  renderCalendar(filteredJobs);
  renderList(listJobs);
}

function toggleSaved(jobId) {
  if (state.savedIds.has(jobId)) state.savedIds.delete(jobId);
  else state.savedIds.add(jobId);
  persistSavedIds();
  renderJobs();
  if (elements.dialog.open) openJobDialog(jobId);
}

function openJobDialog(jobId) {
  const job = jobs.find((item) => item.id === jobId);
  if (!job) return;
  const isSaved = state.savedIds.has(job.id);

  elements.dialogContent.innerHTML = `
    <div class="dialog-body">
      <p class="dialog-eyebrow">KOFIA ACTUAL POSTING · ${escapeHtml(job.postedDate)}</p>
      <h2>${escapeHtml(job.title)}</h2>
      <p class="dialog-company">${escapeHtml(job.company)} · ${escapeHtml(job.location)}</p>
      <div class="dialog-date">
        <div>
          <span>접수 기간</span>
          <strong>${escapeHtml(formatKoreanDate(job.startDate))} — ${escapeHtml(formatKoreanDate(job.endDate))}</strong>
        </div>
        <strong>${escapeHtml(deadlineLabel(job.endDate, today))}</strong>
      </div>
      <div class="tag-row">
        <span class="tag">${experienceLabel(job.experience)}</span>
        <span class="tag">${escapeHtml(job.employment)}</span>
        ${job.roles.map((role) => `<span class="tag">${escapeHtml(role)}</span>`).join("")}
      </div>
      <p class="dialog-summary">${escapeHtml(job.summary || "공고 원문에서 상세 업무와 자격요건을 확인하세요.")}</p>
      <div class="dialog-actions">
        <a href="${escapeHtml(job.sourceUrl || KOFIA_BOARD_URL)}" target="_blank" rel="noreferrer">KOFIA 원문 확인 ↗</a>
        <button
          type="button"
          data-save-id="${escapeHtml(job.id)}"
          aria-label="관심 공고 ${isSaved ? "해제" : "저장"}"
          aria-pressed="${isSaved}"
        >${isSaved ? "★" : "☆"}</button>
      </div>
    </div>
  `;

  if (!elements.dialog.open) elements.dialog.showModal();
}

function setView(view) {
  state.view = view;
  elements.calendarView.hidden = view !== "calendar";
  elements.listView.hidden = view !== "list";
  elements.listContext.hidden = view !== "list";
  elements.monthNavigation.hidden = view !== "calendar";
  elements.jobStatusTabs.hidden = view !== "list";
  elements.jobStatusHelp.hidden = view !== "list";
  elements.viewButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  });
  renderJobs();
}

elements.trackSelector.addEventListener("click", (event) => {
  const button = event.target.closest("[data-track]");
  if (!button) return;
  state.track = button.dataset.track;
  state.showAllProjects = false;
  state.selectedProjectId = rankedProjects()[0].id;
  renderTrackSelector();
  renderProjectMatcher();
});

elements.toggleProjects.addEventListener("click", () => {
  state.showAllProjects = !state.showAllProjects;
  renderProjectMatcher();
});

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.currentTarget.value;
  state.listLimit = 18;
  renderJobs();
});

elements.roleFilter.addEventListener("change", (event) => {
  state.roleGroup = event.currentTarget.value;
  state.listLimit = 18;
  renderJobs();
});

elements.experienceFilter.addEventListener("change", (event) => {
  state.experience = event.currentTarget.value;
  state.listLimit = 18;
  renderJobs();
});

elements.savedFilter.addEventListener("click", () => {
  state.savedOnly = !state.savedOnly;
  state.listLimit = 18;
  renderJobs();
});

elements.statusButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.availability = button.dataset.jobStatus;
    state.listLimit = 18;
    renderJobs();
  });
});

elements.previousMonth.addEventListener("click", () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
  renderJobs();
});

elements.nextMonth.addEventListener("click", () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
  renderJobs();
});

elements.todayButton.addEventListener("click", () => {
  state.month = new Date(today.getFullYear(), today.getMonth(), 1);
  renderJobs();
});

elements.loadMore.addEventListener("click", () => {
  state.listLimit += 24;
  renderJobs();
});

elements.viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.addEventListener("click", (event) => {
  const jobButton = event.target.closest("[data-job-id]");
  const saveButton = event.target.closest("[data-save-id]");
  const projectButton = event.target.closest("[data-project-id]");
  const projectDetailButton = event.target.closest("[data-project-detail]");
  const agentProjectButton = event.target.closest("[data-agent-project]");
  if (projectButton) {
    state.selectedProjectId = projectButton.dataset.projectId;
    renderProjectMatcher();
  }
  if (projectDetailButton) {
    state.selectedProjectId = projectDetailButton.dataset.projectDetail;
    renderProjectMatcher();
    elements.briefingPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (agentProjectButton) {
    state.selectedProjectId = agentProjectButton.dataset.agentProject;
    const project = capstones.find((item) => item.id === state.selectedProjectId);
    if (project) {
      state.showAllProjects = true;
      renderProjectMatcher();
      elements.briefingPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  if (jobButton) openJobDialog(jobButton.dataset.jobId);
  if (saveButton) {
    event.stopPropagation();
    toggleSaved(saveButton.dataset.saveId);
  }
});

elements.dialogClose.addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

elements.menuButton.addEventListener("click", () => {
  const isOpen = elements.mainNav.dataset.open === "true";
  elements.mainNav.dataset.open = String(!isOpen);
  elements.menuButton.setAttribute("aria-expanded", String(!isOpen));
});

elements.mainNav.addEventListener("click", () => {
  elements.mainNav.dataset.open = "false";
  elements.menuButton.setAttribute("aria-expanded", "false");
});

elements.agentPrompts.forEach((button) => {
  button.addEventListener("click", () => {
    elements.agentInput.value = button.dataset.agentPrompt;
    elements.agentInput.focus();
  });
});

elements.agentLoadModel.addEventListener("click", async () => {
  if (agentBusy || !supportsLocalAgent()) return;
  agentBusy = true;
  elements.agentLoadModel.disabled = true;
  elements.agentLoadModel.textContent = "모델 준비 중…";
  try {
    const { model } = await careerAgent.initialize();
    elements.agentProgressBar.style.width = "100%";
    elements.agentLoadModel.textContent = "로컬 AI 준비 완료";
    elements.agentModelStatus.textContent = `기기 내 실행 준비 완료 · ${model}`;
  } catch (error) {
    elements.agentLoadModel.textContent = "호환 모드로 계속";
    elements.agentModelStatus.textContent = `로컬 AI를 준비하지 못했습니다. 분석 시 호환 모드를 사용합니다. (${error.message})`;
  } finally {
    agentBusy = false;
  }
});

elements.agentRun.addEventListener("click", async () => {
  const prompt = elements.agentInput.value.trim();
  if (!prompt) {
    elements.agentModelStatus.textContent = "먼저 목표와 우선순위를 입력해 주세요.";
    elements.agentInput.focus();
    return;
  }
  if (agentBusy) return;

  agentBusy = true;
  agentToolStep = 0;
  latestAgentResult = null;
  elements.agentRun.disabled = true;
  elements.agentLoadModel.disabled = true;
  elements.agentRun.innerHTML = "Agent 분석 중 <span>···</span>";
  elements.agentTrace.innerHTML = "<p>목표를 해석하고 사용할 도구를 고르고 있습니다.</p>";
  elements.agentResult.setAttribute("aria-busy", "true");
  elements.agentResult.innerHTML = "<div class=\"agent-empty agent-empty--loading\"><span></span><p>공고와 프로젝트 데이터를 교차 확인하고 있습니다.</p></div>";
  elements.agentCopy.hidden = true;

  try {
    latestAgentResult = await careerAgent.run(prompt);
    renderAgentResult(latestAgentResult);
    elements.agentCopy.hidden = false;
    const modeText = latestAgentResult.mode === "local-ai" ? "로컬 AI Agent" : "규칙 기반 호환 Agent";
    elements.agentModelStatus.textContent = `${modeText} 분석 완료 · 데이터는 외부 LLM API로 전송되지 않았습니다.`;
  } catch (error) {
    elements.agentResult.innerHTML = `<div class="agent-error"><strong>분석을 완료하지 못했습니다.</strong><p>${escapeHtml(error.message)}</p></div>`;
    elements.agentModelStatus.textContent = "분석 중 오류가 발생했습니다.";
  } finally {
    agentBusy = false;
    elements.agentResult.removeAttribute("aria-busy");
    elements.agentRun.disabled = false;
    elements.agentRun.innerHTML = "Agent 분석 시작 <span>→</span>";
    elements.agentLoadModel.disabled = !supportsLocalAgent() || careerAgent.ready;
  }
});

elements.agentCopy.addEventListener("click", async () => {
  if (!latestAgentResult) return;
  try {
    await navigator.clipboard.writeText(formatAgentMarkdown(latestAgentResult));
    elements.agentCopy.textContent = "복사 완료 ✓";
    window.setTimeout(() => { elements.agentCopy.textContent = "결과를 Markdown으로 복사"; }, 1800);
  } catch {
    elements.agentCopy.textContent = "복사 권한을 확인해 주세요";
  }
});

if (supportsLocalAgent()) {
  elements.agentModelStatus.textContent = "WebGPU 확인 완료 · 로컬 AI를 미리 준비하거나 바로 분석할 수 있습니다.";
} else {
  elements.agentLoadModel.disabled = true;
  elements.agentLoadModel.textContent = "WebGPU 미지원";
  elements.agentModelStatus.textContent = "이 브라우저에서는 실제 데이터 도구를 사용하는 호환 모드로 분석합니다.";
}

window.addEventListener("pagehide", () => careerAgent.dispose());

renderTrackSelector();
renderProjectMatcher();
renderTrends();
renderPortfolio();
renderDatasetSummary();
setView(state.view);
