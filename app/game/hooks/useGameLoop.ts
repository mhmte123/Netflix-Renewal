"use client";

import { useEffect, useRef } from "react";

/**
 * requestAnimationFrame 기반 게임 루프 훅
 * - running 이 true 인 동안 매 프레임 callback(dt) 호출
 * - dt 는 초 단위 (탭 비활성 등으로 프레임이 밀려도 최대 50ms 로 클램프)
 * - callback 은 ref 로 보관해 리렌더링 없이 항상 최신 로직 실행 (60FPS 유지)
 */
export function useGameLoop(
  callback: (dt: number) => void,
  running: boolean,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!running) return;

    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      callbackRef.current(dt);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [running]);
}
