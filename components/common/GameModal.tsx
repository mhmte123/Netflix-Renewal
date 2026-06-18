"use client";

import { useEffect } from "react";
import RunWithRumi from "@/app/game/RunWithRumi";
import "@/components/main/scss/gameBanner.scss";

interface GameModalProps {
  onClose: () => void;
}

/**
 * RUN WITH RUMI 게임 모달 (공용)
 * - 홈 프로모션 배너, 케데헌 상세페이지 이스터에그 등에서 사용
 * - 페이지 이동 없이 서비스 내부에서 게임 플레이
 */
export default function GameModal({ onClose }: GameModalProps) {
  // 바디 스크롤 잠금 + ESC 닫기
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="game-modal"
      role="dialog"
      aria-modal="true"
      aria-label="RUN WITH RUMI 게임"
      onClick={onClose}
    >
      <div className="game-modal__body" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="game-modal__close"
          onClick={onClose}
          aria-label="게임 닫기"
        >
          ✕
        </button>
        <RunWithRumi embedded />
      </div>
    </div>
  );
}
