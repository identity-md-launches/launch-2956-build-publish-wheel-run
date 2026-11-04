export const STATUS_URL = "https://api.squeekchain.com/v1/status";
export const POLL_INTERVAL = 1500;

                               
                           
              
                
                       
                       
 

function object(value         )                          {
  return value !== null && typeof value === "object"
    ? (value                           )
    : {};
}

export function parseStatus(payload         , now = Date.now())               {
  const body = object(payload);
  const measurement = object(body.measurement);
  if (
    measurement.coreStatus !== "ACTIVE" &&
    measurement.coreStatus !== "IDLE"
  ) {
    throw new Error("The wheel status is unavailable.");
  }
  const observed = Date.parse(String(measurement.observedAt));
  const staleAfter =
    typeof measurement.staleAfterSeconds === "number"
      ? Math.min(120, Math.max(1, measurement.staleAfterSeconds))
      : 120;
  if (
    measurement.freshness !== "online" ||
    !Number.isFinite(observed) ||
    now - observed > staleAfter * 1000 ||
    observed - now > 60_000
  ) {
    throw new Error("The wheel reading is stale.");
  }
  const rpmMilli = measurement.rpmMilli;
  const speed = measurement.speedMmPerSecond;
  if (
    typeof rpmMilli !== "number" ||
    !Number.isFinite(rpmMilli) ||
    rpmMilli < 0 ||
    typeof speed !== "number" ||
    !Number.isFinite(speed) ||
    speed < 0
  ) {
    throw new Error("The wheel reading is invalid.");
  }
  const builder = object(body.builder);
  const round = object(builder.anchor).settledThroughRound;
  // Only the confirmed anchor counts; queued/projected submissions are not settled.
  const validRound =
    builder.status === "available" &&
    (typeof round === "string" || typeof round === "number") &&
    /^\d+$/.test(String(round)) &&
    (typeof round !== "number" || Number.isSafeInteger(round));
  return {
    state: measurement.coreStatus,
    rpm: rpmMilli / 1000,
    speed,
    round: validRound ? BigInt(String(round)) : null,
    installation:
      typeof body.installationId === "string" ? body.installationId : "",
  };
}

export class SettlementTracker {
          highest                = null;
          installation                = null;

  observe(reading              )          {
    if (reading.installation !== this.installation) {
      this.installation = reading.installation;
      this.highest = reading.round;
      return false;
    }
    if (reading.round === null) return false;
    const increased = this.highest !== null && reading.round > this.highest;
    if (this.highest === null || reading.round > this.highest)
      this.highest = reading.round;
    return increased;
  }
}

export function startStatusFeed(
  onReading                                 ,
  onOffline            ,
)             {
  let pending = false;
  let stopped = false;
  let controller                         = null;
  const poll = async () => {
    if (pending || stopped || document.hidden) return;
    pending = true;
    controller = new AbortController();
    const timeout = window.setTimeout(() => controller?.abort(), 4000);
    try {
      const response = await fetch(STATUS_URL, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
      });
      if (!response.ok)
        throw new Error(`Wheel feed returned ${response.status}`);
      const reading = parseStatus(await response.json());
      if (!stopped) onReading(reading);
    } catch {
      if (!stopped) onOffline();
    } finally {
      window.clearTimeout(timeout);
      pending = false;
    }
  };
  const resume = () => {
    if (!document.hidden) void poll();
  };
  const interval = window.setInterval(() => void poll(), POLL_INTERVAL);
  document.addEventListener("visibilitychange", resume);
  void poll();
  return () => {
    stopped = true;
    controller?.abort();
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", resume);
  };
}
