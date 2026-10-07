import { capstones, portfolioPhases, TRACKS } from "./capstones.js";
import { jobs } from "./jobs.js";

const TRACK_ALIASES = {
  finance: ["finance", "금융", "투자", "운용", "증권", "리서치", "vc", "pe", "리스크", "준법"],
  backoffice: ["backoffice", "백오피스", "경영지원", "운영", "관리", "사무", "지원"],
  strategy: ["strategy", "전략", "경영기획", "사업기획", "기획", "컨설팅"],
  accounting: ["accounting", "재무", "회계", "fp&a", "세무", "결산", "자금", "예산"],
  hr: ["hr", "인사", "총무", "채용", "노무", "온보딩"],
};

const ROLE_GROUPS = {
  front: ["자산운용", "주식", "대체투자", "리서치", "기업분석", "IB", "기업금융", "트레이딩", "채권", "파생상품"],
  data: ["데이터", "IT", "AI"],
  backoffice: ["경영지원", "경영관리", "경영기획", "인사", "총무", "회계", "펀드회계", "운용지원", "준법감시", "컴플라이언스", "리스크", "법무"],
};

const SKILL_PATTERNS = [
  ["금융 도메인", ["금융", "투자", "운용", "증권", "펀드", "채권", "파생"]],
  ["재무·회계", ["재무", "회계", "결산", "세무", "예산", "손익"]],
  ["리스크·준법", ["리스크", "준법", "컴플라이언스", "법무", "내부통제"]],
  ["데이터·SQL", ["데이터", "sql", "etl", "데이터베이스", "품질"]],
  ["Python", ["python", "파이썬"]],
  ["AI·LLM", ["ai", "llm", "rag", "agent", "인공지능"]],
  ["Excel·문서", ["excel", "엑셀", "ppt", "보고서", "문서"]],
  ["협업·커뮤니케이션", ["협업", "커뮤니케이션", "소통", "유관부서"]],
];

const STOP_WORDS = new Set([
  "그리고", "하지만", "관련", "관심", "희망", "직무", "아직", "하고", "싶어요", "싶습니다",
  "있는", "없는", "어떤", "추천", "프로젝트", "포트폴리오", "분야", "업무", "조건", "정하지",
]);

export const AGENT_TOOL_DEFINITIONS = [
  {
    name: "search_jobs",
    description: "KOFIA 실제 공고를 회사·직무·본문·경력조건으로 검색한다.",
    arguments: { query: "string", roleGroup: "front|data|backoffice|all", experience: "new|career|both|unknown|all", limit: "1-10" },
  },
  {
    name: "analyze_job_trends",
    description: "목표 직무와 관련된 공고의 직무·기술 키워드 빈도와 대표 공고를 계산한다.",
    arguments: { targetRoles: "string[]", limit: "3-10" },
  },
  {
    name: "compare_capstones",
    description: "14개 캡스톤을 선택한 진로 트랙과 포트폴리오·채용·안정성 우선순위로 비교한다.",
    arguments: { tracks: "finance|backoffice|strategy|accounting|hr 배열", priorities: "portfolio|hiring|mentoring|stability 배열", limit: "3-5" },
  },
  {
    name: "get_project_detail",
    description: "특정 캡스톤의 기업설명회 검증 내용을 조회한다.",
    arguments: { projectId: "string" },
  },
  {
    name: "build_portfolio_plan",
    description: "선택 프로젝트와 목표 직무를 연결한 12주 계획을 만든다.",
    arguments: { projectId: "string", targetRoles: "string[]" },
  },
];

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeText(value) {
  return String(value || "").trim().toLocaleLowerCase("ko-KR");
}

function searchableJob(job) {
  return [job.company, job.title, job.summary, job.employment, ...(job.roles || [])]
    .join(" ")
    .toLocaleLowerCase("ko-KR");
}

