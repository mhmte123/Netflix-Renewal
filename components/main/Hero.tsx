"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import WishlistButton from "@/components/common/WishlistButton";
import ShareButton from "@/components/common/ShareButton";
import { useT, getTmdbLang } from "@/lib/i18n";
import { useLangStore } from "@/store/useLangStore";
import { filterByExcludedGenres, useExcludedGenres } from "@/data/excludedGenres";
import { ratingCeiling, certToLevel, genreLevel } from "@/data/maturityFilter";
import { useMovieStore } from "@/store/useMovieStore";
import { isHidden } from "@/data/hiddenContent";
import "./scss/hero.scss";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";
import Link from "next/link";
import { formatFivePointRating } from "@/lib/rating";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/";

type MediaType = "movie" | "tv";

type HeroItem = {
  id: number;
  media_type?: MediaType;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  logoUrl: string;
  videoKey: string;
};

type TrendingResponse = {
  results?: HeroItem[];
};

type VideoItem = {
  key: string;
  site: string;
  type: string;
  official?: boolean;
};

type VideosResponse = {
  results?: VideoItem[];
};

type LogoItem = {
  file_path: string;
  iso_639_1: string | null;
};

type ImagesResponse = {
  logos?: LogoItem[];
};

type ReleaseDateEntry = {
  certification: string;
  type: number;
};

type ReleaseDateResult = {
  iso_3166_1: string;
  release_dates: ReleaseDateEntry[];
};

type ReleaseDatesResponse = {
  results?: ReleaseDateResult[];
};

type ContentRatingResult = {
  iso_3166_1: string;
  rating: string;
};

type ContentRatingsResponse = {
  results?: ContentRatingResult[];
};

type LoadState = "loading" | "ready" | "error";

const genreMap: Record<number, string> = {
  12: "모험",
  14: "판타지",
  16: "애니메이션",
  18: "드라마",
  27: "공포",
  28: "액션",
  35: "코미디",
  36: "역사",
  53: "스릴러",
  80: "범죄",
  878: "SF",
  9648: "미스터리",
  10402: "음악",
  10749: "로맨스",
  10751: "가족",
  10752: "전쟁",
  10759: "액션&어드벤처",
  10765: "SF&판타지",
  10768: "전쟁&정치",
};

const genreMapEn: Record<number, string> = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  53: "Thriller",
  80: "Crime",
  878: "Science Fiction",
  9648: "Mystery",
  10402: "Music",
  10749: "Romance",
  10751: "Family",
  10752: "War",
  10759: "Action & Adventure",
  10765: "Sci-Fi & Fantasy",
  10768: "War & Politics",
};

function posterUrl(path: string | null, size = "w780") {
  return path ? `${IMG_BASE}${size}${path}` : "";
}

function backdropUrl(path: string | null, size = "original") {
  return path ? `${IMG_BASE}${size}${path}` : "";
}

function getTitle(item: HeroItem) {
  return item.title || item.name || "Untitled";
}

function getYear(item: HeroItem) {
  return (item.release_date || item.first_air_date || "").slice(0, 4);
}

function isExcludedHeroItem(item: HeroItem) {
  const titles = [item.title, item.name, item.original_title, item.original_name]
    .filter((title): title is string => Boolean(title))
    .map((title) => title.trim().toLowerCase());

  return getYear(item) === "2026" && titles.some((title) => title === "hope" || title === "호프");
}

function getGenres(item: HeroItem, lang: "ko" | "en" = "ko") {
  const map = lang === "en" ? genreMapEn : genreMap;
  return item.genre_ids
    ?.slice(0, 2)
    .map((id) => map[id])
    .filter(Boolean)
    .join(" • ");
}

function getStars(rating: number) {
  const count = Math.round(rating / 2);
  return "★".repeat(count) + "☆".repeat(5 - count);
}

// 케이팝 데몬 헌터스 고정 항목 (TMDB movie/803796)
const PINNED_ITEMS: { id: number; mediaType: MediaType }[] = [
  { id: 803796, mediaType: "movie" },
];

