"use client";
import { useT } from "@/lib/i18n";
import { getTmdbLang } from "@/lib/i18n";
import type { ThemeItem } from "@/components/main/ThemeRow";
import { getNetflixOriginalIdSet } from "@/lib/netflix";
import ThemeRowSkeleton from "@/components/main/ThemeRowSkeleton";
import type { RankingItem } from "@/components/main/RankingSection";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import Hero from "@/components/main/Hero";
import MoodBanner from "@/components/main/MoodBanner";
import GameBanner from "@/components/main/GameBanner";
import { GENRE_SLUG_META, useFavoriteGenres } from "@/data/excludedGenres";
import TopButton from "@/components/common/TopButton";
import LazyRender from "@/components/common/LazyRender";
import dynamic from "next/dynamic";

const ThemeRow = dynamic(() => import("@/components/main/ThemeRow"), {
  ssr: false,
});
const RankingSection = dynamic(() => import("@/components/main/RankingSection"), {
  ssr: false,
});
const CategoryList = dynamic(() => import("@/components/main/CategoryList"), {
  ssr: false,
});
const WatchingList = dynamic(() => import("@/components/main/WatchingList"), { ssr: false });
const RecommendList = dynamic(() => import("@/components/main/RecommendList"), { ssr: false });
const SplitBanner = dynamic(() => import("@/components/main/SplitBanner"), { ssr: false });
const Release = dynamic(() => import("@/components/main/Release"), { ssr: false });

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const SPLIT_BANNER_AFTER = 3; // 일본 애니(2) 다음, 미국 TV(3) 앞
const THEME_SPLIT = 5;        // 이 인덱스 이후에 한국 시리즈 랭킹 삽입
const RELEASE_AFTER = 9;      // 이 인덱스 이후에 공개예정 섹션 삽입

const deferWork = (callback: () => void) => {
  const id = window.setTimeout(callback, 700);
  return () => window.clearTimeout(id);
};

const THEME_CONFIGS: { title: string; apiUrl: string; mediaType: "movie" | "tv"; pageCount?: number; href: string }[] = [
  {
    title: "한국 액션 & 어드벤처 시리즈",
    apiUrl: "https://api.themoviedb.org/3/discover/tv?language=ko-KR&with_original_language=ko&with_genres=10759&sort_by=popularity.desc",
    mediaType: "tv",
    href: "/category?type=tv&countries=kr&genres=action",
  },
  {
    title: "아시아 시리즈",
    apiUrl: "https://api.themoviedb.org/3/discover/tv?language=ko-KR&with_origin_country=KR%7CJP%7CCN%7CTW&sort_by=popularity.desc",
    mediaType: "tv",
    href: "/category?type=tv&countries=kr,jp,in,cn,tw",
  },
  {
    title: "일본 애니 시리즈",
    apiUrl: "https://api.themoviedb.org/3/discover/tv?language=ko-KR&with_original_language=ja&with_genres=16&sort_by=popularity.desc",
    mediaType: "tv",
    href: "/category?type=animation&countries=jp",
  },
  {
    title: "미국 TV 프로그램",
    apiUrl: "https://api.themoviedb.org/3/discover/tv?language=ko-KR&with_original_language=en&sort_by=popularity.desc",
    mediaType: "tv",
    href: "/category?type=tv&countries=us",
  },
  {
    title: "액션 영화",
    apiUrl: "https://api.themoviedb.org/3/discover/movie?language=ko-KR&with_genres=28&sort_by=popularity.desc",
    mediaType: "movie",
    href: "/category?type=movie&genres=action",
  },
  {
    title: "스릴러 시리즈",
    apiUrl: "https://api.themoviedb.org/3/discover/movie?language=ko-KR&with_genres=53&sort_by=popularity.desc",
    mediaType: "movie",
    href: "/category?type=tv&genres=thriller",
  },
  {
    title: "한국 판타지 시리즈",
    apiUrl: "https://api.themoviedb.org/3/discover/tv?language=ko-KR&with_original_language=ko&with_genres=10765&sort_by=popularity.desc",
    mediaType: "tv",
    href: "/category?type=tv&countries=kr&genres=fantasy",
  },
  {
    title: "모험 애니메이션",
    apiUrl: "https://api.themoviedb.org/3/discover/tv?language=ko-KR&with_original_language=ja&with_genres=16%10765&sort_by=popularity.desc",
    mediaType: "tv",
    pageCount: 3,
    href: "/category?type=animation&genres=scifi",
  },
  {
    title: "해외 다큐멘터리",
    apiUrl: "https://api.themoviedb.org/3/discover/tv?language=ko-KR&with_original_language=en&with_genres=99&sort_by=popularity.desc",
    mediaType: "movie",
    href: "/category?countries=jp,in,cn,tw,us,uk,fr,es,de&genres=documentary",
  },
  {
    title: "판타지 영화",
    apiUrl: "https://api.themoviedb.org/3/discover/movie?language=ko-KR&with_genres=14&sort_by=popularity.desc",
    mediaType: "movie",
    href: "/category?type=movie&genres=fantasy",
  },
  {
    title: "오늘 가장 많이보는 시리즈",
    apiUrl: "https://api.themoviedb.org/3/trending/tv/day?language=ko-KR",
    mediaType: "tv",
    href: "/category?type=tv&source=trending-tv-day",
  },
];

