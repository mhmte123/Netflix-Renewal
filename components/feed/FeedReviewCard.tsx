"use client";

import React, { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  useFeedStore,
  type FeedCommentView,
  type FeedView,
} from "@/store/useFeedStore";
import {
  FEED_CATEGORY_LABELS,
  getInitial,
  getPosterUrl,
  getRelativeTime,
  parseFeedMediaMeta,
  REPORT_REASONS,
} from "@/types/feedData";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { showToast } from "@/store/useToastStore";
import { auth } from "@/firebase/firebase";
import FeedAuthorBadges from "@/components/feed/FeedAuthorBadges";
import RepBadge from "@/components/common/RepBadge";

interface FeedReviewCardProps {
  review: FeedView;
  showOwnerActions?: boolean;
  onEdit?: (review: FeedView) => void;
  onDelete?: (feedId: string) => void;
}

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

export default function FeedReviewCard({
  review,
  showOwnerActions = false,
  onEdit,
  onDelete,
}: FeedReviewCardProps) {
  const router = useRouter();
  const mediaMeta = parseFeedMediaMeta(review.mediaMeta);
  const isGeneralPost = review.postType === "general";
  const {
    user,
    currentProfile,
    updateUserLikeFeeds,
    updateUserCommentFeed,
    updateUserReportFeed,
  } = useAuthStore();
  const currentUserId =
    user?.userId ||
    (user as { uid?: string } | null)?.uid ||
    auth.currentUser?.uid;
  const {
    feeds,
    onAddComment,
    onDeleteComment,
    onReportFeed,
    onToggleCommentLike,
    onToggleLike,
    onUpdateComment,
  } = useFeedStore();

  const [commentTargetReviewId, setCommentTargetReviewId] = useState<
    string | null
  >(null);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState("");
  const profileReported = Boolean(
    currentProfile?.community?.reportfeeds?.includes(review.feedId),
  );
  const [reportOverride, setReportOverride] = useState<boolean | null>(null);
  const isReported = reportOverride ?? profileReported;

  const selectedCommentReview =
    feeds.find((feed) => feed.feedId === commentTargetReviewId) ??
    (commentTargetReviewId === review.feedId ? review : null);
  const isReviewOwner = Boolean(
    currentUserId &&
      review.userId === currentUserId &&
      (!review.profileId || review.profileId === currentProfile?.id),
  );
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

  const getUserProfileHref = (userId?: string, profileId?: number) => {
    if (!userId) return "";

    const params = new URLSearchParams();
    if (profileId != null) params.set("profileId", String(profileId));

    const query = params.toString();
    return `/users/${userId}${query ? `?${query}` : ""}`;
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
  const closeCommentModal = useCallback(() => {
    setCommentTargetReviewId(null);
    setEditingCommentId(null);
    setCommentText("");
  }, []);

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

  const isMyComment = (comment: FeedCommentView) =>
    Boolean(
      currentUserId &&
        comment.userId === currentUserId &&
        (!comment.profileId || comment.profileId === currentProfile?.id),
    );

  const getCommentAuthor = (comment: FeedCommentView) =>
    isMyComment(comment) && currentProfile?.nickname
      ? currentProfile.nickname
      : comment.author;

  const getCommentAuthorImage = (comment: FeedCommentView) =>
    isMyComment(comment) && currentProfile?.imgUrl
      ? currentProfile.imgUrl
      : comment.authorImage;

  const handleToggleCommentLike = (reviewId: string, commentId: string) => {
    if (!requireFeedAuth()) return;

    void onToggleCommentLike(reviewId, commentId);
    updateUserCommentFeed(reviewId, commentId);
  };

  const handleOpenEditComment = (commentId: string, text: string) => {
    setEditingCommentId(commentId);
    setCommentText(text);
  };

  const handleDeleteComment = async (reviewId: string, commentId: string) => {
    try {
      await onDeleteComment(reviewId, commentId);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setCommentText("");
      }
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
      showToast("댓글 삭제에 실패했습니다.");
    }
  };

  const handleToggleReport = async () => {
    if (!requireFeedAuth()) return;
    if (isReviewOwner) return;

    if (isReported) {
      await onReportFeed(review.feedId, false);
      updateUserReportFeed(review.feedId);
      setReportOverride(false);
      setReportOpen(false);
      setSelectedReportReason("");
      showToast("신고가 취소되었습니다.");
      return;
    }

    setReportOpen((open) => !open);
    setSelectedReportReason("");
  };

  const handleSubmitReport = async () => {
    if (!requireFeedAuth()) return;
    if (isReviewOwner || !selectedReportReason) return;

    await onReportFeed(review.feedId, true, selectedReportReason);
    updateUserReportFeed(review.feedId);
    setReportOverride(true);
    setReportOpen(false);
    setSelectedReportReason("");
    showToast("신고되었습니다.");
  };

  const handleSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCommentReview || !commentText.trim()) return;
    if (!requireFeedAuth()) return;
    if (!currentUserId || !currentProfile) return;

    if (editingCommentId) {
      try {
        await onUpdateComment(
          selectedCommentReview.feedId,
          editingCommentId,
          commentText.trim(),
        );
        setEditingCommentId(null);
        setCommentText("");
      } catch (error) {
        console.error("댓글 수정 실패:", error);
        showToast("댓글 수정에 실패했습니다.");
      }
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

  const renderCommentModal = () => {
    if (!selectedCommentReview || typeof document === "undefined") return null;

    const commentsList = Array.isArray(selectedCommentReview.commentsList)
      ? selectedCommentReview.commentsList
      : [];

    return createPortal(
      <div className="feed-page feed-modal-portal">
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
                commentsList.map((comment) => {
                  const commentAuthor = getCommentAuthor(comment);
                  const commentAuthorImage = getCommentAuthorImage(comment);
                  const canManageComment =
                    comment.isMine || isMyComment(comment);

                  return (
                    <div className="comment-item" key={comment.commentId}>
                      <Link
                        href={getUserProfileHref(
                          comment.userId,
                          comment.profileId,
                        )}
                        className="comment-avatar profile-avatar-link"
                        aria-label={`${commentAuthor} 프로필 보기`}
                      >
                        {commentAuthorImage ? (
                          <img src={commentAuthorImage} alt="" />
                        ) : (
                          getInitial(commentAuthor)
                        )}
                      </Link>
                      <div className="comment-content">
                        <div className="comment-meta">
                          <strong>{commentAuthor}</strong>
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
                            {comment.liked ? "♥" : "♡"} 좋아요{" "}
                            {comment.likesCount}
                          </button>
                          {canManageComment && (
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
                  );
                })
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
      </div>,
      document.body,
    );
  };

  return (
    <article className={`feed-post ${reportOpen ? "report-open" : ""}`}>
      <Link
        href={`/feed/${review.feedId}`}
        className="feed-card-link"
        aria-label={`${review.mediaTitle || FEED_CATEGORY_LABELS[review.category || "daily"]} 피드 상세 보기`}
      />

      <div className="post-head">
        <Link
          href={getUserProfileHref(review.userId, review.profileId)}
          className="post-avatar profile-avatar-link feed-card-layer"
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
            {/* <FeedAuthorBadges badgeIds={review.authorBadgeIds} /> */}
            <RepBadge badge={review.authorEquippedBadge} size="sm" className="feed-author-rep-badge" />
          </h3>
          <div className="post-info">
            <span className="time">{getRelativeTime(review.createdAt)}</span>
            {!review.isPublic && <span className="private-tag">비공개</span>}
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
          {!isReviewOwner && (
            <div className="report-menu">
              <button
                type="button"
                className={isReported ? "report-btn active" : "report-btn"}
                onClick={() => void handleToggleReport()}
                aria-pressed={isReported}
              >
                {isReported ? "신고됨" : "신고"}
              </button>
              {reportOpen && (
                <div className="feed-report-panel">
                  <p>신고 사유</p>
                  <div className="report-reasons">
                    {REPORT_REASONS.map((reason) => (
                      <button
                        type="button"
                        key={reason}
                        className={
                          selectedReportReason === reason ? "selected" : ""
                        }
                        onClick={() => setSelectedReportReason(reason)}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <div className="report-actions">
                    <button type="button" onClick={() => setReportOpen(false)}>
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitReport()}
                      disabled={!selectedReportReason}
                    >
                      신고
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {review.isSpoiler && <span className="spoiler-tag">스포일러</span>}
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
                <p className="meta meta-primary">{mediaMeta.primary}</p>
                {mediaMeta.average && (
                  <p className="meta meta-average">{mediaMeta.average}</p>
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
          <div className="review-text-wrap">
            <p className="review-text">{review.content}</p>
          </div>
        </div>
      </div>

      <div
        className={`post-actions feed-card-layer ${
          showOwnerActions ? "has-owner-actions" : ""
        }`}
      >
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
        {showOwnerActions && (
          <div className="review-owner-actions">
            <button
              type="button"
              className="action"
              onClick={() => onEdit?.(review)}
            >
              수정
            </button>
            <button
              type="button"
              className="action delete-review-btn"
              onClick={() => onDelete?.(review.feedId)}
            >
              삭제
            </button>
          </div>
        )}
      </div>
      {renderCommentModal()}
    </article>
  );
}
