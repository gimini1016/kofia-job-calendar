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

  document.querySelectorAll("[data-job-count]").forEach((element) => { element.textContent = jobs.length; });
  document.querySelectorAll("[data-capstone-count]").forEach((element) => { element.textContent = capstones.length; });
  document.querySelectorAll("[data-snapshot-date]").forEach((element) => { element.textContent = formatDate(DATA_SNAPSHOT_DATE); });
  document.querySelectorAll("[data-open-count]").forEach((element) => { element.textContent = counts.open; });
  document.querySelectorAll("[data-closing-count]").forEach((element) => { element.textContent = counts.closing; });
  document.querySelectorAll("[data-unknown-count]").forEach((element) => { element.textContent = counts.unknown; });
  document.querySelectorAll("[data-closed-count]").forEach((element) => { element.textContent = counts.closed; });
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
  } else if (event.key === "Escape" && notesOpen) {
    setNotes(false);
  }
});

window.addEventListener("hashchange", () => {
  const index = Number.parseInt(window.location.hash.slice(1), 10) - 1;
  if (Number.isInteger(index)) showSlide(index, false);
});

renderDataset();
showSlide(current, false);
renderTimer();
