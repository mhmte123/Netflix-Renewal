"use client";

import { useEffect, useState } from "react";
import AppIcon from "@/components/common/AppIcon";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePlayListStore } from "@/store/usePlayListStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useFollowStore } from "@/store/useFollowStore";
import { dummyPlaylists } from "@/data/dummyPlaylist";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import RepBadge from "@/components/common/RepBadge";
import "../../../scss/playlistDetail.scss";
import { showToast } from "@/store/useToastStore";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

// createdAt → "N개월 전 / N일 전 업데이트"
function updatedLabel(createdAt?: string): string {
  if (!createdAt) return "업데이트";
  const then = new Date(createdAt).getTime();
  if (Number.isNaN(then)) return "업데이트";
  const diff = Date.now() - then;
  const day = 1000 * 60 * 60 * 24;
  const days = Math.floor(diff / day);
  if (days < 1) return "오늘 업데이트";
  if (days < 30) return `${days}일 전 업데이트`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전 업데이트`;
  return `${Math.floor(months / 12)}년 전 업데이트`;
}

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.user as string;
  const listId = params.id as string;

  const { currentPlaylist, fetchPlaylist, togglePlaylistLike } = usePlayListStore();
  const myUserId = useAuthStore((s) => s.user?.userId) ?? "";
  const currentProfile = useAuthStore((s) => s.currentProfile);
  const { follow, unfollow } = useFollowStore();

  // 제작자 팔로우 상태
  const isFollowing = (currentProfile?.community?.following ?? []).includes(userId);
  const isSelf = !!myUserId && userId === myUserId;
  const toggleFollow = () => {
    if (isFollowing) unfollow(userId);
    else follow(userId);
  };

  const [view, setView] = useState<"grid" | "list">("grid");
  const [owner, setOwner] = useState<{ name: string; img: string; badge: string }>({ name: "", img: "", badge: "" });

  useEffect(() => {
    if (userId && listId) fetchPlaylist(userId, listId);
  }, [userId, listId, fetchPlaylist]);

  // 제작자(소유자) 정보 로드
  useEffect(() => {
    if (!userId) return;
    let ignore = false;

    (async () => {
      if (userId.startsWith("dummy")) {
        const d = dummyPlaylists.find((p) => p.userId === userId);
        if (!ignore) setOwner({ name: d?.nickname ?? "유저", img: "", badge: d?.badge ?? "" });
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", userId));
        const p = snap.exists() ? snap.data().profile?.[0] : null;
        if (!ignore) setOwner({ name: p?.nickname ?? "유저", img: p?.imgUrl ?? "", badge: p?.badges?.equippedBadges ?? "" });
      } catch {
        if (!ignore) setOwner({ name: "유저", img: "", badge: "" });
      }
    })();

    return () => {
      ignore = true;
    };
  }, [userId]);

  if (!currentPlaylist) {
    return (
      <div className="playlist-detail-page">
        <p className="pl-empty">플레이리스트를 불러오는 중이거나 찾을 수 없습니다.</p>
      </div>
    );
  }

  const items: any[] = currentPlaylist.items ?? [];
  const heroPosters = items
    .filter((i) => i.poster_path)
    .slice(0, 6)
    .map((i) => `${TMDB_IMG}${i.poster_path}`);
  const likedBy: string[] = (currentPlaylist as any).likedBy ?? [];
  const liked = !!myUserId && likedBy.includes(myUserId);
  const likeCount = currentPlaylist.likesCount ?? likedBy.length;
  const ownerInitial = owner.name ? owner.name.slice(0, 1) : "?";

  const handleShare = (e: React.MouseEvent) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const anchor = { x: rect.left + rect.width / 2, y: rect.top };

      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast("링크가 복사되었습니다.", {
          icon: "/images/icon/link.svg",
          anchor,
        });
      });
    }
  };

  return (
    <div className="playlist-detail-page">
      {/* 히어로 배너 */}
      <div className="pl-hero">
        <div className="pl-hero-bg">
          {heroPosters.map((src, i) => (
            <img key={i} src={src} alt="" aria-hidden="true" />
          ))}
          <div className="pl-hero-gradient" />
        </div>
        <div className="pl-hero-creator">
          <span
            className="pl-creator-avatar"
            style={{ cursor: "pointer" }}
            onClick={() => router.push(`/users/${userId}`)}
          >
            {owner.img ? <img src={owner.img} alt={owner.name} /> : ownerInitial}
          </span>
          <span
            className="pl-creator-name"
            style={{ cursor: "pointer" }}
            onClick={() => router.push(`/users/${userId}`)}
          >
            {owner.name}
          </span>
          <RepBadge badge={owner.badge} size="sm" className="pl-creator-badge" />
          {!isSelf && myUserId && (
            <button
              type="button"
              className={`pl-follow-btn ${isFollowing ? "following" : ""}`}
              onClick={toggleFollow}
            >
              {isFollowing ? "팔로잉" : "+ 팔로우"}
            </button>
          )}
        </div>
      </div>

      {/* 플레이리스트 정보 */}
      <div className="pl-body">
        <h1 className="pl-title">{currentPlaylist.name}</h1>
        {currentPlaylist.content && <p className="pl-desc">{currentPlaylist.content}</p>}

        <div className="pl-stat-line">
          좋아요 {likeCount} <span className="dot">·</span>{" "}
          {updatedLabel(currentPlaylist.createdAt)}
        </div>

        <div className="pl-actions">
          <button
            type="button"
            className={`pl-action ${liked ? "active" : ""}`}
            onClick={() => togglePlaylistLike(userId, listId)}
            disabled={!myUserId}
          >
            <AppIcon name="like" size={16} /> 좋아요
          </button>
          {/* <button type="button" className="pl-action">
            <AppIcon name="comment" size={16} /> 댓글
          </button> */}
          <button type="button" className="pl-action" onClick={handleShare}>
            <AppIcon name="share" size={16} /> 공유
          </button>
        </div>

        {/* 작품 목록 헤더 */}
        <div className="pl-works-head">
          <h2>
            작품들 <span>{items.length}</span>
          </h2>
          <div className="pl-view-toggle">
            <button
              type="button"
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
              aria-label="그리드 보기"
            >
              ▦
            </button>
            <button
              type="button"
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
              aria-label="리스트 보기"
            >
              ☰
            </button>
          </div>
        </div>

        {/* 작품 목록 */}
        <div className={view === "grid" ? "pl-works pl-works--grid" : "pl-works pl-works--list"}>
          {items.map((item) => {
            // console.log(item.poster_path)
            return(
            <Link
              key={`${item.mediaType}-${item.id}`}
              href={`/detail/${item.mediaType}/${item.id}`}
              className="pl-work-card"
            >
              <div className="pl-work-poster">
                {item.poster_path ? (
                  <img src={`${TMDB_IMG}${item.poster_path}`} alt={item.title} />
                ) : (
                  <div className="pl-work-fallback" aria-hidden="true">
                    <AppIcon name="film" size={22} />
                  </div>
                )}
              </div>
              <div className="pl-work-info">
                <h3>{item.title}</h3>
                <span className="pl-work-rating">
                  평균 ★ {(((item.vote_average ?? 0) as number) / 2).toFixed(1)}
                </span>
                <span className="pl-work-cat">
                  {item.mediaType === "movie" ? "영화" : "시리즈"}
                </span>
              </div>
            </Link>
          )})}
        </div>
      </div>
    </div>
  );
}
