"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

export function useRoutePrefetch() {
  const router = useRouter();
  const prefetched = useRef(new Set<string>());

  return useCallback(
    (href?: string | null) => {
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (prefetched.current.has(href)) return;

      prefetched.current.add(href);
      router.prefetch(href);
    },
    [router],
  );
}
