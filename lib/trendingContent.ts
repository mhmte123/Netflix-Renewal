import {
  allSearchOptions,
  getSearchOptionQuery,
} from "@/lib/searchOptions";

export type TrendingMediaType = "movie" | "tv";
export type TrendingMediaTypeFilter = "all" | TrendingMediaType;

export type TrendingMediaItem = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type: TrendingMediaType;
  popularity: number;
};

type TmdbTrendingCandidate = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  adult?: boolean;
};

type TmdbListResponse<T> = {
  results?: T[];
};

type TmdbPersonResult = {
  id?: number;
  known_for?: TmdbTrendingCandidate[];
};

type TmdbPersonCredit = TmdbTrendingCandidate & {
  job?: string;
};

type TmdbPersonCreditsResponse = {
  cast?: TmdbTrendingCandidate[];
  crew?: TmdbPersonCredit[];
};

type TmdbVideoCandidate = {
  key?: string;
  site?: string;
  type?: string;
  official?: boolean;
};

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

const isTrendingMediaType = (
  value: string | undefined,
): value is TrendingMediaType => value === "movie" || value === "tv";

export const getTrendingYear = (item: TrendingMediaItem) =>
  (item.release_date || item.first_air_date || "").slice(0, 4);

export const normalizeTrendingMediaItem = (
  item: TmdbTrendingCandidate,
  fallbackMediaType?: TrendingMediaType,
): TrendingMediaItem | null => {
  const mediaType = isTrendingMediaType(item.media_type)
    ? item.media_type
    : fallbackMediaType;
  const title = item.title || item.name;

  if (!item.id || !mediaType || !title || item.adult) return null;

  return {
    id: item.id,
    title,
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    vote_average: item.vote_average ?? 0,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    media_type: mediaType,
    popularity: item.popularity ?? 0,
  };
};

export const uniqueAndSortTrendingItems = (items: TrendingMediaItem[]) => {
  const itemMap = new Map<string, TrendingMediaItem>();

  items.forEach((item) => {
    const key = `${item.media_type}-${item.id}`;
    const prev = itemMap.get(key);

    if (!prev || item.popularity > prev.popularity) {
      itemMap.set(key, item);
    }
  });

  return Array.from(itemMap.values()).sort((a, b) => b.popularity - a.popularity);
};

export const fetchTrendingMedia = async (
  typeFilter: TrendingMediaTypeFilter,
  signal: AbortSignal,
  limit = 5,
) => {
  if (!TMDB_KEY) return [];

  const mediaTypes: TrendingMediaType[] =
    typeFilter === "all" ? ["tv", "movie"] : [typeFilter];

  const requests = mediaTypes.map(async (mediaType) => {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language: "ko-KR",
      include_adult: "false",
      page: "1",
      sort_by: "popularity.desc",
      "vote_count.gte": "40",
    });

    if (mediaType === "tv") {
      params.set("with_networks", "213");
    } else {
      params.set("watch_region", "KR");
      params.set("with_watch_providers", "8");
    }

    const response = await fetch(
      `${TMDB_BASE}/discover/${mediaType}?${params.toString()}`,
      { signal },
    );
    if (!response.ok) throw new Error("인기 작품을 불러오지 못했습니다.");

    const data = (await response.json()) as TmdbListResponse<TmdbTrendingCandidate>;
    return (data.results ?? [])
      .map((item) => normalizeTrendingMediaItem(item, mediaType))
      .filter((item): item is TrendingMediaItem => Boolean(item));
  });

  const items = (await Promise.all(requests)).flat();

  return uniqueAndSortTrendingItems(items).slice(0, limit);
};

const uniqueTrendingItemsInOrder = (items: TrendingMediaItem[]) => {
  const seenKeys = new Set<string>();
  const uniqueItems: TrendingMediaItem[] = [];

  items.forEach((item) => {
    const key = `${item.media_type}-${item.id}`;
    if (seenKeys.has(key)) return;

    seenKeys.add(key);
    uniqueItems.push(item);
  });

  return uniqueItems;
};

