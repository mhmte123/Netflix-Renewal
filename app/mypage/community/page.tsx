"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BackButton from "@/components/common/BackButton";
import { useConfirmModal } from "@/components/common/ConfirmModal";
import Feed from "@/components/mypage/Feed";
import Review from "@/components/mypage/Review";
import { useAuthStore } from "@/store/useAuthStore";
import { useCommunityStore } from "@/store/useCommunityStore";
import { type FeedView, useFeedStore } from "@/store/useFeedStore";
import { type FeedMediaOption, getPosterUrl } from "@/types/feedData";
import { type ReviewDocument } from "@/types/community";
import {
  allSearchOptions,
  getSearchOptionQuery,
  type SearchOption,
} from "@/lib/searchOptions";
import "../../scss/feed.scss";
import "../../scss/communityPage.scss";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

type CommunityTab = "reviews" | "my-feeds";
type ScopeFilterType = "mine" | "liked" | "following";
type SortType = "recent" | "likes" | "comments";
type ReviewFinderOption = SearchOption;
type TmdbMultiSearchItem = {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
};

const tabs: { id: CommunityTab; label: string }[] = [
  { id: "reviews", label: "리뷰 관리" },
  { id: "my-feeds", label: "피드 관리" },
];

const scopeFilters: { key: ScopeFilterType; label: string }[] = [
  { key: "mine", label: "내가 쓴 글" },
  { key: "liked", label: "좋아요한 글" },
  { key: "following", label: "팔로워 글" },
];

const sortOptions: { key: SortType; label: string }[] = [
  { key: "recent", label: "최근 작성순" },
  { key: "likes", label: "좋아요 많은순" },
  { key: "comments", label: "댓글 많은순" },
];

const getUserId = (user: ReturnType<typeof useAuthStore.getState>["user"]) =>
  user?.userId || (user as { uid?: string } | null)?.uid || "";

const getReviewKey = (review: ReviewDocument) =>
  `${review.videoId}#${review.reviewId}`;

const reviewMoodOptions = allSearchOptions.filter(
  (option) => option.group === "mood",
);
const reviewGenreOptions = allSearchOptions.filter(
  (option) => option.group === "genre",
);

const makeSearchMediaOption = (
  item: TmdbMultiSearchItem,
  fallbackMediaType?: "movie" | "tv",
): FeedMediaOption | null => {
  const mediaType =
    item.media_type === "movie" || item.media_type === "tv"
      ? item.media_type
      : fallbackMediaType;
  if (!mediaType) return null;

  const title = mediaType === "movie" ? item.title : item.name;
  if (!title) return null;

  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const typeLabel = mediaType === "movie" ? "영화" : "시리즈";
  const rating =
    typeof item.vote_average === "number" && item.vote_average > 0
      ? ` · 평점 ${(item.vote_average / 2).toFixed(1)}`
      : "";

  return {
    id: item.id,
    mediaType,
    title,
    posterPath: item.poster_path || undefined,
    meta: `${typeLabel}${year ? ` · ${year}` : ""}${rating}`,
  };
};

const getCombinedReviewTagQuery = (
  tags: ReviewFinderOption[],
  mediaType: "movie" | "tv",
) => {
  const combinedQuery: Record<string, string> = {};
  const genreIds = new Set<string>();

  tags.forEach((tag) => {
    const tagQuery = getSearchOptionQuery(tag, mediaType);

    Object.entries(tagQuery).forEach(([key, value]) => {
      if (key === "with_genres") {
        value.split(/[|,]/).forEach((genreId) => {
          const trimmedGenreId = genreId.trim();
          if (trimmedGenreId) genreIds.add(trimmedGenreId);
        });
        return;
      }

      combinedQuery[key] = value;
    });
  });

  if (genreIds.size > 0) {
    combinedQuery.with_genres = Array.from(genreIds).join(",");
  }

  return combinedQuery;
};

const getStarFill = (rating: number, star: number) =>
  Math.max(0, Math.min(1, rating - (star - 1))) * 100;