async function fetchItemById(id: number, mediaType: MediaType): Promise<HeroItem | null> {
  if (!TMDB_KEY) return null;

  const params = new URLSearchParams({ api_key: TMDB_KEY, language: getTmdbLang() });
  const res = await fetch(`${TMDB_BASE}/${mediaType}/${id}?${params.toString()}`);
  if (!res.ok) return null;

  const data = (await res.json()) as HeroItem;
  if (!data.backdrop_path || !data.poster_path || !data.overview) return null;

  return { ...data, media_type: mediaType, genre_ids: data.genre_ids ?? [], logoUrl: "", videoKey: "" };
}

async function fetchHeroItems() {
  if (!TMDB_KEY) {
    throw new Error("TMDB API key is missing.");
  }

  const commonParams = {
    api_key: TMDB_KEY,
    language: getTmdbLang(),
    with_original_language: "ko",
    sort_by: "popularity.desc",
    page: "1",
  };

  const movieParams = new URLSearchParams({
    ...commonParams,
    "primary_release_date.gte": "2026-01-01",
  });

  const tvParams = new URLSearchParams({
    ...commonParams,
    "first_air_date.gte": "2026-01-01",
  });

  const [movieRes, tvRes, ...pinnedResults] = await Promise.all([
    fetch(`${TMDB_BASE}/discover/movie?${movieParams.toString()}`),
    fetch(`${TMDB_BASE}/discover/tv?${tvParams.toString()}`),
    ...PINNED_ITEMS.map(({ id, mediaType }) => fetchItemById(id, mediaType)),
  ]);

  if (!movieRes.ok || !tvRes.ok) {
    throw new Error("Failed to fetch TMDB data.");
  }

  const [movieData, tvData] = await Promise.all([
    movieRes.json() as Promise<TrendingResponse>,
    tvRes.json() as Promise<TrendingResponse>,
  ]);

  const blockedIds = new Set([297640]);

  const validItem = (item: HeroItem) =>
    !blockedIds.has(item.id) &&
    !isExcludedHeroItem(item) &&
    !isHidden(item.id, item.media_type) &&
    item.overview &&
    item.backdrop_path &&
    item.poster_path;

  const movies = (movieData.results ?? [])
    .filter(validItem)
    .slice(0, 5)
    .map((item) => ({ ...item, media_type: "movie" as MediaType, logoUrl: "" }));

  const tvs = (tvData.results ?? [])
    .filter(validItem)
    .slice(0, 5)
    .map((item) => ({ ...item, media_type: "tv" as MediaType, logoUrl: "" }));

  const combined: HeroItem[] = [];
  for (let i = 0; i < Math.max(movies.length, tvs.length); i++) {
    if (movies[i]) combined.push(movies[i]);
    if (tvs[i]) combined.push(tvs[i]);
  }

  // 고정 항목(케이팝 데몬 헌터스 등)을 히어로 첫 번째 후보로 추가 (중복 제거)
  const pinnedIds = new Set<number>();
  const pinned: HeroItem[] = [];
  for (const item of pinnedResults) {
    if (item && validItem(item)) {
      pinned.push({ ...item, logoUrl: "" });
      pinnedIds.add(item.id);
    }
  }

  const rest = combined.filter((item) => !pinnedIds.has(item.id));
  const candidates = [...pinned, ...rest].slice(0, 8);

  const [logos, videos] = await Promise.all([
    Promise.all(candidates.map(fetchHeroLogo)),
    Promise.all(candidates.map(fetchHeroVideo)),
  ]);

  return candidates
    .map((item, i) => ({ ...item, logoUrl: logos[i], videoKey: videos[i] }))
    .filter((item) => item.logoUrl !== "" && item.videoKey !== "");
}

async function fetchHeroVideo(item: HeroItem) {
  if (!TMDB_KEY || !item.media_type) return "";
  const apiKey = TMDB_KEY;

  async function requestVideo(language: string) {
    const params = new URLSearchParams({ api_key: apiKey, language });

    const res = await fetch(
      `${TMDB_BASE}/${item.media_type}/${item.id}/videos?${params.toString()}`,
    );

    if (!res.ok) return "";

    const data = (await res.json()) as VideosResponse;
    const video = data.results?.find(
      (result) =>
        result.site === "YouTube" &&
        (result.type === "Trailer" || result.type === "Teaser"),
    );

    return video?.key ?? "";
  }

  return (await requestVideo("ko-KR")) || (await requestVideo("en-US"));
}

