export const BEST_KEY = "wheel-run:best:v1";
export function readBest(storage                                 )         {
  try {
    const raw = storage?.getItem(BEST_KEY);
    if (!raw || !/^\d+$/.test(raw)) return 0;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}
export function saveBest(
  storage                                 ,
  score        ,
)          {
  try {
    if (!storage) return false;
    storage.setItem(BEST_KEY, String(Math.floor(score)));
    return true;
  } catch {
    return false;
  }
}
