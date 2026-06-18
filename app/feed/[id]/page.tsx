"use client";

import React, { useEffect, useMemo, useState } from "react";
import { showToast } from "@/store/useToastStore";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/common/BackButton";
import { auth } from "@/firebase/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import { useFeedStore } from "@/store/useFeedStore";
import {
  FEED_CATEGORY_LABELS,
  getInitial,
  getPosterUrl,
  getRelativeTime,
  parseFeedMediaMeta,
} from "@/types/feedData";
import "../../scss/feed.scss";
import FeedAuthorBadges from "@/components/feed/FeedAuthorBadges";

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

export default function FeedDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, currentProfile } = useAuthStore();
  const {
    feeds,
    onAddComment,
    onDeleteComment,
    onHydrateFeeds,
    onToggleCommentLike,
    onToggleLike,
    onUpdateComment,
  } = useFeedStore();
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const currentUserId =
    user?.userId ||
    (user as { uid?: string } | null)?.uid ||
    auth.currentUser?.uid;

  const review = useMemo(
    () => feeds.find((item) => item.feedId === params.id) ?? null,
    [params.id, feeds],
  );
  const mediaMeta = review ? parseFeedMediaMeta(review.mediaMeta) : null;
  const isGeneralPost = review?.postType === "general";

  useEffect(() => {
    void onHydrateFeeds();
  }, [currentProfile?.id, currentUserId, onHydrateFeeds]);

  const handleSubmitComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!review || !commentText.trim()) return;
    if (!currentUserId) {
      showToast("로그인이 필요합니다.");
      router.push("/login");
      return;
    }
    if (!currentProfile) {
      showToast("프로필을 선택해 주세요.");
      return;
    }

    if (editingCommentId) {
      void onUpdateComment(review.feedId, editingCommentId, commentText.trim());
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

    void onAddComment(review.feedId, nextComment);
    setCommentText("");
  };

  const handleOpenEditComment = (commentId: string, text: string) => {
    setEditingCommentId(commentId);
    setCommentText(text);
  };

  const handleDeleteComment = (commentId: string) => {
    if (!review) return;

    void onDeleteComment(review.feedId, commentId);
    if (editingCommentId === commentId) {
      setEditingCommentId(null);
      setCommentText("");
    }
  };

  const handleCopyShareLink = () => {
    if (!review) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    void navigator.clipboard.writeText(
      `${window.location.origin}/feed/${review.feedId}`,
    );
  };
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
  };

  const handleCommentLike = (commentId: string) => {
    if (!review) return;
    if (!requireFeedAuth()) return;

    void onToggleCommentLike(review.feedId, commentId);
  };

  if (!review) {
    return (
      <main className="feed-page feed-detail-page">
        <div className="inner">
          <div className="feed-detail-empty">
            <h1>피드를 찾을 수 없어요.</h1>
            <BackButton fallback="/feed" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="feed-page feed-detail-page">
      <div className="inner">
        <BackButton fallback="/feed" className="feed-back-link" />

        <article className="feed-post feed-detail-card">
          <div className="post-head">
            <Link
              href={getUserProfileHref(review.userId, review.profileId)}
              className="post-avatar profile-avatar-link"
              aria-label={`${review.author} 프로필 보기`}
            >
              {review.authorImage ? (
                <img src={review.authorImage} alt="" />
              ) : (
                getInitial(review.author)
              )}
            </Link>
            <div className="feed-meta-info">
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
              {isGeneralPost && review.category && (
                <span className="feed-category-tag">
                  {FEED_CATEGORY_LABELS[review.category]}
                </span>
              )}
            </div>
          </div>

          <div
            className={`post-body review-body${isGeneralPost ? " general-post-body" : ""}`}
          >
            {review.mediaType && review.mediaId && (
              <Link
                href={`/detail/${review.mediaType}/${review.mediaId}`}
                className="thumb"
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
                <div className="review-media-copy">
                  <h4>{review.mediaTitle}</h4>
                  <p className="meta meta-primary">{mediaMeta?.primary}</p>
                  {mediaMeta?.average && (
                    <p className="meta meta-average">{mediaMeta.average}</p>
                  )}
                  {!isGeneralPost && (
                    <div className="stars">
                      <span className="stars-label">내 별점</span>
                      {renderRatingStars(review.rating)}
                      <em>{review.rating.toFixed(1)} / 5.0</em>
                    </div>
                  )}
                </div>
              )}
              <p className="review-text">{review.content}</p>
            </div>
          </div>

          <div className="post-actions">
            <button
              type="button"
              className={`action ${review.liked ? "liked" : ""}`}
              onClick={() => handleLike(review.feedId)}
            >
              {review.liked ? "♥" : "♡"} {review.likesCount}
            </button>
            {/* <span className="action readonly">댓글 {review.comments}</span> */}
            <button
              type="button"
              className={copied ? "action copied" : "action"}
              onClick={handleCopyShareLink}
            >
              {copied ? "복사됨" : "공유"}
            </button>
          </div>
        </article>

        <section className="feed-detail-comments">
          <div className="detail-comments-head">
            <h2>댓글 {review.comments}</h2>
          </div>

          <form
            className="comment-write detail-comment-write"
            onSubmit={handleSubmitComment}
          >
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

          <div className="comment-list detail-comment-list">
            {review.commentsList.length > 0 ? (
              review.commentsList.map((comment) => (
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
                        onClick={() => handleCommentLike(comment.commentId)}
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
                            onClick={() =>
                              handleDeleteComment(comment.commentId)
                            }
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
        </section>
      </div>
    </main>
  );
}
