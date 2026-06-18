"use client";

import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import { showToast } from "@/store/useToastStore";
import { useRouter, useSearchParams } from "next/navigation";
import { useMovieStore } from "@/store/useMovieStore";
import { usePlayListStore } from "@/store/usePlayListStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import type {
  CastMember,
  Movie,
  RecommendedItem,
  TV,
  Video,
} from "@/types/movie";
import dynamic from "next/dynamic";
import VideoPlayer from "@/components/common/VideoPlayer";

// 게임 모달은 케데헌 페이지에서만 필요하므로 지연 로드
const GameModal = dynamic(() => import("@/components/common/GameModal"), {
  ssr: false,
});
import WishlistButton from "@/components/common/WishlistButton";
import ShareButton from "@/components/common/ShareButton";
import RepBadge from "@/components/common/RepBadge";
import { useConfirmModal } from "@/components/common/ConfirmModal";
import "./detail.module.scss";
import { isHidden } from "@/data/hiddenContent";
import { useCommunityStore } from "@/store/useCommunityStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  createUpcomingAlarm,
  isUpcomingNotificationSet,
  removeUpcomingAlarm,
} from "@/lib/upcomingNotifications";
import AppIcon from "../common/AppIcon";
import WatchPartyModal from "@/components/watch/WatchPartyModal";
import PlaylistCreateModal from "@/components/playlist/PlaylistCreateModal";
import { formatFivePointRating } from "@/lib/rating";
import BackButton from "../common/BackButton";

interface DetailClientProps {
  type: "movie" | "tv";
  mediaId: number;
}

