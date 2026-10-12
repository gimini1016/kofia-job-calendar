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
  ["퀀트", /quant|퀀트|계량분석|팩터투자/gi],
  ["ESG", /\besg\b|책임투자|지속가능투자/gi],
  ["마케팅", /마케팅|브랜드|콘텐츠|홍보/gi],
];

const SKILL_PATTERNS = [
  ["금융시장 이해", /금융\s*시장|자본시장|거시경제/gi],
  ["재무·회계", /재무|회계|결산|세무/gi],
  ["데이터 분석", /데이터|통계|분석|리서치/gi],
  ["코딩", /코딩|python|파이썬|sql|github|개발/gi],
  ["AI 활용", /\bai\b|인공지능|머신러닝|llm|클로드|코덱스/gi],
  ["MS Office", /ms\s*office|ms오피스|엑셀|excel|powerpoint|ppt/gi],
  ["외국어", /외국어|영어|어학|english/gi],
  ["금융 자격증", /투자자산운용사|cfa|frm|scr|금융투자분석사|자격증/gi],
  ["커뮤니케이션", /커뮤니케이션|의사소통|협업/gi],
];

const SECTION_RULES = [
  ["responsibilities", /^(?:담당할\s*)?(?:주요\s*)?(?:담당\s*업무|업무\s*내용|수행\s*직무|직무\s*내용|role\s*&?\s*responsibility)\s*(?:[:：-]\s*)?(.*)$/i],
  ["requirements", /^(?:필수\s*)?(?:지원\s*자격|자격\s*요건|채용\s*요구\s*사항|필수\s*요건|필요\s*역량|응시\s*자격)\s*(?:[:：-]\s*)?(.*)$/i],
  ["preferred", /^(?:이런\s*역량이\s*있다면\s*더욱\s*좋아요|우대\s*사항|우대\s*조건|우대\s*요건)\s*(?:[:：-]\s*)?(.*)$/i],
  ["workConditions", /^(?:근무\s*조건|채용\s*조건|고용\s*조건|근무지|근무\s*장소|근무\s*시간|급여|보수|출근\s*일자)\s*(?:[:：-]\s*)?(.*)$/i],
  ["application", /^(?:접수\s*기간|지원\s*방법|접수\s*방법|제출\s*서류|이력서\s*접수\s*방법|지원서\s*제출)\s*(?:[:：-]\s*)?(.*)$/i],
  ["process", /^(?:채용\s*단계|채용\s*절차|전형\s*절차|전형\s*방법|면접\s*방식(?:\s*및\s*일시)?)\s*(?:[:：-]\s*)?(.*)$/i],
  ["overview", /^(?:모집\s*분야(?:\s*및\s*모집\s*인원)?|모집\s*부문|채용\s*부문|모집\s*인원|채용\s*인원|모집\s*개요)\s*(?:[:：-]\s*)?(.*)$/i],
  ["notes", /^(?:기타\s*사항|유의\s*사항|기\s*타)\s*(?:[:：-]\s*)?(.*)$/i],
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
  if (/파트타임|아르바이트/.test(title)) return "아르바이트";
  if (/인턴/.test(title)) return "인턴";
  const text = String(body).slice(0, 1600);
  if (/정규직/.test(text)) return "정규직";
  if (/계약직/.test(text)) return "계약직";
  if (/파트타임|아르바이트/.test(text)) return "아르바이트";
  if (/인턴/.test(text)) return "인턴";
  return "미분류";
}

