import { useEffect, type Dispatch, type SetStateAction } from "react";
/** Revalidate stored relationships, never recompute matches on page renders. */
export function useMatchFreshness(
  reload: Dispatch<SetStateAction<number>>,
  expiresAt?: string,
) {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") reload((n) => n + 1);
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const interval = window.setInterval(check, 60000);
    const delay = expiresAt ? Date.parse(expiresAt) - Date.now() : -1;
    const expiry =
      delay > 0
        ? window.setTimeout(check, Math.min(delay + 100, 2147483647))
        : undefined;
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(interval);
      window.clearTimeout(expiry);
    };
  }, [reload, expiresAt]);
}
