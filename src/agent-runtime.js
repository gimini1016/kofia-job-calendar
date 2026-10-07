import {
  AGENT_TOOL_DEFINITIONS,
  buildCompatibilityResult,
  executeAgentTool,
  inferProfileFromText,
} from "./agent-tools.js";

const REQUIRED_TOOLS = ["search_jobs", "compare_capstones", "build_portfolio_plan"];
const MAX_TOOL_CALLS = 6;

const SYSTEM_PROMPT = `당신은 금융권 Career Decision Agent다.
사용자의 목표를 해석하고 제공된 도구를 직접 골라 실제 KOFIA 공고와 캡스톤 데이터를 조사한다.

규칙:
1. 답을 추측하지 말고 search_jobs, compare_capstones, build_portfolio_plan을 각각 최소 1회 호출한다.
2. 한 응답에서는 도구 하나만 호출한다.
3. 도구 결과에 없는 회사·수치·지원·채용 약속을 만들지 않는다.
4. 정보가 충분하면 final_answer를 반환한다.
5. 설명 문장이나 Markdown 없이 JSON 객체 하나만 출력한다.

도구:
${JSON.stringify(AGENT_TOOL_DEFINITIONS)}

도구 호출 형식:
{"type":"tool_call","tool":"search_jobs","arguments":{"query":"경영기획","roleGroup":"backoffice","experience":"all","limit":6}}

최종 형식:
{"type":"final_answer","summary":"판단 요약","recommendations":[{"projectId":"실제 ID","reason":"추천 이유"}],"skillGaps":["보완 역량"],"nextQuestion":"다음 질문"}`;

function extractJSONObject(value) {
  const text = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("모델 응답에서 JSON 객체를 찾지 못했습니다.");
    return JSON.parse(text.slice(start, end + 1));
  }
}

function validateAction(action) {
  if (!action || typeof action !== "object") throw new Error("Agent 응답이 객체가 아닙니다.");
  if (action.type === "final_answer") return action;
  if (action.type !== "tool_call") throw new Error("Agent 응답 type이 올바르지 않습니다.");
  if (!AGENT_TOOL_DEFINITIONS.some((tool) => tool.name === action.tool)) {
    throw new Error(`허용되지 않은 도구를 요청했습니다: ${action.tool || "미지정"}`);
  }
  if (!action.arguments || typeof action.arguments !== "object" || Array.isArray(action.arguments)) {
    action.arguments = {};
  }
  return action;
}

function compactObservation(toolName, result) {
  if (toolName === "search_jobs") {
    return {
      ...result,
      jobs: result.jobs.map((job) => ({ ...job, summary: job.summary.slice(0, 180) })),
    };
  }
  if (toolName === "analyze_job_trends") {
    return {
      targetRoles: result.targetRoles,
      sampleSize: result.sampleSize,
      topRoles: result.topRoles,
      topSkills: result.topSkills,
      examples: result.examples.map(({ company, title, roles, sourceUrl }) => ({ company, title, roles, sourceUrl })),
    };
  }
  if (toolName === "compare_capstones") {
    return {
      ...result,
      projects: result.projects.map((project) => ({
        id: project.id,
        company: project.company,
        title: project.title,
        adjustedScore: project.adjustedScore,
        strength: project.strength,
        caution: project.caution,
        stage: project.stage,
        portfolio: project.portfolio,
        hiring: project.hiring,
      })),
    };
  }
  return result;
}

function missingRequiredTools(calledTools) {
  return REQUIRED_TOOLS.filter((name) => !calledTools.includes(name));
}

function groundedResult(action, observations, userText, model) {
  const profile = inferProfileFromText(userText);
  const comparison = observations.get("compare_capstones")
    || executeAgentTool("compare_capstones", { tracks: profile.tracks, priorities: profile.priorities, limit: 5 });
  const jobSearch = observations.get("search_jobs")
    || executeAgentTool("search_jobs", { query: profile.targetRoles.join(" "), limit: 6 });
  const topProject = comparison.projects[0];
  const planResult = observations.get("build_portfolio_plan")
    || executeAgentTool("build_portfolio_plan", { projectId: topProject.id, targetRoles: profile.targetRoles });
  const modelRecommendations = new Map((Array.isArray(action.recommendations) ? action.recommendations : [])
    .filter((item) => item && item.projectId)
    .map((item) => [item.projectId, item]));

  return {
    type: "final_answer",
    mode: "local-ai",
    model,
    summary: `${profile.targetRoles.join("·")} 목표를 기준으로 로컬 AI가 도구를 선택해 실제 공고와 14개 프로젝트를 조사했습니다. ${topProject.company}의 ${topProject.title}을 우선 검토하세요.`,
    recommendations: comparison.projects.slice(0, 3).map((project) => ({
      projectId: project.id,
      company: project.company,
      project: project.title,
      score: project.adjustedScore,
      reason: modelRecommendations.get(project.id)?.reason || project.strength,
      evidence: `${project.stage} · 포트폴리오 ${project.portfolio} · 채용 ${project.hiring}`,
      caution: project.caution,
    })),
    jobEvidence: jobSearch.jobs.slice(0, 4).map((job) => ({
      company: job.company,
      title: job.title,
      reason: job.roles.slice(0, 4).join(" · "),
      sourceUrl: job.sourceUrl,
    })),
    skillGaps: Array.isArray(action.skillGaps) ? action.skillGaps.slice(0, 6).map(String) : [],
    plan: planResult.phases,
    nextQuestion: typeof action.nextQuestion === "string" && action.nextQuestion.trim()
      ? action.nextQuestion.trim()
      : "상위 추천 가운데 어떤 프로젝트를 더 자세히 비교할까요?",
  };
}

