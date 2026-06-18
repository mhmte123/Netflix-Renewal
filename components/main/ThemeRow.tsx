"use client";
import React, { useState, useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useMovieStore } from "@/store/useMovieStore";
import Image from "next/image";
import Link from "next/link";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";

import "swiper/css";
import "swiper/css/navigation";
import "./scss/categoryList.scss";
import WishlistButton from "@/components/common/WishlistButton";
import ShareButton from "@/components/common/ShareButton";
import SectionTitle from "../common/SectionTitle";
import { filterByExcludedGenres, useExcludedGenres } from "@/data/excludedGenres";
import { filterHidden } from "@/data/hiddenContent";
import { filterByMaturity, useMaturityFilterSnapshot } from "@/data/maturityFilter";
import { useAuthStore } from "@/store/useAuthStore";

import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { formatFivePointRating } from "@/lib/rating";

const GENRE_MAP: Record<number, string> = {
  28: "액션", 12: "모험", 16: "애니메이션", 35: "코미디", 80: "범죄",
  99: "다큐", 18: "드라마", 10751: "가족", 14: "판타지", 36: "역사",
  27: "공포", 10402: "음악", 9648: "미스터리", 10749: "로맨스", 878: "SF",
  53: "스릴러", 10752: "전쟁", 37: "서부",
  10759: "액션", 10762: "어린이", 10765: "SF", 10768: "전쟁",
};

export interface ThemeItem {
  id: number;
  title: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  overview: string;
  release_date?: string;
  genre_ids: number[];
  mediaType: "movie" | "tv";
  isNetflixOriginal?: boolean;
}

interface ThemeRowProps {
  title: string;
  items: ThemeItem[];
  href?: string;
  showRank?: boolean; // 포스터 위에 순위 숫자(1,2,3...) 표시 (랭킹 섹션용)
}

const HOVER_VIDEO_DELAY_MS = 900;

