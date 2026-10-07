# Career Portfolio Lab

14개 캡스톤 프로젝트와 금융투자협회(KOFIA) 회원사 실제 채용공고를 연결해
프로젝트 선택, 채용 트렌드 탐색, 지원 일정 관리를 한 화면에서 돕는 개인 커리어 대시보드입니다.

별도 LLM API 키나 유료 서버 없이도 브라우저 안에서 실행되는 Career Decision Agent를 포함합니다.

## 현재 데이터

- KOFIA 공개 공고 355건: 2026-10-07 자동 확인 스냅샷
- 캡스톤 후보 14개: 2026-10-02 기업설명회 전사를 반영해 5개 진로 트랙으로 비교
- 실제 지원 전 [KOFIA 회원사 채용안내](https://www.kofia.or.kr/brd/m_96/list.do?multi_itm_seq=0)와 각 회사 원문을 다시 확인해야 합니다.

## 주요 기능

- 관심 직무에 따라 14개 프로젝트 점수와 순위 즉시 재계산
- 프로젝트별 실제 데이터, 멘토링, 근무·지원, 포트폴리오 권리, 채용 신호, 리스크 확인
- 채용공고 본문 기반 주요 직무 키워드·백오피스 신호 요약
- 회사명·제목·직무 검색 및 직무군·경력 필터
- 목록의 `지원 가능 / 마감일 미정 / 마감 공고 / 전체` 분리와 상태별 정렬
- 마감 기록을 유지하는 달력, 마감일 미정 공고 보존, 관심 공고 로컬 저장
- GitHub Actions의 매일 자동 수집·검증과 변경 데이터 배포
- 12주 포트폴리오 제작 로드맵
- 자연어 목표를 해석해 공고 검색·트렌드 계산·캡스톤 비교·12주 계획 도구를 순서대로 호출하는 AI Agent
- WebGPU 지원 브라우저의 온디바이스 LLM과, 지원하지 않는 환경을 위한 결정론적 호환 모드
- 모바일 반응형·키보드 접근성

## AI Agent 실행 구조

Agent는 모델이 임의의 회사나 수치를 답하게 두지 않습니다. 모델은 다음 행동과 읽기 전용 도구만 선택하고, 최종 결과의 회사·점수·공고 URL은 로컬 데이터에서 다시 결합합니다.

```text
사용자 목표
  → 로컬 LLM이 다음 도구 선택
  → search_jobs / analyze_job_trends / compare_capstones / build_portfolio_plan
  → 도구 결과 관찰
  → 근거가 연결된 추천과 12주 계획
```

- WebGPU 사용 시: WebLLM 모델을 브라우저 캐시에 내려받아 기기 안에서 추론
- WebGPU 미지원·모델 오류 시: 같은 데이터 도구를 고정 순서로 호출하는 호환 모드
- 외부 API 키, 서버 측 추론, 사용자 질문 저장 없음
- 첫 로컬 AI 실행은 모델 다운로드 때문에 시간이 걸릴 수 있음

## 로컬 실행

Node.js 20 이상에서 별도 패키지 설치 없이 실행됩니다.

```bash
npm run dev
```

브라우저에서 <http://localhost:4173>을 여세요.

```bash
npm run check
```

KOFIA 공개 공고를 지금 다시 확인하려면 다음 명령을 실행합니다.

```bash
npm run refresh:jobs
```

## 채용공고 자동 갱신

`.github/workflows/update-kofia-jobs.yml`이 매일 00:17 UTC(한국시간 09:17)에 실행됩니다. GitHub Actions의 `Run workflow` 버튼으로 수동 실행할 수도 있습니다.

1. 최근 KOFIA 목록을 기존 공고 ID가 나올 때까지 확인합니다.
2. 신규 공고와 최근 공고 상세만 낮은 빈도로 다시 읽습니다.
3. 기존 공고는 삭제하지 않고 신규·수정 공고를 병합합니다.
4. 건수 감소, 중복 ID, 필수 필드 누락, 페이지 구조 변경 시 덮어쓰지 않고 실패합니다.
5. 전체 테스트 통과 후 `src/jobs.js`만 자동 커밋합니다.
6. GitHub와 연결된 Vercel이 새 커밋을 정적 배포합니다.

수집 결과가 바뀌지 않아도 `DATA_SNAPSHOT_DATE`를 갱신해 사이트에 마지막 확인 날짜를 표시합니다.

## 무료 Vercel 배포

개인 비상업 포트폴리오는 Vercel Hobby 범위에서 무료로 정적 배포할 수 있습니다.

```bash
npx vercel@latest --prod
```

빌드 명령과 출력 디렉터리는 비워 두면 됩니다. API 키와 서버가 없는 정적 사이트여서 별도 환경 변수도 필요하지 않습니다.

## 프로젝트 구조

```text
.
├── index.html
├── styles.css
├── server.mjs
├── vercel.json
├── .github/workflows/
│   └── update-kofia-jobs.yml
├── scripts/
│   ├── kofia-parser.mjs
│   └── refresh-kofia-jobs.mjs
├── src/
│   ├── app.js
│   ├── agent-runtime.js
│   ├── agent-worker.js
│   ├── agent-tools.js
│   ├── capstones.js
│   ├── jobs.js
│   └── job-utils.js
└── tests/
    ├── agent-tools.test.js
    ├── kofia-parser.test.js
    └── job-utils.test.js
```

## 데이터 주의사항

이 사이트의 공고 데이터는 실시간 API가 아니라 매일 확인하는 공개 페이지 스냅샷입니다. 하루 사이의 수정·조기 마감·링크 변경은 늦게 반영될 수 있습니다. `마감일 미정`에는 상시채용과 원문 확인이 필요한 공고가 함께 있으므로 지원 전에 원문을 다시 확인해야 합니다. 캡스톤 점수는 진로 의사결정을 돕기 위한 비교값이지 채용 가능성의 예측값이 아닙니다.
