"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import "./scss/subscribeModal.scss";

interface SubscribeModalProps {
  onClose: () => void;
}

export default function SubscribeModal({ onClose }: SubscribeModalProps) {
  // ESC 키 닫기
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="subscribe-modal-backdrop" onClick={onClose}>
      <div
        className="subscribe-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="구독 필요"
      >
        <button
          type="button"
          className="subscribe-modal__close"
          onClick={onClose}
          aria-label="닫기"
        >
          ✕
        </button>

        <div className="subscribe-modal__icon"><img src="/icons/modal-icon.png" alt="modal icon" /></div>
        <h2 className="subscribe-modal__title">구독이 필요한 서비스입니다</h2>
        <p className="subscribe-modal__desc">
          멤버십을 시작하면 모든 콘텐츠를 무제한으로 <br />즐길 수 있습니다.
        </p>

        <div className="subscribe-modal__actions">
          <Link href="/plan" className="subscribe-modal__cta" onClick={onClose}>
            구독 시작하기
          </Link>
          <button
            type="button"
            className="subscribe-modal__cancel"
            onClick={onClose}
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
