"use client";

/**
 * K-POP DEMON HUNTERS 도트 배경 (패럴랙스)
 * 레이어 (뒤 → 앞):
 *  1. 달밤 하늘 그라디언트 (고정)
 *  2. 한옥 마을 야경 (bg-far.png, data-depth 0.18)
 *  3. 보라 도깨비불 안개 (CSS, data-depth 0.45)
 *  4. 돌바닥 도로 (bg-ground.png, data-depth 1)
 * 게임 엔진이 data-depth 를 읽어 background-position 을 서로 다른 속도로 이동.
 */
export default function Background() {
  return (
    <div className="game-bg" aria-hidden="true">
      <div className="game-bg__sky" />
      <div className="game-bg__layer game-bg__village" data-depth="0.18" />
      <div className="game-bg__layer game-bg__fog" data-depth="0.45" />
      <div className="game-bg__layer game-bg__ground" data-depth="1" />
    </div>
  );
}
