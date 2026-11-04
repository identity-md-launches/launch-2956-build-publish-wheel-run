import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine, paceFor } from "../dist/assets/engine.js";
import { parseStatus, SettlementTracker } from "../dist/assets/feed.js";
import { readBest, saveBest, BEST_KEY } from "../dist/assets/storage.js";

const now = Date.now();
const payload = (state = "IDLE", round = "1258") => ({
  installationId: "unit-test-only",
  measurement: {
    coreStatus: state,
    rpmMilli: 0,
    speedMmPerSecond: 0,
    freshness: "online",
    observedAt: new Date(now).toISOString(),
    staleAfterSeconds: 120,
  },
  builder: { status: "available", anchor: { settledThroughRound: round } },
});
const reading = (state = "IDLE", rpm = 0, speed = 0) => ({
  state,
  rpm,
  speed,
  round: 1258n,
  installation: "unit-test-only",
});
const advance = (game, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 120) game.update(1 / 120);
};
const freshGame = () => {
  const game = new GameEngine(() => 0.5);
  game.start();
  game.nextHazard = 100;
  return game;
};

test("uses real nested measurement units and confirmed anchor", () => {
  const sample = payload("ACTIVE");
  sample.measurement.rpmMilli = 31500;
  sample.measurement.speedMmPerSecond = 220;
  sample.settlementQueue = {
    latestSubmission: { settledThroughRound: "9999" },
  };
  assert.deepEqual(parseStatus(sample, now), {
    state: "ACTIVE",
    rpm: 31.5,
    speed: 220,
    round: 1258n,
    installation: "unit-test-only",
  });
});
test("large settled round retains integer precision", () =>
  assert.equal(
    parseStatus(payload("IDLE", "99999999999999999999"), now).round,
    99999999999999999999n,
  ));
