const DAY_IN_MS = 86_400_000;

const ROLE_GROUPS = {
  front: ["자산운용", "주식", "대체투자", "리서치", "기업분석", "IB", "기업금융", "트레이딩", "채권", "파생상품"],
  data: ["데이터", "IT", "AI"],
  backoffice: ["경영지원", "경영관리", "경영기획", "인사", "총무", "회계", "펀드회계", "운용지원", "준법감시", "컴플라이언스", "리스크", "법무"],
};

export function parseISODate(value) {
  if (!value || typeof value !== "string") return null;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntil(dateValue, referenceDate = new Date()) {
  const target = typeof dateValue === "string" ? parseISODate(dateValue) : startOfDay(dateValue);
  const reference = startOfDay(referenceDate);
  if (!target || !reference) return null;
  return Math.round((target.getTime() - reference.getTime()) / DAY_IN_MS);
}

export function deadlineLabel(endDate, referenceDate = new Date()) {
  const days = daysUntil(endDate, referenceDate);
  if (days === null) return "마감일 미정";
  if (days < 0) return "마감";
  if (days === 0) return "D-DAY";
  return `D-${days}`;
}

export function isOpen(job, referenceDate = new Date()) {
  return jobAvailability(job, referenceDate) === "open";
}

export function jobAvailability(job, referenceDate = new Date()) {
  const days = daysUntil(job.endDate, referenceDate);
  if (days === null) return "unknown";
  return days >= 0 ? "open" : "closed";
}

export function isClosingSoon(job, referenceDate = new Date()) {
  const days = daysUntil(job.endDate, referenceDate);
  return days !== null && days >= 0 && days <= 7;
}

export function formatKoreanDate(value, options = {}) {
  const date = typeof value === "string" ? parseISODate(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: options.weekday ? "short" : undefined,
    year: options.year ? "numeric" : undefined,
  }).format(date);
}

export function buildCalendarDays(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const firstVisibleDay = new Date(year, monthIndex, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDay);
    date.setDate(firstVisibleDay.getDate() + index);
    return {
      date,
      key: toISODate(date),
      inCurrentMonth: date.getMonth() === monthIndex,
    };
  });
}

export function filterJobs(jobs, filters = {}) {
  const query = (filters.query || "").trim().toLocaleLowerCase("ko-KR");
  const savedIds = filters.savedIds || new Set();

  return jobs.filter((job) => {
    const searchable = [job.company, job.title, job.employment, ...job.roles]
      .join(" ")
      .toLocaleLowerCase("ko-KR");
    const matchesQuery = !query || searchable.includes(query);
    const matchesExperience = !filters.experience || filters.experience === "all"
      ? true
      : job.experience === filters.experience;
    const groupRoles = ROLE_GROUPS[filters.roleGroup];
    const matchesRoleGroup = !groupRoles
      || job.roles.some((role) => groupRoles.some((keyword) => role.includes(keyword)));
    const matchesSaved = !filters.savedOnly || savedIds.has(job.id);
    const matchesAvailability = !filters.availability || filters.availability === "all"
      ? true
      : jobAvailability(job, filters.referenceDate || new Date()) === filters.availability;
    return matchesQuery && matchesExperience && matchesRoleGroup && matchesSaved && matchesAvailability;
  });
}

export function jobsInMonth(jobs, year, monthIndex) {
  return jobs.filter((job) => {
    const deadline = parseISODate(job.endDate);
    if (!deadline) return false;
    return deadline.getFullYear() === year && deadline.getMonth() === monthIndex;
  });
}

export function sortByDeadline(jobs) {
  return [...jobs].sort((a, b) => {
    if (!a.endDate && !b.endDate) return (b.postedDate || "").localeCompare(a.postedDate || "");
    if (!a.endDate) return 1;
    if (!b.endDate) return -1;
    return a.endDate.localeCompare(b.endDate);
  });
}

export function sortJobsForAvailability(jobs, availability = "all", referenceDate = new Date()) {
  const sorted = [...jobs];
  if (availability === "closed") {
    return sorted.sort((a, b) => (b.endDate || "").localeCompare(a.endDate || "")
      || (b.postedDate || "").localeCompare(a.postedDate || ""));
  }
  if (availability === "unknown") {
    return sorted.sort((a, b) => (b.postedDate || "").localeCompare(a.postedDate || ""));
  }
  if (availability === "open") return sortByDeadline(sorted);

  const order = { open: 0, unknown: 1, closed: 2 };
  return sorted.sort((a, b) => {
    const aStatus = jobAvailability(a, referenceDate);
    const bStatus = jobAvailability(b, referenceDate);
    if (aStatus !== bStatus) return order[aStatus] - order[bStatus];
    if (aStatus === "closed") return (b.endDate || "").localeCompare(a.endDate || "");
    if (aStatus === "unknown") return (b.postedDate || "").localeCompare(a.postedDate || "");
    return (a.endDate || "9999-12-31").localeCompare(b.endDate || "9999-12-31");
  });
}
