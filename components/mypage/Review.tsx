"use client";

import React, { useEffect, useState } from "react";
import { useCommunityStore } from "@/store/useCommunityStore";
import { useConfirmModal } from "@/components/common/ConfirmModal";
import "../scss/review.scss"; // SCSS 파일 임포트
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { useMovieStore } from "@/store/useMovieStore";
import { showToast } from "@/store/useToastStore";
import { relative } from "path";
import MobileFilterAccordion from "@/components/mypage/MobileFilterAccordion";

const REVIEW_PAGE_SIZE = 10;

// 별점을 계산해서 렌더링하는 컴포넌트 내부 함수
const renderStars = (rating: number) => {
  const roundedRating = Math.round(rating); // 반올림하여 정수 별 개수 계산
  const fullStars = "★".repeat(roundedRating);
  const emptyStars = "☆".repeat(5 - roundedRating);

  return fullStars + emptyStars;
};

type ScopeFilterType = "mine" | "liked" | "following";
type SortType = "recent" | "likes" | "comments";

const scopeFilters: { key: ScopeFilterType; label: string }[] = [
  { key: "mine", label: "내가 쓴 글" },
  { key: "liked", label: "좋아요 한 글" },
  { key: "following", label: "팔로우 글" },
];

const sortOptions: { key: SortType; label: string }[] = [
  { key: "recent", label: "최근 작성순" },
  { key: "likes", label: "좋아요 많은순" },
  { key: "comments", label: "댓글 많은순" },
];

const REPORT_REASONS = [
  "내용이 부적절해요",
  "스포일러가 포함되어 있어요",
  "욕설 또는 혐오 표현이에요",
  "도배성 리뷰예요",
  "기타",
];

