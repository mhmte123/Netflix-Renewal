"use client";

import { useEffect, useRef, useState } from "react";
import { useFollowStore } from "@/store/useFollowStore";
import { useAuthStore } from "@/store/useAuthStore";
import "./scss/followFriendsModal.scss";
import RepBadge from "@/components/common/RepBadge";

interface Props {
  onClose: () => void;
}

export default function FollowFriendsModal({ onClose }: Props) {
  const { similarUsers, isLoadingSimilar, fetchSimilarUsers, follow, followingUsers } = useFollowStore();
  const { currentProfile } = useAuthStore();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSimilarUsers();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const followingIds = new Set<string>([
    ...(currentProfile?.community?.following ?? []),
    ...followingUsers.map((u) => u.userId),
    ...pendingIds,
  ]);

  const filtered = keyword.trim()
    ? similarUsers.filter((u) => u.nickname.includes(keyword.trim()))
    : similarUsers;

  const handleFollow = async (userId: string) => {
    setPendingIds((prev) => new Set([...prev, userId]));
    await follow(userId);
  };

  return (
    <div
      className="follow-friends-modal"
      role="dialog"
      aria-modal="true"
      aria-label="친구 찾기"
    >
      <div className="follow-friends-modal__backdrop" onClick={onClose} />
      <div className="follow-friends-modal__panel" ref={panelRef}>
        <div className="follow-friends-modal__header">
          <div>
            <h2>친구 찾기</h2>
            <p>취향이 비슷한 유저를 팔로우해 보세요</p>
          </div>
          <button
            className="follow-friends-modal__close"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="follow-friends-modal__search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="닉네임으로 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="follow-friends-modal__body">
          {isLoadingSimilar ? (
            <div className="follow-friends-modal__skeleton-list">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="follow-friends-modal__skeleton-item">
                  <div className="follow-friends-modal__skeleton-avatar skeleton-pulse" />
                  <div className="follow-friends-modal__skeleton-info">
                    <div className="follow-friends-modal__skeleton-name skeleton-pulse" />
                    <div className="follow-friends-modal__skeleton-tags skeleton-pulse" />
                  </div>
                  <div className="follow-friends-modal__skeleton-btn skeleton-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="follow-friends-modal__empty">
              <p>추천할 유저가 없습니다</p>
            </div>
          ) : (
            <ul className="follow-friends-modal__list">
              {filtered.map((user) => {
                const isFollowing = followingIds.has(user.userId);
                return (
                  <li key={user.userId} className="follow-friends-modal__item">
                    <div className="follow-friends-modal__avatar">
                      {user.imgUrl ? (
                        <img src={user.imgUrl} alt={user.nickname} />
                      ) : (
                        <span>{user.nickname.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="follow-friends-modal__info">
                      <div className="name-box">
                        <strong>{user.nickname}</strong>
                        <RepBadge badge={user.badge} size="sm" />
                      </div>
                      {user.matchRate > 0 && (
                        <span className="follow-friends-modal__match">
                          취향 일치 {user.matchRate}%
                        </span>
                      )}
                      {user.tags.length > 0 && (
                        <div className="follow-friends-modal__tags">
                          {user.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="follow-friends-modal__tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className={`follow-friends-modal__follow-btn${isFollowing ? " is-following" : ""}`}
                      type="button"
                      onClick={() => !isFollowing && handleFollow(user.userId)}
                      disabled={isFollowing}
                    >
                      {isFollowing ? "팔로잉" : "팔로우"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
