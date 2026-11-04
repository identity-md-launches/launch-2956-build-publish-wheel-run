import { GameEngine } from "./engine.js";
import { Renderer } from "./renderer.js";
import { SettlementTracker, startStatusFeed } from "./feed.js";
import { GameAudio } from "./audio.js";
import { readBest, saveBest } from "./storage.js";
                                              

function element                       (id        )    {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing interface element: ${id}`);
  return node     ;
}

const canvas = element                   ("burrow");
const game = new GameEngine();
const renderer = new Renderer(canvas, game);
const audio = new GameAudio();
const settlement = new SettlementTracker();
const gameSection = element("game");
const intro = element("intro");
const overlay = element("run-overlay");
const pauseButton = element                   ("pause-button");
const continueButton = element                   ("continue-button");
const jumpButton = element                   ("jump-button");
const slideButton = element                   ("slide-button");
const helpDialog = element                   ("help-dialog");
const motionInput = element                  ("reduce-motion");
const score = element("score");
const bestElement = element("best");
const announcer = element("announcer");
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
let storage                 = null;
try {
  storage = window.localStorage;
} catch {
  /* Private browsing can deny access. */
}
let best = readBest(storage);
let bestAtStart = best;
let reducedMotion = prefersReduced.matches;
try {
  const stored = storage?.getItem("wheel-run:reduce-effects");
  if (stored !== null && stored !== undefined)
    reducedMotion = stored === "true";
} catch {
  /* Preferences are optional. */
}
renderer.reducedMotion = reducedMotion;
motionInput.checked = reducedMotion;
if (!storage)
  element("storage-note").textContent =
    "Best kept for this visit. Browser storage is unavailable.";

let frameId = 0;
let previousTime = 0;
let lastHud = 0;
let lastStatus = "";
let quakeNoticeUntil = 0;

function formatScore(value        ) {
  return Math.floor(value).toString().padStart(5, "0");
}
function announce(message        ) {
  announcer.textContent = message;
}

function hud() {
  score.textContent = formatScore(game.score);
  bestElement.textContent = formatScore(Math.max(best, Math.floor(game.score)));
  element("multiplier").textContent = `×${game.pace.multiplier.toFixed(1)}`;
  element("distance").textContent =
    `${Math.floor(game.distance).toLocaleString()} m`;
  canvas.dataset.action =
    game.jumpHeight > 0 ? "jumping" : game.sliding ? "sliding" : "running";
}

function renderPhase() {
  gameSection.dataset.phase = game.phase;
  intro.hidden = game.phase !== "ready";
  overlay.hidden = game.phase === "ready" || game.phase === "running";
  pauseButton.hidden = game.phase !== "running";
  element("scene-label").hidden = game.phase !== "ready";
  jumpButton.disabled = game.phase !== "running";
  slideButton.disabled = game.phase !== "running";
  element("result-stats").hidden = game.phase !== "over";
  element("restart-button").hidden = game.phase === "over";
  if (game.phase === "paused") {
    element("overlay-title").textContent = "Catch your breath.";
    element("overlay-description").textContent =
      "The burrow can wait. Resume when you’re ready.";
    element("overlay-symbol").textContent = "Ⅱ";
    continueButton.textContent = "Resume run";
  } else if (game.phase === "over") {
    element("overlay-title").textContent = "One more burrow?";
    element("overlay-description").textContent =
      game.score > bestAtStart
        ? "A new personal best. Those paws have potential."
        : "A little tumble. A fresh start is one click away.";
    element("overlay-symbol").textContent = "↻";
    continueButton.textContent = "Run again";
    element("final-score").textContent = Math.floor(
      game.score,
    ).toLocaleString();
    element("final-best").textContent = best.toLocaleString();
    element("final-time").textContent = `${Math.floor(game.elapsed)}s`;
  }
  hud();
  renderer.draw();
}

function scheduleFrame() {
  if (!frameId) {
    previousTime = performance.now();
    frameId = requestAnimationFrame(frame);
  }
}
function frame(now        ) {
  frameId = 0;
  const dt = Math.min((now - previousTime) / 1000, 0.06);
  previousTime = now;
  game.update(dt);
  game.updateEffects(dt);
  renderer.draw();
  if (now - lastHud > 80) {
    hud();
    lastHud = now;
  }
  if (quakeNoticeUntil && now > quakeNoticeUntil) {
    element("quake-notice").hidden = true;
    quakeNoticeUntil = 0;
  }
  if (game.phase === "running" || game.quakeTime > 0 || quakeNoticeUntil)
    frameId = requestAnimationFrame(frame);
}

function startRun() {
  bestAtStart = best;
  game.start();
  renderPhase();
  canvas.focus({ preventScroll: true });
  announce("Run started. Jump rocks and slide under hanging roots.");
  scheduleFrame();
}
function pauseRun(message = "Run paused.") {
  if (game.phase !== "running") return;
  game.pause();
  renderPhase();
  announce(message);
  continueButton.focus({ preventScroll: true });
}
function resumeRun() {
  game.resume();
  renderPhase();
  canvas.focus({ preventScroll: true });
  announce("Run resumed.");
  scheduleFrame();
}
function jump() {
  if (game.jump()) {
    audio.play("jump");
    hud();
  }
}
function slide() {
  if (game.slide()) {
    audio.play("slide");
    hud();
  }
}

game.onEnd = () => {
  const result = Math.floor(game.score);
  if (result > best) {
    best = result;
    if (!saveBest(storage, best))
      element("storage-note").textContent =
        "Best kept for this visit. Browser storage is unavailable.";
  }
  audio.play("end");
  renderPhase();
  announce(
    `Run over. Score ${result}. Best ${best}. Select Run again to try again.`,
  );
  continueButton.focus({ preventScroll: true });
};

element("start-button").addEventListener("click", startRun);
continueButton.addEventListener("click", () =>
  game.phase === "paused" ? resumeRun() : startRun(),
);
element("restart-button").addEventListener("click", startRun);
pauseButton.addEventListener("click", () => pauseRun());
jumpButton.addEventListener("click", () => {
  jump();
  canvas.focus({ preventScroll: true });
});
slideButton.addEventListener("click", () => {
  slide();
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  if (game.phase === "ready") startRun();
  else if (game.phase === "running") jump();
});
document.addEventListener("keydown", (event) => {
  if (
    helpDialog.open ||
    event.altKey ||
    event.metaKey ||
    event.ctrlKey ||
    event.repeat
  )
    return;
  if (event.key === "Escape") {
    if (game.phase === "running") {
      event.preventDefault();
      pauseRun();
    } else if (game.phase === "paused") {
      event.preventDefault();
      resumeRun();
    }
    return;
  }
  if ((event.target               ).closest("button,a,input,select,textarea"))
    return;
  if (event.code === "Space" || event.key === "ArrowUp") {
    event.preventDefault();
    if (game.phase === "ready") startRun();
    else jump();
  } else if (event.key === "ArrowDown" && game.phase === "running") {
    event.preventDefault();
    slide();
  }
});

element("help-button").addEventListener("click", () => {
  if (game.phase === "running")
    pauseRun("Run paused while how to play is open.");
  helpDialog.showModal();
  element("close-help").focus();
});
const closeHelp = () => helpDialog.close();
element("close-help").addEventListener("click", closeHelp);
element("close-help-primary").addEventListener("click", closeHelp);
helpDialog.addEventListener("close", () =>
  element("help-button").focus({ preventScroll: true }),
);
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) {
    const rect = helpDialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeHelp();
  }
});
motionInput.addEventListener("change", () => {
  renderer.reducedMotion = motionInput.checked;
  try {
    storage?.setItem("wheel-run:reduce-effects", String(motionInput.checked));
  } catch {
    /* Optional preference. */
  }
  renderer.draw();
});
prefersReduced.addEventListener("change", (event) => {
  renderer.reducedMotion = event.matches;
  motionInput.checked = event.matches;
  renderer.draw();
});

element("sound-button").addEventListener("click", async () => {
  const enabled = await audio.toggle();
  const button = element("sound-button");
  const label = enabled ? "Mute sound" : "Enable sound";
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("aria-pressed", String(enabled));
  document
    .getElementById("sound-waves")
    ?.setAttribute(
      "d",
      enabled
        ? "M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"
        : "m16 9 6 6m0-6-6 6",
    );
  announce(enabled ? "Sound enabled." : "Sound is off.");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden)
    pauseRun("Run paused because the page is in the background.");
});
window.addEventListener("blur", () => {
  if (!helpDialog.open) pauseRun("Run paused because the window lost focus.");
});

function updateReading(reading                     ) {
  game.setReading(reading);
  const status = reading?.state || "offline";
  element("live-badge").dataset.status = status;
  element("live-label").textContent = reading ? reading.state : "Offline";
  element("rpm").textContent = reading
    ? reading.rpm.toLocaleString(undefined, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      })
    : "—";
  element("rpm-fill").style.width =
    `${Math.min(100, ((reading?.rpm || 0) / 110) * 100)}%`;
  element("settled-round").textContent =
    reading?.round !== null && reading?.round !== undefined
      ? reading.round.toLocaleString()
      : "—";
  element("feed-message").textContent = reading
    ? reading.state === "ACTIVE"
      ? "The wheel is spinning. Pick up the pace."
      : "The wheel is resting. Settle into your stride."
    : "Feed unavailable. Playing at a gentle pace. Retrying…";
  if (status !== lastStatus) {
    announce(
      reading
        ? `Wheel ${reading.state.toLowerCase()}. ${reading.state === "ACTIVE" ? "The burrow is speeding up." : "The burrow is slowing down."}`
        : "Wheel feed unavailable. You can keep playing at a gentle pace. Reconnecting automatically.",
    );
    lastStatus = status;
  }
  if (reading && settlement.observe(reading)) {
    game.settle();
    element("quake-notice").hidden = false;
    element("quake-notice").textContent =
      `Round ${reading.round?.toLocaleString()} settled · A little rumble!`;
    quakeNoticeUntil = performance.now() + 2500;
    announce(
      `Round ${reading.round?.toLocaleString()} settled. Harmless settlement quake.`,
    );
    audio.play("quake");
    scheduleFrame();
  }
  hud();
  renderer.draw();
}

new ResizeObserver(() => renderer.resize()).observe(canvas);
renderer.resize();
renderPhase();
let stopFeed = startStatusFeed(updateReading, () => updateReading(null));
window.addEventListener("pagehide", () => {
  stopFeed();
  pauseRun();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted)
    stopFeed = startStatusFeed(updateReading, () => updateReading(null));
});
