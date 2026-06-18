"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useAuthStore } from "@/store/useAuthStore";
import BackButton from "@/components/common/BackButton";
import "../scss/wishlist.scss";
import { Movie, TV } from "@/types/movie";
import { WishItem } from "@/types/wishlist";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type FilterType = "all" | "movie" | "tv" | "animation";
type SortType = "recent" | "title" | "rating";

// ─── 탭 정의 ──────────────────────────────────────────────────────────────────

const TABS: { key: FilterType; label: string }[] = [
  { key: "all", label: "전체리스트" },
  { key: "movie", label: "영화" },
  { key: "tv", label: "드라마" },
  { key: "animation", label: "애니메이션" },
];

const SORT_OPTIONS: { key: SortType; label: string }[] = [
  { key: "recent", label: "최근 찜한 순" },
  { key: "title", label: "제목순" },
  { key: "rating", label: "평점순" },
];

// "n일 전 찜" 텍스트 생성 (addedAt ISO 문자열 기준)
function formatAddedTime(addedAt: string): string {
  if (!addedAt) return ""; // ID만 저장하는 구조: 찜 시각 미보관
  const added = new Date(addedAt).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - added) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "오늘 찜";
  if (diffDays < 7) return `${diffDays}일 전 찜`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전 찜`;
  return `${Math.floor(diffDays / 30)}달 전 찜`;
}

export const convertToMedia = (item: WishItem): Movie | TV => {
  const base = {
    id: item.id,
    poster_path: item.poster_path,
    vote_average: item.vote_average,
    // 필요 시 MediaBase의 다른 공통 속성들도 여기에 추가
  };

  if (item.mediaType === "movie") {
    return {
      ...base,
      title: item.title,
      release_date: "", // WishItem에 없는 정보는 기본값 설정
    } as Movie;
  } else {
    return {
      ...base,
      name: item.title, // TV는 name을 사용
    } as TV;
  }
};

export default function WishlistPage() {
  const { wishlist, onLoadWishlist, onRemoveWish } = useWishlistStore();
  const { user } = useAuthStore();

  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 찜 목록 불러오기
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await onLoadWishlist();
      setIsLoading(false);
    };
    load();
  }, [user]);

  // 필터링
  const filtered = wishlist.filter((item) => {
    if (filter === "all") return true;
    if (filter === "movie") return item.genre === "movie";
    if (filter === "tv") return item.genre === "drama";
    if (filter === "animation") return item.genre === "animation";
    return true;
  });

  // 정렬
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "recent") {
      return 0; // 배열 순서가 이미 최신 찜 순 (맨 앞이 최근)
    }
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "rating") return b.vote_average - a.vote_average;
    return 0;
  });

  // 각 탭별 개수
  const getCount = (key: FilterType) => {
    if (key === "all") return wishlist.length;
    if (key === "movie") return wishlist.filter((i) => i.genre === "movie").length;
    if (key === "tv") return wishlist.filter((i) => i.genre === "drama").length;
    if (key === "animation") return wishlist.filter((i) => i.genre === "animation").length;
    return 0;
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label;

  // 찜 해제 핸들러
  const handleRemove = async (e: React.MouseEvent, item: WishItem) => {
    e.preventDefault();

    // WishItem을 다시 Movie | TV 형태로 변형
    const mediaItem = convertToMedia(item);
    
    await onRemoveWish(mediaItem);
  };

  return (
    <div className="wishlist-page">
      <div className="wishlist-inner">
        <BackButton fallback="/mypage" />
        {/* ── 헤더 ──────────────────────────────────────────────────────── */}
        <div className="wishlist-header">
          <h1 className="wishlist-title">위시리스트</h1>
          <p className="wishlist-subtitle">내가 찜한 모든 작품</p>
        </div>

        {/* ── 탭 + 정렬 ─────────────────────────────────────────────────── */}
        <div className="wishlist-toolbar">
          <div className="wishlist-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab-btn${filter === tab.key ? " is-active" : ""}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
                <span className="tab-count">{getCount(tab.key)}</span>
              </button>
            ))}
          </div>

          {/* 정렬 드롭다운 */}
          <div className="wishlist-sort">
            <button
              type="button"
              className="sort-btn"
              onClick={() => setSortOpen((v) => !v)}
            >
              {currentSortLabel}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className={`sort-arrow${sortOpen ? " is-open" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {sortOpen && (
              <ul className="sort-menu">
                {SORT_OPTIONS.map((opt) => (
                  <li key={opt.key}>
                    <button
                      type="button"
                      className={`sort-option${sort === opt.key ? " is-selected" : ""}`}
                      onClick={() => {
                        setSort(opt.key);
                        setSortOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── 컨텐츠 ────────────────────────────────────────────────────── */}
        {isLoading ? (
          // 로딩 중 스켈레톤
          <ul className="wishlist-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="wish-card">
                <div className="wish-poster wish-poster-skeleton" />
                <div className="wish-info">
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
              </li>
            ))}
          </ul>
        ) : !user ? (
          // 비로그인 상태
          <div className="wishlist-empty">
            <p className="empty-text">로그인하고 찜한 작품을 확인하세요</p>
            <Link href="/login" className="empty-cta">로그인하기</Link>
          </div>
        ) : sorted.length > 0 ? (
          // 찜 목록 표시
          <ul className="wishlist-grid">
            {sorted.map((item) => (
              <li key={`${item.mediaType}-${item.id}`} className="wish-card">
                <Link href={`/detail/${item.mediaType}/${item.id}`} className="wish-card-link">
                  <div className="wish-poster">
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                        alt={item.title}
                      />
                    ) : (
                      <div className="wish-poster-empty" />
                    )}
                    {/* 호버 시 나타나는 찜 해제 버튼 */}
                    <button
                      type="button"
                      className="wish-remove"
                      aria-label="찜 해제"
                      onClick={(e) => handleRemove(e, item)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </button>
                  </div>
                  <div className="wish-info">
                    <h3 className="wish-card-title">{item.title}</h3>
                    {formatAddedTime(item.addedAt) && (
                      <p className="wish-added">{formatAddedTime(item.addedAt)}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          // 찜한 작품이 없을 때
          <div className="wishlist-empty">
            <p className="empty-text">아직 찜한 작품이 없어요</p>
            <Link href="/" className="empty-cta">작품 둘러보기</Link>
          </div>
        )}
      </div>
    </div>
  );
}