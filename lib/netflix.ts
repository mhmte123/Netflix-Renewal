import { getTmdbLang } from "@/lib/i18n";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const NETFLIX_NETWORK_ID = 213;

export interface NetflixOriginalItem {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  first_air_date: string;
  genre_ids: number[];
}

export interface NetflixOriginalsResponse {
  results: NetflixOriginalItem[];
  page: number;
  total_pages: number;
  total_results: number;
}

// 세션 내 재사용을 위한 모듈 레벨 캐시
let _netflixIdCache: Set<number> | null = null;

// 여러 페이지의 Netflix 오리지널 ID를 Set으로 반환 (ThemeRow 마킹용)
// pageCount=20 → 400개 ID 커버 (전체 2766개 중 popularity 상위 400개)
export async function getNetflixOriginalIdSet(pageCount = 20): Promise<Set<number>> {
  if (_netflixIdCache) return _netflixIdCache;
  if (!TMDB_KEY) return new Set();

  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => {
      const params = new URLSearchParams({
        api_key: TMDB_KEY,
        language: "ko-KR",
        with_networks: String(NETFLIX_NETWORK_ID),
        sort_by: "popularity.desc",
        page: String(i + 1),
      });
      return fetch(`${TMDB_BASE}/discover/tv?${params}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .catch(() => ({ results: [] }));
    }),
  );

  _netflixIdCache = new Set<number>(
    pages.flatMap((d) => (d.results ?? []).map((item: { id: number }) => item.id)),
  );
  return _netflixIdCache;
}

export async function getNetflixOriginals(
  page = 1,
  signal?: AbortSignal,
): Promise<NetflixOriginalsResponse> {
  if (!TMDB_KEY) throw new Error("TMDB API 키가 설정되지 않았습니다.");

  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    language: getTmdbLang(),
    with_networks: String(NETFLIX_NETWORK_ID),
    sort_by: "popularity.desc",
    include_null_first_air_dates: "false",
    page: String(page),
  });

  const res = await fetch(`${TMDB_BASE}/discover/tv?${params}`, { signal });

  if (!res.ok) {
    throw new Error(`넷플릭스 오리지널 조회 실패 (HTTP ${res.status})`);
  }

  const data = await res.json();

  const results: NetflixOriginalItem[] = (data.results ?? []).map(
    (item: {
      id?: number;
      name?: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      overview?: string;
      vote_average?: number;
      first_air_date?: string;
      genre_ids?: number[];
    }) => ({
      id: item.id ?? 0,
      name: item.name ?? "",
      poster_path: item.poster_path ?? null,
      backdrop_path: item.backdrop_path ?? null,
      overview: item.overview ?? "",
      vote_average: item.vote_average ?? 0,
      first_air_date: item.first_air_date ?? "",
      genre_ids: item.genre_ids ?? [],
    }),
  );

  return {
    results,
    page: data.page ?? page,
    total_pages: data.total_pages ?? 1,
    total_results: data.total_results ?? 0,
  };
}
