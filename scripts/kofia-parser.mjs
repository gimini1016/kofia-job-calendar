export const KOFIA_BASE_URL = "https://www.kofia.or.kr";
export const KOFIA_LIST_URL = `${KOFIA_BASE_URL}/brd/m_96/list.do?multi_itm_seq=0`;

const NAMED_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
  rarr: "→",
};

const ROLE_PATTERNS = [
  ["경영지원", /경영지원|업무지원/gi],
  ["경영관리", /경영관리/gi],
  ["경영기획", /경영기획|사업기획|전략기획/gi],
  ["인사", /인사팀|인사관리|채용담당|노무|급여/gi],
  ["총무", /총무/gi],
  ["회계", /회계|결산|전표|세무|재무제표/gi],
  ["펀드회계", /펀드회계|기준가격/gi],
  ["운용지원", /운용지원|펀드관리|오퍼레이션|operation/gi],
  ["준법감시", /준법감시|컴플라이언스|compliance/gi],
  ["리스크", /리스크|위험관리|risk/gi],
  ["법무", /법무|변호사/gi],
  ["리서치", /리서치|research|애널리스트|심사역/gi],
  ["기업분석", /기업분석|산업분석|밸류에이션/gi],
  ["IB", /\bib\b|투자금융|인수금융|ipo|m&a/gi],
  ["기업금융", /기업금융|corporate finance/gi],
  ["자산운용", /자산운용|운용역|포트폴리오 매니저/gi],
  ["주식", /주식|equity|에쿼티/gi],
  ["채권", /채권|fixed income|ficc/gi],
  ["파생상품", /파생상품|파생|derivative/gi],
  ["대체투자", /대체투자|부동산금융|인프라|pef|사모펀드/gi],
  ["트레이딩", /트레이딩|trading|트레이더|딜러/gi],
  ["데이터", /데이터|data|sql|분석/gi],
  ["IT", /\bit\b|시스템|개발자|엔지니어|정보보호|보안/gi],
  ["AI", /\bai\b|인공지능|머신러닝|llm/gi],
  ["마케팅", /마케팅|브랜드|콘텐츠|홍보/gi],
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (entity, name) => NAMED_ENTITIES[name.toLowerCase()] ?? entity);
}

