"use client";

import { showToast } from "@/store/useToastStore";
import "./shareButton.scss";

interface ShareButtonProps {
  mediaType: "movie" | "tv";
  id: number;
  className?: string;
  stopPropagation?: boolean;
}

export default function ShareButton({ mediaType, id, className, stopPropagation }: ShareButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    e.preventDefault();

    // 버튼 위치를 비동기(clipboard) 전에 미리 확보
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const anchor = { x: rect.left + rect.width / 2, y: rect.top };

    const url = `${window.location.origin}/detail/${mediaType}/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast("링크가 복사되었습니다.", {
        icon: "/images/icon/link.svg",
        anchor,
      });
    });
  };

  return (
    <button
      type="button"
      className={`share-btn ${className ?? ""}`}
      onClick={handleClick}
      title="공유하기"
      aria-label="공유하기"
    >
      <img src="/images/header/menu/share.svg" alt="공유" width={18} height={18} />
    </button>
  );
}