function inferPatternLabels(text, patterns) {
  return patterns.filter(([, pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }).map(([label]) => label);
}

function inferRoles(title, sections) {
  const text = [title, ...(sections.responsibilities || []), ...(sections.overview || []).slice(0, 3)].join("\n");
  const roles = ROLE_PATTERNS.filter(([, pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }).map(([role]) => role);
  return roles.length ? roles : ["금융일반"];
}

function inferSkills(sections) {
  const text = [...(sections.requirements || []), ...(sections.preferred || [])].join("\n");
  return inferPatternLabels(text, SKILL_PATTERNS);
}

function inferLocation(body) {
  const match = String(body).match(/(?:근무지|근무장소|소재지)\s*[:：]?\s*([^\n]{2,80})/i);
  const candidate = match?.[1]?.replace(/\s{2,}.*/, "").trim();
  if (candidate) return candidate.slice(0, 80);
  const city = String(body).match(/서울(?:특별시)?|부산(?:광역시)?|대구(?:광역시)?|인천(?:광역시)?|광주(?:광역시)?|대전(?:광역시)?|울산(?:광역시)?|세종(?:특별자치시)?|경기(?:도)?|제주(?:도)?/);
  return city?.[0] || "미기재";
}

function stripLineMarker(value) {
  return String(value)
    .replace(/^[▶■□◆●○※*·\-\s]+/, "")
    .replace(/^\d+\s*[.)]\s*/, "")
    .trim();
}

function appendUnique(section, value) {
  const normalized = stripLineMarker(value);
  if (!normalized || section.includes(normalized)) return;
  section.push(normalized);
}

export function extractDetailSections(body) {
  const sections = {
    overview: [],
    responsibilities: [],
    requirements: [],
    preferred: [],
    workConditions: [],
    application: [],
    process: [],
    notes: [],
  };
  let current = "overview";

  String(body).split("\n").map((line) => line.trim()).filter(Boolean).forEach((rawLine) => {
    const line = stripLineMarker(rawLine);
    const compositeHeading = /^(?:모집\s*분야\s*및\s*자격\s*요건|채용\s*내용)$/i.test(line);
    if (compositeHeading) {
      current = "overview";
      return;
    }

    const matchedRule = SECTION_RULES.find(([, pattern]) => pattern.test(line));
    if (matchedRule) {
      const [sectionKey, pattern] = matchedRule;
      pattern.lastIndex = 0;
      const remainder = line.match(pattern)?.[1]?.trim() || "";
      current = sectionKey;
      if (remainder) appendUnique(sections[current], remainder);
      return;
    }

    appendUnique(sections[current], line);
  });

  return Object.fromEntries(Object.entries(sections).filter(([, values]) => values.length));
}

function inferApplicationEmail(body) {
  return String(body).match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || null;
}

function inferDeadlineAt(body, endDate) {
  if (!endDate) return null;
  const [, endMonth, endDay] = endDate.split("-").map(Number);
  const deadlineLines = String(body).split("\n").filter((line) => (
    /접수|마감|제출|까지/.test(line)
    && (line.includes(`${endMonth}월`) || line.includes(String(endDay).padStart(2, "0")) || line.includes(`${endDay}일`))
  ));

  for (const line of deadlineLines) {
    if (/자정/.test(line)) return `${endDate}T23:59:59+09:00`;
    const match = line.match(/(오전|오후)?\s*(\d{1,2})\s*(?::|시)\s*(\d{1,2})?/);
    if (!match) continue;
    let hour = Number(match[2]);
    const minute = Number(match[3] || 0);
    if (match[1] === "오후" && hour < 12) hour += 12;
    if (match[1] === "오전" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) continue;
    return `${endDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
  }
  return null;
}

function compactSummary(body, limit = 300) {
  const value = String(body).replace(/\s+/g, " ").trim();
  if (value.length <= limit) return value;
  const candidate = value.slice(0, limit + 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > limit * 0.72 ? boundary : limit).trim()}…`;
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
  const sections = extractDetailSections(body);

  return {
    id: `kofia-${listing.seq}`,
    company,
    title,
    startDate: startDate || postedDate,
    endDate,
    postedDate,
    experience: inferExperience(title, body),
    employment: inferEmployment(title, body),
    roles: inferRoles(title, sections),
    skills: inferSkills(sections),
    location: inferLocation(body),
    summary: compactSummary(body) || title,
    fullText: body || null,
    detailAvailable: Boolean(body),
    sections,
    source: "KOFIA 회원사 채용안내",
    sourceUrl: listing.sourceUrl,
    applyUrl,
    applicationEmail: inferApplicationEmail(body),
    deadlineAt: inferDeadlineAt(body, endDate),
    deadlineUnknown: !endDate,
    status: "확인필요",
    isDemo: false,
  };
}

function statusFor(job, snapshotDate) {
  if (!job.endDate) return "마감일 미정";
  if (job.deadlineAt) {
    const exactDeadline = new Date(job.deadlineAt);
    if (!Number.isNaN(exactDeadline.getTime()) && exactDeadline.getTime() < Date.now()) return "마감";
  }
  return job.endDate >= snapshotDate ? "진행중" : "마감";
}

export function mergeJobSnapshots(existingJobs, refreshedJobs, snapshotDate) {
  const refreshed = new Map(refreshedJobs.map((job) => [job.id, job]));
  const merged = existingJobs.map((job) => {
    const update = refreshed.get(job.id);
    refreshed.delete(job.id);
    const next = update ? { ...job, ...update } : { ...job };
    const detailAvailable = typeof next.detailAvailable === "boolean"
      ? next.detailAvailable
      : Boolean(next.fullText && (Object.keys(next.sections || {}).length || next.fullText.length > next.title.length));
    return {
      ...next,
      fullText: detailAvailable ? next.fullText : null,
      detailAvailable,
      status: statusFor(next, snapshotDate),
      deadlineUnknown: !next.endDate,
    };
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