export default function Review() {
  const { confirm, modal: confirmModal } = useConfirmModal();
  const {
    reviews,
    fetchUserReviews,
    reportReview,
    deleteReview,
    updateReview,
    updateReviewLikeCount,
    fetchUserReviewsById,
  } = useCommunityStore();
  const { currentProfile, updateUserLike } = useAuthStore();
  const { fetchMediaDetail } = useMovieStore();
  const [reviewPage, setReviewPage] = useState(1);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilterType>("mine");
  const [sortType, setSortType] = useState<SortType>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const currentSortLabel = sortOptions.find((o) => o.key === sortType)?.label;

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewText, setEditReviewText] = useState("");
  const [editReviewHasSpoiler, setEditReviewHasSpoiler] = useState(false);
  const [editRatedStar, setEditRatedStar] = useState(0);
  const [editHoverStar, setEditHoverStar] = useState(0);
  const [visibleSpoilerReviewIds, setVisibleSpoilerReviewIds] = useState<
    string[]
  >([]);
  const [counts, setCounts] = useState({ mine: 0, liked: 0, following: 0 });
  const [reportedReviewIds, setReportedReviewIds] = useState<string[]>([]);
  const [reportTargetReviewId, setReportTargetReviewId] = useState<
    string | null
  >(null);
  const [selectedReportReason, setSelectedReportReason] = useState("");

  // 2. 영화 상세 정보 보완
  const [enrichedReviews, setEnrichedReviews] = useState<any[]>([]);
  // 컴포넌트 내부 최상단에 선언되어 있어야 합니다.
  // const [processedReviews, setProcessedReviews] = useState<any[]>([]);

  useEffect(() => {
    const processAll = async () => {
      // 1. 데이터 수집 (기존 + 팔로잉)
      const followingReviews = (await loadFollowingReviews()) || [];
      // 2. 전체 리뷰에서 중복 없이 ID 기준으로 하나만 남기기
      // Map을 사용하면 가장 효율적으로 reviewId 중복을 제거할 수 있습니다.
      const reviewMap = new Map();

      // 내 리뷰 추가
      reviews.forEach((r) => reviewMap.set(r.reviewId, r));

      // 팔로잉 리뷰 추가 (이미 존재하면 덮어쓰거나 무시, 여기서는 덮어쓰지 않음)
      followingReviews.forEach((r) => {
        if (!reviewMap.has(r.reviewId)) {
          reviewMap.set(r.reviewId, r);
        }
      });

      const unique = Array.from(reviewMap.values());

      // 필터링 적용 전, 각 카테고리별로 몇 개인지 미리 계산합니다.
      const newCounts = {
        mine: unique.filter((r) => r.profileId === currentProfile?.id).length,
        liked: unique.filter((r) =>
          currentProfile?.community?.reviews.includes(
            `${r.videoId}#${r.reviewId}`,
          ),
        ).length,
        following: followingReviews.length,
      };
      setCounts(newCounts);

      // 2. 필터링 및 정렬
      const filteredAndSorted = applyFilterAndSort(
        unique,
        scopeFilter,
        sortType,
        followingReviews,
      );

      // 3. 페이지네이션 계산
      // processedReviews가 아닌 filteredAndSorted를 기준으로 계산합니다.
      const paged = filteredAndSorted.slice(
        (reviewPage - 1) * REVIEW_PAGE_SIZE,
        reviewPage * REVIEW_PAGE_SIZE,
      );

      // 4. 영화 상세 정보 보완 (Enriching)
      const enriched = await Promise.all(
        paged.map(async (review) => {
          const [type, id] = review.videoId.split("-");
          const detail = await fetchMediaDetail(id, type as "movie" | "tv");
          return { ...review, mediaInfo: detail };
        }),
      );

      // 5. 최종 상태 업데이트
      setEnrichedReviews(enriched);
    };

    if (reviews.length > 0) {
      processAll();
    }
  }, [reviews, currentProfile, scopeFilter, sortType, reviewPage]);

  const loadFollowingReviews = async () => {
    // 1. 팔로잉 리스트가 없으면 빈 배열 반환
    if (
      !currentProfile?.community?.following ||
      currentProfile.community.following.length === 0
    ) {
      return [];
    }

    try {
      // 2. 팔로잉 유저들의 리뷰 데이터를 병렬로 모두 요청
      const followingReviewsPromises = currentProfile.community.following.map(
        (userId) => fetchUserReviewsById(userId),
      );

      // 3. 모든 데이터가 올 때까지 대기
      const results = await Promise.all(followingReviewsPromises);

      // 4. 결과물 정리: null/undefined 제거 및 평탄화(flat)
      // results는 [[review1, review2], [review3], ...] 형태이므로 1차원 배열로 만듭니다.
      const allFollowingReviews = results
        .flat()
        .filter((r): r is any => r !== null && r !== undefined);

      return allFollowingReviews;
    } catch (error) {
      console.error("팔로잉 리뷰를 불러오는 중 에러 발생:", error);
      return [];
    }
  };

  const applyFilterAndSort = (
    data: any[],
    scope: string,
    sort: string,
    followingReviews: any[],
  ) => {
    // 1. 신고 수 필터링
    let result = data.filter((r) => (r.reportsCount ?? 0) <= 5);

    const followingReviewIds = new Set(followingReviews.map((r) => r.reviewId));

    // 2. Scope 필터링
    result = result.filter((r) => {
      if (scope === "mine") return r.profileId === currentProfile?.id;

      // 수정된 부분: || [] 를 통해 배열이 없을 경우 안전하게 빈 배열을 제공합니다.
      if (scope === "liked") {
        const likedList = currentProfile?.community?.reviews || [];
        return likedList.includes(`${r.videoId}#${r.reviewId}`);
      }

      if (scope === "following") {
        // const followingList = currentProfile?.community?.following || [];
        return followingReviewIds.has(r.reviewId);
      }

      return true;
    });

    // 3. 정렬
    return [...result].sort((a, b) => {
      if (sort === "likes") return (b.likesCount || 0) - (a.likesCount || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  // 3. 페이지네이션 계산
  // 1. 전체 페이지 수 계산
  const totalReviewPages = Math.ceil(enrichedReviews.length / REVIEW_PAGE_SIZE);

  // 2. 현재 페이지에 맞는 리뷰만 슬라이싱 (페이지는 1부터 시작한다고 가정)
  const pagedReviews = enrichedReviews.slice(
    (reviewPage - 1) * REVIEW_PAGE_SIZE,
    reviewPage * REVIEW_PAGE_SIZE,
  );

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

  const handleOpenEditReview = (reviewId: string) => {
    const targetReview = reviews.find((review) => review.reviewId === reviewId);
    if (!targetReview) return;

    setEditingReviewId(targetReview.reviewId);
    setEditReviewText(targetReview.content);
    setEditReviewHasSpoiler(targetReview.isSpoiler);
    setEditRatedStar(targetReview.rating);
    setEditHoverStar(0);
    // setReportTargetReviewId(null);
    // setSelectedReportReason("");
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

    await updateReview(reviewId, videoId, {
      content,
      isSpoiler: editReviewHasSpoiler,
      rating: editRatedStar || 5,
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

  // const handleSubmitReview = async () => {
  //   if (!reviewText.trim()) return;

  //   await addReview({
  //     content: reviewText.trim(),
  //     videoId: "",
  //     isSpoiler: reviewHasSpoiler,
  //     videoId: "",
  //   });

  //   setReviewText("");
  //   setReviewHasSpoiler(false);
  // };

  return (
    <>
      {confirmModal}
      {/* 3. 섹션 타이틀 및 총 개수 표시 */}
      <div className="section-title-row">
        <h2>리뷰 관리</h2>
        <span className="total-count">{`${enrichedReviews.length}개`}</span>
      </div>

      {/* 4. 스크린샷 스타일의 서브 툴바 (타원형 칩 필터 + 우측 정렬) */}
      <div className="community-toolbar">
        <div className="community-chips">
          {scopeFilters.map((sf) => (
            <button
              type="button"
              key={sf.key}
              className={`chip ${scopeFilter === sf.key ? "is-active" : ""}`}
              onClick={() => setScopeFilter(sf.key)}
            >
              {sf.label}{" "}
              {sf.key === "mine"
                ? counts.mine
                : sf.key === "liked"
                  ? counts.liked
                  : sf.key === "following"
                    ? counts.following
                    : 0}
            </button>
          ))}
        </div>
        <MobileFilterAccordion
          ariaLabel="리뷰 범위 필터"
          value={scopeFilter}
          options={scopeFilters.map((sf) => ({
            value: sf.key,
            label: sf.label,
            count: counts[sf.key],
          }))}
          onChange={setScopeFilter}
        />
        <MobileFilterAccordion
          ariaLabel="리뷰 정렬"
          value={sortType}
          options={sortOptions
            .filter((option) => option.key !== "comments")
            .map((option) => ({
              value: option.key,
              label: option.label,
            }))}
          onChange={setSortType}
        />

        <div className="community-sort">
          <button
            type="button"
            className="sort-btn"
            onClick={() => setSortOpen(!sortOpen)}
          >
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
                // 1. 리뷰 탭일 때 "comments" 옵션 필터링
                .filter((opt) => !(opt.key === "comments"))
                .map((opt) => (
                  <li key={opt.key}>
                    <button
                      type="button"
                      className={`sort-option ${sortType === opt.key ? "is-selected" : ""}`}
                      onClick={() => {
                        setSortType(opt.key);
                        setSortOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
      <div className="review-container">
        {reviews.length > 0 ? (
          <>
            {/* 목록 섹션 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(pagedReviews || []).map((review) => {
                // 옵셔널 체이닝으로 currentProfile이 없어도 에러가 안 나게 수정
                const userLikedReviews =
                  currentProfile?.community?.reviews || [];
                const reviewKey = `${review.videoId}#${review.reviewId}`;
                const isLiked = userLikedReviews.includes(reviewKey);
                const isReported = reportedReviewIds.includes(review.reviewId);
                const [linkType, linkId] = review.videoId.split("-");
                const isEditingReview = editingReviewId === review.reviewId;
                const isMyReview = Boolean(
                  currentProfile &&
                  ((review.userId && review.profileId === currentProfile.id) ||
                    (!review.userId &&
                      review.profileId === currentProfile.id &&
                      review.nickname === currentProfile.nickname)),
                );
                const movie = review.mediaInfo;
                const shouldBlurSpoiler =
                  review.isSpoiler &&
                  !visibleSpoilerReviewIds.includes(review.reviewId);

                return (
                  <article
                    key={review.reviewId}
                    className="mypage-review-card"
                    style={{
                      border: "1px solid #2a2a35",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.025)",
                      padding: 18,
                    }}
                  >
                    <div
                      className="mypage-review-card__main"
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 10,
                      }}
                    >
                      <Link
                        className="mypage-review-card__poster-link"
                        href={`/detail/${linkType}/${linkId}`}
                      >
                        <div className="review-thumb">
                          <img
                            src={
                              movie
                                ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
                                : "https://image.tmdb.org/t/p/w200/evoEi8SBSvllEveM3V6nCJ6vKj8.jpg"
                            }
                            alt={movie?.title || movie?.name || "영화 포스터"}
                          />
                        </div>
                      </Link>
                      <div className="mypage-review-card__info w-full">
                        {/* h3에 클래스 부여 및 margin 리셋 */}
                        <h3
                          className="mypage-review-card__title"
                          style={{ margin: "0 0 6px 0" }}
                        >
                          {movie?.title || movie?.name || "로딩 중..."}
                        </h3>

                        {/* 메타 정보 영역 (닉네임, 별점 등) */}
                        <div
                          className="mypage-review-card__meta"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "4px 8px",
                            marginBottom: 12,
                          }}
                        >
                          <strong
                            style={{
                              color: "#fff",
                              fontSize: 14,
                              fontWeight: 700,
                            }}
                          >
                            {review.nickname}
                          </strong>
                          <span
                            style={{
                              color: "#e50914",
                              fontSize: 13,
                              lineHeight: 1,
                            }}
                          >
                            {renderStars(review.rating)}
                          </span>
                          <span style={{ color: "#aaa", fontSize: 12 }}>
                            {review.rating.toFixed(1)} / 5.0
                          </span>
                          {review.isSpoiler && (
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: 4,
                                border: "1px solid rgba(229,9,20,0.45)",
                                color: "#e50914",
                                fontSize: 11,
                                fontWeight: 600,
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
                            onClick={() =>
                              handleOpenReportReview(review.reviewId)
                            }
                            aria-pressed={isReported}
                            style={{
                              border: `1px solid ${isReported ? "rgba(229,9,20,0.7)" : "#3a3a48"}`,
                              borderRadius: 4,
                              background: isReported
                                ? "rgba(229,9,20,0.16)"
                                : "transparent",
                              color: isReported ? "#e50914" : "#888",
                              height: 28,
                              padding: "0 10px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: isReported ? 700 : 400,
                              position: "absolute",
                              top: "0",
                              right: "0",
                            }}
                          >
                            신고
                          </button>
                        )}
                        {/* 신고 타겟 ID가 이 리뷰인 경우 신고 UI 표시 */}
                        {!isMyReview &&
                          reportTargetReviewId === review.reviewId && (
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
                                    onClick={() =>
                                      setSelectedReportReason(reason)
                                    }
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

                        {isEditingReview ? (
                          <div
                            className="mypage-review-card__review-area"
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
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onMouseEnter={() => setEditHoverStar(star)}
                                    onMouseLeave={() => setEditHoverStar(0)}
                                    onClick={() => setEditRatedStar(star)}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      color:
                                        star <= (editHoverStar || editRatedStar)
                                          ? "#e50914"
                                          : "#4a4a4a",
                                      cursor: "pointer",
                                      fontSize: 20,
                                      lineHeight: 1,
                                      padding: "0 1px",
                                    }}
                                  >
                                    {"\u2605"}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="detail-secondary-hover"
                                onClick={() =>
                                  setEditReviewHasSpoiler((prev) => !prev)
                                }
                                aria-pressed={editReviewHasSpoiler}
                                style={{
                                  height: 30,
                                  padding: "0 10px",
                                  border: `1px solid ${editReviewHasSpoiler ? "rgba(229,9,20,0.7)" : "rgba(255,255,255,0.22)"}`,
                                  borderRadius: 5,
                                  background: editReviewHasSpoiler
                                    ? "rgba(229,9,20,0.14)"
                                    : "rgba(255,255,255,0.06)",
                                  color: editReviewHasSpoiler
                                    ? "#fff"
                                    : "#cfcfcf",
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
                            className="mypage-review-card__review-area"
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
                                filter: shouldBlurSpoiler
                                  ? "blur(6px)"
                                  : "none",
                                opacity: shouldBlurSpoiler ? 0.72 : 1,
                                userSelect: shouldBlurSpoiler ? "none" : "auto",
                                transition:
                                  "filter 0.18s ease, opacity 0.18s ease",
                              }}
                            >
                              <p
                                className="mypage-review-card__content"
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
                      </div>
                    </div>

                    <time
                      className="mypage-review-card__date"
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
                      className="mypage-review-card__actions"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between", //  양쪽 끝으로 정렬 추가
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 10,
                      }}
                    >
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
                      {isMyReview && (
                        <div
                          className="mypage-review-card__owner-actions"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
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
                    setReviewPage((page) =>
                      Math.min(totalReviewPages, page + 1),
                    )
                  }
                  disabled={reviewPage === totalReviewPages}
                  style={{
                    background: "none",
                    border: "1px solid #3a3a48",
                    color: reviewPage === totalReviewPages ? "#444" : "#888",
                    width: 34,
                    height: 34,
                    borderRadius: 4,
                    cursor:
                      reviewPage === totalReviewPages ? "default" : "pointer",
                    fontSize: 14,
                  }}
                >
                  ›
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="community-empty">
            <p className="empty-text">작성된 리뷰가 없습니다.</p>
          </div>
        )}
      </div>
    </>
  );
}
