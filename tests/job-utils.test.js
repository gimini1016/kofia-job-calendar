import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCalendarDays,
  daysUntil,
  deadlineLabel,
  filterJobs,
  jobAvailability,
  jobsInMonth,
  parseISODate,
  sortJobsForAvailability,
  toISODate,
} from "../src/job-utils.js";

const sampleJobs = [
  {
    id: "1",
    company: "한빛증권",
    title: "리서치 신입",
    employment: "정규직",
    experience: "new",
    roles: ["리서치"],
    endDate: "2026-10-03",
  },
  {
    id: "2",
    company: "다온자산운용",
    title: "준법감시 경력",
    employment: "계약직",
    experience: "career",
    roles: ["컴플라이언스"],
    endDate: "2026-11-10",
  },
  {
    id: "3",
    company: "미래운용",
    title: "경영지원 담당",
    employment: "정규직",
    experience: "career",
    roles: ["경영지원", "회계"],
    endDate: null,
    postedDate: "2026-10-01",
  },
];

test("ISO 날짜를 로컬 날짜로 안전하게 변환한다", () => {
  const date = parseISODate("2026-10-03");
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 9);
  assert.equal(date.getDate(), 3);
  assert.equal(toISODate(date), "2026-10-03");
});

test("마감일까지 남은 날짜와 라벨을 계산한다", () => {
  const reference = new Date(2026, 8, 30, 18, 30);
  assert.equal(daysUntil("2026-10-03", reference), 3);
  assert.equal(deadlineLabel("2026-09-30", reference), "D-DAY");
  assert.equal(deadlineLabel("2026-09-29", reference), "마감");
  assert.equal(daysUntil(null, reference), null);
  assert.equal(deadlineLabel(null, reference), "마감일 미정");
});

test("검색, 경력 조건, 관심 공고를 함께 필터링한다", () => {
  assert.deepEqual(filterJobs(sampleJobs, { query: "리서치" }).map((job) => job.id), ["1"]);
  assert.deepEqual(filterJobs(sampleJobs, { experience: "career" }).map((job) => job.id), ["2", "3"]);
  assert.deepEqual(
    filterJobs(sampleJobs, { savedOnly: true, savedIds: new Set(["2"]) }).map((job) => job.id),
    ["2"],
  );
  assert.deepEqual(
    filterJobs(sampleJobs, { roleGroup: "backoffice" }).map((job) => job.id),
    ["2", "3"],
  );
  assert.deepEqual(
    filterJobs(sampleJobs, { availability: "open", referenceDate: new Date(2026, 9, 7) }).map((job) => job.id),
    ["2"],
  );
});

test("지원 가능·마감일 미정·마감 공고를 구분하고 상태에 맞게 정렬한다", () => {
  const reference = new Date(2026, 9, 7);
  assert.equal(jobAvailability(sampleJobs[0], reference), "closed");
  assert.equal(jobAvailability(sampleJobs[1], reference), "open");
  assert.equal(jobAvailability(sampleJobs[2], reference), "unknown");
  assert.deepEqual(
    sortJobsForAvailability([
      { ...sampleJobs[0], endDate: "2026-09-20" },
      sampleJobs[0],
    ], "closed", reference).map((job) => job.endDate),
    ["2026-10-03", "2026-09-20"],
  );
});

test("달력은 일요일부터 시작하는 6주 단위로 만든다", () => {
  const days = buildCalendarDays(2026, 9);
  assert.equal(days.length, 42);
  assert.equal(days[0].key, "2026-09-27");
  assert.equal(days.at(-1).key, "2026-11-07");
  assert.equal(days.filter((day) => day.inCurrentMonth).length, 31);
});

test("선택한 달에 마감하는 공고만 반환한다", () => {
  assert.deepEqual(jobsInMonth(sampleJobs, 2026, 9).map((job) => job.id), ["1"]);
});