const fetchKeywordSeries = async (
  keywords: string[],
  signal: AbortSignal,
) => {
  if (!TMDB_KEY) return [];

  const requests = keywords.map(async (keyword) => {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language: "ko-KR",
      include_adult: "false",
      page: "1",
      query: keyword,
    });

    const response = await fetch(
      `${TMDB_BASE}/search/tv?${params.toString()}`,
      { signal },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as TmdbListResponse<TmdbTrendingCandidate>;
    const normalizedItems = (data.results ?? [])
      .map((item) => normalizeTrendingMediaItem(item, "tv"))
      .filter((item): item is TrendingMediaItem => Boolean(item));

    const exactMatch =
      normalizedItems.find((item) => item.title === keyword) ??
      normalizedItems[0];

    return exactMatch ? [exactMatch] : [];
  });

  return (await Promise.all(requests)).flat();
};

const fetchLatestNetflixSeries = async (
  signal: AbortSignal,
  limit: number,
) => {
  if (!TMDB_KEY) return [];

  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    language: "ko-KR",
    include_adult: "false",
    include_null_first_air_dates: "false",
    page: "1",
    sort_by: "first_air_date.desc",
    with_networks: "213",
    "first_air_date.lte": today,
    "vote_count.gte": "1",
  });

  const response = await fetch(
    `${TMDB_BASE}/discover/tv?${params.toString()}`,
    { signal },
  );
  if (!response.ok) throw new Error("넷플릭스 최신 시리즈를 불러오지 못했습니다.");

  const data = (await response.json()) as TmdbListResponse<TmdbTrendingCandidate>;
  return (data.results ?? [])
    .map((item) => normalizeTrendingMediaItem(item, "tv"))
    .filter((item): item is TrendingMediaItem => Boolean(item))
    .slice(0, limit);
};

export const fetchNetflixSeriesRecommendations = async (
  signal: AbortSignal,
  limit = 5,
) => {
  const [priorityItems, latestItems, popularItems] = await Promise.all([
    fetchKeywordSeries(["참교육"], signal),
    fetchLatestNetflixSeries(signal, limit * 2),
    fetchTrendingMedia("tv", signal, limit * 2),
  ]);

  return uniqueTrendingItemsInOrder([
    ...priorityItems,
    ...latestItems,
    ...popularItems,
  ]).slice(0, limit);
};

export const fetchKeywordPreviewMedia = async (
  keyword: string,
  signal: AbortSignal,
  limit = 5,
) => {
  const trimmedKeyword = keyword.trim();
  if (!TMDB_KEY || !trimmedKeyword) return [];

  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    language: "ko-KR",
    include_adult: "false",
    page: "1",
    query: trimmedKeyword,
  });

  const [mediaResponse, personResponse] = await Promise.all([
    fetch(`${TMDB_BASE}/search/multi?${params.toString()}`, { signal }),
    fetch(`${TMDB_BASE}/search/person?${params.toString()}`, { signal }),
  ]);

  if (!mediaResponse.ok || !personResponse.ok) {
    throw new Error("검색 결과를 불러오지 못했습니다.");
  }

  const mediaData =
    (await mediaResponse.json()) as TmdbListResponse<TmdbTrendingCandidate>;
  const personData =
    (await personResponse.json()) as TmdbListResponse<TmdbPersonResult>;

  const directItems = (mediaData.results ?? [])
    .map((item) => normalizeTrendingMediaItem(item))
    .filter((item): item is TrendingMediaItem => Boolean(item));

  const knownForItems = (personData.results ?? [])
    .flatMap((person) => person.known_for ?? [])
    .map((item) => normalizeTrendingMediaItem(item))
    .filter((item): item is TrendingMediaItem => Boolean(item));

  const creditRequests = (personData.results ?? []).slice(0, 3).flatMap((person) => {
    if (!person.id) return [];

    const creditParams = new URLSearchParams({
      api_key: TMDB_KEY,
      language: "ko-KR",
    });

    return fetch(
      `${TMDB_BASE}/person/${person.id}/combined_credits?${creditParams.toString()}`,
      { signal },
    )
      .then((response) => {
        if (!response.ok) return null;
        return response.json() as Promise<TmdbPersonCreditsResponse>;
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") throw error;
        return null;
      });
  });

  const creditsData = await Promise.all(creditRequests);
  const creditItems = creditsData
    .filter((credits): credits is TmdbPersonCreditsResponse => Boolean(credits))
    .flatMap((credits) => [
      ...(credits.cast ?? []),
      ...(credits.crew ?? []).filter((item) =>
        ["Director", "Creator", "Writer"].includes(item.job ?? ""),
      ),
    ])
    .map((item) => normalizeTrendingMediaItem(item))
    .filter((item): item is TrendingMediaItem => Boolean(item));

  return uniqueAndSortTrendingItems([
    ...directItems,
    ...knownForItems,
    ...creditItems,
  ]).slice(0, limit);
};

