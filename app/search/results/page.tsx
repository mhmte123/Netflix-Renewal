"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  allSearchOptions,
  getSearchOptionQuery,
} from "@/lib/searchOptions";
import {
  fetchTrendingMedia,
  type TrendingMediaItem,
} from "@/lib/trendingContent";
import PosterGridSkeleton from "@/components/common/PosterGridSkeleton";
import TrendingVideoSection from "@/components/search/TrendingVideoSection";
import { filterByExcludedGenres, useExcludedGenres } from "@/data/excludedGenres";
import { useMaturityFiltered } from "@/data/maturityFilter";
import { filterHidden } from "@/data/hiddenContent";
import "../search.scss";
import WishlistButton from "@/components/common/WishlistButton";
import ShareButton from "@/components/common/ShareButton";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { formatFivePointRating } from "@/lib/rating";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const SEARCH_PAGE_BATCH_SIZE = 3;

type MediaType = "movie" | "tv";
type MediaTypeFilter = "all" | MediaType | "animation";
type SearchSortType = "popularity" | "title" | "rating";

type MediaItem = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type: MediaType;
  popularity: number;
  genre_ids: number[];
};

type TmdbMediaCandidate = {
  id?: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  genre_ids?: number[];
  adult?: boolean;
};

type TmdbPersonResult = {
  id?: number;
  known_for?: TmdbMediaCandidate[];
};

type TmdbPersonCredit = TmdbMediaCandidate & {
  job?: string;
};

type TmdbListResponse<T> = {
  results?: T[];
  total_pages?: number;
  total_results?: number;
};

type TmdbPersonCreditsResponse = {
  cast?: TmdbMediaCandidate[];
  crew?: TmdbPersonCredit[];
};

const SEARCH_SORT_OPTIONS: { key: SearchSortType; label: string }[] = [
  { key: "popularity", label: "인기순" },
  { key: "title", label: "제목순" },
  { key: "rating", label: "평점순" },
];

const TYPE_FILTER_OPTIONS: { key: MediaTypeFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "movie", label: "영화" },
  { key: "tv", label: "시리즈" },
  { key: "animation", label: "애니메이션" },
];

const parseParamList = (value: string | null) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const isMediaType = (value: string | undefined): value is MediaType =>
  value === "movie" || value === "tv";

const isMediaTypeFilter = (
  value: string | undefined,
): value is MediaTypeFilter =>
  value === "all" ||
  value === "movie" ||
  value === "tv" ||
  value === "animation";

const isAnimationItem = (item: Pick<MediaItem, "genre_ids">) =>
  item.genre_ids.includes(16);

const normalizeMediaItem = (
  item: TmdbMediaCandidate,
  fallbackMediaType?: MediaType,
): MediaItem | null => {
  const mediaType = isMediaType(item.media_type)
    ? item.media_type
    : fallbackMediaType;
  const title = item.title || item.name;

  if (!item.id || !mediaType || !title || item.adult) return null;

  return {
    id: item.id,
    title,
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    overview: item.overview ?? "",
    vote_average: item.vote_average ?? 0,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    media_type: mediaType,
    popularity: item.popularity ?? 0,
    genre_ids: item.genre_ids ?? [],
  };
};

const uniqueAndSortItems = (items: MediaItem[]) => {
  const itemMap = new Map<string, MediaItem>();

  items.forEach((item) => {
    const key = `${item.media_type}-${item.id}`;
    const prev = itemMap.get(key);

    if (!prev || item.popularity > prev.popularity) {
      itemMap.set(key, item);
    }
  });

  return Array.from(itemMap.values()).sort(
    (a, b) => b.popularity - a.popularity,
  );
};

const mergeKeywordFirst = (
  keywordItems: MediaItem[],
  taggedItems: MediaItem[],
) => {
  const seenKeys = new Set<string>();
  const mergedItems: MediaItem[] = [];

  [...keywordItems, ...taggedItems].forEach((item) => {
    const key = `${item.media_type}-${item.id}`;
    if (seenKeys.has(key)) return;

    seenKeys.add(key);
    mergedItems.push(item);
  });

  return mergedItems;
};

