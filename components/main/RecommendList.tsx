"use client";
import { useEffect, useMemo, useState } from 'react';
import { useT } from "@/lib/i18n";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMovieStore } from '@/store/useMovieStore';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import './scss/recommendList.scss';
import WishlistButton from "@/components/common/WishlistButton";
import ShareButton from "@/components/common/ShareButton";
import SectionTitle from '../common/SectionTitle';
import { filterByExcludedGenres, useExcludedGenres } from "@/data/excludedGenres";
import { filterByMaturity, useMaturityFilterSnapshot } from "@/data/maturityFilter";

import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { formatFivePointRating } from "@/lib/rating";

const GENRE_MAP: Record<number, string> = {
  28: '액션', 12: '모험', 16: '애니메이션', 35: '코미디', 80: '범죄',
  99: '다큐멘터리', 18: '드라마', 10751: '가족', 14: '판타지', 36: '역사',
  27: '공포', 10402: '음악', 9648: '미스터리', 10749: '로맨스', 878: 'SF',
  53: '스릴러', 10752: '전쟁', 37: '서부', 10759: '액션', 10765: 'SF·판타지',
  10762: '어린이', 10764: '리얼리티', 10766: '연속극',
};

function StarRating({ score }: { score: number }) {
  const filled = Math.round(score / 2);
  return (
    <span className="meta-stars">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < filled ? 'star filled' : 'star empty'}>★</span>
      ))}
    </span>
  );
}

