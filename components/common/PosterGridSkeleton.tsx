"use client";

import "./posterGridSkeleton.scss";

type PosterGridSkeletonProps = {
  count?: number;
};

export default function PosterGridSkeleton({
  count = 18,
}: PosterGridSkeletonProps) {
  return (
    <div className="poster-grid poster-grid-skeleton" aria-label="작품 목록 로딩 중">
      {Array.from({ length: count }).map((_, index) => (
        <div className="poster-skeleton-card" key={index}>
          <div className="poster-skeleton-card__poster" />
          <div className="poster-skeleton-card__line" />
          <div className="poster-skeleton-card__line poster-skeleton-card__line--short" />
        </div>
      ))}
    </div>
  );
}
