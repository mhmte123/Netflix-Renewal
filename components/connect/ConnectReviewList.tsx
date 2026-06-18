"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";

import "swiper/css";
import "swiper/css/navigation";
import "./scss/connectReviewList.scss";

import RisingReviewCard from "./RisingReviewCard";
import SectionTitle from "../common/SectionTitle";
import { SimilarUser, useFollowStore } from "@/store/useFollowStore";
import { useAuthStore } from "@/store/useAuthStore";
import { dummyPlaylists } from "@/data/dummyPlaylist";

const DUMMY_USERS: SimilarUser[] = dummyPlaylists.map((d, i) => ({
    userId: d.userId,
    nickname: d.nickname,
    badge: d.badge,
    imgUrl: d.imgUrl ?? "",
    matchRate: Math.max(78, 96 - i * 2),
    followersCount: 0,
    tags: d.tags,
    genreStats: d.genreStats ?? {},
    favoriteMovie: {
        title: d.featuredMovieTitle,
        poster: d.posters[0] ?? "",
        description: d.content,
    },
}));

export default function ConnectReviewList() {
    const swiperRef = useRef<SwiperType | null>(null);
    const roRef = useRef<ResizeObserver | null>(null);
    const [swiperKey, setSwiperKey] = useState(0);
    const { currentProfile } = useAuthStore();
    const { similarUsers, isLoadingSimilar, fetchSimilarUsers } = useFollowStore();

    useEffect(() => {
        fetchSimilarUsers();
    }, [currentProfile?.id]);

    const displayUsers = useMemo<SimilarUser[]>(() => {
        const real = similarUsers.filter((u) => u.favoriteMovie.title && Object.keys(u.genreStats ?? {}).length > 0);
        if (real.length >= 10) return real.slice(0, 10);
        const realIds = new Set(real.map((u) => u.userId));
        const padding = DUMMY_USERS.filter((u) => !realIds.has(u.userId));
        return [...real, ...padding].slice(0, 10);
    }, [similarUsers]);

    useEffect(() => {
        const id = setTimeout(() => setSwiperKey((k) => k + 1), 100);
        return () => {
            clearTimeout(id);
            roRef.current?.disconnect();
        };
    }, []);

    if (!currentProfile) return null;

    return (
        <section className="connect-review-list">
            <div className="connect-review-list__inner">

                <SectionTitle
                    title="나와 취향이 비슷한 유저"
                    subTitle="취향 매칭률이 높은 유저를 팔로우해보세요" showMore={false}/>

                {isLoadingSimilar ? (
                    <div className="connect-review-list__skeleton">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="connect-review-list__skeleton-card skeleton-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="connect-review-list__swiper-shell">
                        <Swiper
                            key={swiperKey}
                            modules={[Navigation]}
                            navigation
                            slidesPerView="auto"
                            spaceBetween={24}
                            observer
                            observeParents
                            onSwiper={(s) => { swiperRef.current = s; }}
                            className="connect-review-list__swiper"
                        >
                            {displayUsers.map((user) => (
                                <SwiperSlide key={user.userId} className="connect-review-list__slide">
                                    <RisingReviewCard user={user} />
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>
                )}
            </div>
        </section>
    );
}
