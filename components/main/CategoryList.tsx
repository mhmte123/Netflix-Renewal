"use client";
import React, { useState, useRef, useEffect } from "react";
import { useT } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useMovieStore } from "@/store/useMovieStore";
import { useAuthStore } from "@/store/useAuthStore";
import Image from "next/image";
import Link from "next/link";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";

import "swiper/css";
import "swiper/css/navigation";
import WishlistButton from "@/components/common/WishlistButton";
import ShareButton from "@/components/common/ShareButton";
import "./scss/categoryList.scss";
import SectionTitle from "../common/SectionTitle";
import { filterByExcludedGenres, useExcludedGenres } from "@/data/excludedGenres";
import { filterByMaturity, useMaturityFilterSnapshot } from "@/data/maturityFilter";

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

interface MediaListProps {
  category: "movie" | "tv" | "netflix";
}

const HOVER_VIDEO_DELAY_MS = 900;

export default function CategoryList({ category }: MediaListProps) {
  const t = useT();
  const router = useRouter();
  const prefetchRoute = useRoutePrefetch();
  const {
    popMovies,
    popVideos,
    onFetchPopular,
    onFetchVideo,
    tvs,
    tvVideos,
    onFetchTvs,
    onFetchTvVideos,
    netflixOriginals,
    onFetchNetflixOriginals,
    onFetchCertification,
  } = useMovieStore();
  const { currentProfile } = useAuthStore();

  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);

  const [hover, setHover] = useState<number | null>(null);
  const [videoReady, setVideoReady] = useState<number | null>(null);
  const videoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedCategoriesRef = useRef<Set<MediaListProps["category"]>>(new Set());
  const [leftEdgeIndex, setLeftEdgeIndex] = useState(0);
  const [rightEdgeIndex, setRightEdgeIndex] = useState(8);

  const updateEdges = (swiper: SwiperType) => {
    const left = swiper.activeIndex;
    setLeftEdgeIndex(left);
    const spv = swiper.params.slidesPerView;
    const numVisible = typeof spv === "number" ? Math.ceil(spv) : 6;
    setRightEdgeIndex(left + numVisible);
  };
  const profileOffset = Math.max((currentProfile?.id ?? 1) - 1, 0) * 3;
  const autoplayPreview = currentProfile?.settings?.playback?.autoplayPreview ?? true;

  useEffect(() => {
    if (requestedCategoriesRef.current.has(category)) return;

    if (category === "movie" && popMovies.length === 0) {
      requestedCategoriesRef.current.add(category);
      onFetchPopular();
      return;
    }
    if (category === "tv" && tvs.length === 0) {
      requestedCategoriesRef.current.add(category);
      onFetchTvs();
      return;
    }
    if (category === "netflix" && netflixOriginals.length === 0) {
      requestedCategoriesRef.current.add(category);
      onFetchNetflixOriginals();
    }
  }, [
    category,
    popMovies.length,
    tvs.length,
    netflixOriginals.length,
    onFetchPopular,
    onFetchTvs,
    onFetchNetflixOriginals,
  ]);

  const movieSource = [
    ...popMovies.slice(profileOffset),
    ...popMovies.slice(0, profileOffset),
  ];
  const tvSource = [
    ...tvs.slice(profileOffset),
    ...tvs.slice(0, profileOffset),
  ];

  const excludedGenres = useExcludedGenres();

  const rawCurrentList =
    category === "movie"
      ? movieSource.slice(0, 18).map((movie) => ({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        vote_average: movie.vote_average,
        overview: movie.overview,
        release_date: movie.release_date,
        genre_ids: movie.genre_ids ?? [],
        videos: popVideos[movie.id],
        fetchVideo: () => onFetchVideo(movie.id),
      }))
      : category === "netflix"
        ? netflixOriginals.slice(0, 18).map((tv) => ({
          id: tv.id,
          title: tv.name,
          poster_path: tv.poster_path,
          backdrop_path: tv.backdrop_path,
          vote_average: tv.vote_average,
          overview: tv.overview,
          release_date: undefined as string | undefined,
          genre_ids: tv.genre_ids ?? [],
          videos: tvVideos[tv.id],
          fetchVideo: () => onFetchTvVideos(tv.id),
        }))
        : tvSource.slice(0, 18).map((tv) => ({
          id: tv.id,
          title: tv.name,
          poster_path: tv.poster_path,
          backdrop_path: tv.backdrop_path,
          vote_average: tv.vote_average,
          overview: tv.overview,
          release_date: undefined as string | undefined,
          genre_ids: tv.genre_ids ?? [],
          videos: tvVideos[tv.id],
          fetchVideo: () => onFetchTvVideos(tv.id),
        }));

  // 제외 장르 작품 숨김
  const excludedList = filterByExcludedGenres(rawCurrentList, excludedGenres);

  // 관람등급 필터 (netflix 카테고리는 tv 등급으로 조회)
  const { ceiling: maturityCeiling, certifications } = useMaturityFilterSnapshot();
  const certMediaType = category === "netflix" ? "tv" : category;
  const currentList = filterByMaturity(
    excludedList,
    maturityCeiling,
    certifications,
    (it: { id: number }) => `${certMediaType}-${it.id}`,
  );

  // hover 전에도 등급 필터가 동작하도록 현재 목록의 등급을 미리 로드
  useEffect(() => {
    if (maturityCeiling >= 19) return;
    excludedList.forEach((it: { id: number }) =>
      onFetchCertification(it.id, certMediaType as "movie" | "tv"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, maturityCeiling, excludedList.length]);

  const handleMouseEnter = (id: number, fetchVideo: () => Promise<void>) => {
    setHover(id);
    setVideoReady(null);
    if (videoTimer.current) clearTimeout(videoTimer.current);
    if (autoplayPreview) {
      videoTimer.current = setTimeout(() => {
        setVideoReady(id);
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

  return (
    <section className="category-section">
      <div className="section-title-outer">
        <SectionTitle title={category === "netflix" ? "넷플릭스 시리즈" : "카테고리"} href="/category" showMore={false} />
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
        >
          {currentList.map((item, index) => {
            const mediaType = category === "netflix" ? "tv" : category;
            const detailHref = `/detail/${mediaType}/${item.id}`;
            const watchHref = `/watch/${mediaType}/${item.id}`;
            const trailer = item.videos?.find((v) => v.type === "Trailer" || v.type === "Teaser");
            const trailerKey = trailer?.key || null;

            return (
              <SwiperSlide key={item.id} className="category-slide">
                <li
                  className="category-item"
                  onMouseEnter={() => {
                    prefetchRoute(detailHref);
                    prefetchRoute(watchHref);
                    handleMouseEnter(item.id, item.fetchVideo);
                  }}
                  onMouseLeave={handleMouseLeave}
                  onFocus={() => prefetchRoute(detailHref)}
                  onClick={() => { if (isUnsubscribed) { openModal(); return; } router.push(detailHref); }}
                >
                  {/* 기본 포스터 */}
                  <div className="img-box">
                    <Image
                      className="poster-img"
                      src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 31vw, (max-width: 1024px) 28vw, 12vw"
                    />
                    {category === "netflix" && (
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

                  {/* 호버 팝업 카드 */}
                  {hover === item.id && (
                    <div className={`hover-card animate-fade-in${index === leftEdgeIndex ? ' left-edge' : index >= rightEdgeIndex ? ' right-edge' : ''}`}>
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
                          {certifications[`${category === "netflix" ? "tv" : category}-${item.id}`] && (
                            <span className="hover-age">{certifications[`${category === "netflix" ? "tv" : category}-${item.id}`]}</span>
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
                          {/* ########### 여기 처럼 수정하기  */}
                          {/* <button type="button" className="btn-play" onClick={(e) => e.stopPropagation()}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            재생하기
                          </button> */}

                          <Link className="btn-play" href={watchHref}
                            onPointerEnter={() => prefetchRoute(watchHref)}
                            onFocus={() => prefetchRoute(watchHref)}
                            onClick={(e) => { e.stopPropagation(); if (isUnsubscribed) { e.preventDefault(); openModal(); } }}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            재생하기
                          </Link>
                          <Link href={detailHref}
                            className="btn-detail"
                            onPointerEnter={() => prefetchRoute(detailHref)}
                            onFocus={() => prefetchRoute(detailHref)}
                            onClick={(e) => { if (isUnsubscribed) { e.preventDefault(); openModal(); } }}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            {t("common.detail")}
                          </Link>
                          <WishlistButton item={item} mediaType={(category === "netflix" ? "tv" : category) as "movie" | "tv"} stopPropagation className="card-wish" />
                          <ShareButton mediaType={(category === "netflix" ? "tv" : category) as "movie" | "tv"} id={item.id} stopPropagation className="card-wish" />
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
