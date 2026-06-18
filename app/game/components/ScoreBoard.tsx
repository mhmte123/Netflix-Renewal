"use client";

interface ScoreBoardProps {
  score: number;
  best: number;
  muted: boolean;
  onToggleSound: () => void;
  /** 무적 남은 시간 (초). 0이면 미표시 */
  invincibleLeft: number;
}

/** 점수판 + 사운드 토글 + 무적 상태 표시 */
export default function ScoreBoard({
  score,
  best,
  muted,
  onToggleSound,
  invincibleLeft,
}: ScoreBoardProps) {
  return (
    <div className="game-hud">
      <div className="game-hud__scores">
        <div className="game-hud__score-item">
          <span className="game-hud__label">BEST SCORE</span>
          <span className="game-hud__value game-hud__value--best">
            {String(best).padStart(5, "0")}
          </span>
        </div>
        <div className="game-hud__score-item">
          <span className="game-hud__label">CURRENT SCORE</span>
          <span className="game-hud__value">
            {String(score).padStart(5, "0")}
          </span>
        </div>
      </div>

      {invincibleLeft > 0 && (
        <div className="game-hud__invincible" role="status">
          ⚡ 무적 {invincibleLeft.toFixed(1)}s
        </div>
      )}

      <button
        type="button"
        className="game-hud__sound"
        onClick={onToggleSound}
        aria-label={muted ? "사운드 켜기" : "사운드 끄기"}
        title={muted ? "사운드 켜기" : "사운드 끄기"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}
