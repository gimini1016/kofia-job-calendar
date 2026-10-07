import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeJobTrendsTool,
  buildCompatibilityResult,
  compareCapstonesTool,
  executeAgentTool,
  inferProfileFromText,
  searchJobsTool,
} from "../src/agent-tools.js";

test("Agent 채용 검색은 실제 KOFIA 공고와 원문 URL만 반환한다", () => {
  const result = searchJobsTool({ query: "금융 데이터", roleGroup: "data", limit: 5 });
  assert.ok(result.jobs.length > 0);
  assert.ok(result.jobs.length <= 5);
  assert.ok(result.jobs.every((job) => job.id.startsWith("kofia-") && job.sourceUrl.includes("kofia.or.kr")));
  assert.ok(result.jobs.some((job) => /데이터|AI|IT/.test(`${job.title} ${job.roles.join(" ")}`)));
});

test("Agent 트렌드 도구는 관련 표본과 빈도를 계산한다", () => {
  const result = analyzeJobTrendsTool({ targetRoles: ["경영기획", "재무·회계"] });
  assert.ok(result.sampleSize > 0);
  assert.ok(result.topRoles.length > 0);
  assert.ok(result.topSkills.every((item) => Number.isInteger(item.count) && item.count >= 0));
});

test("금융·공개·채용 우선 조건에서는 동훈인베스트먼트가 1순위다", () => {
  const result = compareCapstonesTool({
    tracks: ["finance"],
    priorities: ["portfolio", "hiring", "stability"],
    limit: 3,
  });
  assert.equal(result.projects[0].id, "donghoon");
  assert.equal(result.projects.length, 3);
});

test("인사·총무에서 안정성을 중시하면 창업 준비 후보를 자동으로 경계한다", () => {
  const result = compareCapstonesTool({ tracks: ["hr"], priorities: ["stability"], limit: 5 });
  const national = result.projects.findIndex((project) => project.id === "government-data");
  const startup = result.projects.findIndex((project) => project.id === "jido-labs");
  assert.ok(national !== -1 && startup !== -1);
  assert.ok(national < startup);
});

test("자연어에서 진로 트랙과 우선조건을 추출한다", () => {
  const profile = inferProfileFromText("백오피스와 재무회계에 관심 있고 공개 포트폴리오와 안정적인 운영이 중요해요");
  assert.deepEqual(profile.tracks.sort(), ["accounting", "backoffice"].sort());
  assert.ok(profile.priorities.includes("portfolio"));
  assert.ok(profile.priorities.includes("stability"));
});

test("허용되지 않은 Agent 도구는 실행하지 않는다", () => {
  assert.throws(() => executeAgentTool("delete_database", {}), /허용되지 않은 도구/);
});

test("호환 모드도 실제 공고와 12주 계획을 반환한다", () => {
  const called = [];
  const result = buildCompatibilityResult("금융권 취업과 공개 가능한 포트폴리오가 중요해요", (tool) => called.push(tool));
  assert.equal(result.mode, "compatibility");
  assert.equal(result.recommendations.length, 3);
  assert.equal(result.plan.length, 6);
  assert.ok(result.jobEvidence.every((job) => job.sourceUrl.includes("kofia.or.kr")));
  assert.deepEqual(called, ["search_jobs", "analyze_job_trends", "compare_capstones", "build_portfolio_plan"]);
});