const getNextStarRating = (currentRating: number, star: number) => {
  const halfRating = star - 0.5;

  return currentRating === halfRating ? star : halfRating;
};

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <CommunityContent />
    </Suspense>
  );
}

function CommunityContent() {
  const { confirm, modal: confirmModal } = useConfirmModal();
  const { user, currentProfile } = useAuthStore();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<CommunityTab>(
    initialTab === "my-feeds" || initialTab === "reviews"
      ? initialTab
      : "reviews",
  );
  const [scopeFilter, setScopeFilter] = useState<ScopeFilterType>("mine");
  const [sortType, setSortType] = useState<SortType>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<FeedView | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editContent, setEditContent] = useState("");
  const [editHasSpoiler, setEditHasSpoiler] = useState(false);
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editReviewSearch, setEditReviewSearch] = useState("");
  const [editSelectedReviewTags, setEditSelectedReviewTags] = useState<
    ReviewFinderOption[]
  >([]);
  const [editReviewSearchSubmitCount, setEditReviewSearchSubmitCount] =
    useState(0);
  const [editSearchMediaOptions, setEditSearchMediaOptions] = useState<
    FeedMediaOption[]
  >([]);
  const [editIsSearchingMedia, setEditIsSearchingMedia] = useState(false);
  const [editMediaSearchError, setEditMediaSearchError] = useState("");
  const [editSelectedMedia, setEditSelectedMedia] =
    useState<FeedMediaOption | null>(null);

  const { reviews, fetchAllReviews } = useCommunityStore();
  const { feeds, onDeleteFeed, onHydrateFeeds, onUpdateFeed } = useFeedStore();

  // const currentUserId = getUserId(user);
  // const likedReviewKeys = currentProfile?.community?.reviews ?? [];
  // const likedFeedIds = currentProfile?.community?.likedfeeds ?? [];
  // const followingIds = currentProfile?.community?.following ?? [];

  useEffect(() => {
    if (!user) return;

    void fetchAllReviews();
    void onHydrateFeeds();
  }, [fetchAllReviews, onHydrateFeeds, user]);

  useEffect(() => {
    const keyword = editReviewSearch.trim();

    if (!editingFeed || (!keyword && editSelectedReviewTags.length === 0)) {
      return;
    }

    if (!TMDB_KEY) {
      const timeoutId = window.setTimeout(() => {
        setEditSearchMediaOptions([]);
        setEditIsSearchingMedia(false);
        setEditMediaSearchError("검색 설정을 확인해 주세요.");
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setEditIsSearchingMedia(true);
      setEditMediaSearchError("");

      const commonParams = {
        api_key: TMDB_KEY,
        language: "ko-KR",
        include_adult: "false",
        page: "1",
      };

      const keywordRequest = keyword
        ? (() => {
            const params = new URLSearchParams({
              ...commonParams,
              query: keyword,
            });

            return fetch(
              `https://api.themoviedb.org/3/search/multi?${params.toString()}`,
              { signal: abortController.signal },
            )
              .then((response) => {
                if (!response.ok) throw new Error("Failed to search media.");
                return response.json();
              })
              .then((data: { results?: TmdbMultiSearchItem[] }) =>
                (data.results || [])
                  .map((item) => makeSearchMediaOption(item))
                  .filter((item): item is FeedMediaOption => Boolean(item)),
              );
          })()
        : Promise.resolve<FeedMediaOption[]>([]);

      const tagRequest =
        editSelectedReviewTags.length > 0
          ? Promise.all(
              (["movie", "tv"] as const).map((mediaType) => {
                const tagQuery = getCombinedReviewTagQuery(
                  editSelectedReviewTags,
                  mediaType,
                );
                const params = new URLSearchParams({
                  ...commonParams,
                  ...tagQuery,
                  sort_by: "popularity.desc",
                  "vote_count.gte": "80",
                });

                return fetch(
                  `https://api.themoviedb.org/3/discover/${mediaType}?${params.toString()}`,
                  { signal: abortController.signal },
                )
                  .then((response) => {
                    if (!response.ok)
                      throw new Error("Failed to search tagged media.");
                    return response.json();
                  })
                  .then((data: { results?: TmdbMultiSearchItem[] }) =>
                    (data.results || [])
                      .map((item) => makeSearchMediaOption(item, mediaType))
                      .filter((item): item is FeedMediaOption => Boolean(item)),
                  );
              }),
            ).then((results) => results.flat())
          : Promise.resolve<FeedMediaOption[]>([]);

      Promise.all([keywordRequest, tagRequest])
        .then(([keywordOptions, tagOptions]) => {
          const nextOptions =
            keyword && editSelectedReviewTags.length > 0
              ? keywordOptions.filter((item) =>
                  new Set(
                    tagOptions.map(
                      (option) => `${option.mediaType}-${option.id}`,
                    ),
                  ).has(`${item.mediaType}-${item.id}`),
                )
              : [...keywordOptions, ...tagOptions];

          const uniqueOptions = Array.from(
            new Map(
              nextOptions.map((item) => [`${item.mediaType}-${item.id}`, item]),
            ).values(),
          );

          setEditSearchMediaOptions(uniqueOptions);
          setEditMediaSearchError("");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setEditSearchMediaOptions([]);
          setEditMediaSearchError(
            "검색 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
          );
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setEditIsSearchingMedia(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [
    editReviewSearch,
    editReviewSearchSubmitCount,
    editSelectedReviewTags,
    editingFeed,
  ]);

  // const visibleReviews = reviews.filter((review) => (review.reportsCount ?? 0) <= 5);
  // const reviewBuckets = {
  //   mine: visibleReviews.filter(
  //     (review) =>
  //       review.userId === currentUserId &&
  //       (!currentProfile?.id || review.profileId === currentProfile.id),
  //   ),
  //   liked: visibleReviews.filter((review) => likedReviewKeys.includes(getReviewKey(review))),
  //   following: visibleReviews.filter((review) => Boolean(review.userId && followingIds.includes(review.userId))),
  // };

  // const feedBuckets = {
  //   mine: feeds.filter(
  //     (feed) =>
  //       feed.userId === currentUserId &&
  //       (!currentProfile?.id || feed.profileId === currentProfile.id),
  //   ),
  //   liked: feeds.filter(
  //     (feed) =>
  //       likedFeedIds.includes(feed.feedId) ||
  //       feed.liked ||
  //       feed.likedUserIds.includes(`${currentUserId}:${currentProfile?.id}`),
  //   ),
  //   following: feeds.filter((feed) => Boolean(feed.userId && followingIds.includes(feed.userId))),
  // };

  // const filteredReviews = reviewBuckets[scopeFilter];
  // const filteredFeeds = feedBuckets[scopeFilter];
  // const currentTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "커뮤니티 관리";
  // const currentSortLabel = sortOptions.find((option) => option.key === sortType)?.label;
  // const activeCount = activeTab === "reviews" ? filteredReviews.length : filteredFeeds.length;

  const handleEdit = (review: FeedView) => {
    setEditingFeed(review);
    setEditSelectedMedia(
      review.mediaId && review.mediaType && review.mediaTitle
        ? {
            id: review.mediaId,
            mediaType: review.mediaType,
            title: review.mediaTitle,
            posterPath: review.mediaPoster,
            meta: review.mediaMeta,
          }
        : null,
    );
    setEditReviewSearch(review.mediaTitle || "");
    setEditSelectedReviewTags([]);
    setEditSearchMediaOptions([]);
    setEditIsSearchingMedia(false);
    setEditMediaSearchError("");
    setEditRating(review.rating);
    setEditContent(review.content);
    setEditHasSpoiler(review.isSpoiler);
    setEditIsPublic(review.isPublic);
  };

  const closeEditModal = () => {
    setEditingFeed(null);
    setEditRating(0);
    setEditContent("");
    setEditHasSpoiler(false);
    setEditIsPublic(true);
    setEditReviewSearch("");
    setEditSelectedReviewTags([]);
    setEditReviewSearchSubmitCount(0);
    setEditSearchMediaOptions([]);
    setEditIsSearchingMedia(false);
    setEditMediaSearchError("");
    setEditSelectedMedia(null);
  };

  const handleSubmitFeedEdit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (
      !editingFeed ||
      (editingFeed.postType !== "general" &&
        (!editSelectedMedia || editRating <= 0)) ||
      !editContent.trim()
    )
      return;

    await onUpdateFeed({
      ...editingFeed,
      videoId: editSelectedMedia
        ? `${editSelectedMedia.mediaType}-${editSelectedMedia.id}`
        : undefined,
      rating: editingFeed.postType === "general" ? 0 : editRating,
      content: editContent.trim(),
      isSpoiler: editHasSpoiler,
      isPublic: editIsPublic,
    });
    await onHydrateFeeds();
    closeEditModal();
  };

  const handleChangeEditReviewSearch = (value: string) => {
    setEditReviewSearch(value);

    if (!value.trim() && editSelectedReviewTags.length === 0) {
      setEditSearchMediaOptions([]);
      setEditIsSearchingMedia(false);
      setEditMediaSearchError("");
    } else {
      setEditIsSearchingMedia(true);
      setEditMediaSearchError("");
    }
  };

  const handleSelectEditReviewTag = (option: ReviewFinderOption) => {
    setEditSelectedReviewTags((currentTags) =>
      currentTags.some((tag) => tag.value === option.value)
        ? currentTags.filter((tag) => tag.value !== option.value)
        : [...currentTags, option],
    );
    setEditSearchMediaOptions([]);
    setEditIsSearchingMedia(true);
    setEditMediaSearchError("");
  };

  const handleClearEditReviewTag = (tagValue: string) => {
    setEditSelectedReviewTags((currentTags) =>
      currentTags.filter((tag) => tag.value !== tagValue),
    );
    setEditSearchMediaOptions([]);
    setEditIsSearchingMedia(
      editReviewSearch.trim().length > 0 || editSelectedReviewTags.length > 1,
    );
    setEditMediaSearchError("");
  };

  const handleEditReviewSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    if (editReviewSearch.trim() || editSelectedReviewTags.length > 0) {
      setEditSearchMediaOptions([]);
      setEditIsSearchingMedia(true);
      setEditMediaSearchError("");
      setEditReviewSearchSubmitCount((count) => count + 1);
    }
  };

  const handleDelete = async (feedId: string) => {
    const confirmed = await confirm({
      title: "피드 삭제",
      message: "정말 삭제하시겠습니까?",
      confirmLabel: "삭제",
    });
    if (!confirmed) return;

    void onDeleteFeed(feedId);
  };

  return (
    <div className="media-list-page community-page feed-page">
      {confirmModal}
      <div className="community-inner">
        <BackButton fallback="/mypage" />

        <div className="community-header">
          <h1>커뮤니티 관리</h1>
          <p>내가 쓴 리뷰/피드</p>
        </div>

        <div className="community-tabs" aria-label="커뮤니티 메뉴">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                setScopeFilter("mine");
                setSortType("recent");
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!user ? (
          <div className="community-empty">
            <p className="empty-text">로그인이 필요한 페이지입니다.</p>
            <Link href="/login" className="empty-cta">
              로그인하기
            </Link>
          </div>
        ) : (
          <div className="tab-content-panel">
            {/* 3. 섹션 타이틀 및 총 개수 표시
            <div className="section-title-row">
              <h2>{currentTabLabel}</h2>
              <span className="total-count">{activeCount}개</span>
            </div>

            {/* 4. 스크린샷 스타일의 서브 툴바 (타원형 칩 필터 + 우측 정렬) */}
            {/* {activeTab !== "create-feed" && (
              <div className="community-toolbar">
                <div className="community-chips">
                  {scopeFilters.map((sf) => (
                    <button
                      type="button"
                      key={scope.key}
                      className={`chip ${scopeFilter === scope.key ? "is-active" : ""}`}
                      onClick={() => setScopeFilter(scope.key)}
                    >
                      {scope.label} {count}
                    </button>
                  );
                })}
              </div>
            )} */}

            {/* <div className="community-sort">
                <button type="button" className="sort-btn" onClick={() => setSortOpen((open) => !open)}>
                  {currentSortLabel}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={`sort-arrow ${sortOpen ? "is-open" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {sortOpen && (
                  <ul className="sort-menu">
                    {sortOptions
                      .filter((option) => !(activeTab === "reviews" && option.key === "comments"))
                      .map((option) => (
                        <li key={option.key}>
                          <button
                            type="button"
                            className={`sort-option ${sortType === option.key ? "is-selected" : ""}`}
                            onClick={() => {
                              setSortType(option.key);
                              setSortOpen(false);
                            }}
                          >
                            {option.label}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div> */}

            <div className="main-content-area">
              {activeTab === "reviews" && (
                <>
                  <Review
                  // sortType={sortType}
                  // scopeFilter={scopeFilter || "mine"}
                  />
                </>
              )}

              {activeTab === "my-feeds" && (
                <Feed
                  feeds={feeds}
                  sortType={sortType}
                  scopeFilter={scopeFilter}
                  onDeleteFeed={handleDelete}
                  onEditFeed={handleEdit}
                />
              )}
            </div>
          </div>
        )}
      </div>
      {editingFeed && (
        <div
          className="feed-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditModal();
          }}
        >
          <section
            className="feed-write-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-feed-edit-title"
          >
            <form onSubmit={handleSubmitFeedEdit}>
              <div className="feed-modal-head">
                <div>
                  <h3 id="community-feed-edit-title">게시물 수정</h3>
                  <p>{editingFeed.mediaTitle || "일반 게시물"}</p>
                </div>
                <button
                  type="button"
                  className="feed-modal-close"
                  onClick={closeEditModal}
                  aria-label="수정 닫기"
                >
                  ×
                </button>
              </div>

              <div className="feed-write-fields">
                <label className="feed-search-field">
                  <span>작품 검색</span>
                  <div className="feed-search-input">
                    {editSelectedReviewTags.map((selectedReviewTag) => (
                      <span
                        className="feed-selected-tag"
                        key={selectedReviewTag.value}
                      >
                        <img src={selectedReviewTag.icon} alt="" />
                        {selectedReviewTag.label}
                        <button
                          type="button"
                          onClick={() =>
                            handleClearEditReviewTag(selectedReviewTag.value)
                          }
                          aria-label={`${selectedReviewTag.label} 태그 삭제`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={editReviewSearch}
                      onChange={(event) =>
                        handleChangeEditReviewSearch(event.target.value)
                      }
                      onKeyDown={handleEditReviewSearchKeyDown}
                      placeholder={
                        editSelectedReviewTags.length > 0
                          ? ""
                          : "작품 제목을 입력해 주세요"
                      }
                    />
                    {editReviewSearch.trim().length > 0 && (
                      <button
                        type="button"
                        className="feed-search-clear"
                        onClick={() => handleChangeEditReviewSearch("")}
                        aria-label="검색어 지우기"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    )}
                  </div>
                </label>

                {(editReviewSearch.trim().length > 0 ||
                  editSelectedReviewTags.length > 0) && (
                  <div className="feed-search-results-wrap">
                    {editIsSearchingMedia && (
                      <p className="feed-media-status">검색 중...</p>
                    )}
                    {!editIsSearchingMedia && editMediaSearchError && (
                      <p className="feed-media-status is-error">
                        {editMediaSearchError}
                      </p>
                    )}
                    {!editIsSearchingMedia &&
                      !editMediaSearchError &&
                      editSearchMediaOptions.length === 0 && (
                        <p className="feed-media-status">
                          {editSelectedReviewTags.length > 0
                            ? "선택한 태그에 맞는 결과가 없어요."
                            : "검색 결과가 없어요."}
                        </p>
                      )}

                    {editSearchMediaOptions.length > 0 && (
                      <div className="feed-media-results">
                        {editSearchMediaOptions.map((item) => (
                          <button
                            type="button"
                            key={`${item.mediaType}-${item.id}`}
                            className={
                              editSelectedMedia?.id === item.id &&
                              editSelectedMedia.mediaType === item.mediaType
                                ? "selected"
                                : ""
                            }
                            onClick={() => setEditSelectedMedia(item)}
                          >
                            {item.posterPath ? (
                              <img src={getPosterUrl(item.posterPath)} alt="" />
                            ) : (
                              <span
                                className="feed-poster-fallback"
                                aria-hidden="true"
                              >
                                {item.title.slice(0, 1)}
                              </span>
                            )}
                            <span>
                              <strong>{item.title}</strong>
                              <em>{item.meta}</em>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(!editReviewSearch.trim() ||
                  editSelectedReviewTags.length > 0) && (
                  <div className="feed-review-finder">
                    <section>
                      <div className="feed-review-finder__header">
                        <strong>무드로 찾기</strong>
                        <span>오늘 보고 싶은 감정으로 골라보세요.</span>
                      </div>
                      <div className="feed-review-option-grid feed-review-option-grid--mood">
                        {reviewMoodOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={
                              editSelectedReviewTags.some(
                                (tag) => tag.value === option.value,
                              )
                                ? "selected"
                                : ""
                            }
                            aria-pressed={editSelectedReviewTags.some(
                              (tag) => tag.value === option.value,
                            )}
                            onClick={() => handleSelectEditReviewTag(option)}
                          >
                            <img src={option.icon} alt="" />
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="feed-review-finder__header">
                        <strong>장르로 찾기</strong>
                        <span>자주 찾는 장르를 빠르게 입력해요.</span>
                      </div>
                      <div className="feed-review-option-grid feed-review-option-grid--genre">
                        {reviewGenreOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className={
                              editSelectedReviewTags.some(
                                (tag) => tag.value === option.value,
                              )
                                ? "selected"
                                : ""
                            }
                            aria-pressed={editSelectedReviewTags.some(
                              (tag) => tag.value === option.value,
                            )}
                            onClick={() => handleSelectEditReviewTag(option)}
                          >
                            <img src={option.icon} alt="" />
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                <div className="feed-rating-field">
                  <span>별점</span>
                  <div className="feed-rating-control">
                    <div className="feed-rating-value">
                      <div className="feed-half-stars" aria-label="별점 선택">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            className="feed-half-star"
                            key={star}
                            onClick={() =>
                              setEditRating((currentRating) =>
                                getNextStarRating(currentRating, star),
                              )
                            }
                            aria-label={`${star}점 더블 클릭하면 ${star - 0.5}점`}
                            style={
                              {
                                "--fill": `${getStarFill(editRating, star)}%`,
                              } as React.CSSProperties
                            }
                          >
                            <span aria-hidden="true">★</span>
                          </button>
                        ))}
                      </div>
                      <em>{editRating.toFixed(1)} / 5.0</em>
                    </div>
                  </div>
                </div>

                <label className="feed-review-field">
                  <span>내용</span>
                  <textarea
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    placeholder="내용을 작성해 주세요"
                  />
                </label>

                <div className="feed-write-toggles">
                  <button
                    type="button"
                    className={editHasSpoiler ? "active" : ""}
                    onClick={() => setEditHasSpoiler((value) => !value)}
                    aria-pressed={editHasSpoiler}
                  >
                    스포일러
                  </button>
                  <button
                    type="button"
                    className={editIsPublic ? "active" : ""}
                    onClick={() => setEditIsPublic((value) => !value)}
                    aria-pressed={editIsPublic}
                  >
                    커뮤니티 공개
                  </button>
                </div>
              </div>

              <div className="feed-modal-actions">
                <button
                  type="button"
                  className="feed-cancel-btn"
                  onClick={closeEditModal}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="feed-submit-btn"
                  disabled={
                    !editSelectedMedia || editRating <= 0 || !editContent.trim()
                  }
                >
                  수정
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
