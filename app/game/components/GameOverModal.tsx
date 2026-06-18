"use client";

import Link from "next/link";
import { useState } from "react";

const DETAIL_HREF = "/detail/movie/803796";
const SCORE_PER_POINT = 100;
const POINTS_PER_UNIT = 10;

interface GameOverModalProps {
  score: number;
  best: number;
  isNewBest: boolean;
  onRestart: () => void;
  onClaimPoints?: (points: number) => Promise<void>;
}

export default function GameOverModal({
  score,
  best,
  isNewBest,
  onRestart,
  onClaimPoints,
}: GameOverModalProps) {
  const earnedPoints = Math.floor(score / SCORE_PER_POINT) * POINTS_PER_UNIT;
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    if (!onClaimPoints || claimed || earnedPoints <= 0) return;
    setClaiming(true);
    await onClaimPoints(earnedPoints);
    setClaiming(false);
    setClaimed(true);
  };

  return (
    <div className="game-overlay game-over">
      <h2 className="game-over__title">GAME OVER</h2>
      {isNewBest && <p className="game-over__new-best">🏆 NEW BEST SCORE!</p>}

      <div className="game-over__scores">
        <div className="game-over__score">
          <span>SCORE</span>
          <strong>{String(score).padStart(5, "0")}</strong>
        </div>
        <div className="game-over__score game-over__score--best">
          <span>BEST</span>
          <strong>{String(best).padStart(5, "0")}</strong>
        </div>
      </div>

      {earnedPoints > 0 && (
        <div className="game-over__point-box">
          <p className="game-over__point-label">
            이번 게임 획득 포인트
          </p>
          <p className="game-over__point-value">+{earnedPoints}P</p>
          <p className="game-over__point-hint">
            100점당 10포인트 · 쇼핑몰에서 사용 가능
          </p>
          {claimed ? (
            <p className="game-over__point-done">✓ 포인트 적립 완료!</p>
          ) : (
            <button
              type="button"
              className="game-btn game-btn--point game-btn--ko"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? "적립 중…" : "포인트 적립하기"}
            </button>
          )}
        </div>
      )}

      <div className="game-over__actions">
        <button
          type="button"
          className="game-btn game-btn--primary game-btn--ko"
          onClick={onRestart}
        >
          다시 시작
        </button>
        <Link href={DETAIL_HREF} className="game-btn game-btn--ghost game-btn--ko">
          작품 보러가기
        </Link>
      </div>
    </div>
  );
}