async function fetchHeroCertification(item: HeroItem): Promise<string> {
  if (!TMDB_KEY || !item.media_type) return "";

  const params = new URLSearchParams({ api_key: TMDB_KEY });

  if (item.media_type === "movie") {
    const res = await fetch(
      `${TMDB_BASE}/movie/${item.id}/release_dates?${params.toString()}`,
    );
    if (!res.ok) return "";

    const data = (await res.json()) as ReleaseDatesResponse;
    const kr = data.results?.find((r) => r.iso_3166_1 === "KR");
    const cert = kr?.release_dates?.find((d) => d.certification)?.certification ?? "";
    return cert ? `${cert}+` : "";
  } else {
    const res = await fetch(
      `${TMDB_BASE}/tv/${item.id}/content_ratings?${params.toString()}`,
    );
    if (!res.ok) return "";

    const data = (await res.json()) as ContentRatingsResponse;
    const kr = data.results?.find((r) => r.iso_3166_1 === "KR");
    const rating = kr?.rating ?? "";
    return rating ? `${rating}+` : "";
  }
}

async function fetchHeroLogo(item: HeroItem): Promise<string> {
  if (!TMDB_KEY || !item.media_type) return "";

  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    include_image_language: "ko,en,null",
  });

  const res = await fetch(
    `${TMDB_BASE}/${item.media_type}/${item.id}/images?${params.toString()}`,
  );

  if (!res.ok) return "";

  const data = (await res.json()) as ImagesResponse;
  const logos = data.logos ?? [];

  const preferred = useLangStore.getState().lang === "en" ? "en" : "ko";
  const secondary = preferred === "en" ? "ko" : "en";
  const logo =
    logos.find((l) => l.iso_639_1 === preferred) ??
    logos.find((l) => l.iso_639_1 === secondary) ??
    logos.find((l) => l.iso_639_1 === null) ??
    logos[0];

  return logo ? `${IMG_BASE}original${logo.file_path}` : "";
}

