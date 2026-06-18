"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SimilarUser } from "@/store/useFollowStore";
import "./scss/tasteAnalysisModal.scss";

const GENRE_MAP: Record<string, { label: string; color: string }> = {
  "28":    { label: "액션",       color: "#3b82f6" },
  "16":    { label: "애니메이션", color: "#ec4899" },
  "35":    { label: "코미디",     color: "#f59e0b" },
  "99":    { label: "다큐멘터리", color: "#64748b" },
  "18":    { label: "드라마",     color: "#10b981" },
  "14":    { label: "판타지",     color: "#a855f7" },
  "27":    { label: "공포",       color: "#b94010" },
  "9648":  { label: "미스터리",   color: "#10b93a" },
  "10749": { label: "로맨스",     color: "#ec487f" },
  "878":   { label: "SF",         color: "#6366f1" },
  "53":    { label: "스릴러",     color: "#ef4444" },
  "10752": { label: "전쟁",       color: "#e5f50b" },
};

type Props = {
  user: SimilarUser;
  onClose: () => void;
};

export default function TasteAnalysisModal({ user, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const stats = user.genreStats ?? {};
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  const genres = Object.entries(stats)
    .map(([id, count]) => ({
      id, // id를 유지합니다.
      label: GENRE_MAP[id]?.label ?? "기타",
      color: GENRE_MAP[id]?.color ?? "#94a3b8",
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const initials = (user.nickname ?? "").slice(0, 2).toUpperCase() || "?";

  const content = (
    <div className="tam-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tam-panel" onClick={(e) => e.stopPropagation()}>
        <button className="tam-close" onClick={onClose} aria-label="닫기">✕</button>

        <div className="tam-header">
          {user.imgUrl ? (
            <img className="tam-avatar" src={user.imgUrl} alt={user.nickname} />
          ) : (
            <div className="tam-avatar tam-avatar--initial">{initials}</div>
          )}
          <div className="tam-user-info">
            <p className="tam-label">시청 취향 분석</p>
            <h2 className="tam-nickname">{user.nickname}</h2>
            {user.matchRate > 0 && (
              <span className="tam-match">취향 매칭률 {user.matchRate}%</span>
            )}
          </div>
        </div>

        <div className="tam-chart">
          {genres.length === 0 ? (
            <p className="tam-empty">분석 데이터가 없습니다.</p>
          ) : (
            genres.map((g) => (
              // key를 label이 아닌 고유한 id로 설정
              <div key={g.id} className="tam-bar-row">
                <span className="tam-bar-label">{g.label}</span>
                <div className="tam-bar-track">
                  <div
                    className="tam-bar-fill"
                    style={{ width: `${g.percentage}%`, background: g.color }}
                  />
                </div>
                <span className="tam-bar-pct">{g.percentage}%</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
