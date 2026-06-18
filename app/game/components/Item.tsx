"use client";

import { forwardRef } from "react";

export type ItemKind = "note" | "mic";

/**
 * 아이템 (오브젝트 풀 슬롯)
 * - 음표(note): +10점
 * - 마이크(mic): 5초 무적
 * - 종류는 부모가 스폰 시 data-kind 로 변경, 위치는 transform 으로 직접 제어
 */
const Item = forwardRef<HTMLDivElement>(function Item(_props, ref) {
  return (
    <div ref={ref} className="game-item" data-kind="note" data-active="false">
      <span className="game-item__note" aria-hidden="true">
        ♪
      </span>
      <span className="game-item__mic" aria-hidden="true">
        <span className="game-item__mic-head" />
        <span className="game-item__mic-grip" />
      </span>
    </div>
  );
});

export default Item;