type DetailMedia = (Movie | TV) & {
  adult?: boolean;
  created_by?: { id: number; name: string }[];
  first_air_date?: string;
  genres?: { id: number; name: string }[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  production_countries?: { iso_3166_1: string; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  vote_count?: number;
  origin_country?: string[];
};

type DetailTab =
  | "episodes"
  | "info"
  | "cast"
  | "review"
  | "related";

const REVIEW_PAGE_SIZE = 5;
const REPORT_REASONS = [
  "내용이 부적절해요",
  "스포일러가 포함되어 있어요",
  "욕설 또는 혐오 표현이에요",
  "도배성 리뷰예요",
  "기타",
];

interface RegisteredReview {
  id: number;
  author: string;
  rating: number;
  content: string;
  createdAt: string;
  spoiler: boolean;
  mediaId?: number;
  mediaType?: "movie" | "tv";
  mediaTitle?: string;
  posterPath?: string;
}

const USER_REVIEWS_KEY = "netflix-user-reviews";

const getToday = () => new Date().toISOString().slice(0, 10);

// const loadUserReviews = () => {
//   if (typeof window === "undefined") return [];

//   try {
//     const stored = window.localStorage.getItem(USER_REVIEWS_KEY);
//     return stored ? JSON.parse(stored) as RegisteredReview[] : [];
//   } catch {
//     return [];
//   }
// };

// const saveUserReviews = (reviews: RegisteredReview[]) => {
//   if (typeof window === "undefined") return;
//   window.localStorage.setItem(USER_REVIEWS_KEY, JSON.stringify(reviews));
// };

function getTitle(item?: DetailMedia) {
  if (!item) return "";
  return "name" in item ? item.name : item.title;
}

function imageUrl(path?: string | null, size = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
}

function getMoodTags(genres?: { id: number; name: string }[]) {
  const moodByGenreId: Record<number, string> = {
    12: "모험적인",
    14: "몽환적인",
    16: "따뜻한",
    18: "감성적인",
    27: "무서운",
    28: "흥미진진",
    35: "유쾌한",
    36: "묵직한",
    53: "긴장감",
    80: "어두운",
    99: "지적인",
    878: "상상력",
    9648: "미스터리",
    10402: "감각적인",
    10749: "로맨틱",
    10751: "편안한",
    10752: "강렬한",
    10759: "흥미진진",
    10762: "가벼운",
    10764: "리얼한",
    10765: "상상력",
    10766: "몰입감",
    10768: "묵직한",
  };

  return Array.from(
    new Set(
      (genres ?? []).map((genre) => moodByGenreId[genre.id]).filter(Boolean),
    ),
  ).slice(0, 2);
}

function getKoreanCountryName(country: { iso_3166_1: string; name: string }) {
  const countryNameByCode: Record<string, string> = {
    AR: "아르헨티나",
    AU: "호주",
    BE: "벨기에",
    BR: "브라질",
    CA: "캐나다",
    CN: "중국",
    DE: "독일",
    DK: "덴마크",
    ES: "스페인",
    FI: "핀란드",
    FR: "프랑스",
    GB: "영국",
    HK: "홍콩",
    IE: "아일랜드",
    IN: "인도",
    IT: "이탈리아",
    JP: "일본",
    KR: "한국",
    MX: "멕시코",
    NL: "네덜란드",
    NO: "노르웨이",
    SE: "스웨덴",
    TH: "태국",
    TR: "튀르키예",
    TW: "대만",
    US: "미국",
  };

  return countryNameByCode[country.iso_3166_1] ?? country.name;
}

const GENRE_MAP: Record<number, string> = {
  28: "액션",
  12: "모험",
  16: "애니메이션",
  35: "코미디",
  80: "범죄",
  99: "다큐",
  18: "드라마",
  10751: "가족",
  14: "판타지",
  36: "역사",
  27: "공포",
  10402: "음악",
  9648: "미스터리",
  10749: "로맨스",
  878: "SF",
  53: "스릴러",
  10752: "전쟁",
  37: "서부",
  10759: "액션",
  10762: "어린이",
  10765: "SF",
  10768: "전쟁",
};

// 별점을 계산해서 렌더링하는 컴포넌트 내부 함수
const renderStars = (rating: number) => {
  return [1, 2, 3, 4, 5].map((star) => {
    const fill = Math.max(0, Math.min(1, rating - (star - 1))) * 100;
    return (
      <span
        key={star}
        aria-hidden="true"
        style={{
          color: "transparent",
          background: `linear-gradient(90deg, #e50914 ${fill}%, #4a4a4a ${fill}%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
        }}
      >
        ★
      </span>
    );
  });
};

interface HalfStarRatingInputProps {
  value: number;
  hoverValue: number;
  onChange: (rating: number) => void;
  onHoverChange: (rating: number) => void;
  size?: number;
}

function HalfStarRatingInput({
  value,
  hoverValue,
  onChange,
  onHoverChange,
  size = 24,
}: HalfStarRatingInputProps) {
  const activeRating = hoverValue || value;

  return (
    <div
      className="detail-half-rating"
      onMouseLeave={() => onHoverChange(0)}
      aria-label={`별점 선택, 현재 ${value.toFixed(1)}점`}
    >
      <div className="detail-half-rating__stars">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill =
            Math.max(0, Math.min(1, activeRating - (star - 1))) * 100;
          return (
            <span
              className="detail-half-rating__star"
              key={star}
              style={
                {
                  "--detail-star-size": `${size}px`,
                  "--detail-star-fill": `${fill}%`,
                } as CSSProperties
              }
            >
              <span
                className="detail-half-rating__icon"
                aria-hidden="true"
              >
                ★
              </span>
              <button
                type="button"
                className="detail-half-rating__hit detail-half-rating__hit--left"
                onMouseEnter={() => onHoverChange(star - 0.5)}
                onFocus={() => onHoverChange(star - 0.5)}
                onBlur={() => onHoverChange(0)}
                onClick={() => onChange(star - 0.5)}
                aria-label={`${star - 0.5}점`}
              />
              <button
                type="button"
                className="detail-half-rating__hit detail-half-rating__hit--right"
                onMouseEnter={() => onHoverChange(star)}
                onFocus={() => onHoverChange(star)}
                onBlur={() => onHoverChange(0)}
                onClick={() => onChange(star)}
                aria-label={`${star}점`}
              />
            </span>
          );
        })}
      </div>
      <span className="detail-half-rating__value" aria-live="polite">
        {activeRating.toFixed(1)}
      </span>
    </div>
  );
}

export default function DetailClient({ type, mediaId }: DetailClientProps) {
  const { confirm, modal: confirmModal } = useConfirmModal();
  const isTv = type === "tv";
  const searchParams = useSearchParams();
  const router = useRouter();

  // 반응형: 뷰포트 폭에 따라 인라인 레이아웃 분기
  const [vw, setVw] = useState(1920);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = vw <= 600;
  const isTablet = vw <= 1024;
  const hPad = isMobile ? 20 : isTablet ? 24 : 40;
  const sectionPadTop = isMobile ? 40 : 56; // 탭 콘텐츠 상단 여백

  // 차단된 작품에 직접 접근하면 홈으로 돌려보낸다
  const blocked = isHidden(mediaId, type);
  useEffect(() => {
    if (blocked) router.replace("/");
  }, [blocked, router]);
  const shouldAutoPlay = searchParams.get("play") === "1";
  const itemKey = `${type}-${mediaId}`;
  // K-POP 데몬 헌터스 여부 (이스터에그용)
  const isKpopDemonHunters = type === "movie" && mediaId === 803796;

  const {
    tvs,
    tvVideos,
    onFetchTvs,
    onFetchTvVideos,
    seasons,
    onFetchSeasons,
    episodes,
    onFetchEpisodes,
    popMovies,
    popVideos,
    onFetchPopular,
    onFetchVideo,
    mediaDetails,
    onFetchMediaDetail,
    casts,
    directors,
    onFetchCredits,
    recommended,
    onFetchRecommended,
    movieImages,
    onFetchMovieImages,
    certifications,
    onFetchCertification,
    fetchMediaDetail,
  } = useMovieStore();

  const {
    playList,
    myList,
    onAddPlayList,
    onAddMyList,
    onRemoveMyList,
    onLoadMyList,
    onUpdateProgress,
    onUpdateEpisodeProgress,
    customPlaylists,
    fetchMyCustomPlaylists,
    updateCustomPlaylist,
  } = usePlayListStore();
  const { onLoadWishlist, onAddWish, onRemoveWish, isWished, wishlistIds } =
    useWishlistStore();
  const {
    reviews,
    addReview,
    updateReview,
    deleteReview,
    fetchVideoReviews,
    reportReview,
    updateReviewLikeCount,
  } = useCommunityStore();
  const { user, currentProfile, updateUserLike, onInitAuth, onUpdateProfile } =
    useAuthStore();

  // ?play=1 로 진입(메인/커넥트의 '재생하기')하면 첫 렌더부터 풀스크린 플레이어 오버레이를
  // 띄워 상세 콘텐츠가 잠깐 보이는 것을 막는다. (영상 로딩 중에는 검은 화면 + 스피너)
  const [showPopup, setShowPopup] = useState(shouldAutoPlay);
  const [popupVideoKey, setPopupVideoKey] = useState<string | null>(null);
  const [showAdultModal, setShowAdultModal] = useState(false);
  const [selectSeason, setSelectSeason] = useState(1);
  const [selectEpisodeId, setSelectEpisodeId] = useState<number | null>(null);
  const [episodePage, setEpisodePage] = useState(1);
  const [activeTab, setActiveTab] = useState<DetailTab>(
    isTv ? "episodes" : "info",
  );
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);
  const [ratedStar, setRatedStar] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [hoveredRelatedId, setHoveredRelatedId] = useState<number | null>(null);
  const [hoveredEpisodeId, setHoveredEpisodeId] = useState<number | null>(null);
  const [isAddingPlayList, setIsAddingPlayList] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [showPlaylistCreator, setShowPlaylistCreator] = useState(false);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  // 케데헌 이스터에그: 탭 라인 위 루미 클릭 → 게임 모달
  const [showGameModal, setShowGameModal] = useState(false);
  const [showWatchPartyModal, setShowWatchPartyModal] = useState(false);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  // 플레이리스트 카드 모자이크용 작품 이미지 캐시 (videoId → 이미지 URL)
  const [pickerImages, setPickerImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!showPlaylistPicker || customPlaylists.length === 0) return;
    const previewKeys = Array.from(
      new Set(customPlaylists.flatMap((p) => (p.videoIds ?? []).slice(0, 4))),
    );
    const missing = previewKeys.filter((k) => !pickerImages[k]);
    if (missing.length === 0) return;

    (async () => {
      const results = await Promise.all(
        missing.map(async (key) => {
          const [mt, id] = key.split("-");
          const data = await fetchMediaDetail(id, mt as "movie" | "tv");
          const path = data?.backdrop_path || data?.poster_path;
          return { key, url: path ? imageUrl(path, "w300") : "" };
        }),
      );
      setPickerImages((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          if (r.url) next[r.key] = r.url;
        });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlaylistPicker, customPlaylists]);
  const [isAddingMyList, setIsAddingMyList] = useState(false);
  const [isAddingWish, setIsAddingWish] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewHasSpoiler, setReviewHasSpoiler] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewText, setEditReviewText] = useState("");
  const [editReviewHasSpoiler, setEditReviewHasSpoiler] = useState(false);
  const [editRatedStar, setEditRatedStar] = useState(0);
  const [editHoverStar, setEditHoverStar] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [reportedReviewIds, setReportedReviewIds] = useState<string[]>([]);
  const [visibleSpoilerReviewIds, setVisibleSpoilerReviewIds] = useState<
    string[]
  >([]);
  // const [likedReviewIds, setLikedReviewIds] = useState<string[]>([]);
  const [reportTargetReviewId, setReportTargetReviewId] = useState<
    string | null
  >(null);
  const [selectedReportReason, setSelectedReportReason] = useState("");
  // const [submittedReviews, setSubmittedReviews] = useState<RegisteredReview[]>([]);
  const [canExpandSynopsis, setCanExpandSynopsis] = useState(false);

  const stillsRef = useRef<HTMLDivElement>(null);
  const synopsisRef = useRef<HTMLParagraphElement>(null);
  const isDragging = useRef(false);
  const hasAutoPlayed = useRef(false);

  const onStillsMouseDown = () => {
    isDragging.current = true;
  };
  const onStillsMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !stillsRef.current) return;
    stillsRef.current.scrollLeft -= e.movementX;
  };
  const onStillsMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    onLoadWishlist();
    onLoadMyList();
    fetchVideoReviews(itemKey);
  }, [itemKey, onLoadMyList, onLoadWishlist, fetchVideoReviews]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setActiveTab(isTv ? "episodes" : "info");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isTv]);

  useEffect(() => {
    if (isTv && tvs.length === 0) {
      onFetchTvs();
    } else if (!isTv && popMovies.length === 0) {
      onFetchPopular();
    }
  }, [isTv, tvs.length, popMovies.length, onFetchTvs, onFetchPopular]);

  useEffect(() => {
    if (!mediaId) return;
    onFetchMediaDetail(mediaId, type);
    onFetchCredits(mediaId, type);
    onFetchCertification(mediaId, type);
    if (isTv) {
      onFetchTvVideos(mediaId);
    } else {
      onFetchVideo(mediaId);
    }
  }, [
    type,
    isTv,
    mediaId,
    onFetchMediaDetail,
    onFetchCredits,
    onFetchCertification,
    onFetchTvVideos,
    onFetchVideo,
  ]);

  useEffect(() => {
    if (recommended.length === 0) onFetchRecommended();
  }, [recommended.length, onFetchRecommended]);

  useEffect(() => {
    if (isTv && mediaId) onFetchSeasons(mediaId);
  }, [isTv, mediaId, onFetchSeasons]);

  useEffect(() => {
    if (isTv && mediaId) onFetchEpisodes(mediaId, selectSeason);
  }, [isTv, mediaId, selectSeason, onFetchEpisodes]);

  useEffect(() => {
    if (!isTv && mediaId) onFetchMovieImages(mediaId);
  }, [isTv, mediaId, onFetchMovieImages]);

  // useEffect(() => {
  //   const timeoutId = window.setTimeout(() => {
  //     const reviews = loadUserReviews().filter((review) => (
  //       review.mediaId === mediaId && review.mediaType === type
  //     ));
  //     setSubmittedReviews(reviews);
  //   }, 0);

  //   return () => window.clearTimeout(timeoutId);
  // }, [mediaId, type]);

  const mediaItem = (mediaDetails[`${type}-${mediaId}`] ??
    (isTv
      ? tvs.find((item) => item.id === mediaId)
      : popMovies.find((item) => item.id === mediaId))) as
    | DetailMedia
    | undefined;

  const title = getTitle(mediaItem);
  const releaseDate = isTv
    ? mediaItem?.first_air_date
    : (mediaItem as Movie | undefined)?.release_date;
  const today = getToday();
  const isUpcomingFromReleaseSection = searchParams.get("upcoming") === "1";
  const hasUpcomingEpisodes =
    isTv &&
    episodes.some((episode) => episode.air_date && episode.air_date > today);
  const isUpcoming =
    isUpcomingFromReleaseSection ||
    (!!releaseDate && releaseDate > today) ||
    hasUpcomingEpisodes;
  const releaseYear = releaseDate?.split("-")[0] ?? "";
  const countryText =
    mediaItem?.production_countries
      ?.slice(0, 2)
      .map(getKoreanCountryName)
      .join(", ") ?? "";
  const seasonOrRuntimeText = isTv
    ? [
      mediaItem?.number_of_seasons
        ? `시즌 ${mediaItem.number_of_seasons}`
        : null,
      mediaItem?.number_of_episodes
        ? `${mediaItem.number_of_episodes}부작`
        : null,
    ]
      .filter(Boolean)
      .join(" / ")
    : mediaItem?.runtime
      ? `${mediaItem.runtime}분`
      : "";
  const primaryGenreName = mediaItem?.genres?.[0]?.name ?? "";
  const tvStatusText =
    mediaItem?.status === "Ended" || mediaItem?.status === "Canceled"
      ? "완결"
      : "진행중";
  const heroTypeBadgeText = isTv
    ? `${primaryGenreName || "시리즈"}${mediaItem?.number_of_seasons ? ` · 시즌 ${mediaItem.number_of_seasons} ${tvStatusText}` : ""}`
    : "영화";
  const moodTags = getMoodTags(mediaItem?.genres);
  const castKey = `${type}-${mediaId}`;
  const castList: CastMember[] = casts[castKey] ?? [];
  const isUpcomingNotified = isUpcomingNotificationSet(
    currentProfile?.alarm,
    type,
    mediaId,
  );

  useEffect(() => {
    const measureSynopsis = () => {
      const synopsisNode = synopsisRef.current;
      if (!synopsisNode) return;

      const lineHeight = Number.parseFloat(
        window.getComputedStyle(synopsisNode).lineHeight,
      );
      setCanExpandSynopsis(synopsisNode.scrollHeight > lineHeight * 3 + 1);
    };

    const timeoutId = window.setTimeout(measureSynopsis, 0);
    window.addEventListener("resize", measureSynopsis);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", measureSynopsis);
    };
  }, [mediaItem?.overview, activeTab, isTv]);

  const rawCert = certifications[castKey] ?? "";
  const ageBadge = ((): "ALL" | "12+" | "15+" | "19+" => {
    if (rawCert === "12") return "12+";
    if (rawCert === "15") return "15+";
    if (rawCert === "19" || rawCert === "Restricted Screening") return "19+";
    return "ALL";
  })();
  const isAdultContent = ageBadge === "19+" || mediaItem?.adult === true;
  const canAccessAdultContent =
    currentProfile?.settings?.maturityRating === "19+" &&
    currentProfile?.settings?.verifiedAdult === true;
  const isAdultBlocked = isAdultContent && !canAccessAdultContent;
  const heroMetaItems = [releaseYear, seasonOrRuntimeText, countryText].filter(
    Boolean,
  );
  const directorList = directors[castKey] ?? [];
  const videos = isTv
    ? mediaItem
      ? tvVideos[mediaItem.id]
      : undefined
    : mediaItem
      ? popVideos[mediaItem.id]
      : undefined;
  const trailer = videos?.find(
    (v: Video) => v.type === "Trailer" || v.type === "Teaser",
  );
  const selectedEpisode = isTv
    ? (episodes.find((ep) => ep.id === selectEpisodeId) ??
      episodes.find(
        (ep) => !isUpcoming || !ep.air_date || ep.air_date >= today,
      ) ??
      episodes[0] ??
      null)
    : null;
  const activeEpisodeId = selectedEpisode?.id ?? null;
  const detailBackdrop =
    imageUrl(mediaItem?.backdrop_path, "original") ||
    imageUrl(selectedEpisode?.still_path, "original") ||
    imageUrl(mediaItem?.poster_path, "original");
  const posterUrl = imageUrl(mediaItem?.poster_path, "w500");
  const relatedItems = recommended
    .filter((item: RecommendedItem) => item.id !== mediaId)
    .slice(0, 6);
  const isMyListAdded = myList.includes(itemKey);
  const currentUserId = user?.userId || (user as { uid?: string } | null)?.uid;
  // const sampleReviews: RegisteredReview[] = Array.from({ length: 12 }, (_, index) => ({
  //   id: index + 1,
  //   author: ["민지", "준호", "서연", "도윤", "하린", "지우"][index % 6],
  //   rating: 5 - (index % 3) * 0.5,
  //   content: index % 2 === 0
  //     ? `${title || "이 작품"}은 장면의 밀도와 분위기가 좋아서 끝까지 몰입하게 만드는 힘이 있었어요.`
  //     : "캐릭터의 선택이 인상적이었고 후반부 전개가 꽤 강하게 남았습니다.",
  //   createdAt: `2026.05.${String(28 - index).padStart(2, "0")}`,
  //   spoiler: index % 4 === 0,
  // }));
  // 1. 먼저 전체 리뷰에서 신고 수(reportsCount)가 5 이하인 리뷰만 필터링합니다.
  const filteredReviews = reviews.filter(
    (review) => (review.reportsCount ?? 0) <= 5,
  );
  const visibleEpisodes = isUpcoming
    ? episodes
      .filter((episode) => episode.air_date && episode.air_date > today)
      .slice(0, 1)
    : episodes;
  const visibleSeasons = isUpcoming
    ? seasons.filter((season) => season.season_number > 0).slice(0, 1)
    : seasons;

  // 2. 필터링된 데이터를 기준으로 페이지 관련 계산을 수행합니다.
  const totalReviewPages = Math.ceil(filteredReviews.length / REVIEW_PAGE_SIZE);

  // 3. 현재 페이지에 해당하는 리뷰만 추출합니다.
  const pagedReviews = filteredReviews.slice(
    (reviewPage - 1) * REVIEW_PAGE_SIZE,
    reviewPage * REVIEW_PAGE_SIZE,
  );

  const tabItems: { id: DetailTab; label: string; meta?: string }[] = [
    ...(isTv
      ? [
        {
          id: "episodes" as const,
          label: isUpcoming ? "공개예정" : "회차",
          meta: visibleEpisodes.length
            ? `${visibleEpisodes.length}`
            : undefined,
        },
      ]
      : []),
    ...(!isTv ? [{ id: "info" as const, label: "작품 정보" }] : []),
    {
      id: "cast",
      label: "감독/출연",
      meta: castList.length ? `${castList.length}` : undefined,
    },
    ...(!isUpcoming
      ? [
        {
          id: "review" as const,
          label: "리뷰",
          meta: filteredReviews.length ? `${filteredReviews.length}` : undefined,
        },
      ]
      : []),
    { id: "related", label: "관련 콘텐츠" },
  ];

  useEffect(() => {
    if (isUpcoming && activeTab === "review") {
      const timeoutId = window.setTimeout(() => {
        setActiveTab(isTv ? "episodes" : "info");
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [activeTab, isTv, isUpcoming]);

  const handleSeasonSelect = (seasonNumber: number) => {
    setSelectSeason(seasonNumber);
    setSelectEpisodeId(null);
    setEpisodePage(1);
  };

  useEffect(() => {
    if (!isAdultBlocked) {
      setShowAdultModal(false);
      return;
    }

    setShowPopup(false);
    setPopupVideoKey(null);
    setShowAdultModal(true);

    if (shouldAutoPlay) {
      router.replace(`/detail/${type}/${mediaId}`, { scroll: false });
    }
  }, [isAdultBlocked, mediaId, router, shouldAutoPlay, type]);

  useEffect(() => {
    if (!isUpcoming || !isTv || visibleSeasons.length === 0) return;

    const nextSeasonNumber = visibleSeasons[0].season_number;
    if (selectSeason !== nextSeasonNumber) {
      const timeoutId = window.setTimeout(() => {
        setSelectSeason(nextSeasonNumber);
        setSelectEpisodeId(null);
        setEpisodePage(1);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [isUpcoming, isTv, selectSeason, visibleSeasons]);

  const openVideo = async (key?: string | null) => {
    if (!mediaItem) return;
    if (isTv) await onFetchTvVideos(mediaId);
    else await onFetchVideo(mediaId);
    const resolvedKey = key ?? trailer?.key ?? null;
    setPopupVideoKey(resolvedKey);
    if (resolvedKey) {
      setShowPopup(true);
    } else {
      // 재생할 영상이 없으면 오버레이를 닫고 상세페이지를 노출
      setShowPopup(false);
      if (shouldAutoPlay) router.replace(`/detail/${type}/${mediaId}`, { scroll: false });
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const handlePlay = async () => {
    if (isAdultBlocked) {
      setShowAdultModal(true);
      return;
    }
    if (isUpcoming) {
      handleNotifyUpcoming();
      return;
    }
    if (!mediaItem || isAddingPlayList) return;

    setIsAddingPlayList(true);
    try {
      await onAddPlayList(mediaItem);
      router.push(`/watch/${type}/${mediaId}`);
    } finally {
      setIsAddingPlayList(false);
    }
  };

  const handleOpenWatchParty = () => {
    if (!user || !currentProfile) {
      showToast("로그인 후 프로필을 선택해 주세요.");
      router.push("/login");
      return;
    }
    setShowWatchPartyModal(true);
  };

  const handleNotifyUpcoming = async () => {
    if (!mediaItem || !currentProfile) return;

    const alarm = isUpcomingNotified
      ? removeUpcomingAlarm(currentProfile.alarm, type, mediaId)
      : [
        ...(currentProfile.alarm ?? []),
        createUpcomingAlarm({
          id: mediaId,
          media_type: type,
          title: title || "공개 예정",
          release_date: releaseDate ?? "",
          poster_path: mediaItem.poster_path,
        }),
      ];

    await onUpdateProfile({
      ...currentProfile,
      alarm,
    });
  };

  const handleMyList = async () => {
    if (!mediaItem || isAddingMyList) return;

    setIsAddingMyList(true);
    try {
      if (isMyListAdded) {
        await onRemoveMyList(mediaId, type);
      } else {
        await onAddMyList(mediaItem, type);
      }
    } finally {
      setIsAddingMyList(false);
    }
  };

  // 위시리스트 찜 추가/해제 토글
  const handleWish = async () => {
    if (!mediaItem || isAddingWish) return;

    setIsAddingWish(true);
    try {
      if (isWished(itemKey)) {
        await onRemoveWish(mediaItem);
        showToast("위시리스트에서 삭제되었습니다.");
      } else {
        await onAddWish(mediaItem);
      }
    } finally {
      setIsAddingWish(false);
    }
  };

  const handleSubmitReview = async () => {
    const content = reviewText.trim();
    if (!content) return;
    if (ratedStar === 0) {
      showToast("별점을 선택해 주세요.");
      return;
    }

    // 1. 파이어베이스에 리뷰 저장 (스토어 액션 호출)
    // 스토어 내부에서 profileId, createdAt, likesCount 등이 자동 처리됩니다.
    await addReview({
      content: content,
      videoId: itemKey, // mediaId를 videoId 자리에 전달
      isSpoiler: reviewHasSpoiler,
      rating: ratedStar,
    });

    // 2. UI 상태 초기화
    setReviewText("");
    setReviewHasSpoiler(false);
    setRatedStar(0);
    setHoverStar(0);
    setReviewPage(1);
  };

  const handleOpenEditReview = (reviewId: string) => {
    const targetReview = reviews.find((review) => review.reviewId === reviewId);
    if (!targetReview) return;

    setEditingReviewId(targetReview.reviewId);
    setEditReviewText(targetReview.content);
    setEditReviewHasSpoiler(targetReview.isSpoiler);
    setEditRatedStar(targetReview.rating);
    setEditHoverStar(0);
    setReportTargetReviewId(null);
    setSelectedReportReason("");
  };

  const handleCancelEditReview = () => {
    setEditingReviewId(null);
    setEditReviewText("");
    setEditReviewHasSpoiler(false);
    setEditRatedStar(0);
    setEditHoverStar(0);
  };

  const handleSubmitEditReview = async (reviewId: string, videoId: string) => {
    const content = editReviewText.trim();
    if (!content) return;
    if (editRatedStar === 0) {
      showToast("별점을 선택해 주세요.");
      return;
    }

    await updateReview(reviewId, videoId, {
      content,
      isSpoiler: editReviewHasSpoiler,
      rating: editRatedStar,
    });
    handleCancelEditReview();
  };

  const handleDeleteReview = async (reviewId: string, videoId: string) => {
    const confirmed = await confirm({
      title: "리뷰 삭제",
      message: "리뷰를 삭제하시겠습니까?",
      confirmLabel: "삭제",
    });
    if (!confirmed) return;

    await deleteReview(reviewId, videoId);
    if (editingReviewId === reviewId) {
      handleCancelEditReview();
    }
  };

  const handleOpenReportReview = (reviewId: string) => {
    setReportTargetReviewId((currentId) =>
      currentId === reviewId ? null : reviewId,
    );
    setSelectedReportReason("");
  };

  const handleSubmitReportReview = async () => {
    if (!reportTargetReviewId || !selectedReportReason) return;

    try {
      // 1. 스토어의 신고 액션 호출
      // 현재 보고 있는 리뷰 객체에서 videoId를 함께 전달해야 합니다.
      const targetReview = reviews.find(
        (r) => r.reviewId === reportTargetReviewId,
      );
      if (!targetReview) return;

      await reportReview(reportTargetReviewId, targetReview.videoId);

      // 2. 성공 시 UI 업데이트
      setReportedReviewIds((prev) => [...prev, reportTargetReviewId]);
      setReportTargetReviewId(null);
      setSelectedReportReason("");
      showToast("신고되었습니다.");
    } catch (error) {
      showToast("신고 처리에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const updatetoggleReviewLike = async (reviewId: string) => {
    const { user, currentProfile } = useAuthStore.getState();
    if (!user?.userId || !currentProfile) return;

    const targetReview = reviews.find((r) => r.reviewId === reviewId);
    if (!targetReview) return;

    const reviewKey = `${targetReview.videoId}#${reviewId}`;
    const isLiked = currentProfile.community.reviews.includes(reviewKey);

    // 1. 커뮤니티 스토어에서 리뷰 테이블 카운트 변경
    await updateReviewLikeCount(targetReview.videoId, reviewId, isLiked);

    // 2. Auth 스토어에서 유저 정보(키 목록) 변경
    await updateUserLike(reviewId, targetReview.videoId);
  };

  useEffect(() => {
    if (
      isUpcoming ||
      isAdultBlocked ||
      !shouldAutoPlay ||
      hasAutoPlayed.current ||
      !mediaItem ||
      !videos
    )
      return;

    hasAutoPlayed.current = true;
    handlePlay();
  }, [isUpcoming, isAdultBlocked, shouldAutoPlay, mediaItem, videos]);

  // 플레이어 뒤로가기/닫기: 오버레이를 닫고, 메인에서 ?play=1 로 바로 진입한 경우엔
  // play 파라미터를 제거해 (이미 로드된) 상세페이지가 드러나도록 한다.
  const handleClosePlayer = () => {
    setShowPopup(false);
    if (shouldAutoPlay) {
      router.replace(`/detail/${type}/${mediaId}`, { scroll: false });
    }
  };

  // 공개 예정작을 ?play=1 로 진입한 경우: 재생 오버레이 대신 상세페이지를 보여준다
  useEffect(() => {
    if (shouldAutoPlay && (isUpcoming || isAdultBlocked)) {
      setShowPopup(false);
      router.replace(`/detail/${type}/${mediaId}`, { scroll: false });
    }
  }, [shouldAutoPlay, isUpcoming, isAdultBlocked, mediaId, router, type]);

  // ─── Render sections ────────────────────────────────────────────────────────

  const renderEpisodesTab = () => {
    const PAGE_SIZE = 6;
    const episodeItems = visibleEpisodes;
    const totalPages = Math.ceil(episodeItems.length / PAGE_SIZE);
    const paged = episodeItems.slice(
      (episodePage - 1) * PAGE_SIZE,
      episodePage * PAGE_SIZE,
    );
    const playListItem = playList.find(
      (item) => item.id === mediaId && item.mediaType === type,
    );
    const getVisibleEpisodePages = () => {
      const maxVisible = 5;
      if (totalPages <= maxVisible)
        return Array.from({ length: totalPages }, (_, index) => index + 1);

      const half = Math.floor(maxVisible / 2);
      let start = Math.max(1, episodePage - half);
      const endOverflow = start + maxVisible - 1 - totalPages;

      if (endOverflow > 0) {
        start = Math.max(1, start - endOverflow);
      }

      return Array.from({ length: maxVisible }, (_, index) => start + index);
    };
    const visibleEpisodePages = getVisibleEpisodePages();

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: `${isMobile ? 36 : 48}px ${hPad}px 0`,
        }}
      >
        {isTv && renderSynopsis({ compact: true })}

        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {isMobile ? (
              /* 모바일: 커스텀 시즌 셀렉트 */
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setSeasonDropdownOpen((v) => !v)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#1b1b22",
                    border: `1px solid ${seasonDropdownOpen ? "#666" : "#3a3a48"}`,
                    padding: "8px 14px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#ddd",
                  }}
                >
                  {visibleSeasons.find(
                    (s) => s.season_number === selectSeason,
                  )?.name ?? `시즌 ${selectSeason}`}
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 10,
                      color: "#888",
                      transform: seasonDropdownOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                      transition: "transform 0.18s ease",
                    }}
                  >
                    ▼
                  </span>
                </button>

                {seasonDropdownOpen && (
                  <>
                    {/* 바깥 클릭 시 닫기 */}
                    <div
                      onClick={() => setSeasonDropdownOpen(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 50 }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        zIndex: 51,
                        minWidth: 170,
                        maxHeight: 264,
                        overflowY: "auto",
                        background: "#1b1b22",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
                        padding: "6px 0",
                      }}
                    >
                      {visibleSeasons.map((season) => {
                        const isSelected =
                          selectSeason === season.season_number;
                        return (
                          <button
                            key={season.id}
                            onClick={() => {
                              handleSeasonSelect(season.season_number);
                              setSeasonDropdownOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              width: "100%",
                              padding: "11px 14px",
                              background: isSelected
                                ? "rgba(229,9,20,0.1)"
                                : "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 14,
                              fontWeight: isSelected ? 700 : 400,
                              color: isSelected ? "#fff" : "#aaa",
                              textAlign: "left",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {season.name}
                            {isSelected && (
                              <span style={{ color: "#e50914", fontSize: 13 }}>
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              visibleSeasons.map((season) => {
                const isSelected = selectSeason === season.season_number;
                return (
                  <button
                    key={season.id}
                    onClick={() => handleSeasonSelect(season.season_number)}
                    style={{
                      background: "transparent",
                      border: "1px solid #3a3a48",
                      padding: "8px 18px",
                      borderRadius: 100,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 400,
                      color: "#888",
                      whiteSpace: "nowrap",
                      opacity: isSelected ? 1 : 0.4,
                    }}
                  >
                    {season.name}
                  </button>
                );
              })
            )}
          </div>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              marginTop: 8,
              background: "none",
              border: "none",
              color: "#888",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 14 }}>↕</span> 오래된순
          </button>
        </div>

        {/* Episode grid */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
          {paged.map((ep, idx) => {
            const isActive = ep.id === activeEpisodeId;
            const stillUrl =
              imageUrl(ep.still_path, "w500") ||
              imageUrl(mediaItem?.backdrop_path, "w500");
            const isLastRow = isMobile
              ? idx === paged.length - 1
              : idx >= paged.length - (paged.length % 2 === 0 ? 2 : 1);
            const isLeft = idx % 2 === 0;
            const meta = [
              ep.runtime ? `${ep.runtime}분` : null,
              ep.air_date ?? null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={ep.id}
                onClick={async () => {
                  if (isAdultBlocked) {
                    setShowAdultModal(true);
                    return;
                  }
                  if (isUpcoming) {
                    handleNotifyUpcoming();
                    return;
                  }
                  setSelectEpisodeId(ep.id);
                  await onAddPlayList(mediaItem!);
                  router.push(`/watch/${type}/${mediaId}?season=${selectSeason}&ep=${ep.episode_number}`);
                }}
                onMouseEnter={() => setHoveredEpisodeId(ep.id)}
                onMouseLeave={() => setHoveredEpisodeId(null)}
                style={{
                  display: "flex",
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  gap: 14,
                  padding: "20px 0",
                  borderBottom: isLastRow
                    ? "none"
                    : "1px solid rgba(255,255,255,0.07)",
                  paddingLeft: !isMobile && !isLeft ? 20 : 0,
                  paddingRight: !isMobile && isLeft ? 20 : 0,
                  cursor: "pointer",
                  background: "transparent",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    width: isMobile ? 128 : 180,
                    height: isMobile ? 76 : 110,
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "#2a2a35",
                  }}
                >
                  {stillUrl && (
                    <img
                      src={stillUrl}
                      alt={ep.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.3s ease",
                        transform:
                          hoveredEpisodeId === ep.id
                            ? "scale(1.05)"
                            : "scale(1)",
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.25)",
                      opacity:
                        isMobile ||
                          (selectEpisodeId !== null && isActive) ||
                          hoveredEpisodeId === ep.id
                          ? 1
                          : 0,
                      transition: "opacity 0.2s",
                    }}
                  >
                    <div
                      style={{
                        width: isMobile ? 32 : 42,
                        height: isMobile ? 32 : 42,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.65)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: isMobile ? 15 : 20,
                      }}
                    >
                      {isUpcoming ? "🔔" : "▶"}
                    </div>
                  </div>
                  {(() => {
                    const epProgress =
                      playListItem?.episodeProgress?.[ep.id] ?? 0;
                    const barWidth = isActive
                      ? epProgress > 0
                        ? epProgress
                        : 0
                      : epProgress;
                    return barWidth > 0 ? (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          height: 3,
                          width: `${barWidth}%`,
                          background: "#e50914",
                        }}
                      />
                    ) : null;
                  })()}
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? 2 : 6,
                    marginLeft: isMobile ? 0 : 16,
                  }}
                >
                  <p
                    style={{
                      fontSize: isMobile ? 15 : 18,
                      fontWeight: isMobile ? 500 : 700,
                      color: "#fff",
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {isUpcoming
                      ? "공개예정"
                      : `${ep.episode_number}. ${ep.name}`}
                  </p>
                  {meta && (
                    <p
                      style={{
                        fontSize: isMobile ? 13 : 14,
                        color: "#666",
                        margin: 0,
                      }}
                    >
                      {meta}
                    </p>
                  )}
                  {!isMobile && !isUpcoming && ep.overview && (
                    <p
                      style={
                        {
                          fontSize: 14,
                          color: "#999",
                          margin: 0,
                          lineHeight: 1.6,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 3,
                        } as CSSProperties
                      }
                    >
                      {ep.overview}
                    </p>
                  )}
                </div>
                {/* 모바일: 줄거리는 썸네일 아래 전체 폭으로 */}
                {isMobile && !isUpcoming && ep.overview && (
                  <p
                    style={
                      {
                        flexBasis: "100%",
                        fontSize: 12,
                        color: "#999",
                        margin: 0,
                        lineHeight: 1.6,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 3,
                      } as CSSProperties
                    }
                  >
                    {ep.overview}
                  </p>
                )}
              </div>
            );
          })}
          {paged.length === 0 && (
            <p
              style={{
                gridColumn: "1 / -1",
                color: "#888",
                fontSize: 14,
                margin: 0,
                padding: "20px 0",
              }}
            >
              공개 예정 회차 정보가 아직 없습니다.
            </p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingTop: 8,
            }}
          >
            <button
              onClick={() => setEpisodePage(1)}
              disabled={episodePage === 1}
              style={{
                background: "none",
                border: "1px solid #3a3a48",
                color: episodePage === 1 ? "#444" : "#888",
                width: 34,
                height: 34,
                borderRadius: 4,
                cursor: episodePage === 1 ? "default" : "pointer",
                fontSize: 13,
                letterSpacing: -3,
              }}
            >
              {"<<"}
            </button>
            <button
              onClick={() => setEpisodePage((p) => Math.max(1, p - 1))}
              disabled={episodePage === 1}
              style={{
                background: "none",
                border: "1px solid #3a3a48",
                color: episodePage === 1 ? "#444" : "#888",
                width: 34,
                height: 34,
                borderRadius: 4,
                cursor: episodePage === 1 ? "default" : "pointer",
                fontSize: 14,
              }}
            >
              {"<"}
            </button>
            {visibleEpisodePages.map((page) => (
              <button
                key={page}
                onClick={() => setEpisodePage(page)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 4,
                  fontSize: 14,
                  background: "none",
                  border: "1px solid #3a3a48",
                  color: "#888",
                  fontWeight: 400,
                  opacity: page === episodePage ? 0.4 : 1,
                  cursor: page === episodePage ? "default" : "pointer",
                }}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setEpisodePage((p) => Math.min(totalPages, p + 1))}
              disabled={episodePage === totalPages}
              style={{
                background: "none",
                border: "1px solid #3a3a48",
                color: episodePage === totalPages ? "#444" : "#888",
                width: 34,
                height: 34,
                borderRadius: 4,
                cursor: episodePage === totalPages ? "default" : "pointer",
                fontSize: 14,
              }}
            >
              {">"}
            </button>
            <button
              onClick={() => setEpisodePage(totalPages)}
              disabled={episodePage === totalPages}
              style={{
                background: "none",
                border: "1px solid #3a3a48",
                color: episodePage === totalPages ? "#444" : "#888",
                width: 34,
                height: 34,
                borderRadius: 4,
                cursor: episodePage === totalPages ? "default" : "pointer",
                fontSize: 13,
                letterSpacing: -3,
              }}
            >
              {">>"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSynopsis = ({ compact = false }: { compact?: boolean } = {}) =>
    !isUpcoming && (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: compact ? "0 0 24px" : `${sectionPadTop}px ${hPad}px 0`,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
          {isTv ? "시리즈 줄거리" : "영화 줄거리"}
        </h2>
        <div style={{ position: "relative" }}>
          <p
            ref={synopsisRef}
            style={{
              fontSize: isMobile ? 14 : 16,
              color: "#ccc",
              opacity: 0.7,
              lineHeight: 1.72,
              margin: 0,
              overflow: "hidden",
              display: synopsisExpanded ? "block" : "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: synopsisExpanded ? "unset" : 3,
              maxWidth: "100%",
            }}
          >
            {mediaItem?.overview}
          </p>
        </div>
        {mediaItem?.overview && canExpandSynopsis && (
          <button
            onClick={() => setSynopsisExpanded(!synopsisExpanded)}
            style={{
              fontSize: 14,
              color: "#e50914",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              width: "fit-content",
            }}
          >
            {synopsisExpanded ? "접기 ▴" : "더보기 ▾"}
          </button>
        )}
      </div>
    );

  const renderRating = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: `${sectionPadTop}px ${hPad}px 0`,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
        시리즈 평가
      </h2>
      <div
        style={{
          borderRadius: 12,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid #2a2a35",
          padding: "20px 21px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 16, color: "#888" }}>별점을 매겨주세요</span>
          <HalfStarRatingInput
            value={ratedStar}
            hoverValue={hoverStar}
            onChange={setRatedStar}
            onHoverChange={setHoverStar}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            style={{
              borderRadius: 100,
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid #3a3a48",
              color: "#888",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ＋ 플레이리스트
          </button>
          <button
            style={{
              borderRadius: 100,
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid #3a3a48",
              color: "#888",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            🔔 신규 회차 알림
          </button>
        </div>
      </div>
    </div>
  );
  void renderRating;

  const renderReviewTab = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: isMobile ? 18 : 24,
        padding: `${sectionPadTop}px ${hPad}px 0`,
      }}
    >
      <section
        style={{
          border: "1px solid #2a2a35",
          borderRadius: 8,
          background: "rgba(255,255,255,0.03)",
          padding: isMobile ? 16 : 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <h2
            style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}
          >
            내 리뷰 작성
          </h2>
          <HalfStarRatingInput
            value={ratedStar}
            hoverValue={hoverStar}
            onChange={setRatedStar}
            onHoverChange={setHoverStar}
          />
        </div>
        <textarea
          className="detail-review-textarea"
          value={reviewText}
          onChange={(event) => setReviewText(event.target.value)}
          placeholder="이 작품에 대한 감상을 남겨보세요."
          style={{
            width: "100%",
            height: 130,
            resize: "none",
            overflowY: "auto",
            boxSizing: "border-box",
            border: "1px solid #3a3a48",
            borderRadius: 6,
            background: "#111",
            color: "#fff",
            padding: 16,
            fontSize: 14,
            lineHeight: 1.7,
            outline: "none",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="detail-chip-hover"
            onClick={() => setReviewHasSpoiler((value) => !value)}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 6,
              border: `1px solid ${reviewHasSpoiler ? "#e50914" : "#3a3a48"}`,
              background: reviewHasSpoiler
                ? "rgba(229,9,20,0.12)"
                : "transparent",
              color: reviewHasSpoiler ? "#e50914" : "#aaa",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {/* {reviewHasSpoiler ? "스포일러 포함" : "스포일러 없음"} */}
            스포일러
          </button>
          <button
            type="button"
            className="detail-primary-hover"
            onClick={handleSubmitReview}
            disabled={!reviewText.trim()}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 6,
              border: "none",
              background: "#e50914",
              color: "#fff",
              cursor: reviewText.trim() ? "pointer" : "default",
              opacity: reviewText.trim() ? 1 : 0.45,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            리뷰 등록
          </button>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}
          >
            등록된 리뷰
          </h2>
          <span style={{ color: "#888", fontSize: 13 }}>
            {filteredReviews.length}개
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pagedReviews.map((review) => {
            const reviewKey = `${itemKey}#${review.reviewId}`;
            const isReported = reportedReviewIds.includes(review.reviewId);
            const isLiked =
              currentProfile?.community.reviews.includes(reviewKey);
            const shouldBlurSpoiler =
              review.isSpoiler &&
              !visibleSpoilerReviewIds.includes(review.reviewId);
            const isMyReview = Boolean(
              currentProfile &&
              ((review.userId &&
                review.userId === currentUserId &&
                review.profileId === currentProfile.id) ||
                (!review.userId &&
                  review.profileId === currentProfile.id &&
                  review.nickname === currentProfile.nickname)),
            );
            const isEditingReview = editingReviewId === review.reviewId;

            return (
              <article
                key={review.reviewId}
                style={{
                  border: "1px solid #2a2a35",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.025)",
                  padding: isMobile ? 14 : 18,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <strong style={{ color: "#fff", fontSize: 15 }}>
                      {review.nickname}
                    </strong>
                    {review.equippedBadge && (
                      <span style={{ marginLeft: 8, display: "inline-flex", verticalAlign: "middle" }}>
                        <RepBadge badge={review.equippedBadge} size="sm" />
                      </span>
                    )}
                    <span
                      style={{ color: "#e50914", marginLeft: 10, fontSize: 13 }}
                    >
                      {renderStars(review.rating)}
                    </span>
                    <span
                      style={{ color: "#aaa", marginLeft: 8, fontSize: 12 }}
                    >
                      {review.rating.toFixed(1)} / 5.0
                    </span>
                    {review.isSpoiler && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 7px",
                          borderRadius: 4,
                          border: "1px solid rgba(229,9,20,0.45)",
                          color: "#e50914",
                          fontSize: 11,
                        }}
                      >
                        스포일러
                      </span>
                    )}
                  </div>

                  {!isMyReview && (
                    <button
                      type="button"
                      className={`detail-outline-hover${isReported ? " detail-report-active" : ""}`}
                      onClick={() => handleOpenReportReview(review.reviewId)}
                      aria-pressed={isReported}
                      style={{
                        border: `1px solid ${isReported ? "rgba(229,9,20,0.7)" : "#3a3a48"}`,
                        borderRadius: 4,
                        background: isReported
                          ? "rgba(229,9,20,0.16)"
                          : "transparent",
                        color: isReported ? "#e50914" : "#888",
                        height: 30,
                        padding: "0 10px",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: isReported ? 700 : 400,
                      }}
                    >
                      신고
                    </button>
                  )}

                  {/* 신고 타겟 ID가 이 리뷰인 경우 신고 UI 표시 */}
                  {!isMyReview && reportTargetReviewId === review.reviewId && (
                    <div
                      style={{
                        position: "absolute",
                        top: 36,
                        right: 0,
                        zIndex: 20,
                        width: 260,
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        background: "#191919",
                        padding: 12,
                        boxShadow: "0 14px 42px rgba(0,0,0,0.42)",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 10px",
                          color: "#d8d8d8",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        신고 사유
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        {REPORT_REASONS.map((reason) => (
                          <button
                            type="button"
                            key={reason}
                            onClick={() => setSelectedReportReason(reason)}
                            style={{
                              minHeight: 34,
                              padding: "0 10px",
                              border: `1px solid ${selectedReportReason === reason ? "rgba(229,9,20,0.7)" : "#333"}`,
                              borderRadius: 6,
                              background:
                                selectedReportReason === reason
                                  ? "rgba(229,9,20,0.14)"
                                  : "rgba(255,255,255,0.03)",
                              color:
                                selectedReportReason === reason
                                  ? "#fff"
                                  : "#aaa",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 6,
                          marginTop: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setReportTargetReviewId(null)}
                          style={{
                            height: 30,
                            padding: "0 10px",
                            border: "1px solid #333",
                            borderRadius: 5,
                            background: "transparent",
                            color: "#888",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitReportReview}
                          disabled={!selectedReportReason}
                          style={{
                            height: 30,
                            padding: "0 10px",
                            border: "none",
                            borderRadius: 5,
                            background: "#e50914",
                            color: "#fff",
                            cursor: selectedReportReason
                              ? "pointer"
                              : "default",
                            opacity: selectedReportReason ? 1 : 0.45,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          신고
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isEditingReview ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <HalfStarRatingInput
                          value={editRatedStar}
                          hoverValue={editHoverStar}
                          onChange={setEditRatedStar}
                          onHoverChange={setEditHoverStar}
                          size={20}
                        />
                      </div>
                      <button
                        type="button"
                        className="detail-secondary-hover"
                        onClick={() => setEditReviewHasSpoiler((prev) => !prev)}
                        aria-pressed={editReviewHasSpoiler}
                        style={{
                          height: 30,
                          padding: "0 10px",
                          border: `1px solid ${editReviewHasSpoiler ? "rgba(229,9,20,0.7)" : "rgba(255,255,255,0.22)"}`,
                          borderRadius: 5,
                          background: editReviewHasSpoiler
                            ? "rgba(229,9,20,0.14)"
                            : "rgba(255,255,255,0.06)",
                          color: editReviewHasSpoiler ? "#fff" : "#cfcfcf",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {/* {"\uC2A4\uD3EC\uC77C\uB7EC"} */}
                        스포일러
                      </button>
                    </div>

                    <textarea
                      className="detail-review-textarea"
                      value={editReviewText}
                      onChange={(event) =>
                        setEditReviewText(event.target.value)
                      }
                      style={{
                        width: "100%",
                        height: 130,
                        resize: "none",
                        overflowY: "auto",
                        boxSizing: "border-box",
                        border: "1px solid #3a3a48",
                        borderRadius: 6,
                        background: "#111",
                        color: "#fff",
                        padding: 16,
                        fontSize: 14,
                        lineHeight: 1.7,
                        outline: "none",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: 6,
                      minHeight: shouldBlurSpoiler ? 96 : "auto",
                    }}
                  >
                    <div
                      style={{
                        minHeight: shouldBlurSpoiler ? 96 : "auto",
                        filter: shouldBlurSpoiler ? "blur(6px)" : "none",
                        opacity: shouldBlurSpoiler ? 0.72 : 1,
                        userSelect: shouldBlurSpoiler ? "none" : "auto",
                        transition: "filter 0.18s ease, opacity 0.18s ease",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: "#cfcfcf",
                          lineHeight: 1.7,
                          fontSize: 14,
                        }}
                      >
                        {review.content}
                      </p>
                    </div>
                    {shouldBlurSpoiler && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background:
                            "radial-gradient(circle at center, rgba(20,20,20,0.72) 0%, rgba(20,20,20,0.58) 46%, rgba(20,20,20,0.32) 100%)",
                          backdropFilter: "blur(3px)",
                        }}
                      >
                        <button
                          type="button"
                          className="detail-secondary-hover"
                          onClick={() =>
                            setVisibleSpoilerReviewIds((prev) => [
                              ...prev,
                              review.reviewId,
                            ])
                          }
                          style={{
                            height: 34,
                            padding: "0 16px",
                            border: "1px solid rgba(255,255,255,0.28)",
                            borderRadius: 6,
                            background: "rgba(255,255,255,0.12)",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          스포일러 보기
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <time
                  style={{
                    display: "block",
                    marginTop: 12,
                    color: "#666",
                    fontSize: 12,
                  }}
                >
                  {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                </time>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between", //  양쪽 끝으로 정렬 추가
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 10,
                  }}
                >
                  {/* 왼쪽: 좋아요 버튼 */}
                  <button
                    type="button"
                    className="detail-secondary-hover"
                    onClick={() => updatetoggleReviewLike(review.reviewId)}
                    aria-pressed={isLiked}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      height: 32,
                      padding: "0 10px",
                      border: `1px solid ${isLiked ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.24)"}`,
                      borderRadius: 999,
                      background: isLiked
                        ? "rgba(255,255,255,0.9)"
                        : "rgba(255,255,255,0.08)",
                      color: isLiked ? "#111" : "#d6d6d6",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    <img
                      src={
                        isLiked
                          ? "/images/detail/review/heart-filled.svg"
                          : "/images/detail/review/heart-lined.svg"
                      }
                      alt="좋아요"
                      style={{
                        width: 14,
                        height: 14,
                        opacity: isLiked ? 1 : 0.86,
                        filter: isLiked ? "none" : "invert(1)",
                      }}
                    />
                    좋아요 {review.likesCount}
                  </button>

                  {/* 오른쪽: 내가 쓴 리뷰일 때의 버튼들 관리 */}
                  {isMyReview && (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      {" "}
                      {/*  오른쪽 버튼들을 묶어주는 div 추가 */}
                      {isEditingReview ? (
                        <>
                          <button
                            type="button"
                            className="detail-outline-hover"
                            onClick={() =>
                              void handleSubmitEditReview(
                                review.reviewId,
                                review.videoId,
                              )
                            }
                            disabled={!editReviewText.trim()}
                            style={{
                              border: "1px solid rgba(229,9,20,0.65)",
                              borderRadius: 999,
                              background: "rgba(229,9,20,0.12)",
                              color: "#fff",
                              height: 32,
                              padding: "0 12px",
                              cursor: editReviewText.trim()
                                ? "pointer"
                                : "default",
                              opacity: editReviewText.trim() ? 1 : 0.45,
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            수정완료
                          </button>
                          <button
                            type="button"
                            className="detail-outline-hover"
                            onClick={handleCancelEditReview}
                            style={{
                              border: "1px solid #3a3a48",
                              borderRadius: 999,
                              background: "transparent",
                              color: "#aaa",
                              height: 32,
                              padding: "0 12px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            수정취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="detail-outline-hover"
                            onClick={() =>
                              handleOpenEditReview(review.reviewId)
                            }
                            style={{
                              border: "1px solid #3a3a48",
                              borderRadius: 999,
                              background: "transparent",
                              color: "#aaa",
                              height: 32,
                              padding: "0 12px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="detail-outline-hover"
                            onClick={() =>
                              void handleDeleteReview(
                                review.reviewId,
                                review.videoId,
                              )
                            }
                            style={{
                              border: "1px solid rgba(229,9,20,0.55)",
                              borderRadius: 999,
                              background: "rgba(229,9,20,0.08)",
                              color: "#e50914",
                              height: 32,
                              padding: "0 12px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {filteredReviews.length === 0 && (
            <div
              style={{
                padding: "44px 0",
                textAlign: "center",
                color: "#888",
                fontSize: 14,
                border: "1px dashed #2a2a35",
                borderRadius: 8,
                background: "rgba(255,255,255,0.015)",
              }}
            >
              등록된 리뷰가 없습니다.
            </div>
          )}
        </div>

        {totalReviewPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingTop: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setReviewPage((page) => Math.max(1, page - 1))}
              disabled={reviewPage === 1}
              style={{
                background: "none",
                border: "1px solid #3a3a48",
                color: reviewPage === 1 ? "#444" : "#888",
                width: 34,
                height: 34,
                borderRadius: 4,
                cursor: reviewPage === 1 ? "default" : "pointer",
                fontSize: 14,
              }}
            >
              ‹
            </button>
            {Array.from(
              { length: totalReviewPages },
              (_, index) => index + 1,
            ).map((page) => (
              <button
                type="button"
                key={page}
                onClick={() => setReviewPage(page)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: "pointer",
                  background: page === reviewPage ? "#e50914" : "none",
                  border: `1px solid ${page === reviewPage ? "#e50914" : "#3a3a48"}`,
                  color: page === reviewPage ? "#fff" : "#888",
                  fontWeight: page === reviewPage ? 700 : 400,
                }}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setReviewPage((page) => Math.min(totalReviewPages, page + 1))
              }
              disabled={reviewPage === totalReviewPages}
              style={{
                background: "none",
                border: "1px solid #3a3a48",
                color: reviewPage === totalReviewPages ? "#444" : "#888",
                width: 34,
                height: 34,
                borderRadius: 4,
                cursor: reviewPage === totalReviewPages ? "default" : "pointer",
                fontSize: 14,
              }}
            >
              ›
            </button>
          </div>
        )}
      </section>
    </div>
  );

  const renderRelated = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: `${sectionPadTop}px ${hPad}px 0`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
          함께 보면 좋은 작품
        </h2>
        <span style={{ fontSize: 12, color: "#888", cursor: "pointer" }}>
          더보기 →
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${isMobile ? 3 : isTablet ? 4 : 6}, 1fr)`,
          gap: isMobile ? 8 : 12,
        }}
      >
        {relatedItems.map((item) => {
          // 모바일/태블릿에서는 정보 오버레이 없이 탭하면 바로 상세로 이동
          const isHovered = !isMobile && !isTablet && hoveredRelatedId === item.id;
          return (
            <a
              key={`${item.media_type}-${item.id}`}
              href={`/detail/${item.media_type}/${item.id}`}
              onMouseEnter={
                isMobile || isTablet
                  ? undefined
                  : () => setHoveredRelatedId(item.id)
              }
              onMouseLeave={
                isMobile || isTablet
                  ? undefined
                  : () => setHoveredRelatedId(null)
              }
              style={{
                position: "relative",
                display: "block",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.05)",
                aspectRatio: "2/3",
                background: "#1a1a22",
                transform: isHovered ? "scale(1.04)" : "scale(1)",
                transition: "transform 0.2s",
              }}
            >
              {item.poster_path && (
                <img
                  src={imageUrl(item.poster_path)}
                  alt={item.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: isHovered ? 0.4 : 0.8,
                    transition: "opacity 0.2s",
                  }}
                />
              )}
              <span
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  fontSize: 14,
                  padding: "3px 9px",
                  borderRadius: 3,
                  background: "rgba(0,0,0,0.7)",
                  color: "#ccc",
                }}
              >
                {item.media_type === "tv" ? "시리즈" : "영화"}
              </span>
              {isHovered && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "20px 20px",
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
                    gap: 8,
                  }}
                >
                  <p
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#fff",
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.title}
                  </p>
                  {/* 별점 · 연도 · 장르 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      flexWrap: "wrap",
                    }}
                  >
                    {item.vote_average > 0 && (
                      <>
                        <span style={{ fontSize: 12, color: "#e50914" }}>
                          ★
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#fff",
                            fontWeight: 700,
                          }}
                        >
                          {formatFivePointRating(item.vote_average)}
                        </span>
                        <span style={{ fontSize: 12, color: "#555" }}>|</span>
                      </>
                    )}
                    {item.release_date && (
                      <>
                        <span style={{ fontSize: 12, color: "#bbb" }}>
                          {item.release_date.slice(0, 4)}
                        </span>
                        {(item.genre_ids ?? []).length > 0 && (
                          <span style={{ fontSize: 14, color: "#555" }}>|</span>
                        )}
                      </>
                    )}
                    {(item.genre_ids ?? []).length > 0 && (
                      <span style={{ fontSize: 12, color: "#bbb" }}>
                        {(item.genre_ids ?? [])
                          .slice(0, 2)
                          .map((id: number) => GENRE_MAP[id])
                          .filter(Boolean)
                          .join(" • ")}
                      </span>
                    )}
                  </div>
                  {/* 줄거리 */}
                  {item.overview && (
                    <p
                      style={
                        {
                          fontSize: 12,
                          color: "#aaa",
                          margin: 0,
                          lineHeight: 1.55,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        } as CSSProperties
                      }
                    >
                      {item.overview}
                    </p>
                  )}
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );

  const renderPersonCard = (
    id: number,
    profilePath: string | null,
    name: string,
    sub: string,
    idx: number,
    total: number,
    cols: number,
  ) => {
    const isLastRow = idx >= total - (total % cols || cols);
    const isRightCol = (idx + 1) % cols !== 0;
    return (
      <a
        key={`${id}-${idx}`}
        href={`/person/${id}?from=/detail/${type}/${mediaId}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 0",
          borderBottom: isLastRow ? "none" : "1px solid rgba(255,255,255,0.07)",
          borderRight: isRightCol ? "1px solid rgba(255,255,255,0.07)" : "none",
          paddingLeft: idx % cols === 0 ? 0 : 20,
          paddingRight: (idx + 1) % cols === 0 ? 0 : 20,
          textDecoration: "none",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: 8,
            overflow: "hidden",
            background: "#2a2a35",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {profilePath ? (
            <img
              src={imageUrl(profilePath, "w185")}
              alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                color: "#444",
              }}
            >
              <AppIcon name="faq-account" size={20} />
            </div>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              margin: 0,
              lineHeight: 1.4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </p>
          <p
            style={{
              fontSize: 13,
              color: "#666",
              margin: 0,
              lineHeight: 1.4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sub}
          </p>
        </div>
      </a>
    );
  };

  const renderCast = () => {
    const COLS = isMobile ? 1 : isTablet ? 2 : 4;
    const visibleCast = castList.slice(0, 12);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 28 : 40,
          padding: `${sectionPadTop}px ${hPad}px 0`,
        }}
      >
        {directorList.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
              감독/제작
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
              {directorList.map((member, idx) =>
                renderPersonCard(
                  member.id,
                  member.profile_path,
                  member.name,
                  member.job,
                  idx,
                  directorList.length,
                  COLS,
                )
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
            출연진
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
            {visibleCast.map((member, idx) =>
              renderPersonCard(
                member.id,
                member.profile_path,
                member.name,
                `출연 | ${member.character}`,
                idx,
                visibleCast.length,
                COLS,
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStills = () => {
    const rawImages = movieImages[mediaId] ?? [];
    const stills =
      rawImages.length > 0
        ? rawImages.slice(0, 8).map((img) => imageUrl(img.file_path, "w780"))
        : ([
          mediaItem?.backdrop_path
            ? imageUrl(mediaItem.backdrop_path, "w780")
            : null,
          mediaItem?.poster_path
            ? imageUrl(mediaItem.poster_path, "w780")
            : null,
        ].filter(Boolean) as string[]);

    if (stills.length === 0) return null;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: `${sectionPadTop}px ${hPad}px 0`,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
          스틸컷
        </h2>
        <div
          ref={stillsRef}
          className="scrollbar-hide"
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            paddingBottom: 8,
            cursor: "grab",
            userSelect: "none",
          }}
          onMouseDown={onStillsMouseDown}
          onMouseMove={onStillsMouseMove}
          onMouseUp={onStillsMouseUp}
          onMouseLeave={onStillsMouseUp}
        >
          {stills.map((src, i) => (
            <div
              key={i}
              onClick={() => {
                if (!isDragging.current) setLightboxSrc(src);
              }}
              style={{
                flexShrink: 0,
                width: 320,
                height: 180,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#1a1a22",
                cursor: "pointer",
              }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  pointerEvents: "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };


  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "#141414", minHeight: "100vh", marginTop: -81 }}>
      {confirmModal}
      {showWatchPartyModal && mediaItem && (
        <WatchPartyModal
          media={{
            type,
            mediaId,
            title: title || "같이보기",
            posterPath: mediaItem.poster_path,
            backdropPath: mediaItem.backdrop_path,
          }}
          onClose={() => setShowWatchPartyModal(false)}
        />
      )}
      {/* Hero + Info Section (shared background) */}
      <div style={{ position: "relative" }}>
        {detailBackdrop && (
          <img
            src={detailBackdrop}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center center",
              opacity: 0.45,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(20,20,20,0.35) 0%, rgba(20,20,20,0.12) 40%, transparent 75%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, #141414 0%, rgba(20,20,20,0.12) 30%, transparent 60%)",
          }}
        />

        {/* Hero spacer */}
        <div style={{ height: "50vh" }} />
        {/* <BackButton fallback="/" /> */}
        <div style={{
              position: "relative",
              zIndex: 10,
              padding: `0 ${hPad}px 0 ${isMobile ? hPad : 87}px`
            }}>
          <button
            type="button"
            className={`app-back-btn`.trim()}
            onClick={handleBack}
            aria-label="뒤로가기"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>뒤로</span>
            <style jsx>{`
              .app-back-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin: 16px 0;
                padding: 8px 14px 8px 10px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 8px;
                color: #fff;
                font-size: 14px;
                line-height: 1;
                cursor: pointer;
                transition: background 0.15s ease, border-color 0.15s ease;
              }
              .app-back-btn:hover {
                background: rgba(255, 255, 255, 0.16);
                border-color: rgba(255, 255, 255, 0.3);
              }
              .app-back-btn svg {
                display: block;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
              }
            `}</style>
          </button>
        </div>
        {/* Info Section */}
        <div style={{ position: "relative", display: "flex", gap: 24, padding: `0 ${hPad}px ${isMobile ? 8 : 40}px ${isMobile ? hPad : 87}px`, zIndex: 10 }}>
          {/* Poster */}
          {!isMobile && (
            <div
              style={{
                flexShrink: 0,
                width: 180,
                height: 260,
                borderRadius: 8,
                overflow: "hidden",
                border: "1.5px solid rgba(255,255,255,0.12)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                background: "#2a2a35",
              }}
            >
              {posterUrl && (
                <img
                  src={posterUrl}
                  alt={title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
          )}

          {/* Metadata */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: 10,
              minWidth: 0,
              paddingBottom: 4,
            }}
          >
            {!isMobile && (
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 25,
                    padding: "0 8px",
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.14)",
                    color: "rgba(255,255,255,0.72)",
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: 0,
                  }}
                >
                  {heroTypeBadgeText}
                </span>
              </div>
            )}

            <h1
              style={{
                fontWeight: 900,
                fontSize: isMobile ? 30 : isTablet ? 32 : 40,
                color: "#fff",
                lineHeight: 1.15,
                letterSpacing: -0.8,
                margin: 0,
              }}
            >
              {title}
            </h1>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {isMobile ? (
                /* 모바일: 연도 · 등급(빨간 뱃지) · 시즌 · 4K — 넷플릭스 앱 스타일 */
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {releaseYear && (
                    <span style={{ fontSize: 14, color: "#bbb" }}>
                      {releaseYear}
                    </span>
                  )}
                  {seasonOrRuntimeText && (
                    <span style={{ fontSize: 14, color: "#bbb" }}>
                      {seasonOrRuntimeText}
                    </span>
                  )}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 20,
                      padding: "0 6px",
                      border: "1px solid rgba(255,255,255,0.4)",
                      borderRadius: 3,
                      color: "rgba(255,255,255,0.8)",
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {/* TMDB 장르(16=Animation) 기준 분류 */}
                    {mediaItem?.genres?.some((g) => g.id === 16)
                      ? "애니메이션"
                      : isTv
                        ? "시리즈"
                        : "영화"}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 20,
                      padding: "0 6px",
                      border: "1px solid rgba(255,255,255,0.4)",
                      borderRadius: 3,
                      color: "rgba(255,255,255,0.8)",
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {ageBadge}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {heroMetaItems.map((item, index) => (
                    <React.Fragment key={item}>
                      {index > 0 && <span style={{ color: "#444" }}>·</span>}
                      <span style={{ fontSize: 14, color: "#888" }}>{item}</span>
                    </React.Fragment>
                  ))}
                  {heroMetaItems.length > 0 && (
                    <span style={{ color: "#444" }}>·</span>
                  )}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 38,
                      height: 20,
                      padding: "0 8px",
                      border: "1px solid rgba(255,255,255,0.35)",
                      borderRadius: 3,
                      color: "rgba(255,255,255,0.78)",
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {ageBadge}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: isMobile ? "none" : "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {mediaItem?.genres?.slice(0, 3).map((g) => (
                  <span
                    key={g.id}
                    style={{
                      padding: "2px 10px",
                      borderRadius: 100,
                      border: "1px solid #555",
                      fontSize: 11,
                      color: "#999",
                    }}
                  >
                    {g.name}
                  </span>
                ))}
                {moodTags.map((mood) => (
                  <span
                    key={mood}
                    style={{
                      padding: "2px 10px",
                      borderRadius: 100,
                      border: "1px solid #555",
                      fontSize: 11,
                      color: "#999",
                    }}
                  >
                    {mood}
                  </span>
                ))}
                {/* {countryText && <span style={{ fontSize: 14, color: "#888" }}>{countryText}</span>} */}
              </div>
            </div>

            <div
              style={{
                display: "none",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {releaseYear && (
                <span style={{ fontSize: 14, color: "#888" }}>
                  {releaseYear}
                </span>
              )}
              {isTv && mediaItem?.number_of_seasons && (
                <>
                  <span style={{ color: "#444" }}>·</span>
                  <span style={{ fontSize: 14, color: "#888" }}>
                    시즌 {mediaItem.number_of_seasons}
                  </span>
                </>
              )}
              {!isTv && mediaItem?.runtime && (
                <>
                  <span style={{ color: "#444" }}>·</span>
                  <span style={{ fontSize: 14, color: "#888" }}>
                    {mediaItem.runtime}분
                  </span>
                </>
              )}
              {mediaItem?.genres && mediaItem.genres.length > 0 && (
                <>
                  {/* <span style={{ color: "#444" }}>·</span> */}
                  {mediaItem.genres.slice(0, 3).map((g) => (
                    <span
                      key={g.id}
                      style={{
                        padding: "2px 10px",
                        borderRadius: 100,
                        border: "1px solid #555",
                        fontSize: 11,
                        color: "#999",
                      }}
                    >
                      {g.name}
                    </span>
                  ))}
                </>
              )}
              {/* {countryText && (
                <>
                  <span style={{ color: "#444" }}>·</span>
                  <span style={{ fontSize: 14, color: "#888" }}>{countryText}</span>
                </>
              )} */}
            </div>

            {/* Score */}
            {!isUpcoming && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{ color: "#e50914", fontSize: 16, letterSpacing: -7 }}
                >
                  ★
                </span>
                <span style={{ fontWeight: 500, fontSize: 16, color: "#fff" }}>
                  {mediaItem?.vote_average
                    ? formatFivePointRating(mediaItem.vote_average)
                    : "-"}
                </span>
                {mediaItem?.vote_count && (
                  <span style={{ fontSize: 14, color: "#888" }}>
                    {mediaItem.vote_count.toLocaleString()}명 평가
                  </span>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                justifyContent: isMobile ? "space-around" : "flex-start",
                gap: 10,
                flexWrap: isMobile ? "nowrap" : "wrap",
                marginTop: 12,
              }}
            >
              {isMobile ? (
                /* 모바일: 원형 아이콘 + 하단 라벨 (찜/공유와 동일 디자인) */
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <button
                    onClick={handlePlay}
                    disabled={!isUpcoming && isAddingPlayList}
                    aria-label={isUpcoming ? "알림받기" : "재생하기"}
                    style={{
                      flexShrink: 0,
                      width: 56,
                      height: 44,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "none",
                      border: "none",
                      color: "#fff",
                      fontSize: 38,
                      cursor:
                        !isUpcoming && isAddingPlayList ? "default" : "pointer",
                      opacity: !isUpcoming && isAddingPlayList ? 0.6 : 1,
                    }}
                  >
                    {isUpcoming ? (
                      <img
                        src="/images/header/alarm.svg"
                        alt=""
                        style={{
                          width: 32,
                          height: 32,
                          filter: "brightness(0) invert(1)",
                        }}
                      />
                    ) : (
                      "▶"
                    )}
                  </button>
                  <span style={{ fontSize: 13, color: "#888" }}>
                    {isUpcoming
                      ? isUpcomingNotified
                        ? "알림설정됨"
                        : "알림받기"
                      : "재생"}
                  </span>
                </div>
              ) : null}
              {isMobile && !isUpcoming ? (
                /* 모바일: 플레이리스트 추가 (+) */
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <button
                    onClick={async () => {
                      if (isAdultBlocked) {
                        setShowAdultModal(true);
                        return;
                      }
                      if (!user) {
                        router.push("/login");
                        return;
                      }
                      if (!mediaItem) return;
                      await fetchMyCustomPlaylists();
                      setShowPlaylistPicker(true);
                    }}
                    disabled={isAddingPlayList}
                    aria-label="플레이리스트에 추가"
                    style={{
                      flexShrink: 0,
                      width: 56,
                      height: 44,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "none",
                      border: "none",
                      color: "#fff",
                      fontSize: 44,
                      fontWeight: 300,
                      lineHeight: 1,
                      cursor: isAddingPlayList ? "default" : "pointer",
                      opacity: isAddingPlayList ? 0.6 : 1,
                    }}
                  >
                    +
                  </button>
                  <span style={{ fontSize: 13, color: "#888" }}>
                    플레이리스트
                  </span>
                </div>
              ) : null}
              {isMobile && mediaItem && !isUpcoming && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <button
                    type="button"
                    className="detail-hero-action-btn detail-party-btn"
                    onClick={handleOpenWatchParty}
                    aria-label="넷플릭스 파티 만들기"
                    title="넷플릭스 파티 만들기"
                  >
                    <img
                      src="/images/detail/review/netflix-party-icon.svg"
                      alt=""
                    />
                  </button>
                  <span style={{ fontSize: 13, color: "#888" }}>같이보기</span>
                </div>
              )}
              {!isMobile && (
              <button
                className="detail-primary-hover"
                onClick={handlePlay}
                disabled={!isUpcoming && isAddingPlayList}
                style={{
                  background: isUpcoming
                    ? isUpcomingNotified
                      ? "rgba(255, 255, 255, 0.05)"
                      : "transparent"
                    : "#e50914",
                  color: isUpcoming
                    ? "#fff"
                    : "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: isUpcoming ? 48 : 46,
                  padding: isUpcoming ? "14px 24px" : "0 22px",
                  fontSize: isUpcoming ? 14 : 16,
                  fontWeight: 700,
                  border: isUpcoming
                    ? `1px solid ${isUpcomingNotified ? "rgba(255, 255, 255, 0.3)" : "#fff"}`
                    : "none",
                  borderRadius: 4,
                  cursor:
                    !isUpcoming && isAddingPlayList ? "default" : "pointer",
                  opacity: !isUpcoming && isAddingPlayList ? 0.7 : 1,
                }}
              >
                {isUpcoming ? (
                  <>
                    <img
                      src="/images/header/alarm.svg"
                      alt=""
                      style={{
                        width: 20,
                        height: 20,
                        filter: isUpcoming
                          ? "brightness(0) invert(1)"
                          : undefined,
                        opacity: 1,
                      }}
                    />
                    <span style={{ fontSize: 14 }}>
                      {isUpcomingNotified ? "알림설정됨" : "알림받기"}
                    </span>
                  </>
                ) : isAddingPlayList ? (
                  "추가 중..."
                ) : (
                  `▶ 재생하기`
                )}
              </button>
              )}
              {isMobile ? (
                /* 모바일: 아이콘 + 하단 라벨 (넷플릭스 앱 스타일) */
                <>
                  {mediaItem && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <WishlistButton
                        item={mediaItem}
                        mediaType={type}
                        className="detail-hero-action-btn"
                      />
                      <span style={{ fontSize: 13, color: "#888" }}>
                        찜한 목록
                      </span>
                    </div>
                  )}
                  {mediaItem && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <ShareButton
                        mediaType={type}
                        id={mediaItem.id}
                        className="detail-hero-action-btn"
                      />
                      <span style={{ fontSize: 13, color: "#888" }}>공유</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {mediaItem && !isUpcoming && (
                    <button
                      type="button"
                      className="detail-plus-btn"
                      onClick={async () => {
                        if (isAdultBlocked) {
                          setShowAdultModal(true);
                          return;
                        }
                        if (!user) {
                          router.push("/login");
                          return;
                        }
                        await fetchMyCustomPlaylists();
                        setShowPlaylistPicker(true);
                      }}
                      title="플레이리스트에 추가"
                      aria-label="플레이리스트에 추가"
                      style={{
                        flexShrink: 0,
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.3)",
                        color: "#fff",
                        fontSize: 22,
                        fontWeight: 300,
                        lineHeight: 1,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  )}
                  {mediaItem && !isUpcoming && (
                    <button
                      type="button"
                      className="detail-plus-btn detail-party-btn"
                      onClick={handleOpenWatchParty}
                      title="넷플릭스 파티 만들기"
                      aria-label="넷플릭스 파티 만들기"
                    >
                      <img
                        src="/images/detail/review/netflix-party-icon.svg"
                        alt=""
                      />
                    </button>
                  )}
                  {mediaItem && (
                    <WishlistButton item={mediaItem} mediaType={type} />
                  )}
                  {mediaItem && (
                    <ShareButton mediaType={type} id={mediaItem.id} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TabNav (래퍼: 루미 러너가 탭 높이에 갇히지 않도록) */}
      <div style={{ position: "relative" }}>
        {/* 케데헌 이스터에그: 탭 라인 위를 달리는 루미 → 클릭 시 게임 실행 */}
        {isKpopDemonHunters && (
          <button
            type="button"
            className="kpop-rumi-runner"
            onClick={() => setShowGameModal(true)}
            aria-label="RUN WITH RUMI 게임 실행"
            title="RUN WITH RUMI"
          />
        )}
      <div style={{ display: "flex", alignItems: "flex-end", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: `0 ${hPad}px 0 ${isMobile ? hPad : 87}px`, marginTop: isMobile ? 8 : 24, overflowX: "auto", scrollbarWidth: "none" }}>
        {tabItems
          // 1. 리뷰 탭이면서 권한이 없는 경우 필터링 (렌더링하지 않음)
          .filter((tab) => {
            if (tab.id === "review") {
              return !user || currentProfile?.isCommunity;
            }
            return true; // 다른 탭은 모두 유지
          })
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: "relative",
                height: 48,
                padding: "0 14px 0 4px",
                marginRight: 8,
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === tab.id
                    ? "2px solid #e50914"
                    : "2px solid transparent",
                marginBottom: -1,
                color: activeTab === tab.id ? "#fff" : "#888",
                fontWeight: activeTab === tab.id ? 700 : 400,
                fontSize: 16,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {tab.label}
              {tab.meta && (
                <span style={{ fontSize: 10, color: "#555", marginLeft: 2 }}>
                  {tab.meta}
                </span>
              )}
            </button>
          ))}
      </div>
      </div>

      {/* Tab content */}
      <div style={{ paddingBottom: isMobile ? 12 : 80, paddingLeft: isMobile ? 0 : 47 }}>
        {activeTab === "episodes" && isTv && renderEpisodesTab()}
        {activeTab === "info" && !isTv && renderStills()}
        {activeTab === "info" && !isTv && renderSynopsis()}
        {activeTab === "info" && !isTv && renderRelated()}
        {activeTab === "cast" && renderCast()}
        {(!user || currentProfile?.isCommunity) &&
          activeTab === "review" &&
          renderReviewTab()}
        {activeTab === "related" && renderRelated()}
      </div>

      {/* 플레이리스트 선택 바텀시트 */}
      {showPlaylistPicker && (
        <div
          onClick={() => setShowPlaylistPicker(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999, // 모바일 하단 네비(99996)보다 위

            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: isMobile ? "100%" : "min(760px, 90vw)",
              maxHeight: isMobile ? "60vh" : "76vh",
              display: "flex",
              flexDirection: "column",
              background: "#1b1b22",
              borderRadius: isMobile ? "16px 16px 0 0" : 12,
              border: "1px solid rgba(255,255,255,0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                플레이리스트에 추가
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPlaylistPicker(false);
                    setShowPlaylistCreator(true);
                  }}
                  style={{
                    height: 34,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + 새 플레이리스트
                </button>
                <button
                  onClick={() => setShowPlaylistPicker(false)}
                  aria-label="닫기"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#888",
                    fontSize: 20,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              style={{
                overflowY: "auto",
                padding: isMobile
                  ? "8px 0 calc(16px + env(safe-area-inset-bottom))"
                  : "8px 0 16px",
              }}
            >
              {customPlaylists.length === 0 ? (
                <div style={{ padding: "28px 20px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 14px", color: "#888", fontSize: 14 }}>
                    아직 만든 플레이리스트가 없습니다.
                  </p>
                  <button
                    onClick={() => {
                      setShowPlaylistPicker(false);
                      setShowPlaylistCreator(true);
                    }}
                    style={{
                      height: 36,
                      padding: "0 16px",
                      borderRadius: 6,
                      border: "none",
                      background: "#e50914",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    플레이리스트 만들기
                  </button>
                </div>
              ) : isMobile ? (
                customPlaylists.map((pl) => {
                  const alreadyAdded = pl.videoIds?.includes(itemKey);
                  const isAdding = addingToListId === pl.listId;
                  return (
                    <button
                      key={pl.listId}
                      disabled={alreadyAdded || isAdding}
                      onClick={async () => {
                        setAddingToListId(pl.listId);
                        try {
                          await updateCustomPlaylist(pl.listId, {
                            videoIds: Array.from(
                              new Set([...(pl.videoIds ?? []), itemKey]),
                            ),
                          });
                          showToast(`"${pl.name}"에 추가되었습니다.`);
                          setShowPlaylistPicker(false);
                        } finally {
                          setAddingToListId(null);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        width: "100%",
                        padding: "14px 20px",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        cursor: alreadyAdded ? "default" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 600,
                            color: alreadyAdded ? "#666" : "#fff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {pl.name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#666" }}>
                          {(pl.videoIds ?? []).length}개 작품
                        </p>
                      </div>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: alreadyAdded ? 13 : 20,
                          color: alreadyAdded ? "#e50914" : "#888",
                          fontWeight: alreadyAdded ? 700 : 300,
                        }}
                      >
                        {isAdding ? "…" : alreadyAdded ? "✓ 추가됨" : "+"}
                      </span>
                    </button>
                  );
                })
              ) : (
                /* 데스크탑: 마이페이지 플레이리스트 카드 디자인 그리드 */
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 16,
                    padding: "12px 20px 20px",
                  }}
                >
                  {customPlaylists.map((pl) => {
                    const alreadyAdded = pl.videoIds?.includes(itemKey);
                    const isAdding = addingToListId === pl.listId;
                    const previewKeys = (pl.videoIds ?? []).slice(0, 4);
                    const extraCount = (pl.videoIds ?? []).length - 4;
                    return (
                      <button
                        key={pl.listId}
                        disabled={alreadyAdded || isAdding}
                        className={alreadyAdded ? "" : "detail-playlist-card"}
                        onClick={async () => {
                          setAddingToListId(pl.listId);
                          try {
                            await updateCustomPlaylist(pl.listId, {
                              videoIds: Array.from(
                                new Set([...(pl.videoIds ?? []), itemKey]),
                              ),
                            });
                            showToast(`"${pl.name}"에 추가되었습니다.`);
                            setShowPlaylistPicker(false);
                          } finally {
                            setAddingToListId(null);
                          }
                        }}
                        style={{
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          gap: 0,
                          padding: 14,
                          border: "1px solid #2a2a2a",
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.025)",
                          cursor: alreadyAdded ? "default" : "pointer",
                          textAlign: "left",
                          opacity: alreadyAdded ? 0.55 : 1,
                        }}
                      >
                        {/* 모자이크 (2x2) */}
                        <div
                          style={{
                            position: "relative",
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)",
                            aspectRatio: "16 / 10",
                            overflow: "hidden",
                            border: "1px solid #252525",
                            borderRadius: 8,
                            background: "#101010",
                          }}
                        >
                          {Array.from({ length: 4 }, (_, i) => {
                            const key = previewKeys[i];
                            const url = key ? pickerImages[key] : "";
                            return (
                              <div
                                key={i}
                                style={{
                                  minWidth: 0,
                                  overflow: "hidden",
                                  background: "#080808",
                                }}
                              >
                                {url && (
                                  <img
                                    src={url}
                                    alt=""
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      display: "block",
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                          {extraCount > 0 && (
                            <span
                              style={{
                                position: "absolute",
                                right: 14,
                                bottom: 14,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: 52,
                                height: 36,
                                padding: "0 12px",
                                borderRadius: 999,
                                background: "rgba(0,0,0,0.7)",
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: 14,
                              }}
                            >
                              +{extraCount}
                            </span>
                          )}
                          {alreadyAdded && (
                            <span
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(0,0,0,0.45)",
                                color: "#e50914",
                                fontWeight: 800,
                                fontSize: 15,
                              }}
                            >
                              ✓ 추가됨
                            </span>
                          )}
                        </div>

                        <h3
                          style={{
                            margin: "14px 0 0",
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {pl.name}
                        </h3>
                        {pl.content && (
                          <p
                            style={
                              {
                                margin: "5px 0 0",
                                color: "#d0d0d0",
                                fontSize: 12,
                                lineHeight: 1.5,
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                                overflow: "hidden",
                              } as CSSProperties
                            }
                          >
                            {pl.content}
                          </p>
                        )}
                        <p style={{ margin: "10px 0 0", color: "#9a9a9a", fontSize: 12 }}>
                          {(pl.videoIds ?? []).length}개 작품
                          {isAdding ? " · 추가 중…" : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <PlaylistCreateModal
        open={showPlaylistCreator}
        videoIds={[itemKey]}
        previewItems={[
          {
            id: itemKey,
            posterPath: mediaItem?.poster_path,
            title,
          },
        ]}
        onClose={() => setShowPlaylistCreator(false)}
      />

      {/* 케데헌 이스터에그: RUN WITH RUMI 게임 모달 */}
      {showGameModal && <GameModal onClose={() => setShowGameModal(false)} />}

      {/* Stills lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={lightboxSrc}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              borderRadius: 8,
              objectFit: "contain",
            }}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            닫기
          </button>
        </div>
      )}

      {showAdultModal && isAdultBlocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="adult-verification-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400000,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(100%, 420px)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 8,
              background: "#141414",
              padding: isMobile ? 22 : 28,
              color: "#fff",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
            }}
          >
            <h2
              id="adult-verification-title"
              style={{
                margin: "0 0 10px",
                fontSize: isMobile ? 22 : 26,
                lineHeight: 1.2,
              }}
            >
              성인 인증이 필요합니다
            </h2>
            <p
              style={{
                margin: "0 0 22px",
                color: "rgba(255,255,255,0.72)",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              이 콘텐츠는 만 19세 이상만 시청할 수 있습니다. 생년월일
              확인 후 현재 프로필에서 19세 콘텐츠를 볼 수 있습니다.
            </p>
            <label
              htmlFor="adult-birth-date"
              style={{
                display: "none",
                marginBottom: 8,
                color: "rgba(255,255,255,0.86)",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              생년월일
            </label>
            <input
              id="adult-birth-date"
              type="date"
              value=""
              max={getToday()}
              readOnly
              required
              style={{
                display: "none",
                width: "100%",
                height: 46,
                boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,0.28)",
                borderRadius: 4,
                background: "#0f0f0f",
                color: "#fff",
                padding: "0 12px",
                fontSize: 15,
                colorScheme: "dark",
              }}
            />
            {false && (
              <p
                role="alert"
                style={{
                  margin: "10px 0 0",
                  color: "#ff7b7b",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {""}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 24,
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  router.push(
                    currentProfile
                      ? `/profiles/settings?profileId=${currentProfile.id}`
                      : "/profiles",
                  )
                }
                style={{
                  flex: 1,
                  height: 44,
                  border: "none",
                  borderRadius: 4,
                  background: "#e50914",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                인증하고 보기
              </button>
              <button
                type="button"
                onClick={() => router.replace("/")}
                style={{
                  flex: 1,
                  height: 44,
                  border: "1px solid rgba(255,255,255,0.28)",
                  borderRadius: 4,
                  background: "transparent",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {showPopup && !popupVideoKey && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 299999,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={handleClosePlayer}
            aria-label="뒤로"
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0,0,0,0.5)",
              border: "none",
              color: "#fff",
              fontSize: 15,
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ← 뒤로
          </button>
          <div
            style={{
              width: 48,
              height: 48,
              border: "4px solid rgba(255,255,255,0.25)",
              borderTopColor: "#e50914",
              borderRadius: "50%",
              animation: "vp-spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes vp-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {showPopup && popupVideoKey && (
        <VideoPlayer
          videoKey={popupVideoKey}
          title={title}
          onClose={handleClosePlayer}
          onTimeUpdate={(currentTime, duration) => {
            if (duration <= 0) return;
            const progress = Math.round((currentTime / duration) * 100);
            if (progress === 0) return;
            onUpdateProgress(mediaId, type, progress);
            if (isTv && activeEpisodeId) {
              onUpdateEpisodeProgress(mediaId, type, activeEpisodeId, progress);
            }
          }}
        />
      )}
    </div>
  );
}