export default function RecommendList() {
  const t = useT();
  const router = useRouter();
  const prefetchRoute = useRoutePrefetch();
  const { recommended: rawRecommended, onFetchRecommended, onFetchCertification } = useMovieStore();
  const excludedGenres = useExcludedGenres();
  const { ceiling: maturityCeiling, certifications } = useMaturityFilterSnapshot();

  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);

  // 제외 장르 작품 숨김 (인덱스 정합성을 위해 이후 로직은 모두 이 목록을 사용)
  const genreFiltered = useMemo(
    () => filterByExcludedGenres(rawRecommended, excludedGenres),
    [rawRecommended, excludedGenres],
  );
  // 관람등급 필터
  const recommended = useMemo(
    () =>
      filterByMaturity(
        genreFiltered,
        maturityCeiling,
        certifications,
        (it: { media_type: string; id: number }) => `${it.media_type}-${it.id}`,
      ),
    [genreFiltered, maturityCeiling, certifications],
  );

  // hover 전에도 등급 필터가 동작하도록 등급 미리 로드
  useEffect(() => {
    if (maturityCeiling >= 19) return;
    genreFiltered.forEach((it) => onFetchCertification(it.id, it.media_type));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreFiltered, maturityCeiling]);
  const [activeBackdrop, setActiveBackdrop] = useState<{ id: number; backdropPath: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    onFetchRecommended();
  }, []);

  useEffect(() => {
    if (recommended.length > 0 && !activeBackdrop) {
      const first = recommended[0];
      setActiveBackdrop({ id: first.id, backdropPath: first.backdrop_path });
      onFetchCertification(first.id, first.media_type);
    }
  }, [recommended]);

  useEffect(() => {
    const item = recommended[activeIndex];
    if (item) onFetchCertification(item.id, item.media_type);
  }, [activeIndex, recommended]);

  const handleSlideChange = (swiper: SwiperClass) => {
    const idx = swiper.realIndex;
    const item = recommended[idx];
    if (item) {
      setActiveBackdrop({ id: item.id, backdropPath: item.backdrop_path });
      setActiveIndex(idx);
    }
  };

  if (recommended.length === 0) return null;

  const sectionBg = activeBackdrop?.backdropPath
    ? `https://image.tmdb.org/t/p/original${activeBackdrop.backdropPath}`
    : '';



  return (
    <section className="recommend-section">
      {/* 배경 레이어: 활성 작품 백드롭 */}
      <div
        key={activeBackdrop?.id}
        className="recommend-bg"
        style={{
          backgroundImage: sectionBg ? `url(${sectionBg})` : 'none'
        }}
      />
      <div className="recommend-bg-overlay" />

      <div className="section-title-outer">
        <SectionTitle title='넷플릭스 추천작' href="/category" showMore={false} />
      </div>
      <Swiper
        modules={[Navigation, Autoplay]}
        grabCursor
        centeredSlides
        loop
        slidesPerView={isMobile ? 1.8 : 3}
        spaceBetween={isMobile ? 10 : 16}
        navigation
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        onSlideChange={handleSlideChange}
        className="recommend-swiper"
        breakpoints={{
          601:  { slidesPerView: 3, spaceBetween: 10, centeredSlides: true },
          1280: { slidesPerView: 3, spaceBetween: 4,  centeredSlides: true },
          1920: { slidesPerView: 3, spaceBetween: -3, centeredSlides: true },
          2560: { slidesPerView: 5, spaceBetween: 1,  centeredSlides: true },
        }}
      >
        {recommended.map((item) => {
          const detailHref = `/detail/${item.media_type}/${item.id}`;
          const watchHref = `/watch/${item.media_type}/${item.id}`;

          return (
          <SwiperSlide key={`${item.media_type}-${item.id}`}>
            <div
              className="recommend-slide"
              onPointerEnter={() => {
                prefetchRoute(detailHref);
                prefetchRoute(watchHref);
              }}
              onFocus={() => prefetchRoute(detailHref)}
              onClick={() => {
                // 모바일: 카드 탭 → 상세페이지 이동 (버튼이 숨겨져 있으므로)
                if (!isMobile) return;
                if (isUnsubscribed) {
                  openModal();
                  return;
                }
                router.push(detailHref);
              }}
              style={isMobile ? { cursor: 'pointer' } : undefined}
            >
              {/* 상단 - 포스터 영역 */}
              <div className="slide-poster">
                {item.backdrop_path && (
                  <img
                    src={`https://image.tmdb.org/t/p/w1280${item.backdrop_path}`}
                    alt={item.title}
                  />
                )}
                <span className="slide-platform">
                  {item.media_type === 'movie' ? 'MOVIE' : 'TV'}
                </span>
              </div>

              {/* 하단 - 정보 영역 */}
              <div className="slide-info">
                <div className="slide-title-row">
                  <h3 className="slide-title">{item.title}</h3>
                  {certifications[`${item.media_type}-${item.id}`] && (
                    <span className="meta-cert">
                      {certifications[`${item.media_type}-${item.id}`]}
                    </span>
                  )}
                </div>

                <div className="slide-meta">
                  <StarRating score={item.vote_average} />
                  <span className="meta-score">{formatFivePointRating(item.vote_average)}</span>
                  <span className="meta-sep">|</span>
                  {item.release_date && (
                    <span className="meta-year">{item.release_date.slice(0, 4)}</span>
                  )}
                  {(item.genre_ids ?? []).length > 0 && (
                    <>
                      <span className="meta-sep">|</span>
                      <span className="meta-genres">
                        {(item.genre_ids ?? []).slice(0, 2).map(id => GENRE_MAP[id]).filter(Boolean).join('·')}
                      </span>
                    </>
                  )}
                </div>

                <p className="slide-overview">
                  {item.overview || '소개 정보가 없습니다.'}
                </p>

                <div className="slide-actions">
                  <Link
                    href={watchHref}
                    className="btn-play"
                    onPointerEnter={() => prefetchRoute(watchHref)}
                    onFocus={() => prefetchRoute(watchHref)}
                    onClick={(e) => { if (isUnsubscribed) { e.preventDefault(); openModal(); } }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15" fill="#fff">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {t("common.play")}
                  </Link>
                  <Link
                    href={detailHref}
                    className="btn-info"
                    onPointerEnter={() => prefetchRoute(detailHref)}
                    onFocus={() => prefetchRoute(detailHref)}
                    onClick={(e) => { if (isUnsubscribed) { e.preventDefault(); openModal(); } }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    {t("common.detail")}
                  </Link>
                  <WishlistButton item={item} mediaType={item.media_type} className="card-wish" />
                  <ShareButton mediaType={item.media_type} id={item.id} className="card-wish" />
                </div>
              </div>
            </div>
          </SwiperSlide>
          );
        })}
      </Swiper>
    </section>
  );
}