export function supportsLocalAgent() {
  return typeof window !== "undefined" && "gpu" in navigator && typeof Worker !== "undefined";
}

export class CareerDecisionAgent {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.worker = null;
    this.ready = false;
    this.model = null;
    this.requestId = 0;
    this.pending = new Map();
  }

  emit(name, payload) {
    if (typeof this.callbacks[name] === "function") this.callbacks[name](payload);
  }

  createWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL("./agent-worker.js", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type === "progress") {
        this.emit("onProgress", message.payload);
        return;
      }
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      if (message.type === "error") pending.reject(new Error(message.error || "로컬 모델 오류"));
      else pending.resolve(message.payload);
      this.pending.delete(message.requestId);
    });
    this.worker.addEventListener("error", (event) => {
      this.pending.forEach(({ reject }) => reject(new Error(event.message || "로컬 모델을 시작하지 못했습니다.")));
      this.pending.clear();
    });
  }

  send(type, payload = {}) {
    this.createWorker();
    const requestId = `agent-${Date.now()}-${this.requestId += 1}`;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker.postMessage({ type, requestId, payload });
    });
  }

  async initialize() {
    if (this.ready) return { model: this.model };
    if (!supportsLocalAgent()) throw new Error("이 브라우저는 WebGPU 로컬 AI를 지원하지 않습니다.");
    this.emit("onStatus", "브라우저용 AI 모델을 준비하고 있습니다.");
    const result = await this.send("initialize");
    this.ready = true;
    this.model = result.model;
    this.emit("onStatus", `로컬 AI 준비 완료 · ${result.model}`);
    return result;
  }

  async generate(messages) {
    const result = await this.send("generate", { messages });
    return result.content;
  }

  async run(userText) {
    if (!supportsLocalAgent()) {
      this.emit("onStatus", "WebGPU 미지원 · 규칙 기반 호환 모드로 분석합니다.");
      return buildCompatibilityResult(userText, (tool, args) => this.emit("onTool", { tool, args, mode: "compatibility" }));
    }

    try {
      await this.initialize();
      const profile = inferProfileFromText(userText);
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `사용자 요청: ${userText}\n초기 해석 힌트: ${JSON.stringify(profile)}\n도구를 선택해 조사를 시작하세요.`,
        },
      ];
      const calledTools = [];
      const observations = new Map();

      for (let step = 0; step <= MAX_TOOL_CALLS; step += 1) {
        this.emit("onStatus", step === 0 ? "목표를 해석하고 첫 도구를 선택합니다." : "도구 결과를 관찰하고 다음 행동을 결정합니다.");
        let action;
        try {
          action = validateAction(extractJSONObject(await this.generate(messages)));
        } catch (error) {
          messages.push({ role: "user", content: `이전 응답은 사용할 수 없습니다: ${error.message} JSON 객체 하나로 다시 답하세요.` });
          continue;
        }

        if (action.type === "final_answer") {
          const missing = missingRequiredTools(calledTools);
          if (missing.length && step < MAX_TOOL_CALLS) {
            messages.push({ role: "assistant", content: JSON.stringify(action) });
            messages.push({ role: "user", content: `아직 필수 도구 ${missing.join(", ")}를 실행하지 않았습니다. 가장 먼저 필요한 도구 하나를 호출하세요.` });
            continue;
          }
          return groundedResult(action, observations, userText, this.model);
        }

        if (calledTools.length >= MAX_TOOL_CALLS) break;
        this.emit("onTool", { tool: action.tool, args: action.arguments, mode: "local-ai" });
        const result = executeAgentTool(action.tool, action.arguments);
        calledTools.push(action.tool);
        observations.set(action.tool, result);
        messages.push({ role: "assistant", content: JSON.stringify(action) });
        messages.push({
          role: "user",
          content: `TOOL_RESULT ${action.tool}: ${JSON.stringify(compactObservation(action.tool, result))}`,
        });
      }

      throw new Error("Agent가 제한된 실행 횟수 안에 분석을 완료하지 못했습니다.");
    } catch (error) {
      this.emit("onStatus", `로컬 AI 오류 · 호환 모드로 계속합니다. (${error.message})`);
      const fallback = buildCompatibilityResult(userText, (tool, args) => this.emit("onTool", { tool, args, mode: "compatibility" }));
      fallback.fallbackReason = error.message;
      return fallback;
    }
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}