const collectPreviewGenreIds = (
  mediaType: TrendingMediaType,
  selectedGenres: string[],
  selectedMoods: string[],
) => {
  const selectedValues = new Set([...selectedGenres, ...selectedMoods]);
  const genreIds = new Set<string>();

  allSearchOptions
    .filter((option) => selectedValues.has(option.value))
    .forEach((option) => {
      const genreValue = getSearchOptionQuery(option, mediaType).with_genres;
      genreValue?.split(",").forEach((genreId) => {
        const trimmedGenreId = genreId.trim();
        if (trimmedGenreId) genreIds.add(trimmedGenreId);
      });
    });

  return Array.from(genreIds);
};

export const fetchTaggedPreviewMedia = async (
  selectedGenres: string[],
  selectedMoods: string[],
  signal: AbortSignal,
  limit = 5,
) => {
  if (
    !TMDB_KEY ||
    (selectedGenres.length === 0 && selectedMoods.length === 0)
  ) {
    return [];
  }

  const requests = (["tv", "movie"] as const).flatMap((mediaType) => {
    const genreIds = collectPreviewGenreIds(
      mediaType,
      selectedGenres,
      selectedMoods,
    );
    if (genreIds.length === 0) return [];

    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language: "ko-KR",
      include_adult: "false",
      page: "1",
      sort_by: "popularity.desc",
      with_genres: genreIds.join(","),
      "vote_count.gte": "30",
    });

    return fetch(`${TMDB_BASE}/discover/${mediaType}?${params.toString()}`, {
      signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("태그 결과를 불러오지 못했습니다.");

      const data =
        (await response.json()) as TmdbListResponse<TmdbTrendingCandidate>;
      return (data.results ?? [])
        .map((item) => normalizeTrendingMediaItem(item, mediaType))
        .filter((item): item is TrendingMediaItem => Boolean(item));
    });
  });

  const results = await Promise.all(requests);
  return uniqueAndSortTrendingItems(results.flat()).slice(0, limit);
};

export const intersectTrendingItems = (
  primaryItems: TrendingMediaItem[],
  filterItems: TrendingMediaItem[],
) => {
  const filterKeys = new Set(
    filterItems.map((item) => `${item.media_type}-${item.id}`),
  );

  return primaryItems.filter((item) =>
    filterKeys.has(`${item.media_type}-${item.id}`),
  );
};

const pickTrailerKey = (videos: TmdbVideoCandidate[]) => {
  const youtubeVideos = videos.filter((video) => video.site === "YouTube" && video.key);
  const trailer =
    youtubeVideos.find((video) => video.type === "Trailer" && video.official) ??
    youtubeVideos.find((video) => video.type === "Trailer") ??
    youtubeVideos.find((video) => video.type === "Teaser") ??
    youtubeVideos[0];

  return trailer?.key ?? null;
};

export const fetchTrendingTrailerKey = async (
  item: Pick<TrendingMediaItem, "id" | "media_type">,
  signal: AbortSignal,
) => {
  if (!TMDB_KEY) return null;

  const fetchVideos = async (language: string) => {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      language,
    });
    const response = await fetch(
      `${TMDB_BASE}/${item.media_type}/${item.id}/videos?${params.toString()}`,
      { signal },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as TmdbListResponse<TmdbVideoCandidate>;
    return pickTrailerKey(data.results ?? []);
  };

  return (await fetchVideos("ko-KR")) ?? (await fetchVideos("en-US"));
};
