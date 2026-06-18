"use client";

import { useCallback } from "react";

/** 논리 좌표 기준 바운딩 박스 (x: 왼쪽, y: 지면에서의 높이, w/h: 크기) */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * AABB(Bounding Box) 충돌 판정
 * @param shrink 판정 박스 축소 비율 (0~1). 1이면 픽셀 그대로, 0.8이면 중심 기준 80%만 판정
 *               — 시각적 억울함을 줄이기 위한 히트박스 보정
 */
export function intersects(a: Box, b: Box, shrink = 0.8): boolean {
  const ax = a.x + (a.w * (1 - shrink)) / 2;
  const aw = a.w * shrink;
  const ay = a.y + (a.h * (1 - shrink)) / 2;
  const ah = a.h * shrink;

  const bx = b.x + (b.w * (1 - shrink)) / 2;
  const bw = b.w * shrink;
  const by = b.y + (b.h * (1 - shrink)) / 2;
  const bh = b.h * shrink;

  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** 충돌 판정 유틸 훅 */
export function useCollision() {
  const check = useCallback(
    (a: Box, b: Box, shrink?: number) => intersects(a, b, shrink),
    [],
  );
  return { check };
}
