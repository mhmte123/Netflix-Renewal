"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase/firebase";
import { useConfirmModal } from "@/components/common/ConfirmModal";
import { useAuthStore } from "@/store/useAuthStore";
import { type FeedView, useFeedStore } from "@/store/useFeedStore";
import { showToast } from "@/store/useToastStore";
import {
  FeedMediaOption,
  type FeedCategory,
  type FeedPostType,
  FeedReview,
  FeedTab,
  FEED_CATEGORY_LABELS,
  REPORT_REASONS,
  getInitial,
  getRelativeTime,
  getPosterUrl,
  parseFeedMediaMeta,
} from "@/types/feedData";
import { BADGE_LIST } from "@/data/badge";
import FeedAuthorBadges from "@/components/feed/FeedAuthorBadges";
import AppIcon from "@/components/common/AppIcon";
import "@/components/common/wishlistButton.scss";
import "../scss/feed.scss";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
type FeedContentFilter = "all" | "general" | "media" | FeedCategory;

const feedCategoryOptions: { value: FeedCategory; label: string }[] = [
  { value: "discussion", label: "토론" },
  { value: "question", label: "질문" },
  { value: "daily", label: "일상" },
  { value: "watch-party", label: "같이보기" },
];

const feedContentFilters: { value: FeedContentFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "general", label: "일반" },
  { value: "media", label: "작품" },
  { value: "discussion", label: "토론" },
  { value: "question", label: "질문" },
  { value: "daily", label: "일상" },
  { value: "watch-party", label: "같이보기" },
];
const GENRE_LABELS: Record<string, string> = {
  "12": "모험",
  "14": "판타지",
  "16": "애니",
  "18": "드라마",
  "27": "호러",
  "28": "액션",
  "35": "코미디",
  "36": "역사",
  "53": "스릴러",
  "80": "범죄",
  "99": "다큐",
  "878": "SF",
  "9648": "미스터리",
  "10402": "음악",
  "10749": "로맨스",
  "10751": "가족",
  "10752": "전쟁",
  "10759": "액션",
  "10762": "키즈",
  "10764": "리얼리티",
  "10765": "SF",
  "10766": "연속극",
  "10768": "전쟁",
};

type ReviewFinderOption = {
  label: string;
  value: string;
  icon: string;
  group: "mood" | "genre";
  query: Record<string, string>;
  tvQuery?: Record<string, string>;
};

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

const reviewMoodOptions: ReviewFinderOption[] = [
  {
    label: "힐링",
    value: "chill",
    icon: "/images/header/menu/mood-chill.svg",
    group: "mood",
    query: { with_genres: "18,10749" },
    tvQuery: { with_genres: "18" },
  },
  {
    label: "다크",
    value: "dark",
    icon: "/images/header/menu/mood-dark.svg",
    group: "mood",
    query: { with_genres: "53,9648" },
    tvQuery: { with_genres: "80,9648" },
  },
  {
    label: "감성적",
    value: "emotional",
    icon: "/images/header/menu/mood-emotional.svg",
    group: "mood",
    query: { with_genres: "18,10749" },
  },
  {
    label: "신나는",
    value: "exciting",
    icon: "/images/header/menu/mood-exciting.svg",
    group: "mood",
    query: { with_genres: "28,12" },
    tvQuery: { with_genres: "10759,10765" },
  },
  {
    label: "웃긴",
    value: "funny",
    icon: "/images/header/menu/mood-funny.svg",
    group: "mood",
    query: { with_genres: "35" },
  },
  {
    label: "로맨틱",
    value: "romantic",
    icon: "/images/header/menu/mood-romantic.svg",
    group: "mood",
    query: { with_genres: "10749,35" },
    tvQuery: { with_genres: "10749" },
  },
  {
    label: "무서운",
    value: "scary",
    icon: "/images/header/menu/mood-scary.svg",
    group: "mood",
    query: { with_genres: "27" },
    tvQuery: { with_genres: "9648" },
  },
  {
    label: "생각나는",
    value: "thoughtful",
    icon: "/images/header/menu/mood-thoughtful.svg",
    group: "mood",
    query: { with_genres: "18,99" },
  },
];

const reviewGenreOptions: ReviewFinderOption[] = [
  {
    label: "액션",
    value: "action",
    icon: "/images/header/menu/genre-action.svg",
    group: "genre",
    query: { with_genres: "28" },
    tvQuery: { with_genres: "10759" },
  },
  {
    label: "애니메이션",
    value: "animation",
    icon: "/images/header/menu/genre-animation.svg",
    group: "genre",
    query: { with_genres: "16" },
    tvQuery: { with_genres: "16" },
  },
  {
    label: "코미디",
    value: "comedy",
    icon: "/images/header/menu/genre-comedy.svg",
    group: "genre",
    query: { with_genres: "35" },
  },
  {
    label: "다큐멘터리",
    value: "documentary",
    icon: "/images/header/menu/genre-documentary.svg",
    group: "genre",
    query: { with_genres: "99" },
    tvQuery: { with_genres: "99" },
  },
  {
    label: "드라마",
    value: "drama",
    icon: "/images/header/menu/genre-drama.svg",
    group: "genre",
    query: { with_genres: "18" },
  },
  {
    label: "판타지",
    value: "fantasy",
    icon: "/images/header/menu/genre-fantasy.svg",
    group: "genre",
    query: { with_genres: "14" },
    tvQuery: { with_genres: "10765" },
  },
  {
    label: "공포",
    value: "horror",
    icon: "/images/header/menu/genre-horror.svg",
    group: "genre",
    query: { with_genres: "27" },
    tvQuery: { with_genres: "9648" },
  },
  {
    label: "미스터리",
    value: "mystery",
    icon: "/images/header/menu/genre-mystery.svg",
    group: "genre",
    query: { with_genres: "9648" },
    tvQuery: { with_genres: "9648" },
  },
  {
    label: "로맨스",
    value: "romance",
    icon: "/images/header/menu/genre-romance.svg",
    group: "genre",
    query: { with_genres: "10749" },
  },
  {
    label: "SF",
    value: "scifi",
    icon: "/images/header/menu/genre-scifi.svg",
    group: "genre",
    query: { with_genres: "878" },
    tvQuery: { with_genres: "10765" },
  },
  {
    label: "스릴러",
    value: "thriller",
    icon: "/images/header/menu/genre-thriller.svg",
    group: "genre",
    query: { with_genres: "53" },
    tvQuery: { with_genres: "9648" },
  },
  {
    label: "전쟁",
    value: "war",
    icon: "/images/header/menu/genre-war.svg",
    group: "genre",
    query: { with_genres: "10752" },
    tvQuery: { with_genres: "10768" },
  },
];

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
      ? ` · 평균 ${(item.vote_average / 2).toFixed(1)}`
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
    const tagQuery =
      mediaType === "tv" && tag.tvQuery ? tag.tvQuery : tag.query;

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

