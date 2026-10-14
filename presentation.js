import { DATA_SNAPSHOT_DATE, jobs } from "./src/jobs.js";
import { capstones } from "./src/capstones.js";
import { isClosingSoon, jobAvailability } from "./src/job-utils.js";

const slides = [...document.querySelectorAll(".slide")];
const total = slides.length;
const elements = {
  previous: document.querySelector("#previous-button"),
  next: document.querySelector("#next-button"),
  currentNumber: document.querySelector("#current-number"),
  currentTitle: document.querySelector("#current-title"),
  progress: document.querySelector("#progress-bar"),
  notesButton: document.querySelector("#notes-button"),
  notesPanel: document.querySelector("#notes-panel"),
  notesTitle: document.querySelector("#notes-title"),
  notesContent: document.querySelector("#notes-content"),
  notesClose: document.querySelector("#notes-close"),
  fullscreen: document.querySelector("#fullscreen-button"),
  timerButton: document.querySelector("#timer-button"),
  timer: document.querySelector("#timer"),
};

let current = Math.max(0, Math.min(total - 1, Number.parseInt(window.location.hash.slice(1), 10) - 1 || 0));
let notesOpen = false;
let timerStartedAt = null;
let timerElapsed = 0;
let timerInterval = null;
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionTimers = new Set();
const motionFrames = new Set();

const motionPlan = {
  "slide-1": [
    [".kicker", 40],
    [".cover-copy h1", 130],
    [".lead", 240],
    [".cover-meta", 340],
    [".cover-dashboard", 190],
  ],
  "slide-2": [
    [".slide-heading > *", 30, 100],
    [".legacy-shot", 180],
    [".legacy-callout--date", 520],
    [".legacy-callout--body", 680],
    [".friction-stack article", 280, 120],
    [".friction-loop", 720],
  ],
  "slide-3": [
    [".slide-heading > *", 30, 100],
    [".solution-flow > article", 210, 180],
    [".solution-flow > i", 350, 180, "motion-fade"],
    [".principle-row", 930],
  ],
  "slide-4": [
    [".slide-heading > *", 30, 100],
    [".ui-search", 170],
    [".ui-tabs > div", 300, 80],
    [".ui-job-row", 620],
    [".ui-detail-preview", 760],
    [".feature-strip span", 900, 60],
  ],
  "slide-5": [
    [".slide-heading > *", 30, 100],
    [".pipeline > article", 180, 140, "motion-item motion-pipeline"],
    [".pipeline > i", 290, 140, "motion-fade"],
    [".pipeline-facts > div", 920, 80],
  ],
  "slide-6": [
    [".slide-heading > *", 30, 100],
    [".score-card", 180],
    [".rubric-grid article", 280, 120],
    [".score-caution", 820],
  ],
  "slide-7": [
    [".slide-heading > *", 30, 100],
    [".agent-explainer > article", 180, 260],
    [".agent-explainer > .agent-arrow", 390, 260, "motion-fade"],
    [".agent-loop", 900],
    [".agent-loop > strong", 1010, 0, "motion-fade"],
    [".agent-loop > span", 1100, 140, "motion-fade motion-loop-step"],
    [".agent-loop > i", 1210, 140, "motion-fade"],
    [".agent-modes > p", 1750, 90],
  ],
  "slide-8": [
    [".slide-index", 40],
    [".closing-grid h2", 130],
    [".outcome-stats > div", 290, 100],
    [".next-steps", 760],
    [".closing-link", 360],
  ],
};

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function renderDataset() {
  const today = new Date();
  const counts = jobs.reduce((result, job) => {
    const status = jobAvailability(job, today);
    result[status] += 1;
    if (isClosingSoon(job, today)) result.closing += 1;
    return result;
  }, { open: 0, closing: 0, unknown: 0, closed: 0 });
  const detailCount = jobs.filter((job) => job.detailAvailable && job.fullText).length;
  const exactDeadlineCount = jobs.filter((job) => job.deadlineAt).length;
  const applyUrlCount = jobs.filter((job) => job.applyUrl).length;

  document.querySelectorAll("[data-job-count]").forEach((element) => { element.textContent = jobs.length; });
  document.querySelectorAll("[data-capstone-count]").forEach((element) => { element.textContent = capstones.length; });
  document.querySelectorAll("[data-detail-count]").forEach((element) => { element.textContent = detailCount; });
  document.querySelectorAll("[data-exact-deadline-count]").forEach((element) => { element.textContent = exactDeadlineCount; });
  document.querySelectorAll("[data-apply-url-count]").forEach((element) => { element.textContent = applyUrlCount; });
  document.querySelectorAll("[data-snapshot-date]").forEach((element) => { element.textContent = formatDate(DATA_SNAPSHOT_DATE); });
  document.querySelectorAll("[data-open-count]").forEach((element) => { element.textContent = counts.open; });
  document.querySelectorAll("[data-closing-count]").forEach((element) => { element.textContent = counts.closing; });
  document.querySelectorAll("[data-unknown-count]").forEach((element) => { element.textContent = counts.unknown; });
  document.querySelectorAll("[data-closed-count]").forEach((element) => { element.textContent = counts.closed; });
}

