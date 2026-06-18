"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GameModal from "@/components/common/GameModal";
import "./scss/gameBanner.scss";

/**
 * RUN WITH RUMI 홈 프로모션 배너 (시네마 모드 메인 홈 최하단)
 * - 무드 배너와 동일한 레이아웃 구조 + 레트로 도트 디자인
 * - 클릭 시 페이지 이동 없이 모달로 게임 실행 (독립 페이지 /game 은 유지)
 */
export default function GameBanner() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 무드 배너와 동일한 스크롤 등장 애니메이션
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      section.classList.add("is-visible--instant");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          section.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <section className="game-banner-section" ref={sectionRef}>
        <button
          type="button"
          className="game-banner"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
        >
          {/* 배경: 도트 마을 야경 + 스캔라인 */}
          <div className="game-banner__bg" aria-hidden="true">
            <span className="game-banner__scanline" />
          </div>

          <div className="game-banner__inner">
            <div className="game-banner__content">
              <p className="game-banner__eyebrow">K-POP DEMON HUNTERS MINI GAME</p>
              <h2 className="game-banner__title">
                RUN WITH <em>RUMI</em>
              </h2>
              <p className="game-banner__desc">
                악령을 피해 달리고 최고 점수에 도전하세요!
              </p>
            </div>

            {/* 도트 스프라이트 연출: 루미를 쫓는 도깨비들 */}
            <div className="game-banner__visual" aria-hidden="true">
              <span className="game-banner__rumi" />
              <span className="game-banner__demon game-banner__demon--medium" />
              <span className="game-banner__demon game-banner__demon--small" />
            </div>
          </div>
        </button>
      </section>

      {/* 게임 모달: 페이지 이동 없이 서비스 내부에서 플레이 */}
      {isOpen && <GameModal onClose={close} />}
    </>
  );
}
