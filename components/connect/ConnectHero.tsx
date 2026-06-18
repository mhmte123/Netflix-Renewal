"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/navigation";
import "./scss/connectHero.scss";

import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";
import { useT } from "@/lib/i18n";
import { useLangStore, type Lang } from "@/store/useLangStore";
import { formatFivePointRating } from "@/lib/rating";
import WishlistButton from "@/components/common/WishlistButton";
import ShareButton from "@/components/common/ShareButton";

const KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const IMG = "https://image.tmdb.org/t/p";

const GENRE_MAP: Record<number, string> = {
  28: "액션", 12: "모험", 16: "애니메이션", 35: "코미디",
  80: "범죄", 99: "다큐", 18: "드라마", 10751: "가족",
  14: "판타지", 27: "공포", 9648: "미스터리", 10749: "로맨스",
  878: "SF", 53: "스릴러", 10759: "액션", 10765: "SF·판타지",
};

const GENRE_MAP_EN: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 27: "Horror", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 53: "Thriller", 10759: "Action", 10765: "Sci-Fi & Fantasy",
};

function withParticle(title: string) {
  const last = title.charCodeAt(title.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) {
    return (last - 0xac00) % 28 !== 0 ? `"${title}"과` : `"${title}"와`;
  }
  return `"${title}"와`;
}

type HeroItem = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  backdropPath: string;
  posterPath: string | null;
  logoPath: string | null;
  logoIsVector: boolean;
  genre: string;
  genreIds: number[];
  ageRating: string;
  rating: string;
  voteAverage: number;
  directorName: string;
  recTitle: string;
  videoKey: string | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchHeroItems(lang: Lang): Promise<HeroItem[]> {
  const NETFLIX_PROVIDER = 8;
  const EXCLUDED_TITLES = ["케이프 피어", "Cape Fear"];
  const tmdbLang = lang === "en" ? "en-US" : "ko-KR";
  const genreMap = lang === "en" ? GENRE_MAP_EN : GENRE_MAP;

  // 넷플릭스 제공 콘텐츠만 discover API로 직접 조회
  const [movieRes, tvRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${KEY}&language=${tmdbLang}&with_watch_providers=${NETFLIX_PROVIDER}&watch_region=KR&sort_by=popularity.desc`),
    fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${KEY}&language=${tmdbLang}&with_watch_providers=${NETFLIX_PROVIDER}&watch_region=KR&sort_by=popularity.desc`),
  ]);
  const [movieData, tvData] = await Promise.all([movieRes.json(), tvRes.json()]);

  const pool = [
    ...(movieData.results as any[]).map((r: any) => ({ ...r, media_type: "movie" })),
    ...(tvData.results as any[]).map((r: any) => ({ ...r, media_type: "tv" })),
  ].filter(
    (r: any) =>
      r.backdrop_path &&
      !EXCLUDED_TITLES.includes(r.title ?? r.name)
  );
  const candidates = shuffle(pool).slice(0, 12);

  const detailed = await Promise.all(
    candidates.map(async (item: any) => {
      const mt = item.media_type as "movie" | "tv";
      const certParam = mt === "movie" ? "release_dates" : "content_ratings";

      // 상세 정보 + 영상 병렬 fetch
      const [detailRes, videoRes] = await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/${mt}/${item.id}` +
          `?api_key=${KEY}&language=${tmdbLang}` +
          `&append_to_response=images,${certParam},credits` +
          `&include_image_language=ko,en,null`
        ),
        fetch(
          `https://api.themoviedb.org/3/${mt}/${item.id}/videos?api_key=${KEY}&language=en-US`
        ),
      ]);
      const [d, vd] = await Promise.all([detailRes.json(), videoRes.json()]);

      // 로고: 현재 언어 > 보조 언어 > 첫 번째
      const logos: any[] = d.images?.logos ?? [];
      const preferredLogoLang = lang === "en" ? "en" : "ko";
      const fallbackLogoLang = lang === "en" ? "ko" : "en";
      const logo =
        logos.find((l: any) => l.iso_639_1 === preferredLogoLang) ||
        logos.find((l: any) => l.iso_639_1 === fallbackLogoLang) ||
        logos[0] ||
        null;

      // 연령 등급
      let ageRating = lang === "en" ? "All" : "전체";
      if (mt === "movie") {
        const kr = d.release_dates?.results?.find((r: any) => r.iso_3166_1 === "KR");
        const cert = kr?.release_dates?.[0]?.certification;
        if (cert) ageRating = cert;
      } else {
        const kr = d.content_ratings?.results?.find((r: any) => r.iso_3166_1 === "KR");
        if (kr?.rating) ageRating = kr.rating;
      }

      // 감독 / 창작자
      let directorName = "";
      if (mt === "movie") {
        directorName = d.credits?.crew?.find((c: any) => c.job === "Director")?.name ?? "";
      } else {
        directorName =
          d.created_by?.[0]?.name ??
          d.credits?.crew?.find((c: any) => c.job === "Series Director")?.name ??
          "";
      }

      // 비디오 키: Trailer > Teaser > Clip > 기타
      const ytVideos = (vd.results ?? []).filter((v: any) => v.site === "YouTube");
      const video =
        ytVideos.find((v: any) => v.type === "Trailer") ||
        ytVideos.find((v: any) => v.type === "Teaser") ||
        ytVideos.find((v: any) => v.type === "Clip") ||
        ytVideos[0] ||
        null;

      return {
        id: item.id,
        mediaType: mt,
        title: (d.title ?? d.name ?? item.title ?? item.name) as string,
        backdropPath: item.backdrop_path as string,
        posterPath: (d.poster_path ?? item.poster_path ?? null) as string | null,
        logoPath: logo?.file_path ?? null,
        logoIsVector: logo?.file_type === ".svg",
        genre: genreMap[item.genre_ids?.[0]] ?? (lang === "en" ? "Drama" : "드라마"),
        genreIds:
          item.genre_ids ??
          (d.genres ?? []).map((genre: { id: number }) => genre.id),
        ageRating,
        rating: formatFivePointRating(item.vote_average),
        voteAverage: item.vote_average ?? d.vote_average ?? 0,
        directorName,
        recTitle: "",
        videoKey: video?.key ?? null,
      };
    })
  );

  // 로고 있는 작품 우선, 각 그룹 내에서도 셔플 유지
  const withLogo = detailed.filter((d) => d.logoPath);
  const withoutLogo = detailed.filter((d) => !d.logoPath);
  const picked = [...withLogo, ...withoutLogo].slice(0, 4);

  return picked.map((item, i) => ({
    ...item,
    recTitle: picked[(i + 1) % picked.length].title,
  }));
}

