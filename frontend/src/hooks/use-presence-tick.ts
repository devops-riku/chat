"use client";

import { useEffect, useState } from "react";

/**
 * Forces a re-render every `ms` milliseconds so presence labels
 * ("Active 3s ago", "Active 1m ago", …) stay current without any
 * extra state — callers just invoke presenceLabel() normally and
 * React will call it again on each tick.
 */
export function usePresenceTick(ms = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
