"use client";

import { useRouter } from "next/navigation";

interface BackButtonProps {
  label?: string;
  // 히스토리가 없을 때(직접 진입/새로고침) 돌아갈 경로
  fallback?: string;
  className?: string;
}

export default function BackButton({
  label = "뒤로",
  fallback = "/mypage",
  className = "",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      type="button"
      className={`app-back-btn ${className}`.trim()}
      onClick={handleBack}
      aria-label="뒤로가기"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{label}</span>

      <style jsx>{`
        .app-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 16px 0;
          padding: 8px 14px 8px 10px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .app-back-btn:hover {
          background: rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.3);
        }
        .app-back-btn svg {
          display: block;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
      `}</style>
    </button>
  );
}