function tokenize(value) {
  return [...new Set(normalizeText(value)
    .split(/[^0-9a-zA-Z가-힣+#.]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)))];
}

function normalizeTracks(values = []) {
  const requested = Array.isArray(values) ? values : [values];
  const matched = new Set();

  requested.forEach((value) => {
    const normalized = normalizeText(value);
    if (TRACKS[normalized]) matched.add(normalized);
    Object.entries(TRACK_ALIASES).forEach(([key, aliases]) => {
      if (aliases.some((alias) => normalized.includes(alias))) matched.add(key);
    });
  });

  return [...matched];
}

function roleGroupMatches(job, roleGroup) {
  const keywords = ROLE_GROUPS[roleGroup];
  if (!keywords) return true;
  return (job.roles || []).some((role) => keywords.some((keyword) => role.includes(keyword)));
}

function compactJob(job, score = 0) {
  return {
    id: job.id,
    company: job.company,
    title: job.title,
    experience: job.experience,
    employment: job.employment,
    roles: (job.roles || []).slice(0, 8),
    summary: String(job.summary || "").slice(0, 360),
    sourceUrl: job.sourceUrl,
    relevanceScore: score,
  };
}

export function searchJobsTool(argumentsValue = {}) {
  const query = String(argumentsValue.query || "").trim();
  const terms = tokenize(query);
  const roleGroup = ROLE_GROUPS[argumentsValue.roleGroup] ? argumentsValue.roleGroup : "all";
  const experience = ["new", "career", "both", "unknown"].includes(argumentsValue.experience)
    ? argumentsValue.experience
    : "all";
  const limit = clampInteger(argumentsValue.limit, 1, 10, 6);

  const scored = jobs
    .filter((job) => roleGroupMatches(job, roleGroup))
    .filter((job) => experience === "all" || job.experience === experience)
    .map((job) => {
      const title = normalizeText(job.title);
      const company = normalizeText(job.company);
      const roles = normalizeText((job.roles || []).join(" "));
      const summary = normalizeText(job.summary);
      const score = terms.reduce((total, term) => total
        + (title.includes(term) ? 5 : 0)
        + (roles.includes(term) ? 4 : 0)
        + (company.includes(term) ? 3 : 0)
        + (summary.includes(term) ? 1 : 0), 0);
      return { job, score };
    })
    .filter(({ score }) => terms.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || (b.job.postedDate || "").localeCompare(a.job.postedDate || ""));

  const fallback = scored.length ? scored : jobs
    .filter((job) => roleGroupMatches(job, roleGroup))
    .slice(0, limit)
    .map((job) => ({ job, score: 0 }));

  return {
    query,
    roleGroup,
    experience,
    matchedCount: scored.length,
    jobs: fallback.slice(0, limit).map(({ job, score }) => compactJob(job, score)),
  };
}

export function analyzeJobTrendsTool(argumentsValue = {}) {
  const targetRoles = Array.isArray(argumentsValue.targetRoles)
    ? argumentsValue.targetRoles.filter(Boolean).slice(0, 8)
    : [];
  const terms = tokenize(targetRoles.join(" "));
  const tracks = normalizeTracks(targetRoles);
  const roleGroups = new Set();
  if (tracks.includes("finance")) roleGroups.add("front");
  if (tracks.some((track) => ["backoffice", "strategy", "accounting", "hr"].includes(track))) roleGroups.add("backoffice");
  if (targetRoles.some((role) => /데이터|ai|it|개발/i.test(role))) roleGroups.add("data");

  let relevant = jobs.filter((job) => {
    const text = searchableJob(job);
    const termMatch = terms.some((term) => text.includes(term));
    const groupMatch = [...roleGroups].some((group) => roleGroupMatches(job, group));
    return termMatch || groupMatch;
  });
  if (!relevant.length) relevant = jobs;

  const roleCounts = new Map();
  relevant.forEach((job) => (job.roles || []).forEach((role) => {
    roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
  }));

  const skillCounts = SKILL_PATTERNS.map(([label, patterns]) => [
    label,
    relevant.filter((job) => {
      const text = searchableJob(job);
      return patterns.some((pattern) => text.includes(pattern));
    }).length,
  ]).sort((a, b) => b[1] - a[1]);

  const limit = clampInteger(argumentsValue.limit, 3, 10, 6);
  return {
    targetRoles,
    sampleSize: relevant.length,
    topRoles: [...roleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([label, count]) => ({ label, count })),
    topSkills: skillCounts.slice(0, 8).map(([label, count]) => ({ label, count })),
    examples: relevant.slice(0, limit).map((job) => compactJob(job)),
  };
}

function portfolioBonus(project, priorities) {
  if (!priorities.includes("portfolio")) return 0;
  return { good: 4, warn: 0, bad: -6 }[project.briefing.portfolioLevel] || 0;
}

function hiringBonus(project, priorities) {
  if (!priorities.includes("hiring")) return 0;
  return { good: 4, warn: 1, bad: -4, neutral: 0 }[project.briefing.hiringLevel] || 0;
}

function stabilityBonus(project, priorities) {
  if (!priorities.includes("stability")) return 0;
  return { live: 3, pilot: 0, proposal: -4, startup: -7 }[project.briefing.stageLevel] || 0;
}

export function compareCapstonesTool(argumentsValue = {}) {
  const tracks = normalizeTracks(argumentsValue.tracks);
  const selectedTracks = tracks.length ? tracks : ["finance", "backoffice"];
  const priorities = Array.isArray(argumentsValue.priorities)
    ? argumentsValue.priorities.filter((priority) => ["portfolio", "hiring", "mentoring", "stability"].includes(priority))
    : [];
  const limit = clampInteger(argumentsValue.limit, 3, 5, 5);

  const ranked = capstones.map((project) => {
    const trackScore = Math.round(selectedTracks.reduce((sum, track) => sum + project.scores[track], 0) / selectedTracks.length);
    const mentoring = priorities.includes("mentoring") && /밀착|직접|가깝|수시|참여/.test(project.briefing.mentoring) ? 2 : 0;
    const adjustedScore = Math.max(0, Math.min(100,
      trackScore + portfolioBonus(project, priorities) + hiringBonus(project, priorities)
      + stabilityBonus(project, priorities) + mentoring));
    return { project, trackScore, adjustedScore };
  }).sort((a, b) => b.adjustedScore - a.adjustedScore || b.trackScore - a.trackScore);

  return {
    tracks: selectedTracks.map((track) => ({ key: track, label: TRACKS[track].label })),
    priorities,
    projects: ranked.slice(0, limit).map(({ project, trackScore, adjustedScore }) => ({
      id: project.id,
      company: project.company,
      title: project.title,
      trackScore,
      adjustedScore,
      keywords: project.keywords,
      strength: project.strength,
      caution: project.caution,
      stage: project.briefing.stage,
      portfolio: project.briefing.portfolio,
      portfolioDetail: project.briefing.portfolioDetail,
      hiring: project.briefing.hiring,
      hiringDetail: project.briefing.hiringDetail,
    })),
  };
}

export function getProjectDetailTool(argumentsValue = {}) {
  const project = capstones.find((item) => item.id === argumentsValue.projectId);
  if (!project) return { error: "존재하지 않는 프로젝트입니다." };
  return {
    id: project.id,
    company: project.company,
    title: project.title,
    keywords: project.keywords,
    strength: project.strength,
    caution: project.caution,
    scores: project.scores,
    briefing: project.briefing,
  };
}

export function buildPortfolioPlanTool(argumentsValue = {}) {
  const project = capstones.find((item) => item.id === argumentsValue.projectId);
  if (!project) return { error: "12주 계획을 만들 프로젝트를 찾을 수 없습니다." };
  const targetRoles = Array.isArray(argumentsValue.targetRoles)
    ? argumentsValue.targetRoles.filter(Boolean).slice(0, 6)
    : [];
  const roleText = targetRoles.length ? targetRoles.join("·") : "선택 직무";

  return {
    projectId: project.id,
    project: `${project.company} · ${project.title}`,
    targetRoles,
    phases: portfolioPhases.map(([period, title, description], index) => ({
      period,
      title,
      action: index === 0
        ? `${project.briefing.portfolioDetail} ${roleText}에서 평가할 KPI와 공개 범위를 서면으로 확정합니다.`
        : description,
      deliverable: [
        "프로젝트 계약서 · 문제정의 1장 · KPI 사전",
        `데이터 사전 · 품질 리포트 · ${project.keywords.slice(0, 2).join("·")} 베이스라인`,
        "재현 가능한 코드 · 업무 흐름 데모",
        "오류유형표 · 사용자 검증 · 업무효과 비교",
        "권한·승인·민감정보·감사로그 체크리스트",
        "회사 실사용본 · 익명 포트폴리오본 · 이력서 문장",
      ][index],
    })),
  };
}

export function executeAgentTool(name, argumentsValue = {}) {
  const tools = {
    search_jobs: searchJobsTool,
    analyze_job_trends: analyzeJobTrendsTool,
    compare_capstones: compareCapstonesTool,
    get_project_detail: getProjectDetailTool,
    build_portfolio_plan: buildPortfolioPlanTool,
  };
  if (!tools[name]) throw new Error(`허용되지 않은 도구입니다: ${name}`);
  return tools[name](argumentsValue && typeof argumentsValue === "object" ? argumentsValue : {});
}

export function inferProfileFromText(text) {
  const normalized = normalizeText(text);
  const tracks = normalizeTracks([normalized]);
  const priorities = [];
  if (/공개|포트폴리오|깃허브|github/.test(normalized)) priorities.push("portfolio");
  if (/채용|취업|입사|인턴|전환/.test(normalized)) priorities.push("hiring");
  if (/멘토|피드백|배우|교육/.test(normalized)) priorities.push("mentoring");
  if (/안정|확실|실제 회사|운영|성장/.test(normalized)) priorities.push("stability");
  return {
    tracks: tracks.length ? tracks : ["finance", "backoffice"],
    priorities: priorities.length ? priorities : ["portfolio", "stability"],
    targetRoles: tracks.length ? tracks.map((track) => TRACKS[track].label) : ["금융·AI", "백오피스 전반"],
  };
}

function skillGapsForTracks(tracks) {
  const gaps = [];
  if (tracks.includes("finance")) gaps.push("금융상품·재무제표 기초", "SQL·Python으로 금융데이터 검증", "근거 추적과 준법 통제");
  if (tracks.includes("backoffice")) gaps.push("Excel·ERP 기반 운영 데이터 처리", "업무 프로세스와 내부통제 문서화");
  if (tracks.includes("strategy")) gaps.push("KPI·효과 추정과 경영진 보고", "이해관계자 인터뷰와 로드맵 작성");
  if (tracks.includes("accounting")) gaps.push("전표·결산·세무·IFRS 기본기", "예산 대비 실적과 손익 차이 분석");
  if (tracks.includes("hr")) gaps.push("채용·급여·노무 업무 이해", "개인정보·권한·승인 흐름 설계");
  return [...new Set(gaps)].slice(0, 6);
}

export function buildCompatibilityResult(userText, onTool = () => {}) {
  const profile = inferProfileFromText(userText);
  const query = profile.targetRoles.join(" ");

  onTool("search_jobs", { query, roleGroup: profile.tracks.includes("finance") ? "front" : "backoffice" });
  const jobResult = searchJobsTool({ query, roleGroup: profile.tracks.includes("finance") ? "front" : "backoffice", limit: 6 });
  onTool("analyze_job_trends", { targetRoles: profile.targetRoles });
  const trendResult = analyzeJobTrendsTool({ targetRoles: profile.targetRoles, limit: 5 });
  onTool("compare_capstones", { tracks: profile.tracks, priorities: profile.priorities });
  const comparison = compareCapstonesTool({ tracks: profile.tracks, priorities: profile.priorities, limit: 5 });
  const first = comparison.projects[0];
  onTool("build_portfolio_plan", { projectId: first.id, targetRoles: profile.targetRoles });
  const plan = buildPortfolioPlanTool({ projectId: first.id, targetRoles: profile.targetRoles });

  return {
    type: "final_answer",
    mode: "compatibility",
    summary: `${profile.targetRoles.join("·")} 기준으로 실제 공고와 14개 프로젝트를 비교했습니다. ${first.company}의 ${first.title}을 우선 검토하세요.`,
    recommendations: comparison.projects.slice(0, 3).map((project) => ({
      projectId: project.id,
      company: project.company,
      project: project.title,
      score: project.adjustedScore,
      reason: project.strength,
      evidence: `${project.stage} · 포트폴리오 ${project.portfolio} · 채용 ${project.hiring}`,
      caution: project.caution,
    })),
    jobEvidence: jobResult.jobs.slice(0, 4).map((job) => ({
      company: job.company,
      title: job.title,
      reason: job.roles.slice(0, 4).join(" · "),
      sourceUrl: job.sourceUrl,
    })),
    trends: trendResult.topSkills.slice(0, 5),
    skillGaps: skillGapsForTracks(profile.tracks),
    plan: plan.phases,
    nextQuestion: "상위 추천 중 금융 직접성과 백오피스 확장성 가운데 어느 쪽을 더 우선할까요?",
  };
}

export function formatAgentMarkdown(result) {
  const lines = ["# Career Decision Agent 결과", "", result.summary || ""];
  if (result.mode === "compatibility") lines.push("", "> WebGPU 미지원 또는 로컬 모델 오류로 규칙 기반 호환 모드에서 생성했습니다.");
  lines.push("", "## 추천 프로젝트");
  (result.recommendations || []).forEach((item, index) => {
    lines.push(`${index + 1}. **${item.company} · ${item.project}** (${item.score ?? "-"}점)`);
    lines.push(`   - 추천 이유: ${item.reason || "-"}`);
    lines.push(`   - 근거: ${item.evidence || "-"}`);
    lines.push(`   - 주의: ${item.caution || "-"}`);
  });
  lines.push("", "## 실제 공고 근거");
  (result.jobEvidence || []).forEach((job) => lines.push(`- [${job.company} · ${job.title}](${job.sourceUrl}) — ${job.reason || ""}`));
  lines.push("", "## 보완 역량");
  (result.skillGaps || []).forEach((gap) => lines.push(`- ${gap}`));
  lines.push("", "## 12주 계획");
  (result.plan || []).forEach((phase) => lines.push(`- **${phase.period} · ${phase.title}** — ${phase.deliverable || phase.action || ""}`));
  if (result.nextQuestion) lines.push("", `## 다음 결정`, result.nextQuestion);
  return lines.join("\n");
}