function prepareMotion() {
  Object.entries(motionPlan).forEach(([slideId, groups]) => {
    const slide = document.querySelector(`#${slideId}`);
    if (!slide) return;
    groups.forEach(([selector, start = 0, interval = 0, classNames = "motion-item"]) => {
      slide.querySelectorAll(selector).forEach((element, index) => {
        element.classList.add(...classNames.split(" "));
        element.style.setProperty("--motion-delay", `${start + index * interval}ms`);
      });
    });
  });

  document.querySelectorAll("[data-count-up]").forEach((element) => {
    const value = element.textContent.trim();
    const match = value.match(/^(.*?)([\d,]+)(.*)$/);
    if (!match) return;
    element.dataset.countPrefix = match[1];
    element.dataset.countTarget = match[2].replaceAll(",", "");
    element.dataset.countSuffix = match[3];
    element.setAttribute("aria-label", value);
    element.setAttribute("aria-live", "off");
  });

  document.body.classList.add("motion-ready");
}

function scheduleMotionTimeout(callback, delay) {
  const timerId = window.setTimeout(() => {
    motionTimers.delete(timerId);
    callback();
  }, delay);
  motionTimers.add(timerId);
  return timerId;
}

function scheduleMotionFrame(callback) {
  const frameId = window.requestAnimationFrame((timestamp) => {
    motionFrames.delete(frameId);
    callback(timestamp);
  });
  motionFrames.add(frameId);
  return frameId;
}

function cancelMotion() {
  motionTimers.forEach((timerId) => window.clearTimeout(timerId));
  motionFrames.forEach((frameId) => window.cancelAnimationFrame(frameId));
  motionTimers.clear();
  motionFrames.clear();
  document.querySelectorAll(".ui-search-query.is-typing").forEach((element) => element.classList.remove("is-typing"));
}

function restoreCounter(element) {
  if (!element.dataset.countTarget) return;
  const target = Number(element.dataset.countTarget);
  element.textContent = `${element.dataset.countPrefix || ""}${target.toLocaleString("ko-KR")}${element.dataset.countSuffix || ""}`;
}

function animateCounter(element) {
  const target = Number(element.dataset.countTarget);
  if (!Number.isFinite(target) || target <= 0) {
    restoreCounter(element);
    return;
  }

  const motionItem = element.closest(".motion-item, .motion-fade");
  const delay = Number.parseFloat(motionItem?.style.getPropertyValue("--motion-delay")) || 120;
  const prefix = element.dataset.countPrefix || "";
  const suffix = element.dataset.countSuffix || "";
  const duration = target > 100 ? 900 : 720;
  element.textContent = `${prefix}0${suffix}`;

  scheduleMotionTimeout(() => {
    let startedAt = null;
    const step = (timestamp) => {
      if (startedAt === null) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(target * eased);
      element.textContent = `${prefix}${currentValue.toLocaleString("ko-KR")}${suffix}`;
      if (progress < 1) scheduleMotionFrame(step);
      else restoreCounter(element);
    };
    scheduleMotionFrame(step);
  }, delay + 170);
}

function runSearchDemo(slide) {
  const field = slide.querySelector("[data-demo-query]");
  if (!field) return;
  const query = field.dataset.demoQuery || "";
  field.setAttribute("aria-label", `검색 예시: ${query}`);

  if (reduceMotionQuery.matches) {
    field.textContent = query;
    return;
  }

  field.textContent = "";
  field.classList.add("is-typing");
  let index = 0;
  const typeNext = () => {
    index += 1;
    field.textContent = query.slice(0, index);
    if (index < query.length) scheduleMotionTimeout(typeNext, 75);
    else scheduleMotionTimeout(() => field.classList.remove("is-typing"), 360);
  };
  scheduleMotionTimeout(typeNext, 430);
}

