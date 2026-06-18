"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BEST_SCORE_KEY = "run-with-rumi-best-score";

/**
 * 점수 시스템 훅
 * - 생존 시간 1초 = 1점 (게임 루프에서 addTime 호출)
 * - 음표 아이템 +10점 (addBonus)
 * - 최고 점수는 LocalStorage 에 저장되어 재접속 시 유지
 * - 점수 누적은 ref 로 처리하고, 화면 표시는 setDisplayScore 로 스로틀링
 *   (매 프레임 리렌더링 방지)
 */
export function useScore() {
  const timeRef = useRef(0); // 생존 시간 (초)
  const bonusRef = useRef(0); // 아이템 보너스 점수
  const lastSyncRef = useRef(0);

  const [displayScore, setDisplayScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  // 최초 마운트 시 최고 점수 로드
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BEST_SCORE_KEY);
      if (saved) setBestScore(Number(saved) || 0);
    } catch {
      /* localStorage 접근 불가 환경 무시 */
    }
  }, []);

  /** 현재 점수 (정수) */
  const getScore = useCallback(
    () => Math.floor(timeRef.current) + bonusRef.current,
    [],
  );

  /** 게임 루프에서 매 프레임 호출 — dt(초) 누적 + 0.2초마다 표시 갱신 */
  const addTime = useCallback(
    (dt: number) => {
      timeRef.current += dt;
      if (timeRef.current - lastSyncRef.current >= 0.2) {
        lastSyncRef.current = timeRef.current;
        setDisplayScore(getScore());
      }
    },
    [getScore],
  );

  /** 음표 등 아이템 보너스 */
  const addBonus = useCallback(
    (points: number) => {
      bonusRef.current += points;
      setDisplayScore(getScore());
    },
    [getScore],
  );

  /** 게임 종료 시 최고 점수 갱신 + 최종 점수 반환 */
  const commit = useCallback(() => {
    const final = getScore();
    setDisplayScore(final);
    setBestScore((prev) => {
      const next = Math.max(prev, final);
      try {
        window.localStorage.setItem(BEST_SCORE_KEY, String(next));
      } catch {
        /* 무시 */
      }
      return next;
    });
    return final;
  }, [getScore]);

  /** 새 게임 시작 시 초기화 */
  const reset = useCallback(() => {
    timeRef.current = 0;
    bonusRef.current = 0;
    lastSyncRef.current = 0;
    setDisplayScore(0);
  }, []);

  return { displayScore, bestScore, getScore, addTime, addBonus, commit, reset };
}
