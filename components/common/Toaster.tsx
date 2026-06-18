"use client";

import { createPortal } from "react-dom";
import { useToastStore } from "@/store/useToastStore";
import "./toaster.scss";
import { useIsMounted } from '@/hooks/useIsMounted';

export default function Toaster() {
  const isMounted = useIsMounted();

  const toasts = useToastStore((s) => s.toasts);

  // 아직 마운트되지 않았다면 (서버이거나 클라이언트 초기화 전)
  // 에러를 유발하는 UI를 렌더링하지 않거나, 빈 상태를 반환합니다.
  if (!isMounted) return null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="app-toaster" aria-live="polite">
      {toasts.map((t, i) => {
        // 모든 토스트를 하단 중앙에 표시 (여러 개면 위로 쌓임)
        const style: React.CSSProperties = {
          left: "50%",
          bottom: 32 + i * 56,
          transform: "translateX(-50%)",
        };
        return (
          <div
            key={t.id}
            className={`app-toast${t.hiding ? " app-toast--hiding" : ""}`}
            style={style}
          >
            {t.icon && <img src={t.icon} alt="" width={18} height={18} />}
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
