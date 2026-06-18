"use client";

import { forwardRef } from "react";

export type PlayerState = "run" | "jump" | "dead";

interface PlayerProps {
  state: PlayerState;
  invincible: boolean;
}

/**
 * 루미(Rumi) — 도트 스프라이트 캐릭터
 * - 달리기: rumi-run.png (6프레임 스프라이트 스트립, steps 애니메이션)
 * - 점프:   rumi-jump.png (단일 프레임)
 * - 사망:   rumi-dead.png (단일 프레임)
 * - 무적 시 Glow 효과
 * - 위치 이동은 게임 엔진이 ref 를 통해 transform 으로 직접 제어 → 리렌더링 없음
 */
const Player = forwardRef<HTMLDivElement, PlayerProps>(function Player(
  { state, invincible },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`rumi rumi--${state}${invincible ? " rumi--invincible" : ""}`}
      aria-label="루미"
    >
      <span className="rumi__sprite" />
      <span className="rumi__sword" aria-hidden="true" />
      <span className="rumi__aura" aria-hidden="true" />
    </div>
  );
});

export default Player;