let cachedThemeRows: ThemeItem[][] | null = null;
let cachedThemeLoading = true;
let cachedKoreanSeries: RankingItem[] | null = null;
let cachedKoreanMovieRanking: RankingItem[] | null = null;

async function fetchCert(id: number, mediaType: "movie" | "tv"): Promise<string> {
  const usMovieToKr: Record<string, string> = { "G": "전체관람가", "PG": "전체관람가", "PG-13": "15", "R": "19", "NC-17": "19" };
  const usTvToKr: Record<string, string> = { "TV-Y": "전체관람가", "TV-Y7": "전체관람가", "TV-G": "전체관람가", "TV-PG": "12", "TV-14": "15", "TV-MA": "19" };
  try {
    if (mediaType === "movie") {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/release_dates?api_key=${TMDB_KEY}`);
      const data = await res.json();
      const results = data.results ?? [];
      const kr = results.find((r: any) => r.iso_3166_1 === "KR");
      let cert = (kr?.release_dates ?? []).map((d: any) => d.certification).find((c: string) => c) ?? "";
      if (!cert) {
        const us = results.find((r: any) => r.iso_3166_1 === "US");
        const usCert = (us?.release_dates ?? []).map((d: any) => d.certification).find((c: string) => c) ?? "";
        cert = usMovieToKr[usCert] ?? "";
      }
      return cert;
    } else {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/content_ratings?api_key=${TMDB_KEY}`);
      const data = await res.json();
      const results = data.results ?? [];
      const kr = results.find((r: any) => r.iso_3166_1 === "KR");
      let cert = kr?.rating ?? "";
      if (!cert) {
        const us = results.find((r: any) => r.iso_3166_1 === "US");
        cert = usTvToKr[us?.rating ?? ""] ?? "";
      }
      return cert;
    }
  } catch {
    return "";
  }
}

async function fetchThemeItems(apiUrl: string, mediaType: "movie" | "tv", pageCount = 1): Promise<ThemeItem[]> {
  const startPage = Math.floor(Math.random() * 3) + 1;
  const pages = await Promise.all(
    Array.from({ length: Math.max(pageCount, 2) }, (_, i) =>
      fetch(`${apiUrl.replace("language=ko-KR", "language=" + getTmdbLang())}&page=${startPage + i}&api_key=${TMDB_KEY}`).then((r) => r.json())
    )
  );
  const allResults = pages.flatMap((data) => data.results || []);
  const seen = new Set<number>();
  const unique = allResults
    .filter((item: any) => seen.has(item.id) ? false : (seen.add(item.id), true))
    .sort(() => Math.random() - 0.5);

  const rawItems: ThemeItem[] = unique.map((item: any) => ({
    id: item.id,
    title: item.title ?? item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    overview: item.overview,
    release_date: item.release_date ?? item.first_air_date,
    genre_ids: item.genre_ids ?? [],
    mediaType,
  }));

  rawItems.sort((a, b) => {
    const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
    const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
    
    // 최근 날짜가 더 큰 숫자(밀리초)를 가지므로 b - a 순으로 정렬
    return dateB - dateA;
  });

  // 모든 아이템의 연령 정보를 병렬로 fetch
  return rawItems;
  /*

  // Zustand store에 미리 저장해두면 hover 시 바로 표시됨
  const certMap: Record<string, string> = {};
  certs.forEach((cert, i) => { certMap[`${mediaType}-${rawItems[i].id}`] = cert; });
  useMovieStore.setState((state) => ({
    certifications: { ...state.certifications, ...certMap },
  }));

  const withCert = rawItems.filter((_, i) => certs[i] !== "");
  if (withCert.length >= MIN_ITEMS) return withCert;

  // 9개 미만이면 인증 없는 아이템으로 채워서 최소 9개 보장
  const withoutCert = rawItems.filter((_, i) => certs[i] === "");
  return [...withCert, ...withoutCert.slice(0, MIN_ITEMS - withCert.length)];
  */
}