export default function ThemeRow({ title, items: rawItems, href, showRank = false }: ThemeRowProps) {
  const t = useT();
  const router = useRouter();
  const prefetchRoute = useRoutePrefetch();
  const excludedGenres = useExcludedGenres();
  const { ceiling: maturityCeiling, certifications } = useMaturityFilterSnapshot();
  const currentProfile = useAuthStore((state) => state.currentProfile);
  const autoplayPreview = currentProfile?.settings?.playback?.autoplayPreview ?? true;
  const { onFetchVideo, onFetchTvVideos, popVideos, tvVideos } = useMovieStore();
  const items = filterHidden(
    filterByMaturity(
      filterByExcludedGenres(rawItems, excludedGenres),
      maturityCeiling,
      certifications,
      (it) => `${it.mediaType}-${it.id}`,
    ),
  );

  const [hover, setHover] = useState<number | null>(null);
  const [videoReady, setVideoReady] = useState<number | null>(null);
  const [leftEdgeIndex, setLeftEdgeIndex] = useState(0);
  const [rightEdgeIndex, setRightEdgeIndex] = useState(Infinity);

  // 태블릿/모바일(<=1024px) 감지: TOP10(showRank) 행은 호버 프리뷰 없이 탭 → 바로 상세 이동
  const [isCompactView, setIsCompactView] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const update = () => setIsCompactView(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const videoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 현재 보이는 슬라이드의 좌/우 끝 인덱스 갱신 (오른쪽 끝 카드가 컨테이너 밖으로 안 나가게)
  const updateEdges = (swiper: SwiperType) => {
    const spv = typeof swiper.params.slidesPerView === "number" ? swiper.params.slidesPerView : 1;
    setLeftEdgeIndex(swiper.activeIndex);
    setRightEdgeIndex(swiper.activeIndex + Math.floor(spv) - 1);
  };

  const handleMouseEnter = (item: ThemeItem) => {
    setHover(item.id);
    setVideoReady(null);
    if (videoTimer.current) clearTimeout(videoTimer.current);
    const fetchVideo = item.mediaType === "movie"
      ? () => onFetchVideo(item.id)
      : () => onFetchTvVideos(item.id);
    if (autoplayPreview) {
      videoTimer.current = setTimeout(() => {
        setVideoReady(item.id);
        void fetchVideo();
      }, HOVER_VIDEO_DELAY_MS);
    }
  };

  const handleMouseLeave = () => {
    setHover(null);
    setVideoReady(null);
    if (videoTimer.current) clearTimeout(videoTimer.current);
  };

  useEffect(() => {
    return () => {
      if (videoTimer.current) clearTimeout(videoTimer.current);
    };
  }, []);

  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);
  const isDragging = useRef(false);

  if (items.length === 0) return null;

  return (
    <section className="category-section">
      <div className="section-title-outer">
        {title === "오늘 가장 많이보는 시리즈" || title === "팔로우 취향 저격 작품" || title === "지금 커넥트에서 핫한 작품" ? <SectionTitle title={title} href={href ?? "/category"} showMore={false} /> :
          <SectionTitle title={title} href={href ?? "/category"} />}
      </div>

      <div className="swiper-outer">
        <Swiper
          modules={[Navigation]}
          navigation
          spaceBetween={12}
          slidesPerView={2.5}
          breakpoints={{
            0: { slidesPerView: 3.3 },
            640: { slidesPerView: 3.5 },
            1024: { slidesPerView: 6.5 },
            1280: { slidesPerView: 8.5 },
          }}
          onSwiper={(swiper) => updateEdges(swiper)}
          onSlideChange={(swiper) => updateEdges(swiper)}
          onBreakpoint={(swiper) => updateEdges(swiper)}
          className="media-swiper"
          onTouchStart={() => { isDragging.current = false; }}
          onTouchMove={() => { isDragging.current = true; }}
          onTouchEnd={() => { setTimeout(() => { isDragging.current = false; }, 50); }}
          onClick={() => { if (isUnsubscribed) openModal(); }}
        >
          {items.map((item, index) => {
            const detailHref = `/detail/${item.mediaType}/${item.id}`;
            const watchHref = `/watch/${item.mediaType}/${item.id}`;
            const videos = item.mediaType === "movie" ? popVideos[item.id] : tvVideos[item.id];
            const trailer = videos?.find((v) => v.type === "Trailer" || v.type === "Teaser");
            const trailerKey = trailer?.key || null;
            const certKey = `${item.mediaType}-${item.id}`;

            return (
              <SwiperSlide key={item.id} className="category-slide">
                <li
                  className="category-item"
                  onMouseEnter={() => {
                    prefetchRoute(detailHref);
                    prefetchRoute(watchHref);
                    // 태블릿/모바일 TOP10: 프리뷰 카드가 떠서 숫자/카드가 올라가 보이는 현상 방지
                    if (showRank && isCompactView) return;
                    handleMouseEnter(item);
                  }}
                  onMouseLeave={handleMouseLeave}
                  onFocus={() => prefetchRoute(detailHref)}
                  onClick={() => {
                    if (isDragging.current) return;
                    if (isUnsubscribed) { openModal(); return; }
                    router.push(detailHref);
                  }}
                >
                  <div className="img-box">
                    <Image
                      className="poster-img"
                      src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 31vw, (max-width: 1024px) 28vw, 12vw"
                    />
                    {showRank && (
                      <span className="theme-rank-num" aria-hidden="true">
                        {index + 1}
                      </span>
                    )}
                    {item.isNetflixOriginal && (
                      <>
                        <div className="netflix-corner-logo">
                          <div className="logo-box">
                            <img src="/images/logo-icon.svg" alt="Netflix" />
                          </div>
                        </div>
                        <div className="netflix-original-badge">
                          <img src="/images/logo-icon.svg" alt="Netflix" className="badge-logo" />
                          <span className="badge-text">ORIGINAL</span>
                        </div>
                      </>
                    )}
                  </div>

                  {hover === item.id && (
                    <div className={`hover-card animate-fade-in${index === leftEdgeIndex ? " left-edge" : index >= rightEdgeIndex ? " right-edge" : ""}`}>
                      <div className="hover-video">
                        {autoplayPreview && trailerKey && videoReady === item.id ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&fs=0&showinfo=0`}
                            title="트레일러"
                            allow="autoplay"
                            loading="lazy"
                            referrerPolicy="strict-origin-when-cross-origin"
                          />
                        ) : (
                          <Image
                            src={`https://image.tmdb.org/t/p/w500${item.backdrop_path}`}
                            alt={item.title}
                            className="fallback-img"
                            fill
                            sizes="(max-width: 640px) 100vw, 40vw"
                          />
                        )}
                      </div>
                      <div className="hover-info">
                        <div className="hover-title-row">
                          <h3 className="hover-title">{item.title}</h3>
                          {certifications[certKey] && (
                            <span className="hover-age">{certifications[certKey]}</span>
                          )}
                        </div>
                        <div className="hover-meta">
                          {item.vote_average > 0 && (
                            <>
                              <span className="meta-star">★</span>
                              <span className="meta-score">{formatFivePointRating(item.vote_average)}</span>
                              <span className="meta-sep">|</span>
                            </>
                          )}
                          {item.release_date && (
                            <>
                              <span className="meta-year">{item.release_date.slice(0, 4)}</span>
                              {item.genre_ids.length > 0 && <span className="meta-sep">|</span>}
                            </>
                          )}
                          {item.genre_ids.length > 0 && (
                            <span className="meta-genre">
                              {item.genre_ids.slice(0, 2).map((id) => GENRE_MAP[id]).filter(Boolean).join(" • ")}
                            </span>
                          )}
                        </div>
                        {item.overview && (
                          <p className="hover-overview">{item.overview}</p>
                        )}
                        <div className="hover-actions">
                          {isUnsubscribed ? (
                            <>
                              <button type="button" className="btn-play" onClick={(e) => { e.stopPropagation(); openModal(); }}>
                                <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" style={{ fill: "#fff" }}>
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                {t("common.play")}
                              </button>
                              <button type="button" className="btn-detail" onClick={(e) => { e.stopPropagation(); openModal(); }}>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="16" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                {t("common.detail")}
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={watchHref}
                                className="btn-play"
                                onPointerEnter={() => prefetchRoute(watchHref)}
                                onFocus={() => prefetchRoute(watchHref)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg viewBox="0 0 24 24" width={15} height={15} aria-hidden="true" style={{ fill: "#fff" }}>
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                {t("common.play")}
                              </Link>
                              <Link
                                href={detailHref}
                                className="btn-detail"
                                onPointerEnter={() => prefetchRoute(detailHref)}
                                onFocus={() => prefetchRoute(detailHref)}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="16" x2="12" y2="12" />
                                  <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                {t("common.detail")}
                              </Link>
                            </>
                          )}
                          <WishlistButton item={item} mediaType={item.mediaType} stopPropagation className="card-wish" />
                          <ShareButton mediaType={item.mediaType} id={item.id} stopPropagation className="card-wish" />
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </section>
  );
}
