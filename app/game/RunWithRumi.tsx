"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Press_Start_2P } from "next/font/google";

/** 레트로 픽셀 폰트 (숫자/영문 — 한글은 기본 폰트 폴백) */
const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

import Player, { type PlayerState } from "./components/Player";
import Obstacle, { type ObstacleKind } from "./components/Obstacle";
import Item, { type ItemKind } from "./components/Item";
import Background from "./components/Background";
import ScoreBoard from "./components/ScoreBoard";
import StartScreen from "./components/StartScreen";
import GameOverModal from "./components/GameOverModal";

import { useGameLoop } from "./hooks/useGameLoop";
import { useCollision, type Box } from "./hooks/useCollision";
import { useScore } from "./hooks/useScore";
import { gameSound } from "./lib/sound";
import { usePointStore } from "@/store/usePointStore";

import "./styles/game.scss";

// ─── 게임 상수 ────────────────────────────────────────────────────────────────
const GRAVITY = 2600; // px/s²
const JUMP_VELOCITY = 880; // px/s
const BASE_SPEED = 580; // px/s (장애물 이동 속도)
const MAX_JUMPS = 2; // 더블 점프
const PLAYER_X_RATIO = 0.2; // 화면 왼쪽 20% 지점 고정
const PLAYER_W = 44; // 히트박스 (시각 스프라이트보다 약간 좁게)
const PLAYER_H = 78;
const INVINCIBLE_DURATION = 5; // 마이크 무적 (초)
const INVINCIBLE_SPEED_MULT = 2.2; // 무적 중 속도 배율
const NOTE_POINTS = 10;

const OBSTACLE_POOL = 6;
const ITEM_POOL = 5;

/** 도깨비 크기 정의 (도트 스프라이트 비율 기준) */
const DEMON_SIZE: Record<ObstacleKind, { w: number; h: number }> = {
  small: { w: 56, h: 64 },
  medium: { w: 88, h: 84 },
  big: { w: 110, h: 110 },
};

const ITEM_SIZE: Record<ItemKind, { w: number; h: number }> = {
  note: { w: 30, h: 30 },
  mic: { w: 30, h: 46 },
};

/** 난이도: 경과 시간(초) → 속도 배율 (30s/60s/90s 단계 상승) */
function difficultyMultiplier(elapsed: number): number {
  if (elapsed >= 90) return 1.8; // 최고 난이도
  if (elapsed >= 60) return 1.5;
  if (elapsed >= 30) return 1.25;
  return 1;
}

interface PoolEntity {
  active: boolean;
  x: number;
  y: number; // 지면 기준 높이
  w: number;
  h: number;
  kind: string;
}

type GamePhase = "start" | "playing" | "gameover";

interface RunWithRumiProps {
  /** 모달 등 임베드 환경 여부 (페이지 패딩/배경 제거) */
  embedded?: boolean;
}

