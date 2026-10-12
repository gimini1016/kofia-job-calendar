import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeHtmlEntities,
  extractDetailSections,
  mergeJobSnapshots,
  parseDetailPage,
  parseListPage,
  serializeJobsModule,
} from "../scripts/kofia-parser.mjs";

const listFixture = `
  <table><tbody><tr>
    <td class="first num">33938</td>
    <td>흥국증권</td>
    <td class="left new"><span><a href="./view.do?seq=42556&amp;page=1"></span>[흥국증권] 준법감시팀 경력 직원 채용</a></td>
    <td></td><td class="num">2026-10-07</td>
  </tr></tbody></table>`;

const detailFixture = `
  <table><tbody>
    <tr><th class="first">제목</th><td colspan="3">[흥국증권] 준법감시팀 경력 직원 채용</td></tr>
    <tr><th class="first">등록일</th><td>2026-10-07 09:28:37</td><th>조회수</th><td>66</td></tr>
    <tr><th class="first">회원사명</th><td>흥국증권</td><th>접수기간</th><td>20260922~20261031</td></tr>
    <tr><th class="first">사이트바로가기</th><td colspan="3"><a href="https://example.com/apply">지원</a></td></tr>
    <tr><th class="first center" colspan="4">내용</th></tr>
    <tr><td colspan="4"><div id="write">&#51456;&#48277;&#44048;&#49884;&#54016; 경력 직원 모집<br/>▶ 담당업무<br/>- 컴플라이언스 업무<br/>▶ 지원자격<br/>- 관련 경력 5년 이상<br/>▶ 근무조건<br/>- 근무지 : 서울 영등포구<br/>▶ 접수기간<br/>- 접수기간 : 2026년 9월 22일 ~ 10월 31일 오후 5시까지<br/>- 접수방법 : recruit@example.com</div></td></tr>
  </tbody></table>`;

test("KOFIA 목록에서 게시번호·회사·제목·등록일을 추출한다", () => {
  assert.deepEqual(parseListPage(listFixture), [{
    seq: "42556",
    company: "흥국증권",
    title: "[흥국증권] 준법감시팀 경력 직원 채용",
    postedDate: "2026-10-07",
    sourceUrl: "https://www.kofia.or.kr/brd/m_96/view.do?seq=42556",
  }]);
});

test("KOFIA 상세에서 기간·본문·직무를 정규화한다", () => {
  const listing = parseListPage(listFixture)[0];
  const job = parseDetailPage(detailFixture, listing);
  assert.equal(job.id, "kofia-42556");
  assert.equal(job.startDate, "2026-09-22");
  assert.equal(job.endDate, "2026-10-31");
  assert.equal(job.experience, "career");
  assert.equal(job.location, "서울 영등포구");
  assert.ok(job.roles.includes("준법감시"));
  assert.equal(job.applyUrl, "https://example.com/apply");
  assert.equal(job.applicationEmail, "recruit@example.com");
  assert.equal(job.deadlineAt, "2026-10-31T17:00:00+09:00");
  assert.deepEqual(job.sections.responsibilities, ["컴플라이언스 업무"]);
  assert.deepEqual(job.sections.requirements, ["관련 경력 5년 이상"]);
  assert.match(job.fullText, /접수방법/);
  assert.match(job.summary, /준법감시팀/);
});

test("원문 전체를 보존하고 항목별로 분리한다", () => {
  const longRequirement = "데이터 분석 역량 ".repeat(60);
  const body = `▶ 담당업무\n- 리서치 자료 작성\n▶ 자격요건\n- ${longRequirement}\n▶ 우대사항\n- Python 활용`;
  const sections = extractDetailSections(body);
  assert.deepEqual(sections.responsibilities, ["리서치 자료 작성"]);
  assert.match(sections.requirements[0], /데이터 분석 역량/);
  assert.deepEqual(sections.preferred, ["Python 활용"]);
});

test("HTML 숫자 엔티티를 한글로 복원한다", () => {
  assert.equal(decodeHtmlEntities("&#44552;&#50997;투자"), "금융투자");
});

test("기존 공고를 보존하고 신규 공고를 병합하며 상태를 갱신한다", () => {
  const existing = [{
    id: "kofia-1", company: "기존", title: "기존 공고", endDate: "2026-10-01", postedDate: "2026-09-01",
    sourceUrl: "https://www.kofia.or.kr/brd/m_96/view.do?seq=1",
  }];
  const incoming = [{
    id: "kofia-2", company: "신규", title: "신규 공고", endDate: "2026-10-20", postedDate: "2026-10-07",
    sourceUrl: "https://www.kofia.or.kr/brd/m_96/view.do?seq=2",
  }];
  const merged = mergeJobSnapshots(existing, incoming, "2026-10-07");
  assert.deepEqual(merged.map((job) => job.id), ["kofia-2", "kofia-1"]);
  assert.equal(merged[0].status, "진행중");
  assert.equal(merged[1].status, "마감");
});

test("생성 모듈에 확인 날짜와 출처를 남긴다", () => {
  const output = serializeJobsModule([], "2026-10-07");
  assert.match(output, /DATA_SNAPSHOT_DATE = "2026-10-07"/);
  assert.match(output, /kofia\.or\.kr/);
});