export function htmlToText(value = "") {
  return decodeHtmlEntities(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|li|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractCells(rowHtml) {
  return [...String(rowHtml).matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((match) => htmlToText(match[1]));
}

export function parseListPage(html) {
  const tbody = String(html).match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || "";
  return [...tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const row = match[1];
    const link = row.match(/href=["'][^"']*view\.do\?seq=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) return [];
    const cells = extractCells(row);
    const postedDate = cells.find((cell) => /^\d{4}-\d{2}-\d{2}$/.test(cell)) || "";
    return [{
      seq: link[1],
      company: cells[1] || "미기재",
      title: htmlToText(link[2]),
      postedDate,
      sourceUrl: `${KOFIA_BASE_URL}/brd/m_96/view.do?seq=${link[1]}`,
    }];
  });
}

function extractTableValue(html, label) {
  const pattern = new RegExp(`<th\\b[^>]*>\\s*${escapeRegExp(label)}\\s*</th>\\s*<td\\b[^>]*>([\\s\\S]*?)</td>`, "i");
  return htmlToText(String(html).match(pattern)?.[1] || "");
}

function extractTableHtml(html, label) {
  const pattern = new RegExp(`<th\\b[^>]*>\\s*${escapeRegExp(label)}\\s*</th>\\s*<td\\b[^>]*>([\\s\\S]*?)</td>`, "i");
  return String(html).match(pattern)?.[1] || "";
}

function normalizeDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractReceptionDates(value) {
  const dates = String(value || "").match(/\d{8}/g) || [];
  return {
    startDate: normalizeDate(dates[0]),
    endDate: normalizeDate(dates[1]),
  };
}

function inferExperience(title, body) {
  const heading = String(title).toLowerCase();
  if (/신입\s*[·/&,및~-]+\s*경력|경력\s*[·/&,및~-]+\s*신입|신입경력/.test(heading)) return "both";
  if (/신입/.test(heading)) return "new";
  if (/경력/.test(heading)) return "career";
  const opening = String(body).slice(0, 1400);
  if (/신입\s*(및|또는|\/|·|,|~)\s*경력|경력\s*(및|또는|\/|·|,|~)\s*신입/.test(opening)) return "both";
  if (/경력\s*\d+\s*년|\d+\s*년\s*이상\s*경력|경력자/.test(opening)) return "career";
  return "unknown";
}

function inferEmployment(title, body) {
  const text = `${title} ${String(body).slice(0, 1600)}`;
  if (/정규직/.test(text)) return "정규직";
  if (/계약직/.test(text)) return "계약직";
  if (/인턴/.test(text)) return "인턴";
  if (/파트타임|아르바이트/.test(text)) return "파트타임";
  return "미분류";
}

function inferRoles(title, body) {
  const text = `${title}\n${body}`;
  const roles = ROLE_PATTERNS.filter(([, pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }).map(([role]) => role);
  return roles.length ? roles : ["금융일반"];
}

function inferLocation(body) {
  const match = String(body).match(/(?:근무지|근무장소|소재지)\s*[:：]?\s*([^\n]{2,80})/i);
  const candidate = match?.[1]?.replace(/\s{2,}.*/, "").trim();
  if (candidate) return candidate.slice(0, 80);
  const city = String(body).match(/서울(?:특별시)?|부산(?:광역시)?|대구(?:광역시)?|인천(?:광역시)?|광주(?:광역시)?|대전(?:광역시)?|울산(?:광역시)?|세종(?:특별자치시)?|경기(?:도)?|제주(?:도)?/);
  return city?.[0] || "미기재";
}

function compactSummary(body) {
  return String(body).replace(/\s+/g, " ").trim().slice(0, 520);
}

export function parseDetailPage(html, listing) {
  const title = extractTableValue(html, "제목") || listing.title;
  const company = extractTableValue(html, "회원사명") || listing.company || title.match(/^\[([^\]]+)]/)?.[1] || "미기재";
  const registeredAt = extractTableValue(html, "등록일");
  const postedDate = normalizeDate(registeredAt.slice(0, 10)) || listing.postedDate;
  const reception = extractTableValue(html, "접수기간");
  const { startDate, endDate } = extractReceptionDates(reception);
  const writeHtml = String(html).match(/<div\b[^>]*id=["']write["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
  const body = htmlToText(writeHtml);
  const siteHtml = extractTableHtml(html, "사이트바로가기");
  const rawApplyUrl = decodeHtmlEntities(siteHtml.match(/href=["']([^"']+)["']/i)?.[1] || "");
  const applyUrl = rawApplyUrl && !rawApplyUrl.toLowerCase().startsWith("javascript:")
    ? new URL(rawApplyUrl, listing.sourceUrl).href
    : null;

  return {
    id: `kofia-${listing.seq}`,
    company,
    title,
    startDate: startDate || postedDate,
    endDate,
    postedDate,
    experience: inferExperience(title, body),
    employment: inferEmployment(title, body),
    roles: inferRoles(title, body),
    location: inferLocation(body),
    summary: compactSummary(body) || title,
    source: "KOFIA 회원사 채용안내",
    sourceUrl: listing.sourceUrl,
    applyUrl,
    deadlineUnknown: !endDate,
    status: "확인필요",
    isDemo: false,
  };
}

function statusFor(job, snapshotDate) {
  if (!job.endDate) return "마감일 미정";
  return job.endDate >= snapshotDate ? "진행중" : "마감";
}

export function mergeJobSnapshots(existingJobs, refreshedJobs, snapshotDate) {
  const refreshed = new Map(refreshedJobs.map((job) => [job.id, job]));
  const merged = existingJobs.map((job) => {
    const update = refreshed.get(job.id);
    refreshed.delete(job.id);
    const next = update ? { ...job, ...update } : { ...job };
    return { ...next, status: statusFor(next, snapshotDate), deadlineUnknown: !next.endDate };
  });
  refreshed.forEach((job) => merged.push({
    ...job,
    status: statusFor(job, snapshotDate),
    deadlineUnknown: !job.endDate,
  }));
  return merged.sort((a, b) => (b.postedDate || "").localeCompare(a.postedDate || "")
    || Number.parseInt(b.id.replace(/\D/g, ""), 10) - Number.parseInt(a.id.replace(/\D/g, ""), 10));
}

export function serializeJobsModule(jobs, snapshotDate) {
  return `export const DATA_SNAPSHOT_DATE = ${JSON.stringify(snapshotDate)};\n`
    + `export const KOFIA_BOARD_URL = ${JSON.stringify(KOFIA_LIST_URL)};\n\n`
    + `// KOFIA 회원사 채용안내를 ${snapshotDate}에 자동 확인한 공개 공고 스냅샷입니다.\n`
    + "// 지원 전 반드시 sourceUrl의 원문을 다시 확인하세요.\n"
    + `export const jobs = ${JSON.stringify(jobs, null, 2)};\n`;
}
