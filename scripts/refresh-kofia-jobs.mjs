import { rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { jobs as existingJobs } from "../src/jobs.js";
import {
  KOFIA_LIST_URL,
  mergeJobSnapshots,
  parseDetailPage,
  parseListPage,
  serializeJobsModule,
} from "./kofia-parser.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const jobsPath = join(scriptDirectory, "..", "src", "jobs.js");
const temporaryPath = `${jobsPath}.next`;
const requestDelayMs = Number.parseInt(process.env.KOFIA_REQUEST_DELAY_MS || "700", 10);
const maximumListPages = Number.parseInt(process.env.KOFIA_MAX_LIST_PAGES || "30", 10);
const recentRefreshCount = Number.parseInt(process.env.KOFIA_REFRESH_RECENT_COUNT || "20", 10);
const maximumNewDetails = Number.parseInt(process.env.KOFIA_MAX_NEW_DETAILS || "150", 10);
const dryRun = process.argv.includes("--dry-run");

function snapshotDateInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function wait(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(url, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
        "User-Agent": "CareerPortfolioLab/1.0 (+https://github.com/gimini1016/kofia-job-calendar)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text.includes("금융투자협회")) throw new Error("예상한 KOFIA HTML이 아닙니다.");
    return text;
  } catch (error) {
    if (attempt >= 3) throw new Error(`${url} 요청 실패: ${error.message}`);
    await wait(1_000 * attempt);
    return fetchText(url, attempt + 1);
  } finally {
    clearTimeout(timeout);
  }
}

async function collectRecentListings() {
  const existingIds = new Set(existingJobs.map((job) => job.id));
  const listings = [];
  const seen = new Set();
  let reachedExistingData = false;

  for (let page = 1; page <= maximumListPages; page += 1) {
    const separator = KOFIA_LIST_URL.includes("?") ? "&" : "?";
    const html = await fetchText(`${KOFIA_LIST_URL}${separator}page=${page}`);
    const pageListings = parseListPage(html);
    if (pageListings.length < 5) throw new Error(`목록 ${page}페이지에서 공고를 ${pageListings.length}건만 찾았습니다.`);

    pageListings.forEach((listing) => {
      if (!seen.has(listing.seq)) {
        listings.push(listing);
        seen.add(listing.seq);
      }
    });

    const knownOnPage = pageListings.filter((listing) => existingIds.has(`kofia-${listing.seq}`)).length;
    if (knownOnPage >= 3) reachedExistingData = true;
    process.stdout.write(`목록 ${page}페이지 확인 · 누적 ${listings.length}건\n`);

    if (page >= 2 && reachedExistingData) break;
    await wait(requestDelayMs);
  }

  if (!reachedExistingData && existingJobs.length) {
    throw new Error(`${maximumListPages}페이지 안에서 기존 공고를 찾지 못했습니다. 덮어쓰지 않습니다.`);
  }
  return listings;
}

function validateJobs(jobs) {
  if (jobs.length < existingJobs.length) throw new Error("기존 공고가 누락되어 갱신을 중단했습니다.");
  const ids = new Set();
  jobs.forEach((job) => {
    if (!/^kofia-\d+$/.test(job.id)) throw new Error(`잘못된 공고 ID: ${job.id}`);
    if (ids.has(job.id)) throw new Error(`중복 공고 ID: ${job.id}`);
    if (!job.company || !job.title || !job.sourceUrl?.includes("kofia.or.kr")) {
      throw new Error(`필수 필드가 비어 있습니다: ${job.id}`);
    }
    ids.add(job.id);
  });
}

async function main() {
  const snapshotDate = snapshotDateInSeoul();
  const listings = await collectRecentListings();
  const existingIds = new Set(existingJobs.map((job) => job.id));
  const newListings = listings.filter((listing) => !existingIds.has(`kofia-${listing.seq}`));
  if (newListings.length > maximumNewDetails) {
    throw new Error(`신규 공고가 ${newListings.length}건으로 안전 한도 ${maximumNewDetails}건을 넘었습니다.`);
  }

  const detailCandidates = new Map();
  [...newListings, ...listings.slice(0, recentRefreshCount)]
    .forEach((listing) => detailCandidates.set(listing.seq, listing));
  process.stdout.write(`신규 ${newListings.length}건 · 최근 재확인 포함 상세 ${detailCandidates.size}건\n`);

  const refreshedJobs = [];
  let index = 0;
  for (const listing of detailCandidates.values()) {
    if (index > 0) await wait(requestDelayMs);
    const html = await fetchText(listing.sourceUrl);
    const job = parseDetailPage(html, listing);
    if (!job.title || !job.company || job.summary.length < 5) {
      throw new Error(`상세 파싱 결과가 불완전합니다: ${listing.sourceUrl}`);
    }
    refreshedJobs.push(job);
    index += 1;
    if (index % 10 === 0 || index === detailCandidates.size) {
      process.stdout.write(`상세 ${index}/${detailCandidates.size}건 확인\n`);
    }
  }

  const mergedJobs = mergeJobSnapshots(existingJobs, refreshedJobs, snapshotDate);
  validateJobs(mergedJobs);
  const output = serializeJobsModule(mergedJobs, snapshotDate);

  if (!dryRun) {
    await writeFile(temporaryPath, output, "utf8");
    await rename(temporaryPath, jobsPath);
  }
  process.stdout.write(`${dryRun ? "검증" : "갱신"} 완료 · ${existingJobs.length} → ${mergedJobs.length}건 · ${snapshotDate}\n`);
}

main().catch((error) => {
  process.stderr.write(`KOFIA 자동 갱신 실패: ${error.message}\n`);
  process.exitCode = 1;
});