const renderRatingStars = (rating: number) => (
  <span className="rating-stars" aria-label={`${rating.toFixed(1)}점`}>
    {[1, 2, 3, 4, 5].map((star) => {
      const fillPercent = Math.max(0, Math.min(1, rating - (star - 1))) * 100;

      return (
        <span
          className="rating-star"
          key={star}
          style={{ "--fill": `${fillPercent}%` } as React.CSSProperties}
          aria-hidden="true"
        >
          ★
        </span>
      );
    })}
  </span>
);

const getStarFill = (rating: number, star: number) =>
  Math.max(0, Math.min(1, rating - (star - 1))) * 100;

const getCommentContent = (content: unknown) => {
  if (typeof content === "string") return content;
  if (
    typeof content === "object" &&
    content !== null &&
    "content" in content &&
    typeof (content as { content?: unknown }).content === "string"
  ) {
    return (content as { content: string }).content;
  }

  return "";
};

const getUserProfileHref = (userId?: string, profileId?: number) => {
  if (!userId) return "";

  const params = new URLSearchParams();
  if (profileId != null) params.set("profileId", String(profileId));

  const query = params.toString();
  return `/users/${userId}${query ? `?${query}` : ""}`;
};

export default function FeedPage() {
  const router = useRouter();
  const { confirm, modal: confirmModal } = useConfirmModal();
  const { user, currentProfile, updateUserLikeFeeds, updateUserCommentFeed } =
    useAuthStore();
  const {
    feeds,
    onAddComment,
    onAddFeed,
    onDeleteComment,
    onDeleteFeed,
    onHydrateFeeds,
    onReportFeed,
    onToggleCommentLike,
    onToggleLike,
    onUpdateComment,
    onUpdateFeed,
  } = useFeedStore();
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [contentFilter, setContentFilter] =
    useState<FeedContentFilter>("all");
  const [visibleSpoilerReviewIds, setVisibleSpoilerReviewIds] = useState<
    string[]
  >([]);
  const [reportedReviewIds, setReportedReviewIds] = useState<string[]>([]);
  const [reportTargetReviewId, setReportTargetReviewId] = useState<
    string | null
  >(null);
  const [selectedReportReason, setSelectedReportReason] = useState("");
  const [copiedReviewId, setCopiedReviewId] = useState<string | null>(null);
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [newPostType, setNewPostType] = useState<FeedPostType>("general");
  const [newCategory, setNewCategory] =
    useState<FeedCategory>("discussion");
  const [commentTargetReviewId, setCommentTargetReviewId] = useState<
    string | null
  >(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [selectedReviewTags, setSelectedReviewTags] = useState<
    ReviewFinderOption[]
  >([]);
  const [reviewSearchSubmitCount, setReviewSearchSubmitCount] = useState(0);
  const [searchMediaOptions, setSearchMediaOptions] = useState<
    FeedMediaOption[]
  >([]);
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);
  const [mediaSearchError, setMediaSearchError] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<FeedMediaOption | null>(
    null,
  );
  const [newRating, setNewRating] = useState(0);
  const [newHoverRating, setNewHoverRating] = useState(0);
  const [newReviewText, setNewReviewText] = useState("");
  const [newHasSpoiler, setNewHasSpoiler] = useState(false);
  const [newIsPublic, setNewIsPublic] = useState(true);
  const currentUserId =
    user?.userId ||
    (user as { uid?: string } | null)?.uid ||
    auth.currentUser?.uid;
  const isReviewOwner = (
    review: Pick<FeedView, "author" | "isMine" | "profileId" | "userId">,
  ) => {
    if (review.isMine) return true;

    const profileMatches =
      currentProfile?.id == null ||
      review.profileId == null ||
      String(review.profileId) === String(currentProfile.id);
    const userIdMatches = Boolean(
      currentUserId && review.userId === currentUserId,
    );
    const nicknameMatches = Boolean(
      currentProfile?.nickname && review.author === currentProfile.nickname,
    );

    return profileMatches && (userIdMatches || nicknameMatches);
  };

  const closeWriteModal = useCallback(() => {
    setWriteModalOpen(false);
    setEditingReviewId(null);
    setNewPostType("general");
    setNewCategory("discussion");
    setReviewSearch("");
    setSelectedReviewTags([]);
    setSearchMediaOptions([]);
    setIsSearchingMedia(false);
    setMediaSearchError("");
    setSelectedMedia(null);
    setNewRating(0);
    setNewHoverRating(0);
    setNewReviewText("");
    setNewHasSpoiler(false);
    setNewIsPublic(true);
  }, []);

  const closeCommentModal = useCallback(() => {
    setCommentTargetReviewId(null);
    setEditingCommentId(null);
    setCommentText("");
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    void onHydrateFeeds();
  }, [currentProfile?.id, currentUserId, onHydrateFeeds]);

  // useEffect(() => {
  //   const reportedFeedIds = (currentProfile?.community?.reportfeeds || [])
  //     .filter((activity) => activity.type === "report")
  //     .map((activity) => activity.feedId);
  //   const timeoutId = window.setTimeout(() => {
  //     setReportedReviewIds([...new Set(reportedFeedIds)]);
  //   }, 0);

  //   return () => window.clearTimeout(timeoutId);
  // }, [currentProfile?.community?.feeds]);

  useEffect(() => {
    if (!writeModalOpen && !commentTargetReviewId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeWriteModal();
        closeCommentModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeCommentModal,
    closeWriteModal,
    commentTargetReviewId,
    writeModalOpen,
  ]);

  useEffect(() => {
    const keyword = reviewSearch.trim();

    if (!writeModalOpen || (!keyword && selectedReviewTags.length === 0)) {
      return;
    }

    if (!TMDB_KEY) {
      const timeoutId = window.setTimeout(() => {
        setSearchMediaOptions([]);
        setIsSearchingMedia(false);
        setMediaSearchError("검색 설정을 확인해 주세요.");
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsSearchingMedia(true);
      setMediaSearchError("");

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
              {
                signal: abortController.signal,
              },
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
        selectedReviewTags.length > 0
          ? Promise.all(
              (["movie", "tv"] as const).map((mediaType) => {
                const tagQuery = getCombinedReviewTagQuery(
                  selectedReviewTags,
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
                  {
                    signal: abortController.signal,
                  },
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

      const searchRequest = Promise.all([keywordRequest, tagRequest]).then(
        ([keywordOptions, tagOptions]) => {
          if (keyword && selectedReviewTags.length > 0) {
            const taggedOptionKeys = new Set(
              tagOptions.map((item) => `${item.mediaType}-${item.id}`),
            );

            return keywordOptions.filter((item) =>
              taggedOptionKeys.has(`${item.mediaType}-${item.id}`),
            );
          }

          return [...keywordOptions, ...tagOptions];
        },
      );

      searchRequest
        .then((nextOptions) => {
          const uniqueOptions = Array.from(
            new Map(
              nextOptions.map((item) => [`${item.mediaType}-${item.id}`, item]),
            ).values(),
          );

          setSearchMediaOptions(uniqueOptions);
          setMediaSearchError("");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
          setSearchMediaOptions([]);
          setMediaSearchError(
            "검색 결과를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
          );
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setIsSearchingMedia(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [
    reviewSearch,
    reviewSearchSubmitCount,
    selectedReviewTags,
    writeModalOpen,
  ]);

  const hasReviewSearchKeyword =
    reviewSearch.trim().length > 0 || selectedReviewTags.length > 0;

  const handleChangeReviewSearch = (value: string) => {
    setReviewSearch(value);

    if (!value.trim() && selectedReviewTags.length === 0) {
      setSearchMediaOptions([]);
      setIsSearchingMedia(false);
      setMediaSearchError("");
    } else {
      setIsSearchingMedia(true);
      setMediaSearchError("");
    }
  };

  const handleSelectReviewTag = (option: ReviewFinderOption) => {
    setSelectedReviewTags((currentTags) =>
      currentTags.some((tag) => tag.value === option.value)
        ? currentTags.filter((tag) => tag.value !== option.value)
        : [...currentTags, option],
    );
    setSearchMediaOptions([]);
    setIsSearchingMedia(true);
    setMediaSearchError("");
  };

  const handleClearReviewTag = (tagValue: string) => {
    setSelectedReviewTags((currentTags) =>
      currentTags.filter((tag) => tag.value !== tagValue),
    );
    setSearchMediaOptions([]);
    setIsSearchingMedia(
      reviewSearch.trim().length > 0 || selectedReviewTags.length > 1,
    );
    setMediaSearchError("");
  };

  const handleReviewSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    if (reviewSearch.trim() || selectedReviewTags.length > 0) {
      setSearchMediaOptions([]);
      setIsSearchingMedia(true);
      setMediaSearchError("");
      setReviewSearchSubmitCount((count) => count + 1);
    }
  };

  const relationshipFilteredReviews =
    activeTab === "all" ? feeds : feeds.filter((review) => review.isFollowing);
  const filteredReviews = relationshipFilteredReviews.filter((review) => {
    if (contentFilter === "all") return true;
    if (contentFilter === "general") return !review.videoId;
    if (contentFilter === "media") return Boolean(review.videoId);
    return review.category === contentFilter;
  });

  const selectedCommentReview =
    feeds.find((review) => review.feedId === commentTargetReviewId) ?? null;
  const myProfileReviews = feeds.filter((review) => isReviewOwner(review));
  const profileReviewCount = myProfileReviews.length;
  const averageRating =
    profileReviewCount > 0
      ? myProfileReviews.reduce((total, review) => total + review.rating, 0) /
        profileReviewCount
      : 0;
  const profileName =
    currentProfile?.nickname || user?.email?.split("@")[0] || "Netflixer";
  const profileImage = currentProfile?.imgUrl;
  const followerCount = currentProfile?.community?.followers?.length ?? 0;
  const followingCount = currentProfile?.community?.following?.length ?? 0;
  const equippedBadge =
    BADGE_LIST.find(
      (badge) => badge.id === currentProfile?.badges?.equippedBadges,
    ) ?? BADGE_LIST.find((badge) => badge.id === "first_streaming");
  const completedBadgeCount =
    currentProfile?.badges?.earnedBadges?.filter((badge) => badge.isComplete)
      .length ?? 0;
  const tasteTags = Object.entries(currentProfile?.movies?.genreStats ?? {})
    .sort(([, firstCount], [, secondCount]) => secondCount - firstCount)
    .slice(0, 2)
    .map(([genreId]) => GENRE_LABELS[genreId] ?? "취향");

  const requireFeedAuth = () => {
    if (!currentUserId) {
      showToast("로그인이 필요합니다.");
      router.push("/login");
      return false;
    }
    if (!currentProfile) {
      showToast("프로필을 선택해 주세요.");
      return false;
    }

    return true;
  };

  const handleLike = (feedId: string) => {
    if (!requireFeedAuth()) return;

    void onToggleLike(feedId);
    updateUserLikeFeeds(feedId);
  };

  const handleOpenCommentModal = (reviewId: string) => {
    if (!requireFeedAuth()) return;

    setCommentTargetReviewId(reviewId);
  };

  const handleOpenReportReview = async (review: FeedView) => {
    if (!requireFeedAuth()) return;
    if (isReviewOwner(review)) return;

    if (reportedReviewIds.includes(review.feedId)) {
      await onReportFeed(review.feedId, false);
      setReportedReviewIds((prev) =>
        prev.filter((reviewId) => reviewId !== review.feedId),
      );
      if (reportTargetReviewId === review.feedId) {
        setReportTargetReviewId(null);
      }
      setSelectedReportReason("");
      showToast("신고가 취소되었습니다");
      return;
    }

    setReportTargetReviewId((currentId) =>
      currentId === review.feedId ? null : review.feedId,
    );
    setSelectedReportReason("");
  };

  const handleSubmitReportReview = async () => {
    if (!requireFeedAuth()) return;
    if (!reportTargetReviewId || !selectedReportReason) return;

    await onReportFeed(reportTargetReviewId, true, selectedReportReason);
    setReportedReviewIds((prev) =>
      prev.includes(reportTargetReviewId)
        ? prev
        : [...prev, reportTargetReviewId],
    );
    setReportTargetReviewId(null);
    setSelectedReportReason("");
    showToast("신고되었습니다");
  };

  const handleCopyShareLink = (reviewId: string) => {
    const shareUrl = `${window.location.origin}/feed/${reviewId}`;

    setCopiedReviewId(reviewId);
    window.setTimeout(() => setCopiedReviewId(null), 1600);
    void navigator.clipboard.writeText(shareUrl);
  };

  const handleCopyProfileLink = () => {
    if (!currentUserId) {
      showToast("로그인이 필요합니다.");
      return;
    }

    const params = new URLSearchParams();
    if (currentProfile?.id != null) {
      params.set("profileId", String(currentProfile.id));
    }

    const profileUrl = `${window.location.origin}/users/${currentUserId}${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    void navigator.clipboard?.writeText(profileUrl);
    showToast("프로필 링크가 복사되었습니다");
  };

  const handleOpenEditReview = (review: FeedView) => {
    setEditingReviewId(review.feedId);
    setNewPostType(review.postType === "general" ? "general" : "media");
    setNewCategory(
      review.category === "recommendation"
        ? "discussion"
        : review.category || "discussion",
    );
    setSelectedMedia(
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
    setReviewSearch(review.mediaTitle || "");
    setSelectedReviewTags([]);
    setNewRating(review.rating);
    setNewReviewText(review.content);
    setNewHasSpoiler(review.isSpoiler);
    setNewIsPublic(review.isPublic);
    setWriteModalOpen(true);
  };

  const handleSubmitComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCommentReview || !commentText.trim()) return;
    if (!requireFeedAuth()) return;
    if (!currentUserId || !currentProfile) return;

    if (editingCommentId) {
      void onUpdateComment(
        selectedCommentReview.feedId,
        editingCommentId,
        commentText.trim(),
      );
      setEditingCommentId(null);
      setCommentText("");
      return;
    }

    const now = new Date().toISOString();
    const nextComment = {
      commentId: "",
      userId: currentUserId,
      profileId: currentProfile.id,
      content: commentText.trim(),
      reportsCount: 0,
      likesCount: 0,
      likedUserIds: [],
      createdAt: now,
      updatedAt: now,
      isDelete: false,
    };

    void onAddComment(selectedCommentReview.feedId, nextComment);
    setCommentText("");
  };

  const handleOpenEditComment = (commentId: string, text: string) => {
    setEditingCommentId(commentId);
    setCommentText(text);
  };

  const handleDeleteComment = (reviewId: string, commentId: string) => {
    void onDeleteComment(reviewId, commentId);
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setCommentText("");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    const confirmed = await confirm({
      title: "게시물 삭제",
      message: "정말 삭제하시겠습니까?",
      confirmLabel: "삭제",
    });
    if (!confirmed) return;

    await onDeleteFeed(reviewId);
    showToast("게시물이 삭제되었습니다");
  };

  const handleToggleCommentLike = (reviewId: string, commentId: string) => {
    if (!requireFeedAuth()) return;

    void onToggleCommentLike(reviewId, commentId);
    updateUserCommentFeed(reviewId, commentId);
  };

  const handleSubmitReview = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const isMediaPost = newPostType === "media";
    if (!newReviewText.trim()) return;
    if (isMediaPost && (!selectedMedia || newRating === 0)) return;
    if (!requireFeedAuth()) return;
    if (!currentUserId || !currentProfile) return;

    const editingReview = editingReviewId
      ? feeds.find((review) => review.feedId === editingReviewId)
      : null;

    if (editingReview) {
      await onUpdateFeed({
        ...editingReview,
        postType: newPostType,
        category: isMediaPost ? undefined : newCategory,
        videoId: selectedMedia
          ? `${selectedMedia.mediaType}-${selectedMedia.id}`
          : undefined,
        rating: isMediaPost ? newRating : 0,
        content: newReviewText.trim(),
        isSpoiler: isMediaPost ? newHasSpoiler : false,
        isPublic: newIsPublic,
      });
      await onHydrateFeeds();
      closeWriteModal();
      showToast("게시물이 수정되었습니다");
      return;
    }

    const nextReview: FeedReview = {
      feedId: "",
      userId: currentUserId,
      profileId: currentProfile.id,
      postType: newPostType,
      category: isMediaPost ? undefined : newCategory,
      videoId: selectedMedia
        ? `${selectedMedia.mediaType}-${selectedMedia.id}`
        : undefined,
      content: newReviewText.trim(),
      likesCount: 0,
      reportsCount: 0,
      createdAt: new Date().toISOString(),
      rating: isMediaPost ? newRating : 0,
      isSpoiler: isMediaPost ? newHasSpoiler : false,
      isPublic: newIsPublic,
      likedUserIds: [],
    };

    await onAddFeed(nextReview);
    closeWriteModal();
    showToast("게시물이 등록되었습니다");
  };

  const renderWriteModal = () => {
    if (!writeModalOpen) return null;

    return (
      <div
        className="feed-modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeWriteModal();
          }
        }}
      >
        <section
          className="feed-write-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feed-write-title"
        >
          <form onSubmit={handleSubmitReview}>
            <div className="feed-modal-head">
              <div>
                <h3 id="feed-write-title">
                  {editingReviewId ? "게시물 수정" : "게시물 작성"}
                </h3>
                <p>
                  {newPostType === "media"
                    ? "작품을 선택하고 감상을 남겨보세요."
                    : "말머리를 고르고 자유롭게 이야기를 나눠보세요."}
                </p>
              </div>
              <button
                type="button"
                className="feed-modal-close"
                onClick={closeWriteModal}
                aria-label="게시물 작성 닫기"
              >
                ×
              </button>
            </div>

            <div className="feed-write-fields">
              <div
                className="feed-write-type-tabs"
                role="tablist"
                aria-label="게시물 유형"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={newPostType === "general"}
                  className={newPostType === "general" ? "active" : ""}
                  onClick={() => setNewPostType("general")}
                >
                  일반 게시물
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={newPostType === "media"}
                  className={newPostType === "media" ? "active" : ""}
                  onClick={() => setNewPostType("media")}
                >
                  작품 게시물
                </button>
              </div>

              {newPostType === "general" && (
                <div className="feed-category-field">
                  <span>말머리</span>
                  <div className="feed-category-options">
                    {feedCategoryOptions.map(({ value, label }) => (
                      <button
                        type="button"
                        key={value}
                        className={newCategory === value ? "active" : ""}
                        aria-pressed={newCategory === value}
                        onClick={() => setNewCategory(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="feed-search-field">
                <span>
                  {newPostType === "general"
                    ? "작품 태그 추가 (선택)"
                    : "작품 검색"}
                </span>
                <div className="feed-search-input">
                  {selectedReviewTags.map((selectedReviewTag) => (
                    <span
                      className="feed-selected-tag"
                      key={selectedReviewTag.value}
                    >
                      <img src={selectedReviewTag.icon} alt="" />
                      {selectedReviewTag.label}
                      <button
                        type="button"
                        onClick={() =>
                          handleClearReviewTag(selectedReviewTag.value)
                        }
                        aria-label={`${selectedReviewTag.label} 태그 삭제`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={reviewSearch}
                    onChange={(event) =>
                      handleChangeReviewSearch(event.target.value)
                    }
                    onKeyDown={handleReviewSearchKeyDown}
                    placeholder={
                      selectedReviewTags.length > 0
                        ? ""
                        : "작품 제목을 입력해 주세요"
                    }
                  />
                  {reviewSearch.trim().length > 0 && (
                    <button
                      type="button"
                      className="feed-search-clear"
                      onClick={() => handleChangeReviewSearch("")}
                      aria-label="검색어 지우기"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  )}
                </div>
              </label>

              {hasReviewSearchKeyword && (
                <div className="feed-search-results-wrap">
                  {isSearchingMedia && (
                    <p className="feed-media-status">검색 중...</p>
                  )}
                  {!isSearchingMedia && mediaSearchError && (
                    <p className="feed-media-status is-error">
                      {mediaSearchError}
                    </p>
                  )}
                  {!isSearchingMedia &&
                    !mediaSearchError &&
                    searchMediaOptions.length === 0 && (
                      <p className="feed-media-status">
                        {selectedReviewTags.length > 0
                          ? "선택한 태그에 맞는 결과가 없어요."
                          : "검색 결과가 없어요."}
                      </p>
                    )}

                  {searchMediaOptions.length > 0 && (
                    <div className="feed-media-results">
                      {searchMediaOptions.map((item) => (
                        <button
                          type="button"
                          key={`${item.mediaType}-${item.id}`}
                          className={
                            selectedMedia?.id === item.id &&
                            selectedMedia.mediaType === item.mediaType
                              ? "selected"
                              : ""
                          }
                          onClick={() => setSelectedMedia(item)}
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

              {newPostType === "media" &&
                (!reviewSearch.trim() || selectedReviewTags.length > 0) && (
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
                            selectedReviewTags.some(
                              (tag) => tag.value === option.value,
                            )
                              ? "selected"
                              : ""
                          }
                          aria-pressed={selectedReviewTags.some(
                            (tag) => tag.value === option.value,
                          )}
                          onClick={() => handleSelectReviewTag(option)}
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
                            selectedReviewTags.some(
                              (tag) => tag.value === option.value,
                            )
                              ? "selected"
                              : ""
                          }
                          aria-pressed={selectedReviewTags.some(
                            (tag) => tag.value === option.value,
                          )}
                          onClick={() => handleSelectReviewTag(option)}
                        >
                          <img src={option.icon} alt="" />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {newPostType === "media" && (
                <div className="feed-rating-field">
                <span>별점</span>
                <div className="feed-rating-control">
                  <div className="feed-rating-value">
                    <div
                      className="feed-half-stars"
                      aria-label="별점 선택"
                      onMouseLeave={() => setNewHoverRating(0)}
                    >
                      {[1, 2, 3, 4, 5].map((star) => {
                        const activeRating = newHoverRating || newRating;
                        return (
                          <span
                            className="feed-half-star"
                            key={star}
                            style={
                              {
                                "--fill": `${getStarFill(activeRating, star)}%`,
                              } as React.CSSProperties
                            }
                          >
                            <span aria-hidden="true">★</span>
                            <button
                              type="button"
                              className="feed-half-star__hit feed-half-star__hit--left"
                              onMouseEnter={() => setNewHoverRating(star - 0.5)}
                              onFocus={() => setNewHoverRating(star - 0.5)}
                              onBlur={() => setNewHoverRating(0)}
                              onClick={() => setNewRating(star - 0.5)}
                              aria-label={`${star - 0.5}점`}
                            />
                            <button
                              type="button"
                              className="feed-half-star__hit feed-half-star__hit--right"
                              onMouseEnter={() => setNewHoverRating(star)}
                              onFocus={() => setNewHoverRating(star)}
                              onBlur={() => setNewHoverRating(0)}
                              onClick={() => setNewRating(star)}
                              aria-label={`${star}점`}
                            />
                          </span>
                        );
                      })}
                    </div>
                    <em>{(newHoverRating || newRating).toFixed(1)} / 5.0</em>
                  </div>
                </div>
                </div>
              )}

              <label className="feed-review-field">
                <span>내용</span>
                <textarea
                  value={newReviewText}
                  onChange={(event) => setNewReviewText(event.target.value)}
                  placeholder="내용을 작성해 주세요"
                />
              </label>

              <div className="feed-write-toggles">
                {newPostType === "media" && (
                  <button
                    type="button"
                    className={newHasSpoiler ? "active" : ""}
                    onClick={() => setNewHasSpoiler((value) => !value)}
                    aria-pressed={newHasSpoiler}
                  >
                    스포일러
                  </button>
                )}
                <button
                  type="button"
                  className={newIsPublic ? "active" : ""}
                  onClick={() => setNewIsPublic((value) => !value)}
                  aria-pressed={newIsPublic}
                >
                  {/* {newIsPublic ? "커뮤니티 공개" : "비공개"} */}
                  커뮤니티 공개
                </button>
              </div>
            </div>

            <div className="feed-modal-actions">
              <button
                type="button"
                className="feed-cancel-btn"
                onClick={closeWriteModal}
              >
                취소
              </button>
              <button
                type="submit"
                className="feed-submit-btn"
                disabled={
                  !newReviewText.trim() ||
                  (newPostType === "media" &&
                    (!selectedMedia || newRating === 0))
                }
              >
                {editingReviewId ? "수정" : "등록"}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  };

  const renderCommentModal = () => {
    if (!selectedCommentReview) return null;

    const commentsList = Array.isArray(selectedCommentReview.commentsList)
      ? selectedCommentReview.commentsList
      : [];

    return (
      <div
        className="feed-modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeCommentModal();
          }
        }}
      >
        <section
          className="feed-comment-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feed-comment-title"
        >
          <div className="feed-modal-head">
            <div>
              <h3 id="feed-comment-title">댓글</h3>
              <p>
                {selectedCommentReview.mediaTitle
                  ? `“${selectedCommentReview.mediaTitle}” 게시물에 남긴 의견`
                  : "게시물에 남긴 의견"}
              </p>
            </div>
            <button
              type="button"
              className="feed-modal-close"
              onClick={closeCommentModal}
              aria-label="댓글 닫기"
            >
              ×
            </button>
          </div>

          <div className="comment-list">
            {commentsList.length > 0 ? (
              commentsList.map((comment) => (
                <div className="comment-item" key={comment.commentId}>
                  <Link
                    href={getUserProfileHref(comment.userId, comment.profileId)}
                    className="comment-avatar profile-avatar-link"
                    aria-label={`${comment.author} 프로필 보기`}
                  >
                    {comment.authorImage ? (
                      <img src={comment.authorImage} alt="" />
                    ) : (
                      getInitial(comment.author)
                    )}
                  </Link>
                  <div className="comment-content">
                    <div className="comment-meta">
                      <strong>{comment.author}</strong>
                      <span>
                        {getRelativeTime(
                          comment.updatedAt || comment.createdAt,
                        )}
                      </span>
                    </div>
                    <p>{getCommentContent(comment.content)}</p>
                    <div className="comment-actions">
                      <button
                        type="button"
                        className={
                          comment.liked
                            ? "comment-like-btn liked"
                            : "comment-like-btn"
                        }
                        onClick={() =>
                          handleToggleCommentLike(
                            selectedCommentReview.feedId,
                            comment.commentId,
                          )
                        }
                        aria-pressed={comment.liked}
                      >
                        {comment.liked ? "♥" : "♡"} 좋아요 {comment.likesCount}
                      </button>
                      {comment.isMine && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenEditComment(
                                comment.commentId,
                                getCommentContent(comment.content),
                              )
                            }
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="comment-delete-btn"
                            onClick={() => {
                              handleDeleteComment(
                                selectedCommentReview.feedId,
                                comment.commentId,
                              );
                            }}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="comment-empty">
                <div className="empty-img">
                  <img src="/images/feed/empty-comment.svg" alt="." />
                </div>
                <div>아직 댓글이 없어요.</div>
              </div>
            )}
          </div>

          <form className="comment-write" onSubmit={handleSubmitComment}>
            <input
              type="text"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="댓글을 입력해 주세요"
            />
            <button type="submit" disabled={!commentText.trim()}>
              {editingCommentId ? "수정" : "등록"}
            </button>
          </form>
        </section>
      </div>
    );
  };

  return (
    <div className="feed-page">
      {confirmModal}
      <div className="inner">
        <div className="page-head feed-page-head">
          <div>
            <h1>피드</h1>
            <p>커뮤니티 게시물과 팔로우한 유저의 감상을 둘러보세요.</p>
          </div>
          {/* <button
            type="button"
            className="feed-write-btn"
            onClick={() => setWriteModalOpen(true)}
          >
            게시물 작성
          </button> */}
        </div>

        <div className="feed-layout">
          <aside className="feed-profile-panel" aria-label="프로필 정보">
            {!currentUserId ? (
              <div className="feed-profile-card feed-profile-card--guest">
                <div className="feed-profile-card__eyebrow">커뮤니티 피드</div>
                <div
                  className="feed-profile-card__guest-icon"
                  aria-hidden="true"
                >
                  N
                </div>
                <strong>
                  로그인하고 <br />
                  피드를 시작해 보세요
                </strong>
                <p className="feed-profile-card__guest-copy">
                  내 취향 리뷰를 남기고, 다른 이용자의 감상에 댓글로 참여할 수
                  있어요.
                </p>
                <div className="feed-profile-guest-actions">
                  <Link href="/login" className="feed-profile-login-btn">
                    로그인하러 가기
                  </Link>
                  <Link href="/signin" className="feed-profile-signup-btn">
                    회원가입
                  </Link>
                </div>
              </div>
            ) : (
              <div className="feed-profile-card">
                <div className="feed-profile-card__eyebrow">프로필 정보</div>
                <div className="feed-profile-identity">
                  <div className="feed-profile-card__avatar">
                    {profileImage ? (
                      <img src={profileImage} alt="" />
                    ) : (
                      getInitial(profileName)
                    )}
                  </div>
                  <div className="feed-profile-identity__meta">
                    <strong>{profileName}</strong>
                    <Link href="/goods" className="feed-profile-badge">
                      {equippedBadge?.imgUrl && (
                        <img src={equippedBadge.imgUrl} alt="" />
                      )}
                      <span>{equippedBadge?.name ?? "위대한 첫걸음"}</span>
                    </Link>
                    <div className="profile-meta-info">
                      <p className="follower-info">
                        팔로워 <span>{followerCount}</span>
                      </p>
                      <p className="following-info">
                        팔로잉 <span>{followingCount}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="feed-profile-stats">
                  <div>
                    <b>{averageRating.toFixed(1)}</b>
                    <span>평균 별점</span>
                  </div>
                  <Link href="/mypage/community?tab=my-feeds">
                    <b>{profileReviewCount}</b>
                    <span>피드</span>
                  </Link>
                  <Link href="/goods">
                    <b>{completedBadgeCount}</b>
                    <span>뱃지</span>
                  </Link>
                </div>
                <div className="feed-profile-taste-tags">
                  {tasteTags.length > 0 ? (
                    tasteTags.map((tag) => <span key={tag}>#{tag} 취향</span>)
                  ) : (
                    <span>#취향 수집중</span>
                  )}
                </div>
                <div className="feed-profile-nav">
                  <div className="feed-profile-nav__primary">
                    <Link href="/mypage/playlist?tab=history">
                      <AppIcon name="eye" size={20} />
                      <span>시청 이력</span>
                    </Link>
                    <Link href="/mypage/community?tab=my-feeds">
                      <AppIcon name="film" size={20} />
                      <span>내 피드</span>
                    </Link>
                    <Link href="/mypage">
                      <AppIcon name="gear" size={20} />
                      <span>프로필</span>
                    </Link>
                    <Link href="/friends">
                      <AppIcon name="friend" size={20} />
                      <span>친구</span>
                    </Link>
                  </div>
                  <div className="edit-profile-area">
                    <button type="button" onClick={handleCopyProfileLink}>
                      <AppIcon name="share" size={17} />
                      <span>프로필 공유</span>
                    </button>
                    <button
                      type="button"
                      className="feed-write-btn"
                      onClick={() => setWriteModalOpen(true)}
                    >
                      <AppIcon name="clapper" size={17} color="#fff" />
                      <span>피드 작성</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>
          {currentUserId && (
            <div className="feed-main">
            <div
                className="feed-tabs"
                role="tablist"
                aria-label="피드 게시물 필터"
              >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                className={activeTab === "all" ? "active" : ""}
                onClick={() => setActiveTab("all")}
              >
                전체
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "following"}
                className={activeTab === "following" ? "active" : ""}
                onClick={() => setActiveTab("following")}
              >
                팔로우 게시물
              </button>
            </div>
            <div className="feed-filter-chips" aria-label="게시물 종류 필터">
              {feedContentFilters.map((filter) => (
                <button
                  type="button"
                  key={filter.value}
                  className={contentFilter === filter.value ? "active" : ""}
                  aria-pressed={contentFilter === filter.value}
                  onClick={() => setContentFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {filteredReviews.length === 0 ? (
              <div className="feed-empty-state">게시물이 없습니다</div>
            ) : (
              filteredReviews.map((review) => {
                const isReported = reportedReviewIds.includes(review.feedId);
                const isOwnReview = isReviewOwner(review);
                const shouldBlurSpoiler =
                  review.isSpoiler &&
                  !visibleSpoilerReviewIds.includes(review.feedId);
                const mediaMeta = parseFeedMediaMeta(review.mediaMeta);
                const isGeneralPost = review.postType === "general";

                return (
                  <article
                    key={review.feedId}
                    className={`feed-post ${reportTargetReviewId === review.feedId ? "report-open" : ""}`}
                  >
                    <Link
                      href={`/feed/${review.feedId}`}
                      className="feed-card-link"
                      aria-label={`${review.mediaTitle || FEED_CATEGORY_LABELS[review.category || "daily"]} 피드 상세 보기`}
                    />
                    <div className="post-head">
                      <Link
                        href={getUserProfileHref(
                          review.userId,
                          review.profileId,
                        )}
                        className="post-avatar profile-avatar-link feed-card-layer"
                        aria-label={`${review.author} 프로필 보기`}
                      >
                        {review.authorImage ? (
                          <img src={review.authorImage} alt="" />
                        ) : (
                          getInitial(review.author)
                        )}
                      </Link>
                      <div className="post-meta">
                        <h3>
                          {review.author}
                          <FeedAuthorBadges badgeIds={review.authorBadgeIds} />
                        </h3>
                        <div className="post-info">
                          <span className="time">
                            {getRelativeTime(review.createdAt)}
                          </span>
                          {!review.isPublic && (
                            <span className="private-tag">비공개</span>
                          )}
                        </div>
                      </div>
                      <div className="review-tags">
                        {isGeneralPost && review.category && (
                          <span className="feed-category-tag">
                            {FEED_CATEGORY_LABELS[review.category]}
                          </span>
                        )}
                        {!isGeneralPost && (
                          <div className="desktop-card-rating">
                            {renderRatingStars(review.rating)}
                            <em>{review.rating.toFixed(1)}</em>
                          </div>
                        )}
                        {review.isSpoiler && (
                          <span className="spoiler-tag">스포일러</span>
                        )}
                        {!isOwnReview && (
                          <div className="report-menu">
                            <button
                              type="button"
                              className={
                                isReported ? "report-btn active" : "report-btn"
                              }
                              onClick={() =>
                                void handleOpenReportReview(review)
                              }
                              aria-pressed={isReported}
                            >
                              {isReported ? "신고됨" : "신고"}
                            </button>
                            {reportTargetReviewId === review.feedId && (
                              <div className="feed-report-panel">
                                <p>신고 사유</p>
                                <div className="report-reasons">
                                  {REPORT_REASONS.map((reason) => (
                                    <button
                                      type="button"
                                      key={reason}
                                      className={
                                        selectedReportReason === reason
                                          ? "selected"
                                          : ""
                                      }
                                      onClick={() =>
                                        setSelectedReportReason(reason)
                                      }
                                    >
                                      {reason}
                                    </button>
                                  ))}
                                </div>
                                <div className="report-actions">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReportTargetReviewId(null)
                                    }
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleSubmitReportReview()
                                    }
                                    disabled={!selectedReportReason}
                                  >
                                    신고
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`post-body review-body${isGeneralPost ? " general-post-body" : ""}`}
                    >
                      {review.mediaType && review.mediaId && (
                        <Link
                          href={`/detail/${review.mediaType}/${review.mediaId}`}
                          className="thumb feed-card-layer"
                        >
                          {review.mediaPoster && (
                            <img
                              src={getPosterUrl(review.mediaPoster)}
                              alt={review.mediaTitle || ""}
                            />
                          )}
                        </Link>
                      )}
                      <div className="review-info">
                        {review.mediaTitle && (
                          <div className="feed-detail-link">
                            <div className="feed-review-media-copy">
                              <h4>{review.mediaTitle}</h4>
                              <p className="meta meta-primary">
                                {mediaMeta.primary}
                              </p>
                              {mediaMeta.average && (
                                <p className="meta meta-average">
                                  {mediaMeta.average}
                                </p>
                              )}
                            </div>
                            {!isGeneralPost && (
                              <div className="stars mobile-card-rating">
                                <span className="stars-label">내 별점</span>
                                {renderRatingStars(review.rating)}
                                <em>{review.rating.toFixed(1)} / 5.0</em>
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          className={
                            shouldBlurSpoiler
                              ? "review-text-wrap spoiler-blurred"
                              : "review-text-wrap"
                          }
                        >
                          <p className="review-text">{review.content}</p>
                          {shouldBlurSpoiler && (
                            <button
                              type="button"
                              className="spoiler-reveal-btn"
                              onClick={() =>
                                setVisibleSpoilerReviewIds((prev) => [
                                  ...prev,
                                  review.feedId,
                                ])
                              }
                            >
                              스포일러 보기
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="post-actions feed-card-layer">
                      <button
                        type="button"
                        className={`action ${review.liked ? "liked" : ""}`}
                        onClick={() => handleLike(review.feedId)}
                      >
                        {review.liked ? "♥" : "♡"} {review.likesCount}
                      </button>
                      <button
                        type="button"
                        className="action"
                        onClick={() => handleOpenCommentModal(review.feedId)}
                      >
                        댓글 {review.comments}
                      </button>
                      <button
                        type="button"
                        className={
                          copiedReviewId === review.feedId
                            ? "action copied"
                            : "action"
                        }
                        onClick={() => handleCopyShareLink(review.feedId)}
                      >
                        {copiedReviewId === review.feedId ? "복사됨" : "공유"}
                      </button>
                      {isOwnReview && (
                        <div className="review-owner-actions">
                          <button
                            type="button"
                            className="action"
                            onClick={() => handleOpenEditReview(review)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="action delete-review-btn"
                            onClick={() =>
                              void handleDeleteReview(review.feedId)
                            }
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
            </div>
          )}
        </div>
      </div>
      {currentUserId && renderWriteModal()}
      {currentUserId && renderCommentModal()}
    </div>
  );
}