export default function RunWithRumi({ embedded = false }: RunWithRumiProps) {
  // ─── React 상태 (저빈도 갱신만) ──────────────────────────────────────────
  const [phase, setPhase] = useState<GamePhase>("start");
  const [playerState, setPlayerState] = useState<PlayerState>("run");
  const [invincible, setInvincible] = useState(false);
  const [invincibleLeft, setInvincibleLeft] = useState(0);
  const [muted, setMuted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  const { check } = useCollision();
  const { displayScore, bestScore, getScore, addTime, addBonus, commit, reset } =
    useScore();
  const { addGamePoints } = usePointStore();

  // ─── DOM refs ────────────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const obstacleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bgLayersRef = useRef<{ el: HTMLElement; depth: number }[]>([]);

  // ─── 게임 상태 refs (매 프레임 갱신, 리렌더링 없음) ──────────────────────
  const elapsedRef = useRef(0);
  const playerYRef = useRef(0); // 지면 기준 높이
  const velocityRef = useRef(0);
  const jumpingRef = useRef(false);
  const jumpCountRef = useRef(0); // 더블 점프 카운트
  const invincibleUntilRef = useRef(0);
  const obstaclesRef = useRef<PoolEntity[]>([]);
  const itemsRef = useRef<PoolEntity[]>([]);
  const obstacleTimerRef = useRef(0);
  const obstacleIntervalRef = useRef(1.6);
  const itemTimerRef = useRef(0);
  const itemIntervalRef = useRef(3.2);
  const bgOffsetRef = useRef(0);
  const phaseRef = useRef<GamePhase>("start");
  phaseRef.current = phase;

  // ─── 초기화 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    obstaclesRef.current = Array.from({ length: OBSTACLE_POOL }, () => ({
      active: false, x: 0, y: 0, w: 0, h: 0, kind: "small",
    }));
    itemsRef.current = Array.from({ length: ITEM_POOL }, () => ({
      active: false, x: 0, y: 0, w: 0, h: 0, kind: "note",
    }));
    // 패럴랙스 레이어 수집
    const stage = stageRef.current;
    if (stage) {
      bgLayersRef.current = Array.from(
        stage.querySelectorAll<HTMLElement>("[data-depth]"),
      ).map((el) => ({ el, depth: Number(el.dataset.depth) || 1 }));
    }
    return () => gameSound.stopBgm();
  }, []);

  const stageWidth = () => stageRef.current?.clientWidth ?? 900;
  /** 모바일(≤640px 스테이지)에서는 스프라이트가 75%로 축소되므로 히트박스도 동일 비율 적용 */
  const sizeFactor = () => (stageWidth() <= 640 ? 0.75 : 1);

  // ─── 점프 ────────────────────────────────────────────────────────────────
  const jump = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    // 더블 점프: 최대 2회까지 (그 이상 연속 점프 방지)
    if (jumpCountRef.current >= MAX_JUMPS) return;
    jumpCountRef.current += 1;
    jumpingRef.current = true;
    // 2단 점프는 살짝 약하게
    velocityRef.current =
      jumpCountRef.current === 1 ? JUMP_VELOCITY : JUMP_VELOCITY * 0.88;
    setPlayerState("jump");
    gameSound.jump();
  }, []);

  // ─── 시작 / 재시작 ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    // 풀 초기화
    obstaclesRef.current.forEach((o, i) => {
      o.active = false;
      const el = obstacleRefs.current[i];
      if (el) el.dataset.active = "false";
    });
    itemsRef.current.forEach((it, i) => {
      it.active = false;
      const el = itemRefs.current[i];
      if (el) el.dataset.active = "false";
    });

    elapsedRef.current = 0;
    playerYRef.current = 0;
    velocityRef.current = 0;
    jumpingRef.current = false;
    jumpCountRef.current = 0;
    invincibleUntilRef.current = 0;
    obstacleTimerRef.current = 0;
    obstacleIntervalRef.current = 1.6;
    itemTimerRef.current = 1.5;
    itemIntervalRef.current = 3.2;

    reset();
    setInvincible(false);
    setInvincibleLeft(0);
    setIsNewBest(false);
    setPlayerState("run");
    setPhase("playing");
    gameSound.startBgm();
  }, [reset]);

  const endGame = useCallback(() => {
    setPhase("gameover");
    setPlayerState("dead");
    gameSound.crash();
    setTimeout(() => gameSound.gameOver(), 200);

    const prevBest = bestScore;
    const final = commit();
    setFinalScore(final);
    setIsNewBest(final > prevBest);
  }, [bestScore, commit]);

  // ─── 스폰 ────────────────────────────────────────────────────────────────
  const spawnObstacle = useCallback(() => {
    const slotIndex = obstaclesRef.current.findIndex((o) => !o.active);
    if (slotIndex === -1) return;

    const kinds: ObstacleKind[] = ["small", "small", "medium", "medium", "big"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const size = DEMON_SIZE[kind];

    const f = sizeFactor();
    const o = obstaclesRef.current[slotIndex];
    o.active = true;
    o.kind = kind;
    o.w = size.w * f;
    o.h = size.h * f;
    o.x = stageWidth() + 80;
    o.y = 0;

    const el = obstacleRefs.current[slotIndex];
    if (el) {
      el.dataset.kind = kind;
      el.dataset.active = "true";
    }
  }, []);

  const spawnItem = useCallback(() => {
    const slotIndex = itemsRef.current.findIndex((it) => !it.active);
    if (slotIndex === -1) return;

    // 마이크는 낮은 확률 (약 18%)
    const kind: ItemKind = Math.random() < 0.18 ? "mic" : "note";
    const size = ITEM_SIZE[kind];

    const it = itemsRef.current[slotIndex];
    it.active = true;
    it.kind = kind;
    it.w = size.w;
    it.h = size.h;
    it.x = stageWidth() + 80;
    it.y = 50 + Math.random() * 120; // 공중 배치 (점프로 획득)

    const el = itemRefs.current[slotIndex];
    if (el) {
      el.dataset.kind = kind;
      el.dataset.active = "true";
    }
  }, []);

  // ─── 메인 게임 루프 ──────────────────────────────────────────────────────
  useGameLoop((dt) => {
    elapsedRef.current += dt;

    const now = elapsedRef.current;
    const multiplier = difficultyMultiplier(now);
    const isInvincible = invincibleUntilRef.current > now;
    addTime(dt * (isInvincible ? INVINCIBLE_SPEED_MULT : 1));
    const speed = BASE_SPEED * multiplier * (isInvincible ? INVINCIBLE_SPEED_MULT : 1);

    // 1) 플레이어 물리 (점프/중력)
    if (jumpingRef.current) {
      velocityRef.current -= GRAVITY * dt;
      playerYRef.current += velocityRef.current * dt;
      if (playerYRef.current <= 0) {
        // 착지 → 달리기 복귀 + 점프 카운트 리셋
        playerYRef.current = 0;
        velocityRef.current = 0;
        jumpingRef.current = false;
        jumpCountRef.current = 0;
        setPlayerState("run");
      }
    }
    if (playerRef.current) {
      playerRef.current.style.transform = `translate3d(0, ${-playerYRef.current}px, 0)`;
    }

    // 2) 무적 상태 갱신
    const invLeft = Math.max(0, invincibleUntilRef.current - now);
    setInvincibleLeft((prev) =>
      invLeft === 0 || Math.abs(prev - invLeft) > 0.05 ? invLeft : prev,
    );
    if (invLeft <= 0 && invincibleUntilRef.current > 0) {
      invincibleUntilRef.current = 0;
      setInvincible(false);
    }

    // 3) 배경 패럴랙스
    bgOffsetRef.current += speed * dt;
    bgLayersRef.current.forEach(({ el, depth }) => {
      el.style.backgroundPositionX = `${-bgOffsetRef.current * depth}px`;
    });

    // 4) 장애물 스폰 (난이도에 따라 빈도 증가)
    obstacleTimerRef.current += dt;
    if (obstacleTimerRef.current >= obstacleIntervalRef.current) {
      obstacleTimerRef.current = 0;
      obstacleIntervalRef.current =
        (1.1 + Math.random() * 0.9) / multiplier; // 랜덤 간격
      spawnObstacle();
    }

    // 5) 아이템 스폰
    itemTimerRef.current += dt;
    if (itemTimerRef.current >= itemIntervalRef.current) {
      itemTimerRef.current = 0;
      itemIntervalRef.current = 2.4 + Math.random() * 2.4;
      spawnItem();
    }

    // 6) 플레이어 히트박스 (모바일 축소 반영)
    const f = sizeFactor();
    const playerBox: Box = {
      x: stageWidth() * PLAYER_X_RATIO,
      y: playerYRef.current,
      w: PLAYER_W * f,
      h: PLAYER_H * f,
    };

    // 7) 장애물 이동 + 충돌
    for (let i = 0; i < obstaclesRef.current.length; i++) {
      const o = obstaclesRef.current[i];
      if (!o.active) continue;
      o.x -= speed * dt;

      const el = obstacleRefs.current[i];
      if (el) el.style.transform = `translate3d(${o.x}px, 0, 0)`;

      if (o.x < -120) {
        o.active = false;
        if (el) el.dataset.active = "false";
        continue;
      }

      // Bounding Box 충돌 → 즉시 게임 종료 (무적이면 통과)
      if (!isInvincible && check(playerBox, o, 0.72)) {
        endGame();
        return;
      }
    }

    // 8) 아이템 이동 + 획득
    for (let i = 0; i < itemsRef.current.length; i++) {
      const it = itemsRef.current[i];
      if (!it.active) continue;
      it.x -= speed * dt;

      const el = itemRefs.current[i];
      if (el) el.style.transform = `translate3d(${it.x}px, ${-it.y}px, 0)`;

      if (it.x < -80) {
        it.active = false;
        if (el) el.dataset.active = "false";
        continue;
      }

      if (check(playerBox, it, 0.95)) {
        it.active = false;
        if (el) el.dataset.active = "false";

        if (it.kind === "note") {
          addBonus(NOTE_POINTS);
          gameSound.pickup();
        } else {
          // 마이크: 5초 무적
          invincibleUntilRef.current = now + INVINCIBLE_DURATION;
          setInvincible(true);
          gameSound.power();
        }
      }
    }
  }, phase === "playing");

  // ─── 입력 (키보드 / 터치) ────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (phaseRef.current === "playing") jump();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [jump]);

  const handleStageTouch = useCallback(() => {
    if (phaseRef.current === "playing") jump();
  }, [jump]);

  const toggleSound = useCallback(() => {
    setMuted((prev) => {
      gameSound.setMuted(!prev);
      return !prev;
    });
  }, []);

  // ─── 렌더 ────────────────────────────────────────────────────────────────
  return (
    <div className={`game-page ${pixelFont.className}${embedded ? " game-page--embedded" : ""}`}>
      <div
        ref={stageRef}
        className="game-stage"
        onPointerDown={handleStageTouch}
        role="application"
        aria-label="RUN WITH RUMI 미니게임"
      >
        <Background />

        {/* 플레이어 (왼쪽 20% 고정) */}
        <div className="game-stage__player-anchor">
          <Player ref={playerRef} state={playerState} invincible={invincible} />
        </div>

        {/* 장애물 풀 */}
        {Array.from({ length: OBSTACLE_POOL }, (_, i) => (
          <Obstacle
            key={`ob-${i}`}
            ref={(el) => {
              obstacleRefs.current[i] = el;
            }}
          />
        ))}

        {/* 아이템 풀 */}
        {Array.from({ length: ITEM_POOL }, (_, i) => (
          <Item
            key={`it-${i}`}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
          />
        ))}

        {/* HUD */}
        <ScoreBoard
          score={phase === "gameover" ? finalScore : displayScore}
          best={bestScore}
          muted={muted}
          onToggleSound={toggleSound}
          invincibleLeft={invincibleLeft}
        />

        {/* 오버레이 */}
        {phase === "start" && <StartScreen onStart={startGame} />}
        {phase === "gameover" && (
          <GameOverModal
            score={finalScore}
            best={bestScore}
            isNewBest={isNewBest}
            onRestart={startGame}
            onClaimPoints={addGamePoints}
          />
        )}
      </div>

      <p className="game-page__hint">
        SPACE / ↑ / 터치로 점프 (공중에서 한 번 더 점프 가능) · 음표 +10점 · 마이크 5초 무적
      </p>
    </div>
  );
}