export default function Home() {
  const t = useT();
  const [themeRows, setThemeRowsState] = useState<ThemeItem[][]>(() => cachedThemeRows ?? []);
  const [themeLoading, setThemeLoadingState] = useState(() => cachedThemeLoading);
  const [koreanSeries, setKoreanSeriesState] = useState<RankingItem[]>(() => cachedKoreanSeries ?? []);
  const [koreanMovieRanking, setKoreanMovieRankingState] = useState<RankingItem[]>(() => cachedKoreanMovieRanking ?? []);
  const netflixIdsRef = useRef<Set<number>>(new Set());
  const setThemeRows = (value: SetStateAction<ThemeItem[][]>) => {
    setThemeRowsState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      cachedThemeRows = next;
      return next;
    });
  };
  const setThemeLoading = (value: boolean) => {
    cachedThemeLoading = value;
    setThemeLoadingState(value);
  };
  const setKoreanSeries = (value: RankingItem[]) => {
    cachedKoreanSeries = value;
    setKoreanSeriesState(value);
  };
  const setKoreanMovieRanking = (value: RankingItem[]) => {
    cachedKoreanMovieRanking = value;
    setKoreanMovieRankingState(value);
  };

  // 선호 장르: 메인 상단에 "내가 선호하는 OO" 줄을 일반 테마보다 먼저 노출
  const favoriteGenres = useFavoriteGenres();
  const [favoriteRows, setFavoriteRows] = useState<{ title: string; href: string; items: ThemeItem[] }[]>([]);

  useEffect(() => {
    if (favoriteGenres.length === 0) {
      setFavoriteRows([]);
      return;
    }
    let ignore = false;
    const cancelDeferred = deferWork(() => {

      const configs = favoriteGenres
        .map((slug) => {
          const meta = GENRE_SLUG_META[slug];
          if (!meta) return null;
          return {
            title: `내가 선호하는 ${meta.title}`,
            href: `/genre/${slug}`,
            apiUrl: `https://api.themoviedb.org/3/discover/movie?language=ko-KR&with_genres=${meta.movieId}&sort_by=popularity.desc&vote_count.gte=50`,
            mediaType: "movie" as const,
          };
        })
        .filter((c): c is { title: string; href: string; apiUrl: string; mediaType: "movie" } => c !== null);

      Promise.all(configs.map((c) => fetchThemeItems(c.apiUrl, c.mediaType))).then((rows) => {
        if (ignore) return;
        const usedIds = new Set<number>();
        const built = configs.map((c, i) => {
          const items = (rows[i] ?? []).filter((item) =>
            usedIds.has(item.id) ? false : (usedIds.add(item.id), true),
          );
          return { title: c.title, href: c.href, items };
        });
        setFavoriteRows(built);
      });
    });

    return () => {
      ignore = true;
      cancelDeferred();
    };
  }, [favoriteGenres]);

  useEffect(() => {
    let ignore = false;
    const cancelDeferred = deferWork(() => {
      // 숨김/제외장르/관람등급 필터 후에도 10개가 채워지도록 2페이지까지 넉넉히 가져온다.
      // (10개 자르기는 RankingSection에서 모든 필터 적용 후 수행)
      const base = `https://api.themoviedb.org/3/discover/tv?language=${getTmdbLang()}&with_original_language=ko&without_genres=10764%2C10767&first_air_date.gte=2025-01-01&sort_by=popularity.desc&api_key=${TMDB_KEY}`;
      Promise.all([
        fetch(`${base}&page=1`).then((r) => r.json()),
        fetch(`${base}&page=2`).then((r) => r.json()),
      ])
        .then(([d1, d2]) => {
          if (ignore) return;
          const seen = new Set<number>();
          const merged = [...(d1.results || []), ...(d2.results || [])].filter((t: any) => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });
          const items: RankingItem[] = merged
            .filter((t: any) => t.poster_path && t.backdrop_path)
            .map((t: any) => ({
              id: t.id,
              title: t.name,
              poster_path: t.poster_path,
              backdrop_path: t.backdrop_path,
              vote_average: t.vote_average,
              overview: t.overview,
              media_type: "tv" as const,
              genre_ids: t.genre_ids ?? [],
            }));
          setKoreanSeries(items);
        });
    });

    return () => {
      ignore = true;
      cancelDeferred();
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const cancelDeferred = deferWork(() => {
      // 숨김/제외장르/관람등급 필터 후에도 10개가 채워지도록 2페이지까지 넉넉히 가져온다.
      // (10개 자르기는 RankingSection에서 모든 필터 적용 후 수행)
      const base = `https://api.themoviedb.org/3/discover/tv?language=${getTmdbLang()}&with_original_language=ko&with_genres=10764%7C10767&sort_by=popularity.desc&api_key=${TMDB_KEY}`;
      Promise.all([
        fetch(`${base}&page=1`).then((r) => r.json()),
        fetch(`${base}&page=2`).then((r) => r.json()),
      ])
        .then(([d1, d2]) => {
          if (ignore) return;
          const seen = new Set<number>();
          const merged = [...(d1.results || []), ...(d2.results || [])].filter((m: any) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          const items: RankingItem[] = merged
            .filter((m: any) => m.poster_path && m.backdrop_path)
            .map((m: any) => ({
              id: m.id,
              title: m.name,
              poster_path: m.poster_path,
              backdrop_path: m.backdrop_path,
              vote_average: m.vote_average,
              overview: m.overview,
              media_type: "tv" as const,
              genre_ids: m.genre_ids ?? [],
            }));
          setKoreanMovieRanking(items);
        });
    });

    return () => {
      ignore = true;
      cancelDeferred();
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    let cancelDeferred = () => {};

    const buildRows = (rows: ThemeItem[][], existingRows: ThemeItem[][], netflixIds: Set<number>) => {
      const usedIds = new Set<number>();
      existingRows.forEach((row) => row?.forEach((item) => usedIds.add(item.id)));

      return rows.map((row) => {
        const filtered = row
          .filter((item) => !usedIds.has(item.id))
          .slice(0, 18)
          .map((item) => ({
            ...item,
            isNetflixOriginal: item.mediaType === "tv" && netflixIds.has(item.id),
          }));
        filtered.forEach((item) => usedIds.add(item.id));
        return filtered;
      });
    };

    const fetchThemeBatch = async (configs: typeof THEME_CONFIGS, startIndex: number, existingRows: ThemeItem[][]) => {
      const rows = await Promise.all(
        configs.map((c) => fetchThemeItems(c.apiUrl, c.mediaType, c.pageCount)),
      );
      if (ignore) return [];

      const builtRows = buildRows(rows, existingRows, netflixIdsRef.current);
      setThemeRows((prev) => {
        const next = [...prev];
        builtRows.forEach((row, i) => {
          next[startIndex + i] = row;
        });
        return next;
      });

      return builtRows;
    };

    const fetchInitial = async () => {
      netflixIdsRef.current = await getNetflixOriginalIdSet(5);
      const initialRows = await fetchThemeBatch(THEME_CONFIGS.slice(0, SPLIT_BANNER_AFTER), 0, []);
      if (ignore) return;
      setThemeLoading(false);

      cancelDeferred = deferWork(() => {
        void (async () => {
          const middleRows = await fetchThemeBatch(
            THEME_CONFIGS.slice(SPLIT_BANNER_AFTER, THEME_SPLIT),
            SPLIT_BANNER_AFTER,
            initialRows,
          );
          if (ignore) return;

          const laterRows = await fetchThemeBatch(
            THEME_CONFIGS.slice(THEME_SPLIT, RELEASE_AFTER),
            THEME_SPLIT,
            [...initialRows, ...middleRows],
          );
          if (ignore) return;

          await fetchThemeBatch(
            THEME_CONFIGS.slice(RELEASE_AFTER),
            RELEASE_AFTER,
            [...initialRows, ...middleRows, ...laterRows],
          );
        })();
      });
    };

    cancelDeferred = deferWork(() => {
      void fetchInitial();
    });

    return () => {
      ignore = true;
      cancelDeferred();
    };
  }, []);

  return (
    <div className="main-page-wrap">
      <Hero />
      {/* 랭킹 */}
      <RankingSection />
      {/* 기분 배너 */}
      <MoodBanner />
      {/* 시청중 */}
      <LazyRender rootMargin="200px 0px">
        <WatchingList />
      </LazyRender>
      {/* 넷플릭스 오리지널 시리즈 + 하단 조각 배너 */}
      {/* <NetflixOriginal /> */}
      {/* 넷플릭스 시리즈 */}
      <LazyRender rootMargin="200px 0px">
        <CategoryList category="netflix" />
      </LazyRender>
      {/* 신작 */}
      {/* <NewMovieList /> */}
      {/* 급상승 */}
      {/* <RisingMovieList /> */}
      {/* 추천 */}
      <LazyRender rootMargin="200px 0px">
        <RecommendList />
      </LazyRender>
      {/* 선호 장르 우선 추천 — 일반 테마 줄보다 먼저 노출 */}
      {favoriteRows.map((row) =>
        row.items.length > 0 ? (
          <LazyRender key={`fav-${row.title}`}>
            <ThemeRow title={row.title} items={row.items} href={row.href} />
          </LazyRender>
        ) : null,
      )}
      {/* <TopCast /> */}
      {/* 테마별 카테고리 — 앞부분 앞 (일본 애니까지) */}
      {themeLoading
        ? THEME_CONFIGS.slice(0, SPLIT_BANNER_AFTER).map((config) => <ThemeRowSkeleton key={config.title} />)
        : THEME_CONFIGS.slice(0, SPLIT_BANNER_AFTER).map((config, i) =>
            themeRows[i]?.length > 0 ? (
              <LazyRender key={config.title}>
                <ThemeRow title={config.title} items={themeRows[i]} href={config.href} />
              </LazyRender>
            ) : null
          )
      }
      {/* 스플릿 배너 */}
      <LazyRender>
        <SplitBanner />
      </LazyRender>
      {/* 테마별 카테고리 — 앞부분 뒤 (미국 TV ~ 액션 영화) */}
      {themeLoading
        ? THEME_CONFIGS.slice(SPLIT_BANNER_AFTER, THEME_SPLIT).map((config) => <ThemeRowSkeleton key={config.title} />)
        : THEME_CONFIGS.slice(SPLIT_BANNER_AFTER, THEME_SPLIT).map((config, i) =>
            themeRows[SPLIT_BANNER_AFTER + i]?.length > 0 ? (
              <LazyRender key={config.title}>
                <ThemeRow title={config.title} items={themeRows[SPLIT_BANNER_AFTER + i]} href={config.href} />
              </LazyRender>
            ) : null
          )
      }
      {/* RUN WITH RUMI 게임 프로모션 배너 */}
      <LazyRender>
        <GameBanner />
      </LazyRender>
      {/* 중간 랭킹: 한국 시리즈 TOP 10 */}
      {koreanSeries.length > 0 && (
        <LazyRender>
          <RankingSection
            title={t("home.koreanSeries")}
            items={koreanSeries}
            href="/category?type=tv&countries=kr&source=korean-series-top10&limit=10"
          />
        </LazyRender>
      )}
      {/* 테마별 카테고리 — 뒷부분 앞 (해외 코미디까지) */}
      {themeLoading
        ? THEME_CONFIGS.slice(THEME_SPLIT, RELEASE_AFTER).map((config) => <ThemeRowSkeleton key={config.title} />)
        : THEME_CONFIGS.slice(THEME_SPLIT, RELEASE_AFTER).map((config, i) =>
            themeRows[THEME_SPLIT + i]?.length > 0 ? (
              <LazyRender key={config.title}>
                <ThemeRow title={config.title} items={themeRows[THEME_SPLIT + i]} href={config.href} />
              </LazyRender>
            ) : null
          )
      }
      {/* 공개예정 */}
      <LazyRender>
        <Release />
      </LazyRender>
      {/* 테마별 카테고리 — 뒷부분 뒤 (판타지 영화부터) */}
      {themeLoading
        ? THEME_CONFIGS.slice(RELEASE_AFTER).map((config) => <ThemeRowSkeleton key={config.title} />)
        : THEME_CONFIGS.slice(RELEASE_AFTER).map((config, i) =>
            themeRows[RELEASE_AFTER + i]?.length > 0 ? (
              <LazyRender key={config.title}>
                <ThemeRow title={config.title} items={themeRows[RELEASE_AFTER + i]} href={config.href} />
              </LazyRender>
            ) : null
          )
      }
      {/* 오늘의 대한민국 TOP 10 영화 */}
      {koreanMovieRanking.length > 0 && (
        <LazyRender>
          <RankingSection title={t("home.koreanVariety")} items={koreanMovieRanking} />
        </LazyRender>
      )}
      <TopButton />
    </div>
  );
}
