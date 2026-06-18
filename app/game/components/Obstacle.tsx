"use client";

import { forwardRef } from "react";

export type ObstacleKind = "small" | "medium" | "big";

/**
 * 도깨비(악령) — 도트 스프라이트 (오브젝트 풀 슬롯)
 * - demon-small/medium/big.png (각 2프레임 걷기 스트립)
 * - 종류는 부모가 스폰 시 data-kind 로 직접 변경 → 리렌더링 없음
 * - 위치 이동도 부모가 transform 으로 직접 제어
 */
const Obstacle = forwardRef<HTMLDivElement>(function Obstacle(_props, ref) {
  return (
    <div ref={ref} className="demon" data-kind="small" data-active="false">
      <span className="demon__sprite" />
    </div>
  );
});

export default Obstacle;
