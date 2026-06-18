"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimilarUser, useFollowStore } from "@/store/useFollowStore";
import { useAuthStore } from "@/store/useAuthStore";
import RepBadge from "@/components/common/RepBadge";
import TasteAnalysisModal from "./TasteAnalysisModal";

type Props = {
    user: SimilarUser;
};

export default function RisingReviewCard({ user }: Props) {
    const [posterFailed, setPosterFailed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const { currentProfile } = useAuthStore();
    const { follow, unfollow } = useFollowStore();
    const router = useRouter();

    const isFollowing = currentProfile?.community?.following?.includes(user.userId) ?? false;

    const initials = (user.nickname ?? "").slice(0, 2).toUpperCase() || "?";

    const handleFollowToggle = async () => {
        if (loading) return;
        setLoading(true);
        try {
            if (isFollowing) {
                await unfollow(user.userId);
            } else {
                await follow(user.userId);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="review-card" onClick={() => router.push(`/users/${user.userId}`)}>
            <div className="review-card__glow" />

            <div className="review-card__content">
                <div className="review-card__user-row">
                    <div className="review-card__profile">
                        {user.imgUrl ? (
                            <img
                                src={user.imgUrl}
                                alt={user.nickname}
                                className="review-card__avatar"
                            />
                        ) : (
                            <div className="review-card__avatar review-card__avatar--text">
                                {initials}
                            </div>
                        )}

                        <div>
                            {user.badge && (
                                <RepBadge badge={user.badge} size="sm" className="review-card__rep-badge" />
                            )}
                            <h3>{user.nickname}</h3>
                            {user.matchRate > 0 && (
                                <p>취향 매칭률 {user.matchRate}%</p>
                            )}
                        </div>
                    </div>

                    <button
                        className={`review-card__follow${isFollowing ? " review-card__follow--active" : ""}`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleFollowToggle(); }}
                        disabled={loading}
                    >
                        {loading ? "···" : isFollowing ? "팔로잉" : "팔로우"}
                    </button>
                </div>


                <div className="review-card__movie-row">
                    {user.favoriteMovie.title && (
                        <div className="review-card__movie">
                            <div className="review-card__poster">
                                {posterFailed || !user.favoriteMovie.poster ? (
                                    <div className="review-card__poster-fallback">
                                        <span>N</span>
                                        <strong>{user.favoriteMovie.title}</strong>
                                    </div>
                                ) : (
                                    <img
                                        src={user.favoriteMovie.poster}
                                        alt={user.favoriteMovie.title}
                                        onError={() => setPosterFailed(true)}
                                    />
                                )}
                            </div>

                            <div className="review-card__movie-text">
                                {user.matchRate > 0 && (
                                    <p className="review-card__predicted-rating">
                                        예상 ★{(user.matchRate / 100 * 5).toFixed(1)}
                                    </p>
                                )}
                                <p>{user.favoriteMovie.description}</p>
                                <h4>{user.favoriteMovie.title}</h4>
                            </div>
                        </div>
                    )}

                    <button
                        className="review-card__analysis-badge"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowAnalysis(true); }}
                        aria-label="취향 분석 보기"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                            <rect x="2" y="14" width="4" height="8" rx="1" />
                            <rect x="9" y="9" width="4" height="13" rx="1" />
                            <rect x="16" y="4" width="4" height="18" rx="1" />
                        </svg>
                        취향분석
                    </button>
                </div>
            </div>

        {showAnalysis && (
            <TasteAnalysisModal user={user} onClose={() => setShowAnalysis(false)} />
        )}
        </div>
    );
}
