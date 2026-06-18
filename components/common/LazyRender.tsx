"use client";

import { useEffect, useRef, useState } from "react";

type LazyRenderProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
};

export default function LazyRender({
  children,
  fallback = null,
  rootMargin = "600px 0px",
}: LazyRenderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, shouldRender]);

  return <div ref={ref}>{shouldRender ? children : fallback}</div>;
}