test("rejects unknown state, malformed and stale readings", () => {
  for (const input of [null, {}, { measurement: { coreStatus: "UNKNOWN" } }])
    assert.throws(() => parseStatus(input, now));
  const stale = payload();
  stale.measurement.observedAt = new Date(now - 121000).toISOString();
  assert.throws(() => parseStatus(stale, now));
  const offline = payload();
  offline.measurement.freshness = "offline";
  assert.throws(() => parseStatus(offline, now));
  const negative = payload();
  negative.measurement.rpmMilli = -1;
  assert.throws(() => parseStatus(negative, now));
  const future = payload();
  future.measurement.observedAt = new Date(now + 120000).toISOString();
  assert.throws(() => parseStatus(future, now));
  const invalid = payload();
  invalid.measurement.speedMmPerSecond = Infinity;
  assert.throws(() => parseStatus(invalid, now));
});
test("unavailable or unsafe anchors do not masquerade as settled", () => {
  const unavailable = payload();
  unavailable.builder.status = "unavailable";
  assert.equal(parseStatus(unavailable, now).round, null);
  assert.equal(
    parseStatus(payload("IDLE", Number.MAX_SAFE_INTEGER + 1), now).round,
    null,
  );
  assert.equal(parseStatus(payload("IDLE", "not-a-round"), now).round, null);
});
test("first settlement establishes a baseline; only new highs trigger once", () => {
  const tracker = new SettlementTracker();
  const sample = reading();
  assert.equal(tracker.observe(sample), false);
  assert.equal(tracker.observe(sample), false);
  assert.equal(tracker.observe({ ...sample, round: 1260n }), true);
  assert.equal(tracker.observe({ ...sample, round: 1259n }), false);
  assert.equal(tracker.observe({ ...sample, round: 1260n }), false);
  assert.equal(tracker.observe({ ...sample, round: null }), false);
  assert.equal(tracker.observe({ ...sample, round: 1261n }), true);
});
test("new installation resets settlement baseline", () => {
  const tracker = new SettlementTracker();
  tracker.observe(reading());
  assert.equal(
    tracker.observe({
      ...reading(),
      installation: "new-test-installation",
      round: 9000n,
    }),
    false,
  );
});
test("ACTIVE RPM and speed both increase scroll, hazards and multiplier", () => {
  const idle = paceFor(reading());
  for (const active of [
    paceFor(reading("ACTIVE", 80, 0)),
    paceFor(reading("ACTIVE", 0, 600)),
  ]) {
    assert.ok(active.speed > idle.speed);
    assert.ok(active.multiplier > idle.multiplier);
    assert.ok(active.spawnInterval < idle.spawnInterval);
  }
  const low = paceFor(reading("ACTIVE", 10));
  const high = paceFor(reading("ACTIVE", 60));
  assert.ok(
    high.speed > low.speed &&
      high.multiplier > low.multiplier &&
      high.spawnInterval < low.spawnInterval,
  );
});
test("IDLE and offline restore a safe baseline; extreme readings are capped", () => {
  assert.deepEqual(paceFor(null), paceFor(reading("IDLE", 99999, 99999)));
  assert.equal(paceFor(reading("ACTIVE", 99999, 99999)).multiplier, 3);
});
test("starts from ready, accumulates score and distance, then resets", () => {
  const game = new GameEngine();
  assert.equal(game.phase, "ready");
  game.start();
  advance(game, 1);
  assert.ok(game.score > 0 && game.distance > 0);
  game.start();
  assert.equal(game.score, 0);
  assert.equal(game.hazards.length, 0);
  assert.equal(game.jumpHeight, 0);
});
test("jump rises, rejects midair repeats, and lands", () => {
  const game = freshGame();
  assert.equal(game.jump(), true);
  advance(game, 0.2);
  assert.ok(game.jumpHeight > 80);
  assert.equal(game.jump(), false);
  advance(game, 0.6);
  assert.equal(game.jumpHeight, 0);
  assert.equal(game.velocity, 0);
});
test("slide lowers hitbox and expires; jumping cancels slide", () => {
  const game = freshGame();
  const standing = game.playerBox.height;
  assert.equal(game.slide(), true);
  assert.ok(game.playerBox.height < standing);
  assert.equal(game.slide(), false);
  advance(game, 0.9);
  assert.equal(game.sliding, false);
  game.slide();
  game.jump();
  assert.equal(game.slideTime, 0);
});
test("rock collision ends the run once", () => {
  const game = freshGame();
  let ended = 0;
  game.onEnd = () => ended++;
  game.hazards = [{ x: game.playerX, width: 42, type: "rock", passed: false }];
  advance(game, 0.1);
  assert.equal(game.phase, "over");
  assert.equal(ended, 1);
  advance(game, 1);
  assert.equal(ended, 1);
});
test("a timed jump clears a rock without collision", () => {
  const game = freshGame();
  game.hazards = [
    { x: game.playerX + 90, width: 42, type: "rock", passed: false },
  ];
  game.jump();
  advance(game, 0.8);
  assert.equal(game.phase, "running");
  assert.equal(game.dodged, 1);
});
test("standing runner hits a hanging root; sliding clears it", () => {
  const standing = freshGame();
  standing.hazards = [
    { x: standing.playerX + 45, width: 42, type: "root", passed: false },
  ];
  advance(standing, 0.5);
  assert.equal(standing.phase, "over");
  const sliding = freshGame();
  sliding.hazards = [
    { x: sliding.playerX + 45, width: 42, type: "root", passed: false },
  ];
  sliding.slide();
  advance(sliding, 0.55);
  assert.equal(sliding.phase, "running");
  assert.equal(sliding.dodged, 1);
});
test("pause freezes physics and score, even when live pace changes", () => {
  const game = freshGame();
  game.jump();
  advance(game, 0.2);
  game.pause();
  const snapshot = [game.score, game.elapsed, game.jumpHeight, game.offset];
  game.setReading(reading("ACTIVE", 80));
  advance(game, 1);
  assert.deepEqual(
    [game.score, game.elapsed, game.jumpHeight, game.offset],
    snapshot,
  );
  assert.equal(game.jump(), false);
  game.resume();
  advance(game, 0.1);
  assert.ok(game.score > snapshot[0]);
});
test("settlement debris is non-colliding and effect ends", () => {
  const game = freshGame();
  game.settle();
  assert.equal(game.quakeCount, 1);
  assert.equal(game.hazards.length, 0);
  advance(game, 0.5);
  assert.equal(game.phase, "running");
  game.updateEffects(2);
  assert.equal(game.quakeTime, 0);
});
test("speed transitions smoothly to new readings", () => {
  const game = freshGame();
  const original = game.speed;
  game.setReading(reading("ACTIVE", 110));
  game.update(1 / 60);
  assert.ok(game.speed > original && game.speed < game.pace.speed);
  game.setReading(null);
  advance(game, 1);
  assert.ok(game.speed < original + 2);
});
test("large frame gaps do not teleport the runner into hazards", () => {
  const game = freshGame();
  game.update(20);
  assert.ok(game.elapsed <= 0.061);
  assert.ok(game.offset < 20);
});
test("storage validates malformed scores and handles restricted browsers", () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
  assert.equal(readBest(storage), 0);
  assert.equal(saveBest(storage, 153.9), true);
  assert.equal(readBest(storage), 153);
  for (const invalid of [
    "NaN",
    "-2",
    "1.5",
    "Infinity",
    "999999999999999999999",
  ]) {
    map.set(BEST_KEY, invalid);
    assert.equal(readBest(storage), 0);
  }
  assert.equal(readBest(null), 0);
  assert.equal(saveBest(null, 10), false);
  const denied = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("denied");
    },
  };
  assert.equal(readBest(denied), 0);
  assert.equal(saveBest(denied, 10), false);
});