const intersectMediaItems = (
  primaryItems: MediaItem[],
  filterItems: MediaItem[],
) => {
  const filterKeys = new Set(
    filterItems.map((item) => `${item.media_type}-${item.id}`),
  );

  return primaryItems.filter((item) =>
    filterKeys.has(`${item.media_type}-${item.id}`),
  );
};

const collectGenreIds = (
  mediaType: MediaType,
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

const getSelectedSearchOptions = (
  selectedGenres: string[],
  selectedMoods: string[],
) => {
  const selectedValues = new Set([...selectedGenres, ...selectedMoods]);

  return allSearchOptions.filter((option) => selectedValues.has(option.value));
};

const fetchJson = async <T,>(url: string, signal: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("TMDB 요청에 실패했습니다.");
  return response.json() as Promise<T>;
};

const fetchKeywordResults = async (
  keyword: string,
  typeFilter: MediaTypeFilter,
  startPage: number,
  signal: AbortSignal,
) => {
  if (!TMDB_KEY || !keyword) return { items: [], totalPages: 0 };

  const pageNumbers = Array.from(
    { length: SEARCH_PAGE_BATCH_SIZE },
    (_, index) => startPage + index,
  );

  const multiPages = await Promise.all(
    pageNumbers.map((page) => {
      const params = new URLSearchParams({
        api_key: TMDB_KEY,
        language: "ko-KR",
        query: keyword,
        include_adult: "false",
        page: String(page),
      });

      return fetchJson<TmdbListResponse<TmdbMediaCandidate>>(
        `${TMDB_BASE}/search/multi?${params.toString()}`,
        signal,
      );
    }),
  );

  const personData =
    startPage === 1
      ? await (() => {
          const params = new URLSearchParams({
            api_key: TMDB_KEY,
            language: "ko-KR",
            query: keyword,
            include_adult: "false",
            page: "1",
          });

          return fetchJson<TmdbListResponse<TmdbPersonResult>>(
            `${TMDB_BASE}/search/person?${params.toString()}`,
            signal,
          );
        })()
      : ({ results: [] } as TmdbListResponse<TmdbPersonResult>);

  const directItems = multiPages
    .flatMap((page) => page.results ?? [])
    .map((item) => normalizeMediaItem(item))
    .filter((item): item is MediaItem => Boolean(item));

  const knownForItems = (personData.results ?? [])
    .flatMap((person) => person.known_for ?? [])
    .map((item) => normalizeMediaItem(item))
    .filter((item): item is MediaItem => Boolean(item));

  const creditRequests = (personData.results ?? [])
    .slice(0, 4)
    .flatMap((person) => {
      if (!person.id) return [];

      const params = new URLSearchParams({
        api_key: TMDB_KEY,
        language: "ko-KR",
      });

      return [
        fetchJson<TmdbPersonCreditsResponse>(
          `${TMDB_BASE}/person/${person.id}/combined_credits?${params.toString()}`,
          signal,
        ),
      ];
    });

  const creditsData = await Promise.all(creditRequests);
  const creditItems = creditsData
    .flatMap((credits) => [
      ...(credits.cast ?? []),
      ...(credits.crew ?? []).filter((item) =>
        ["Director", "Creator", "Writer"].includes(item.job ?? ""),
      ),
    ])
    .map((item) => normalizeMediaItem(item))
    .filter((item): item is MediaItem => Boolean(item));

  const items = uniqueAndSortItems([
    ...directItems,
    ...knownForItems,
    ...creditItems,
  ]).filter((item) => {
    if (typeFilter === "all") return true;
    if (typeFilter === "animation") return isAnimationItem(item);
    return item.media_type === typeFilter;
  });

  return {
    items,
    totalPages: Math.min(
      Math.max(...multiPages.map((page) => page.total_pages ?? 1), 1),
      500,
    ),
  };
};

const fetchTaggedResults = async (
  selectedGenres: string[],
  selectedMoods: string[],
  typeFilter: MediaTypeFilter,
  startPage: number,
  signal: AbortSignal,
) => {
  if (
    !TMDB_KEY ||
    (selectedGenres.length === 0 && selectedMoods.length === 0)
  ) {
    return { items: [], totalPages: 0 };
  }

  const mediaTypes: MediaType[] =
    typeFilter === "all" || typeFilter === "animation"
      ? ["movie", "tv"]
      : [typeFilter];
  const pageNumbers = Array.from(
    { length: SEARCH_PAGE_BATCH_SIZE },
    (_, index) => startPage + index,
  );

  const requests = mediaTypes.flatMap((mediaType) => {
    const genreIds = collectGenreIds(mediaType, selectedGenres, selectedMoods);
    if (typeFilter === "animation" && !genreIds.includes("16")) {
      genreIds.push("16");
    }
    if (genreIds.length === 0) return [];

    return pageNumbers.map((page) => {
      const params = new URLSearchParams({
        api_key: TMDB_KEY,
        language: "ko-KR",
        include_adult: "false",
        page: String(page),
        sort_by: "popularity.desc",
        with_genres: genreIds.join(","),
        "vote_count.gte": "30",
      });

      return fetchJson<TmdbListResponse<TmdbMediaCandidate>>(
        `${TMDB_BASE}/discover/${mediaType}?${params.toString()}`,
        signal,
      ).then((data) => ({
        items: (data.results ?? [])
          .map((item) => normalizeMediaItem(item, mediaType))
          .filter((item): item is MediaItem => Boolean(item)),
        totalPages: data.total_pages ?? 1,
      }));
    });
  });

  if (requests.length === 0) return { items: [], totalPages: 0 };

  const results = await Promise.all(requests);
  return {
    items: uniqueAndSortItems(results.flatMap((result) => result.items)),
    totalPages: Math.min(
      Math.max(...results.map((result) => result.totalPages), 1),
      500,
    ),
  };
};

export default function SearchResultsPage() {
  return (
    <Suspense fallback={null}>
      <SearchResultsContent />
    </Suspense>
  );
}

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const keyword = searchParams.get("q")?.trim() ?? "";
  const selectedGenres = useMemo(
    () => parseParamList(searchParams.get("genres")),
    [searchParams],
  );
  const selectedMoods = useMemo(
    () => parseParamList(searchParams.get("moods")),
    [searchParams],
  );
  const typeParam = searchParams.get("type") ?? undefined;

  const typeFilter: MediaTypeFilter = isMediaTypeFilter(typeParam)
    ? typeParam
    : "all";

  const [items, setItems] = useState<MediaItem[]>([]);
  const excludedGenres = useExcludedGenres();
  const [popularItems, setPopularItems] = useState<TrendingMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sort, setSort] = useState<SearchSortType>("popularity");
  const [sortOpen, setSortOpen] = useState(false);
  const [nextPage, setNextPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const prefetchRoute = useRoutePrefetch();

  const selectedOptions = getSelectedSearchOptions(selectedGenres, selectedMoods);
  const hasQuery =
    keyword.length > 0 || selectedGenres.length > 0 || selectedMoods.length > 0;
  const currentSortLabel =
    SEARCH_SORT_OPTIONS.find((option) => option.key === sort)?.label ??
    SEARCH_SORT_OPTIONS[0].label;
  const sortedItems = useMemo(() => {
    // 제외 장르 작품 숨김 후 정렬
    return filterByExcludedGenres([...items], excludedGenres).sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ko-KR");
      if (sort === "rating") return b.vote_average - a.vote_average;
      return b.popularity - a.popularity;
    });
  }, [items, sort, excludedGenres]);

  const fetchSearchBatch = async (
    startPage: number,
    signal: AbortSignal,
    reset = false,
  ) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setErrorMessage("");

    try {
      const [keywordResult, taggedResult] = await Promise.all([
        fetchKeywordResults(keyword, typeFilter, startPage, signal),
        fetchTaggedResults(
          selectedGenres,
          selectedMoods,
          typeFilter,
          startPage,
          signal,
        ),
      ]);
      const hasKeyword = keyword.length > 0;
      const hasTags = selectedGenres.length > 0 || selectedMoods.length > 0;
      const nextItems =
        hasKeyword && hasTags
          ? intersectMediaItems(keywordResult.items, taggedResult.items)
          : mergeKeywordFirst(keywordResult.items, taggedResult.items);
      const queryTotalPages =
        hasKeyword && hasTags
          ? Math.min(keywordResult.totalPages, taggedResult.totalPages)
          : Math.max(keywordResult.totalPages, taggedResult.totalPages);

      setItems((currentItems) =>
        reset ? nextItems : mergeKeywordFirst(currentItems, nextItems),
      );
      setTotalPages(queryTotalPages);
      setNextPage(startPage + SEARCH_PAGE_BATCH_SIZE);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (reset) setItems([]);
      setErrorMessage(
        "검색 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };
  // 관람등급 필터 (hover 전에도 적용되도록 등급 선반입)
  const visibleItems = filterHidden(useMaturityFiltered(sortedItems, (it) => it.media_type));

  useEffect(() => {
    if (!hasQuery) {
      const timeoutId = window.setTimeout(() => {
        setItems([]);
        setErrorMessage("");
        setNextPage(1);
        setTotalPages(0);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const controller = new AbortController();
    const loadingTimeoutId = window.setTimeout(() => {
      setLoading(true);
      setErrorMessage("");
    }, 0);

    Promise.all([
      fetchKeywordResults(keyword, typeFilter, 1, controller.signal),
      fetchTaggedResults(
        selectedGenres,
        selectedMoods,
        typeFilter,
        1,
        controller.signal,
      ),
    ])
      .then(([keywordResult, taggedResult]) => {
        const hasKeyword = keyword.length > 0;
        const hasTags = selectedGenres.length > 0 || selectedMoods.length > 0;
        const nextItems =
          hasKeyword && hasTags
            ? intersectMediaItems(keywordResult.items, taggedResult.items)
            : mergeKeywordFirst(keywordResult.items, taggedResult.items);
        const queryTotalPages =
          hasKeyword && hasTags
            ? Math.min(keywordResult.totalPages, taggedResult.totalPages)
            : Math.max(keywordResult.totalPages, taggedResult.totalPages);

        setItems(nextItems);
        setTotalPages(queryTotalPages);
        setNextPage(1 + SEARCH_PAGE_BATCH_SIZE);
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        setItems([]);
        setErrorMessage(
          "검색 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      window.clearTimeout(loadingTimeoutId);
      controller.abort();
    };
  }, [hasQuery, keyword, selectedGenres, selectedMoods, typeFilter]);

  useEffect(() => {
    const controller = new AbortController();

    fetchTrendingMedia(
      typeFilter === "animation" ? "all" : typeFilter,
      controller.signal,
      8,
    )
      .then(setPopularItems)
      .catch((error: Error) => {
        if (error.name !== "AbortError") setPopularItems([]);
      });

    return () => controller.abort();
  }, [typeFilter]);

  const changeTypeFilter = (nextType: MediaTypeFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextType === "all") params.delete("type");
    else params.set("type", nextType);
    router.push(`/search/results?${params.toString()}`);
  };

  const removeSelectedOption = (group: "genre" | "mood", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const paramName = group === "genre" ? "genres" : "moods";
    const nextValues = parseParamList(params.get(paramName)).filter(
      (item) => item !== value,
    );

    if (nextValues.length > 0) params.set(paramName, nextValues.join(","));
    else params.delete(paramName);

    router.push(`/search/results?${params.toString()}`);
  };

  const handleLoadMore = () => {
    const controller = new AbortController();
    void fetchSearchBatch(nextPage, controller.signal);
  };

  return (
    <div className="search-results-page">
      <section className="search-results-hero">
        <div className="inner">
          <p>검색 결과</p>
          <div className="search-result-query-line">
            {keyword && <strong>{keyword}</strong>}
            {selectedOptions.length > 0 && (
              <div className="search-result-chips">
                {selectedOptions.map((option) => (
                  <button
                    type="button"
                    key={`${option.group}-${option.value}`}
                    onClick={() =>
                      removeSelectedOption(option.group, option.value)
                    }
                    aria-label={`${option.label} 태그 제거`}
                  >
                    <span>{option.label}</span>
                    <em aria-hidden="true">×</em>
                  </button>
                ))}
              </div>
            )}
            {!keyword && selectedOptions.length === 0 && (
              <span className="search-result-empty-query">
                검색결과가 없습니다
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="search-results-content inner">
        <div
          className="type-filter"
          aria-label="콘텐츠 유형"
        >
          {TYPE_FILTER_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.key}
              className={typeFilter === option.key ? "active" : ""}
              onClick={() => changeTypeFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <PosterGridSkeleton />
        ) : errorMessage ? (
          <div className="empty">{errorMessage}</div>
        ) : visibleItems.length > 0 ? (
          <>
            <div className="search-results-summary">
              <div className="search-results-count">
                {visibleItems.length.toLocaleString()}개 작품
              </div>
              <div className="search-results-sort">
                <button
                  type="button"
                  className="sort-btn"
                  onClick={() => setSortOpen((isOpen) => !isOpen)}
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
                    {SEARCH_SORT_OPTIONS.map((option) => (
                      <li key={option.key}>
                        <button
                          type="button"
                          className={`sort-option${sort === option.key ? " is-selected" : ""}`}
                          onClick={() => {
                            setSort(option.key);
                            setSortOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="poster-grid">
              {visibleItems.map((item, d) => {
                const releaseYear = (
                  item.release_date || item.first_air_date
                )?.slice(0, 4);
                const imagePath = item.backdrop_path || item.poster_path;

                return (
                  <div className="poster-card" key={`${d}-${item.media_type}-${item.id}`}>
                    <Link
                      href={`/detail/${item.media_type}/${item.id}`}
                    >
                      <div className="poster">
                        {item.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                            alt={item.title}
                            width={228}
                            height={342}
                          />
                        ) : (
                          <div className="no-image">이미지 없음</div>
                        )}
                        <span className="rating">
                          ★ {formatFivePointRating(item.vote_average)}
                        </span>
                      </div>
                    </Link>
                    <div className="search-hover-card">
                      <div className="search-hover-card__media">
                        {imagePath ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w500${imagePath}`}
                            alt={item.title}
                            width={420}
                            height={236}
                          />
                        ) : (
                          <div className="no-image">이미지 없음</div>
                        )}
                      </div>
                      <div className="search-hover-card__info">
                        <div className="search-hover-card__title-row">
                          <h3>{item.title}</h3>
                        </div>
                        <div className="search-hover-card__meta">
                          {item.vote_average > 0 && (
                            <>
                              <span className="meta-star">★</span>
                              <span className="meta-score">
                                {formatFivePointRating(item.vote_average)}
                              </span>
                              {releaseYear && (
                                <span className="meta-sep">|</span>
                              )}
                            </>
                          )}
                          {releaseYear && <span>{releaseYear}</span>}
                        </div>
                        {item.overview && (
                          <p className="search-hover-card__overview">
                            {item.overview}
                          </p>
                        )}
                        <div className="search-hover-card__actions">
                          <Link
                            href={`/watch/${item.media_type}/${item.id}`}
                            className="btn-play"
                            onPointerEnter={() => prefetchRoute(`/watch/${item.media_type}/${item.id}`)}
                            onFocus={() => prefetchRoute(`/watch/${item.media_type}/${item.id}`)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg viewBox="0 0 24 24">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            재생
                          </Link>
                          <Link
                            href={`/detail/${item.media_type}/${item.id}`}
                            className="btn-detail"
                            onPointerEnter={() => prefetchRoute(`/detail/${item.media_type}/${item.id}`)}
                            onFocus={() => prefetchRoute(`/detail/${item.media_type}/${item.id}`)}
                          >
                            <svg viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            상세정보
                          </Link>
                          <WishlistButton item={item} mediaType={item.media_type} stopPropagation className="card-wish" />
                          <ShareButton mediaType={item.media_type} id={item.id} stopPropagation className="card-wish" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {nextPage <= totalPages && (
              <div className="load-more-wrap">
                <button
                  type="button"
                  className="load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "불러오는 중..." : "더보기"}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="empty">
              {hasQuery
                ? "검색 결과가 없어요."
                : "검색어 또는 태그를 선택해 주세요."}
            </div>
            <TrendingVideoSection
              items={popularItems.slice(0, 8)}
              title="지금 많이 찾는 추천 영상"
              variant="results"
            />
          </>
        )}
      </section>
    </div>
  );
}
