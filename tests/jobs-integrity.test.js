import test from "node:test";
import assert from "node:assert/strict";

import { DATA_SNAPSHOT_DATE, jobs } from "../src/jobs.js";

test("모든 KOFIA 공고는 원문 보존 여부와 출처를 명확히 표시한다", () => {
  assert.match(DATA_SNAPSHOT_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(jobs.length >= 409);
  jobs.forEach((job) => {
    assert.equal(typeof job.detailAvailable, "boolean", `${job.id} 상세 상태 누락`);
    if (job.detailAvailable) assert.ok(job.fullText?.length >= job.title.length, `${job.id} 원문 누락`);
    else assert.equal(job.fullText, null, `${job.id} 수집 불가 원문을 완전한 정보처럼 표시함`);
    assert.ok(job.summary?.length <= 301, `${job.id} 요약 길이 초과`);
    assert.match(job.sourceUrl, /^https:\/\/www\.kofia\.or\.kr\/brd\/m_96\/view\.do\?seq=\d+$/);
  });
});

test("미래에셋증권 RA 공고는 마감 시각과 지원 정보를 정확히 보존한다", () => {
  const job = jobs.find((item) => item.id === "kofia-42588");
  assert.ok(job);
  assert.equal(job.employment, "아르바이트");
  assert.equal(job.deadlineAt, "2026-10-12T08:00:00+09:00");
  assert.equal(job.applicationEmail, "research_recruit@miraeasset.com");
  assert.deepEqual(job.roles, ["리서치", "데이터", "퀀트", "ESG"]);
  assert.match(job.fullText, /월 급여 1,888,560원/);
  assert.match(job.fullText, /8:00~16:30/);
  assert.match(job.fullText, /Webex 화상면접/);
  assert.ok(job.sections.workConditions.length >= 4);
  assert.ok(job.sections.application.length >= 7);
});