export default function Hero() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const prefetchRoute = useRoutePrefetch();
  const router = useRouter();
  const { currentProfile } = useAuthStore();
  const excludedGenres = useExcludedGenres();
  const autoplayPreview = currentProfile?.settings?.playback?.autoplayPreview ?? true;
  const [items, setItems] = useState<HeroItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");
  const prevIndexRef = useRef(0);
  const [activeCertification, setActiveCertification] = useState("");
  const [activeVideoKey, setActiveVideoKey] = useState("");
  const [currentVideoKey, setCurrentVideoKey] = useState("");
  const [previousVideoKey, setPreviousVideoKey] = useState("");
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const currentVideoKeyRef = useRef("");
  const itemsRef = useRef<HeroItem[]>([]);
  const heroIframeRef = useRef<HTMLIFrameElement | null>(null);
  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);

  // YT iframe API 핸드셰이크: 이걸 보내야 iframe이 상태 이벤트(postMessage)를 보내줌
  const subscribeHeroIframe = () => {
    const win = heroIframeRef.current?.contentWindow;
    if (!win) return;
    const target = "https://www.youtube.com";
    win.postMessage(
      JSON.stringify({ event: "listening", id: "hero-video", channel: "widget" }),
      target,
    );
    win.postMessage(
      JSON.stringify({
        event: "command",
        func: "addEventListener",
        args: ["onStateChange"],
        id: "hero-video",
        channel: "widget",
      }),
      target,
    );
  };
  // 모바일(≤600px) 여부: 자동 전환은 모바일에서만 동작
  const [isCompactHero, setIsCompactHero] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const mouseStartX = useRef<number | null>(null);
  const mouseStartY = useRef<number | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    let ignore = false;

    async function loadHero() {
      try {
        setLoadState("loading");
        const fetched = await fetchHeroItems();

        if (ignore) return;

        // 제외 장르 작품은 히어로 후보에서 제거
        const nextItemsRaw = filterByExcludedGenres(fetched, excludedGenres);

        // 관람등급 필터: 허용 등급 초과 작품은 히어로 후보에서 제외
        let nextItems = nextItemsRaw;
        const ceiling = ratingCeiling(currentProfile?.settings?.maturityRating);
        if (ceiling < 19 && nextItems.length) {
          const fetchCert = useMovieStore.getState().onFetchCertification;
          await Promise.all(
            nextItems.map((it) => (it.media_type ? fetchCert(it.id, it.media_type) : Promise.resolve())),
          );
          if (ignore) return;
          const certs = useMovieStore.getState().certifications;
          const allowed = nextItems.filter((it) => {
            let level = certToLevel(certs[`${it.media_type}-${it.id}`]);
            if (level < 0) {
              const gl = genreLevel((it as { genre_ids?: number[] }).genre_ids);
              level = gl < 0 ? 0 : gl;
            }
            return level <= ceiling;
          });
          // 등급 필터로 후보가 모두 사라지면(히어로가 비는 것 방지)
          // 명시적 등급 초과만 제외하고, 그래도 비면 원본을 사용
          if (allowed.length) {
            nextItems = allowed;
          } else {
            const certOnly = nextItems.filter((it) => {
              const level = certToLevel(certs[`${it.media_type}-${it.id}`]);
              return level < 0 || level <= ceiling;
            });
            nextItems = certOnly.length ? certOnly : nextItems;
          }
        }

        const randomIndex = Math.floor(Math.random() * nextItems.length);
        setItems(nextItems);
        setActiveIndex(nextItems.length ? randomIndex : 0);
        setLoadState(nextItems.length ? "ready" : "error");
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setItems([]);
          setLoadState("error");
        }
      }
    }

    loadHero();

    return () => {
      ignore = true;
    };
  }, [lang, excludedGenres, currentProfile?.settings?.maturityRating]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 같은 영상에서 중복 전환 방지 (끝나기 0.5초 전 선전환용)
  const advancedKeyRef = useRef("");

  useEffect(() => {
    let playbackTimer: number | null = null;

    function removeCurrentVideo() {
      const failedKey = currentVideoKeyRef.current;
      if (!failedKey) return;
      const next = itemsRef.current.filter((item) => item.videoKey !== failedKey);
      setItems(next);
      setActiveIndex((prev) => Math.min(prev, Math.max(0, next.length - 1)));
    }

    function resetPlaybackTimer() {
      if (playbackTimer) window.clearTimeout(playbackTimer);
      playbackTimer = window.setTimeout(removeCurrentVideo, 8000);
    }

    function handleYouTubeMessage(event: MessageEvent) {
      if (event.origin !== "https://www.youtube.com") return;

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data.event === "onError" && [100, 101, 150].includes(data.info)) {
          if (playbackTimer) window.clearTimeout(playbackTimer);
          removeCurrentVideo();
          return;
        }

        const advanceToNext = () => {
          // 같은 영상에서 한 번만 전환
          if (advancedKeyRef.current === currentVideoKeyRef.current) return;
          advancedKeyRef.current = currentVideoKeyRef.current;
          if (playbackTimer) window.clearTimeout(playbackTimer);
          playbackTimer = null;
          const total = itemsRef.current.length;
          if (total > 1) {
            setActiveIndex((prev) => (prev + 1) % total);
          }
        };

        const handlePlayerState = (state: number) => {
          if (state === 1) {
            // playing — video is fine, cancel the timer
            if (playbackTimer) window.clearTimeout(playbackTimer);
            playbackTimer = null;
          } else if (state === -1 || state === 3) {
            // unstarted or buffering — (re)start the watchdog
            resetPlaybackTimer();
          } else if (state === 0) {
            // ended — 다음 히어로로 전환 (선전환 실패 시 폴백)
            advanceToNext();
          }
        };

        if (data.event === "onStateChange") {
          handlePlayerState(data.info);
        } else if (data.event === "infoDelivery" && data.info) {
          if (typeof data.info.playerState === "number") {
            handlePlayerState(data.info.playerState);
          }
          // 끝나기 1초 전에 미리 전환 → '다시보기' UI 노출 방지
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
    }

    window.addEventListener("message", handleYouTubeMessage);
    return () => {
      window.removeEventListener("message", handleYouTubeMessage);
      if (playbackTimer) window.clearTimeout(playbackTimer);
    };
  }, []);

  const activeItem = items[activeIndex];

  useEffect(() => {
    if (!activeItem) {
      setActiveCertification("");
      return;
    }

    let ignore = false;

    async function loadCertification() {
      const cert = await fetchHeroCertification(activeItem);
      if (!ignore) setActiveCertification(cert);
    }

    setActiveCertification("");
    loadCertification();

    return () => {
      ignore = true;
    };
  }, [activeItem]);

  useEffect(() => {
    if (!activeItem) {
      setActiveVideoKey("");
      setIsVideoVisible(false);
      return;
    }

    const videoKey = activeItem.videoKey;

    setIsVideoVisible(false);

    if (videoKey && videoKey === currentVideoKeyRef.current) {
      const timer = window.setTimeout(() => setIsVideoVisible(true), 120);
      return () => window.clearTimeout(timer);
    } else {
      setActiveVideoKey(videoKey);
    }
  }, [activeItem]);

  useEffect(() => {
    const currentKey = currentVideoKeyRef.current;

    if (!activeVideoKey) {
      if (currentKey) setPreviousVideoKey(currentKey);

      currentVideoKeyRef.current = "";
      setCurrentVideoKey("");
      setIsVideoVisible(false);

      const cleanupTimer = window.setTimeout(() => {
        setPreviousVideoKey("");
      }, 900);

      return () => window.clearTimeout(cleanupTimer);
    }

    if (currentKey === activeVideoKey) {
      setIsVideoVisible(true);
      return;
    }

    if (currentKey) setPreviousVideoKey(currentKey);

    currentVideoKeyRef.current = activeVideoKey;
    setCurrentVideoKey(activeVideoKey);
    setIsVideoVisible(false);

    // 유튜브 UI가 떠 있는 초반 구간 동안 이미지(포스터)를 먼저 노출
    const timer = window.setTimeout(() => {
      setIsVideoVisible(true);
    }, 5000);

    const cleanupTimer = window.setTimeout(() => {
      setPreviousVideoKey("");
    }, 4500);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(cleanupTimer);
    };
  }, [activeVideoKey]);

  const meta = useMemo(() => {
    if (!activeItem) return null;

    return {
      genres: getGenres(activeItem, lang),
      rating: activeItem.vote_average
        ? formatFivePointRating(activeItem.vote_average)
        : "0.0",
      stars: getStars(activeItem.vote_average || 0),
      year: getYear(activeItem),
    };
  }, [activeItem]);

  // 모바일 여부 감지 (SCSS mobile 브레이크포인트 600px 와 동일 기준)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const update = () => setIsCompactHero(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    // 자동 회전: 영상 미리보기가 꺼진 경우에만 (영상이 켜져 있으면 영상 종료가 전환을 담당)
    if (!isCompactHero || items.length < 2 || autoplayPreview) return;
    const timer = window.setInterval(() => {
      setSlideDirection("left");
      setActiveIndex((prev) => {
        const next = (prev + 1) % items.length;
        prevIndexRef.current = next;
        return next;
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isCompactHero, items.length, activeIndex, autoplayPreview]);



  const goToIndex = (index: number) => {
    const n = items.length;
    if (n < 2) { setActiveIndex(index); return; }
    const prev = prevIndexRef.current;
    const fwdDist = (index - prev + n) % n;
    const dir = fwdDist <= n / 2 ? "left" : "right";
    setSlideDirection(dir);
    prevIndexRef.current = index;
    setActiveIndex(index);
  };

  const selectHeroIndex = (index: number) => goToIndex(index);

  // 모바일 스와이프로 이전/다음 작품 전환 (세로 스크롤과 구분)
  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    const deltaY = event.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // 가로 이동이 48px 미만이거나 세로 이동이 더 크면 스크롤로 간주
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (items.length < 2) return;

    const next = deltaX < 0
      ? (activeIndex + 1) % items.length
      : (activeIndex - 1 + items.length) % items.length;
    setSlideDirection(deltaX < 0 ? "left" : "right");
    prevIndexRef.current = next;
    setActiveIndex(next);
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    mouseStartX.current = event.clientX;
    mouseStartY.current = event.clientY;
    isDragging.current = false;
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (mouseStartX.current === null) return;
    if (Math.abs(event.clientX - mouseStartX.current) > 4) {
      isDragging.current = true;
      event.preventDefault();
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (mouseStartX.current === null || mouseStartY.current === null) return;

    const deltaX = event.clientX - mouseStartX.current;
    const deltaY = event.clientY - mouseStartY.current;
    mouseStartX.current = null;
    mouseStartY.current = null;

    if (!isDragging.current) return;
    isDragging.current = false;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (items.length < 2) return;

    const next = deltaX < 0
      ? (activeIndex + 1) % items.length
      : (activeIndex - 1 + items.length) % items.length;
    setSlideDirection(deltaX < 0 ? "left" : "right");
    prevIndexRef.current = next;
    setActiveIndex(next);
  };

  const handleMouseLeave = () => {
    mouseStartX.current = null;
    mouseStartY.current = null;
    isDragging.current = false;
  };

  if (loadState === "loading") {
    return (
      <section className="hero hero-loading" aria-label="추천 콘텐츠 로딩 중">
        <div className="hero-backdrop no-img" />
        <div className="hero-content">
          <div className="hero-skeleton hero-badge-skeleton" />
          <div className="hero-skeleton hero-title-skeleton" />
          <div className="hero-skeleton hero-meta-skeleton" />
          <div className="hero-skeleton hero-desc-skeleton" />
        </div>
      </section>
    );
  }

  if (loadState === "error" || !activeItem || !meta) {
    return (
      <section className="hero hero-empty" aria-label="추천 콘텐츠 오류">
        <div className="hero-backdrop no-img" />
        <div className="hero-content">
          <div className="hero-badge">TMDB</div>
          <h2 className="hero-logo-text">콘텐츠를 불러오지 못했습니다</h2>
          <p className="hero-desc">
            NEXT_PUBLIC_TMDB_API_KEY 값과 네트워크 연결을 확인해주세요.
          </p>
        </div>
      </section>
    );
  }

  const activeBackdrop = backdropUrl(activeItem.backdrop_path);
  const activeMediaType = activeItem.media_type ?? "movie";
  // 모바일/태블릿에서도 미리보기 영상 재생
  const hasPreviewVideo = autoplayPreview && (previousVideoKey || currentVideoKey);
  const origin = window.location.origin;
  const getVideoSrc = (videoKey: string) =>
    // loop 제거: 영상이 끝나면 onStateChange(0) 이벤트로 다음 히어로로 전환
    `https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&cc_load_policy=1&cc_lang_pref=ko&origin=${encodeURIComponent(origin)}`;
  const visiblePosters = [-2, -1, 0, 1, 2]
    .map((offset) => {
      const index = (activeIndex + offset + items.length) % items.length;
      return { item: items[index], index, offset };
    })
    .filter(
      (poster, position, posters) =>
        posters.findIndex(
          (currentPoster) => currentPoster.index === poster.index,
        ) === position,
    );

  return (
    <section
      className="hero"
      aria-label="추천 콘텐츠"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div
        key={`backdrop-${activeIndex}`}
        className={`hero-backdrop${hasPreviewVideo ? "" : " visible"} hero-slide-${slideDirection}`}
        style={{ backgroundImage: `url(${activeBackdrop})` }}
      />
      {isCompactHero && (
        <button
          className="hero-mobile-tap"
          type="button"
          aria-label={`${getTitle(activeItem)} 상세 보기`}
          onClick={() => {
            if (isDragging.current) return;
            router.push(`/detail/${activeMediaType}/${activeItem.id}`);
          }}
        />
      )}
      <div
        className={`hero-video-poster${hasPreviewVideo && isVideoVisible ? "" : " visible"}`}
        style={{ backgroundImage: `url(${activeBackdrop})` }}
      />
      {hasPreviewVideo && (
        <>
          {previousVideoKey && (
            <iframe
              className="hero-video previous"
              src={getVideoSrc(previousVideoKey)}
              title={`${getTitle(activeItem)} previous trailer`}
              allow="autoplay; encrypted-media; picture-in-picture"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
            />
          )}
          {currentVideoKey && (
            <iframe
              ref={heroIframeRef}
              onLoad={subscribeHeroIframe}
              className={`hero-video${isVideoVisible ? " visible" : ""}`}
              src={getVideoSrc(currentVideoKey)}
              title={`${getTitle(activeItem)} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
            />
          )}
          <div className="hero-video-shield" aria-hidden="true" />
        </>
      )}

      <div className="hero-posters" aria-label="히어로 콘텐츠 목록">
        {visiblePosters.map(({ item, index, offset }) => {
          const title = getTitle(item);
          const image = posterUrl(item.poster_path);
          const offsetClass =
            offset === 0
              ? "active"
              : offset < 0
                ? `before-${Math.abs(offset)}`
                : `after-${offset}`;

          return (
            <button
              className={`hero-poster ${offsetClass}`}
              key={`${item.media_type}-${item.id}`}
              onClick={() => selectHeroIndex(index)}
              type="button"
            >
              <img src={image} alt={title} loading="lazy" />
            </button>
          );
        })}
      </div>


      <div key={`content-${activeIndex}`} className="hero-content hero-content-enter">
        <img
          className="hero-logo-img"
          src={activeItem.logoUrl}
          alt={getTitle(activeItem)}
          onError={() => {
            const next = items.filter((item) => item.id !== activeItem.id);
            setItems(next);
            setActiveIndex((prev) => Math.min(prev, Math.max(0, next.length - 1)));
          }}
        />
        <div className="hero-meta">
          <span className="hero-meta-row">
            <span className="hero-rating-stars">{meta.stars}</span>
            <span className="hero-rating-val">{meta.rating}</span>
            {meta.year && (
              <>
                <span className="hero-meta-sep">|</span>
                <span>{meta.year}</span>
              </>
            )}
            {(meta.genres || activeCertification) && (
              <span className="hero-meta-sep">|</span>
            )}
          </span>
          {(meta.genres || activeCertification) && (
            <span className="hero-meta-row">
              {meta.genres && <span>{meta.genres}</span>}
              {activeCertification && (
                <span className="hero-age-badge">{activeCertification}</span>
              )}
            </span>
          )}
        </div>
        <p className="hero-desc">{activeItem.overview}</p>
        {!isCompactHero && (
          <div className="hero-btns">
            <Link
              href = {`/watch/${activeMediaType}/${activeItem.id}`}
              className="btn-play"
              // onClick={() => router.push(`/watch/${activeMediaType}/${activeItem.id}`)}
              onPointerEnter={() => prefetchRoute(`/watch/${activeMediaType}/${activeItem.id}`)}
              onFocus={() => prefetchRoute(`/watch/${activeMediaType}/${activeItem.id}`)}
              onClick={(e) => { if (isUnsubscribed) { e.preventDefault(); openModal(); } }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {t("common.play")}
            </Link>
            <Link
              href = {`/detail/${activeMediaType}/${activeItem.id}`}
              className="btn-info"
              // onClick={() => router.push(`/detail/${activeMediaType}/${activeItem.id}`)}
              onPointerEnter={() => prefetchRoute(`/detail/${activeMediaType}/${activeItem.id}`)}
              onFocus={() => prefetchRoute(`/detail/${activeMediaType}/${activeItem.id}`)}
              onClick={(e) => { if (isUnsubscribed) { e.preventDefault(); openModal(); } }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              {t("common.detail")}
            </Link>
            <WishlistButton item={activeItem} mediaType={activeMediaType} className="hero-wish" />
            <ShareButton mediaType={activeMediaType} id={activeItem.id} className="hero-wish" />
          </div>
        )}
      </div>

      {items.length > 1 && (
        <div className="hero-dots" aria-label="히어로 콘텐츠 선택">
          {items.map((item, index) => (
            <button
              className={`hero-dot${index === activeIndex ? " active" : ""}`}
              key={`dot-${item.media_type}-${item.id}`}
              type="button"
              aria-label={`${index + 1}번째 콘텐츠 보기`}
              aria-current={index === activeIndex}
              onClick={() => selectHeroIndex(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
