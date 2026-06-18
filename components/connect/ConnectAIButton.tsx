"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import "./scss/connectAI.scss";

// 1. 패널을 동적 임포트
const ConnectAIPanel = dynamic(() => import("./ConnectAIPanel"), { ssr: false });

export default function ConnectAIButton() {
  const [isMounted, setIsMounted] = useState(false); // 마운트 상태 추가
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // 2. 마운트 완료 시점 확인
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 280);
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      setIsOpen(true);
    }
  };

  // 3. 마운트 전에는 렌더링 차단 (하이드레이션 불일치 방지)
  if (!isMounted) {
    return (
      <button className="connect-ai-btn" aria-label="Netflix AI 열기" disabled>
        <Image src="/images/icon/NetflixAi2.png" alt="Netflix AI" width={44} height={44} quality={75} />
      </button>
    );
  }

  return (
    <>
      <button
        className={`connect-ai-btn${isOpen ? " connect-ai-btn--open" : ""}`}
        onClick={handleToggle}
        aria-label="Netflix AI 열기"
      >
        <Image src="/images/icon/NetflixAi2.png" alt="Netflix AI" width={44} height={44} quality={75} />
      </button>

      {isOpen && <ConnectAIPanel onClose={handleClose} isClosing={isClosing} />}
    </>
  );
}