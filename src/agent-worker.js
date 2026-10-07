const WEBLLM_MODULE_URL = "https://esm.run/@mlc-ai/web-llm@0.2.85";

let engine = null;
let selectedModel = null;

function post(type, requestId, payload = {}) {
  self.postMessage({ type, requestId, payload });
}

function chooseModel(modelList) {
  const preferences = [
    /Qwen2\.5-1\.5B.*q4f16_1/i,
    /Qwen3-1\.7B.*q4f16_1/i,
    /Qwen2\.5-0\.5B.*q4f16_1/i,
    /Llama-3\.2-1B.*q4f16_1/i,
    /SmolLM2-1\.7B.*q4f16_1/i,
  ];

  for (const pattern of preferences) {
    const found = modelList.find((record) => pattern.test(record.model_id));
    if (found) return found;
  }

  return [...modelList]
    .filter((record) => record.low_resource_required && /Instruct/i.test(record.model_id))
    .filter((record) => !record.vram_required_MB || record.vram_required_MB <= 2800)
    .sort((a, b) => (b.vram_required_MB || 0) - (a.vram_required_MB || 0))[0];
}

async function initialize(requestId) {
  if (engine) {
    post("result", requestId, { model: selectedModel });
    return;
  }

  const webllm = await import(WEBLLM_MODULE_URL);
  const record = chooseModel(webllm.prebuiltAppConfig.model_list || []);
  if (!record) throw new Error("이 기기에서 사용할 수 있는 경량 WebLLM 모델을 찾지 못했습니다.");
  selectedModel = record.model_id;

  engine = await webllm.CreateMLCEngine(selectedModel, {
    initProgressCallback: (report) => post("progress", requestId, {
      progress: Number.isFinite(report.progress) ? report.progress : 0,
      text: report.text || "모델을 내려받고 있습니다.",
      model: selectedModel,
      vramMB: record.vram_required_MB || null,
    }),
    logLevel: "WARN",
  }, { context_window_size: 4096 });

  post("result", requestId, {
    model: selectedModel,
    vramMB: record.vram_required_MB || null,
  });
}

async function generate(requestId, messages) {
  if (!engine) throw new Error("로컬 모델이 아직 준비되지 않았습니다.");
  const request = {
    messages,
    temperature: 0.1,
    top_p: 0.85,
    max_tokens: 900,
    response_format: { type: "json_object" },
  };

  let response;
  try {
    response = await engine.chat.completions.create(request);
  } catch {
    delete request.response_format;
    response = await engine.chat.completions.create(request);
  }

  post("result", requestId, {
    content: response.choices?.[0]?.message?.content || "",
    usage: response.usage || null,
  });
}

self.addEventListener("message", async (event) => {
  const { type, requestId, payload = {} } = event.data || {};
  try {
    if (type === "initialize") await initialize(requestId);
    else if (type === "generate") await generate(requestId, payload.messages || []);
    else throw new Error(`지원하지 않는 Worker 요청입니다: ${type}`);
  } catch (error) {
    self.postMessage({ type: "error", requestId, error: error?.message || String(error) });
  }
});
