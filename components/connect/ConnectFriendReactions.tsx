"use client";

import SectionTitle from "@/components/common/SectionTitle";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FreeMode, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { useFeedStore } from "@/store/useFeedStore";
import { getPosterUrl } from "@/types/feedData";
import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";

import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "./scss/connectSection.scss";
import "./scss/connectFriendReactions.scss";

export default function ConnectFriendReactions() {
  const swiperRef = useRef<SwiperType | null>(null);
  const [swiperKey, setSwiperKey] = useState(0);
  const { feeds, onHydrateFeeds } = useFeedStore();
  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);

  useEffect(() => {
    const id = setTimeout(() => setSwiperKey((key) => key + 1), 100);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (feeds.length === 0) {
      void onHydrateFeeds();
    }
  }, [feeds.length, onHydrateFeeds]);

  const visibleFeeds = feeds
    .filter(
      (feed) =>
        feed.postType === "media" &&
        feed.isPublic &&
        !feed.isSpoiler &&
        Boolean(
          feed.content &&
            feed.mediaId &&
            feed.mediaType &&
            feed.mediaTitle &&
            feed.mediaPoster,
        ),
    )
    .slice(0, 10);

  if (visibleFeeds.length === 0) return null;

  return (
    <section
      className="connect-section connect-friend-reactions"
      aria-label="지금 뜨는 코멘트"
    >
      <div className="connect-section__inner connect-friend-reactions__inner">
        <SectionTitle title="지금 뜨는 코멘트" showMore href="/feed" />

        <div className="connect-friend-reactions__swiper-shell">
          <Swiper
            key={swiperKey}
            className="connect-friend-reactions__list"
            freeMode
            navigation
            modules={[FreeMode, Navigation]}
            slidesPerView="auto"
            spaceBetween={24}
            observer
            observeParents
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            breakpoints={{
              0: { spaceBetween: 14 },
              861: { spaceBetween: 24 },
            }}
          >
            {visibleFeeds.map((item) => {
              const filledStars = Math.round(item.rating / 2);
              return (
                <SwiperSlide className="connect-friend-reactions__slide" key={item.feedId}>
                  <Link
                    href={`/feed/${item.feedId}`}
                    className="connect-friend-reactions__card-link"
                    onClick={(e) => { if (isUnsubscribed) { e.preventDefault(); openModal(); } }}
                  >
                    <article className="connect-friend-reactions__card">
                      {/* 상단: 아바타 + 닉네임 / 별점 */}
                      <div className="cfr-top">
                        <div className="cfr-user">
                          {item.authorImage ? (
                            <img className="cfr-avatar" src={item.authorImage} alt="" aria-hidden="true" />
                          ) : (
                            <span className="cfr-avatar cfr-avatar--initial" aria-hidden="true">
                              {item.author.charAt(0)}
                            </span>
                          )}
                          <span className="cfr-nickname">{item.author}</span>
                        </div>
                        <span className="cfr-stars" aria-label={`${filledStars}점`}>
                          {Array.from({ length: 5 }, (_, i) => (
                            <span key={i} className={i < filledStars ? "star filled" : "star empty"}>★</span>
                          ))}
                        </span>
                      </div>

                      {/* 중단: 포스터 + 제목 + 리뷰 */}
                      <div className="cfr-body">
                        <div className="cfr-poster">
                          <img src={getPosterUrl(item.mediaPoster)} alt={`${item.mediaTitle} 포스터`} />
                        </div>
                        <div className="cfr-text">
                          <p className="cfr-title">{item.mediaTitle}</p>
                          <p className="cfr-review">{item.content}</p>
                        </div>
                      </div>

                      {/* 하단: 좋아요 / 댓글 수 */}
                      <div className="cfr-footer">
                        <span className="cfr-stat">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                          </svg>
                          {item.likesCount ?? 0}
                        </span>
                        <span className="cfr-stat">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          {(item.comments as unknown as number) ?? 0}
                        </span>
                      </div>
                    </article>
                  </Link>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </div>
    </section>
  );
}