export default function ConnectHero() {
  const t = useT();
  const lang = useLangStore((state) => state.lang);
  const router = useRouter();

  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);

  const swiperRef = useRef<SwiperType | null>(null);
  const [items, setItems] = useState<HeroItem[]>([]);
  const [realIndex, setRealIndex] = useState(0);      // 실제 콘텐츠 인덱스 (0~TOTAL-1)
  const [swiperIdx, setSwiperIdx] = useState(0);      // Swiper 절대 인덱스 (loopItems 기준)
  const [showVideo, setShowVideo] = useState(false);
  const [failedLogos, setFailedLogos] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 영상 종료 1초 전 다음 슬라이드 전환용
  const videoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentVideoKeyRef = useRef("");
  const advancedKeyRef = useRef("");

  // YT iframe API 핸드셰이크: 이걸 보내야 iframe이 상태/시간 이벤트를 보내줌
  const subscribeVideoIframe = () => {
    const win = videoIframeRef.current?.contentWindow;
    if (!win) return;
    const target = "https://www.youtube.com";
    win.postMessage(
      JSON.stringify({ event: "listening", id: "connect-hero-video", channel: "widget" }),
      target,
    );
    win.postMessage(
      JSON.stringify({
        event: "command",
        func: "addEventListener",
        args: ["onStateChange"],
        id: "connect-hero-video",
        channel: "widget",
      }),
      target,
    );
  };

  // 유튜브 메시지 수신 → 끝나기 1초 전(또는 종료 시) 다음 슬라이드로
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        const advanceToNext = () => {
          const key = currentVideoKeyRef.current;
          if (!key || advancedKeyRef.current === key) return;
          advancedKeyRef.current = key;
          swiperRef.current?.slideNext();
        };

        if (data.event === "onStateChange" && data.info === 0) {
          advanceToNext();
        } else if (data.event === "infoDelivery" && data.info) {
          if (data.info.playerState === 0) advanceToNext();
          const { currentTime, duration } = data.info;
          if (
            typeof currentTime === "number" &&
            typeof duration === "number" &&
            duration > 0 &&
            duration - currentTime <= 1
          ) {
            advanceToNext();
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // 모바일 뷰 감지 (히어로 탭 → 상세페이지 이동용)
  const [isMobileView, setIsMobileView] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth <= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setItems([]);
    setFailedLogos(new Set());
    fetchHeroItems(lang).then(setItems).catch(console.error);
  }, [lang]);

  // 슬라이드 변경 시 영상 리셋 → 2초 후 재생
  useEffect(() => {
    setShowVideo(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    const item = items[realIndex];
    currentVideoKeyRef.current = item?.videoKey ?? "";
    advancedKeyRef.current = ""; // 슬라이드가 바뀌면 전환 가드 리셋
    if (item?.videoKey) {
      timerRef.current = setTimeout(() => setShowVideo(true), 2000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [realIndex, items]);

  const TOTAL = items.length;
  const isLoading = TOTAL === 0;

  // ─────────────────────────────────────────────────────────
  // Swiper 내장 loop 대신 아이템 3배 복제로 직접 무한 루프 구현
  // → initialSlide를 중간 셋 시작점으로 명시 → 타이밍 무관하게 항상 1번 슬라이드 시작
  // ─────────────────────────────────────────────────────────
  const loopItems = isLoading ? [] : [...items, ...items, ...items];
  const LOOP_CENTER = TOTAL;                          // 중간 셋의 첫 번째 슬라이드 인덱스



  return (
    <section className={`connect-hero${isLoading ? " connect-hero--loading" : ""}`} aria-label="커넥트 컬렉션">
      {/* 배경 블러: 로딩 중에도 항상 렌더링 → GPU compositing 레이어 유지 → fixed 요소 깜빡임 방지 */}
      <div className="connect-hero__bg-layer">
        {/* 플레이스홀더: filter:blur GPU 레이어를 초기 렌더부터 확보 */}
        <div className="connect-hero__section-bg" style={{ opacity: 0 }} />
        {items.map((item, i) => (
          <div
            key={item.id}
            className="connect-hero__section-bg"
            style={{
              backgroundImage: `url(${IMG}/w1280${item.backdropPath})`,
              opacity: i === realIndex ? 1 : 0,
            }}
          />
        ))}
      </div>

      {!isLoading && <Swiper
        className="connect-hero__swiper"
        centeredSlides
        slidesPerView="auto"
        spaceBetween={14}
        initialSlide={LOOP_CENTER}   // 중간 셋 첫 슬라이드 → 타이밍과 무관하게 항상 1번 시작
        speed={520}
        modules={[Navigation]}
        navigation
        onSwiper={(s) => {
          swiperRef.current = s;
          setSwiperIdx(s.activeIndex); // Swiper 마운트 시 초기 인덱스 동기화
        }}
        onSlideChange={(s) => {
          const ai = s.activeIndex;
          setSwiperIdx(ai);
          setRealIndex(ai % TOTAL);  // 실제 콘텐츠 인덱스 (0~TOTAL-1)
        }}
        onTransitionEnd={(s) => {
          // 첫 번째 셋(0~TOTAL-1) 또는 세 번째 셋(TOTAL*2~)에 도달하면
          // 중간 셋의 동일 위치로 조용히 점프 → 무한 루프 효과
          const ai = s.activeIndex;
          if (ai < TOTAL) {
            s.slideTo(ai + TOTAL, 0, false);
          } else if (ai >= TOTAL * 2) {
            s.slideTo(ai - TOTAL, 0, false);
          }
        }}
      >
        {loopItems.map((item, i) => (
          <SwiperSlide
            key={`loop-${i}`}
            className="connect-hero__slide"
            onClick={() => {
              // 비활성(옆) 슬라이드 탭 → 해당 슬라이드로 이동
              if (i !== swiperIdx) {
                swiperRef.current?.slideTo(i);
                return;
              }
              // 모바일: 활성 슬라이드 탭 → 상세페이지 이동
              if (isMobileView) {
                if (isUnsubscribed) {
                  openModal();
                  return;
                }
                router.push(`/detail/${item.mediaType}/${item.id}`);
              }
            }}
          >
            <div
              className="connect-hero__bg"
              style={{ backgroundImage: `url(${IMG}/original${item.backdropPath})` }}
            />

            {/* 현재 활성 슬라이드에만 영상 마운트 (2초 후 fade-in) */}
            {i === swiperIdx && showVideo && item.videoKey && (
              <div className="connect-hero__video">
                <iframe
                  ref={videoIframeRef}
                  onLoad={subscribeVideoIframe}
                  src={
                    `https://www.youtube.com/embed/${item.videoKey}` +
                    `?autoplay=1&mute=1&controls=0` +
                    `&modestbranding=1&showinfo=0&rel=0&playsinline=1` +
                    `&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
                  }
                  allow="autoplay; encrypted-media"
                  title={item.title}
                />
              </div>
            )}

            <div className="connect-hero__dim" />
            <div className="connect-hero__gradient" />

            <div className="connect-hero__badge">
              <span className="connect-hero__badge-heart">♥</span>
              {lang === "en" ? "Recommended for You" : "취향 맞춤작"}
            </div>

            <div className="connect-hero__content">
              {item.logoPath && !failedLogos.has(item.id) ? (
                <div className="connect-hero__logo">
                  <img
                    src={`${IMG}/${item.logoIsVector ? "original" : "w300"}${item.logoPath}`}
                    alt={item.title}
                    onError={() =>
                      setFailedLogos((prev) => new Set(prev).add(item.id))
                    }
                  />
                </div>
              ) : (
                <h2 className="connect-hero__title">{item.title}</h2>
              )}

              <p className="connect-hero__rec-reason">
                {lang === "en"
                  ? `Viewers of "${item.recTitle}" also watched this`
                  : `${withParticle(item.recTitle)} 함께 감상된 콘텐츠`}
              </p>
              {item.directorName && (
                <p className="connect-hero__rec-director">
                  {lang === "en"
                    ? `From director ${item.directorName}, picked for you`
                    : `당신이 좋아할 [${item.directorName}] 감독`}
                </p>
              )}
              <p className="connect-hero__meta">
                {lang === "en" ? "Average" : "평균"} {item.rating}
                <span className="connect-hero__dot">•</span>
                {item.genre}
                <span className="connect-hero__dot">•</span>
                {item.ageRating}
              </p>
              <div className="connect-hero__btns">
                <button
                  className="connect-hero__btn-play"
                  type="button"
                  onClick={() => { if (isUnsubscribed) { openModal(); return; } router.push(`/watch/${item.mediaType}/${item.id}`); }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {t("common.play")}
                </button>
                <button
                  className="connect-hero__btn-info"
                  type="button"
                  onClick={() => { if (isUnsubscribed) { openModal(); return; } router.push(`/detail/${item.mediaType}/${item.id}`); }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  {t("common.detail")}
                </button>
                <WishlistButton
                  item={{
                    id: item.id,
                    title: item.mediaType === "movie" ? item.title : undefined,
                    name: item.mediaType === "tv" ? item.title : undefined,
                    poster_path: item.posterPath,
                    backdrop_path: item.backdropPath,
                    vote_average: item.voteAverage,
                    genre_ids: item.genreIds,
                    media_type: item.mediaType,
                  }}
                  mediaType={item.mediaType}
                  className="hero-wish"
                  stopPropagation
                />
                <ShareButton
                  mediaType={item.mediaType}
                  id={item.id}
                  className="hero-wish"
                  stopPropagation
                />
              </div>
            </div>

            {/* 카운터: 루프 인덱스를 실제 번호로 변환 (i % TOTAL + 1) */}
            <div className="connect-hero__counter">
              {(i % TOTAL) + 1} <span>|</span> {TOTAL}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>}
    </section>
  );
}