function replaySlideMotion(slide) {
  cancelMotion();
  slides.forEach((item) => item.classList.remove("is-animating"));

  if (reduceMotionQuery.matches) {
    slide.querySelectorAll("[data-count-up]").forEach(restoreCounter);
    runSearchDemo(slide);
    return;
  }

  void slide.offsetWidth;
  slide.classList.add("is-animating");
  slide.querySelectorAll("[data-count-up]").forEach(animateCounter);
  runSearchDemo(slide);
}

function activeNotes() {
  const notes = slides[current].querySelector(".speaker-notes");
  return {
    timing: notes?.querySelector("strong")?.textContent || "발표자 노트",
    text: notes?.querySelector("p")?.textContent || "",
  };
}

function renderNotes() {
  const notes = activeNotes();
  elements.notesTitle.textContent = `${String(current + 1).padStart(2, "0")} · ${notes.timing}`;
  elements.notesContent.textContent = notes.text;
}

function showSlide(index, updateHash = true) {
  const nextIndex = Math.max(0, Math.min(total - 1, index));
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === nextIndex);
    slide.classList.toggle("was-active", slideIndex < nextIndex);
    slide.setAttribute("aria-hidden", String(slideIndex !== nextIndex));
  });
  current = nextIndex;
  elements.previous.disabled = current === 0;
  elements.next.disabled = current === total - 1;
  elements.currentNumber.textContent = String(current + 1).padStart(2, "0");
  elements.currentTitle.textContent = slides[current].dataset.title;
  elements.progress.style.width = `${((current + 1) / total) * 100}%`;
  if (updateHash) history.replaceState(null, "", `#${current + 1}`);
  renderNotes();
  slides[current].focus({ preventScroll: true });
  replaySlideMotion(slides[current]);
}

function setNotes(open) {
  notesOpen = open;
  elements.notesPanel.dataset.open = String(open);
  elements.notesPanel.setAttribute("aria-hidden", String(!open));
  elements.notesButton.setAttribute("aria-pressed", String(open));
  if (open) renderNotes();
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function renderTimer() {
  const elapsed = timerElapsed + (timerStartedAt ? Date.now() - timerStartedAt : 0);
  elements.timer.textContent = formatTime(elapsed);
  elements.timer.dateTime = `PT${Math.floor(elapsed / 1000)}S`;
  elements.timer.style.color = elapsed >= 7 * 60 * 1000 ? "#dc2626" : "";
}

function toggleTimer() {
  if (timerStartedAt) {
    timerElapsed += Date.now() - timerStartedAt;
    timerStartedAt = null;
    window.clearInterval(timerInterval);
    timerInterval = null;
  } else {
    timerStartedAt = Date.now();
    timerInterval = window.setInterval(renderTimer, 500);
  }
  elements.timerButton.setAttribute("aria-pressed", String(Boolean(timerStartedAt)));
  renderTimer();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    elements.fullscreen.textContent = "브라우저 메뉴에서 전체 화면";
  }
}

elements.previous.addEventListener("click", () => showSlide(current - 1));
elements.next.addEventListener("click", () => showSlide(current + 1));
elements.notesButton.addEventListener("click", () => setNotes(!notesOpen));
elements.notesClose.addEventListener("click", () => setNotes(false));
elements.timerButton.addEventListener("click", toggleTimer);
elements.fullscreen.addEventListener("click", toggleFullscreen);

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === " " && event.target.closest("button, a")) return;
  if (["ArrowRight", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    showSlide(current + 1);
  } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
    event.preventDefault();
    showSlide(current - 1);
  } else if (event.key === "Home") {
    showSlide(0);
  } else if (event.key === "End") {
    showSlide(total - 1);
  } else if (event.key.toLowerCase() === "n") {
    setNotes(!notesOpen);
  } else if (event.key.toLowerCase() === "t") {
    toggleTimer();
  } else if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
  } else if (event.key.toLowerCase() === "r") {
    replaySlideMotion(slides[current]);
  } else if (event.key === "Escape" && notesOpen) {
    setNotes(false);
  }
});

window.addEventListener("hashchange", () => {
  const index = Number.parseInt(window.location.hash.slice(1), 10) - 1;
  if (Number.isInteger(index)) showSlide(index, false);
});

renderDataset();
prepareMotion();
showSlide(current, false);
renderTimer();

reduceMotionQuery.addEventListener("change", () => replaySlideMotion(slides[current]));

window.addEventListener("beforeprint", () => {
  cancelMotion();
  document.querySelectorAll("[data-count-up]").forEach(restoreCounter);
  document.querySelectorAll("[data-demo-query]").forEach((element) => {
    element.textContent = element.dataset.demoQuery || element.textContent;
  });
});

window.addEventListener("afterprint", () => replaySlideMotion(slides[current]));
