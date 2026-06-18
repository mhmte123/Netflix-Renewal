import { getTmdbLang } from "@/lib/i18n";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const ALLOWED_LANGUAGES = new Set(["ko", "en"]);
const EXCLUDED_GENRE_IDS = new Set([99, 10763, 10764, 10767]);
const UPCOMING_FETCH_PAGES = [1, 2, 3];
const MAX_UPCOMING_DAYS = 100;
const UPCOMING_CACHE_TTL_MS = 1000 * 60 * 10;

let cachedUpcomingItems: UpcomingItem[] | null = null;
let cachedUpcomingAt = 0;
let pendingUpcomingRequest: Promise<UpcomingItem[]> | null = null;

export type UpcomingItem = {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  backdrop_path: string;
  poster_path: string;
  release_date: string;
  popularity: number;
  genre_ids: number[];
  original_language?: string;
  origin_country?: string[];
};

export const getToday = () => new Date().toISOString().slice(0, 10);

const getDaysUntilRelease = (dateStr: string) => {
  const today = new Date(getToday());
  const release = new Date(dateStr);
  return Math.ceil((release.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const hasUsOrKrOrigin = (item: any) => {
  const countries = Array.isArray(item.origin_country) ? item.origin_country : [];
  return countries.length === 0 || countries.some((country: string) => country === "KR" || country === "US");
};

const isGoodUpcomingItem = (item: any) => {
  const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
  return (
    genreIds.length > 0 &&
    genreIds.every((genreId: number) => !EXCLUDED_GENRE_IDS.has(genreId)) &&
    (!item.original_language || ALLOWED_LANGUAGES.has(item.original_language)) &&
    hasUsOrKrOrigin(item)
  );
};

const normalizeMovie = (item: any): UpcomingItem | null => {
  if (!item?.id || !item.release_date || !item.backdrop_path || !item.poster_path || !isGoodUpcomingItem(item)) {
    return null;
  }

  return {
    id: item.id,
    media_type: "movie",
    title: item.title,
    backdrop_path: item.backdrop_path,
    poster_path: item.poster_path,
    release_date: item.release_date,
    popularity: item.popularity ?? 0,
    genre_ids: item.genre_ids ?? [],
    original_language: item.original_language,
  };
};

const normalizeTv = (item: any): UpcomingItem | null => {
  if (!item?.id || !item.first_air_date || !item.backdrop_path || !item.poster_path || !isGoodUpcomingItem(item)) {
    return null;
  }

  return {
    id: item.id,
    media_type: "tv",
    title: item.name,
    backdrop_path: item.backdrop_path,
    poster_path: item.poster_path,
    release_date: item.first_air_date,
    popularity: item.popularity ?? 0,
    genre_ids: item.genre_ids ?? [],
    original_language: item.original_language,
    origin_country: item.origin_country ?? [],
  };
};

export async function fetchUpcomingItems(): Promise<UpcomingItem[]> {
  if (!TMDB_KEY) return [];

  const now = Date.now();
  if (cachedUpcomingItems && now - cachedUpcomingAt < UPCOMING_CACHE_TTL_MS) {
    return cachedUpcomingItems;
  }

  if (pendingUpcomingRequest) {
    return pendingUpcomingRequest;
  }

  pendingUpcomingRequest = fetchUpcomingItemsFromTmdb()
    .then((items) => {
      cachedUpcomingItems = items;
      cachedUpcomingAt = Date.now();
      return items;
    })
    .finally(() => {
      pendingUpcomingRequest = null;
    });

  return pendingUpcomingRequest;
}

async function fetchUpcomingItemsFromTmdb(): Promise<UpcomingItem[]> {
  if (!TMDB_KEY) return [];

  const today = getToday();
  const language = getTmdbLang();
  const movieBaseParams = `api_key=${TMDB_KEY}&language=${language}&primary_release_date.gte=${today}&sort_by=popularity.desc&include_adult=false`;
  const tvBaseParams = `api_key=${TMDB_KEY}&language=${language}&first_air_date.gte=${today}&sort_by=popularity.desc&include_adult=false&without_genres=99%2C10763%2C10764%2C10767`;
  const requests = UPCOMING_FETCH_PAGES.flatMap((page) => [
    { type: "movie" as const, url: `${TMDB_BASE}/movie/upcoming?api_key=${TMDB_KEY}&language=${language}&region=KR&page=${page}` },
    { type: "movie" as const, url: `${TMDB_BASE}/movie/upcoming?api_key=${TMDB_KEY}&language=${language}&region=US&page=${page}` },
    { type: "movie" as const, url: `${TMDB_BASE}/discover/movie?${movieBaseParams}&with_original_language=ko&page=${page}` },
    { type: "movie" as const, url: `${TMDB_BASE}/discover/movie?${movieBaseParams}&with_original_language=en&page=${page}` },
    { type: "tv" as const, url: `${TMDB_BASE}/discover/tv?${tvBaseParams}&with_origin_country=KR&page=${page}` },
    { type: "tv" as const, url: `${TMDB_BASE}/discover/tv?${tvBaseParams}&with_origin_country=US&page=${page}` },
  ]);

  const payloads = await Promise.allSettled(
    requests.map(async (request) => {
      const response = await fetch(request.url);
      if (!response.ok) return { results: [] };
      return response.json();
    }),
  );

  const rawItems = payloads
    .flatMap((result, index) => {
      const payload = result.status === "fulfilled" ? result.value : { results: [] };
      const normalize = requests[index].type === "movie" ? normalizeMovie : normalizeTv;
      return (payload.results ?? []).map(normalize);
    })
    .filter((item): item is UpcomingItem => {
      if (!item || item.release_date < today) return false;
      const daysUntilRelease = getDaysUntilRelease(item.release_date);
      return daysUntilRelease <= MAX_UPCOMING_DAYS;
    });

  const seen = new Set<string>();
  return rawItems
    .filter((item) => {
      const key = `${item.media_type}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const popularityCompare = b.popularity - a.popularity;
      return popularityCompare || a.release_date.localeCompare(b.release_date);
    });
}
