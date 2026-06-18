"use client";

import SectionTitle from "@/components/common/SectionTitle";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FreeMode, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { useAuthStore } from "@/store/useAuthStore";
import { dummyPlaylists } from "@/data/dummyPlaylist";

import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "./scss/connectSection.scss";
import "./scss/connectFollowingPlaylists.scss";

export default function ConnectFollowingPlaylists() {
  const { currentProfile } = useAuthStore();
  const swiperRef = useRef<SwiperType | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [swiperKey, setSwiperKey] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setSwiperKey((k) => k + 1), 100);
    return () => {
      clearTimeout(id);
      roRef.current?.disconnect();
    };
  }, []);

  if (!currentProfile) return null;

  return (
    <section
      className="connect-section connect-following-playlists"
      aria-label="팔로우 유저의 플레이리스트"
    >
      <div className="connect-section__inner connect-following-playlists__inner">
        <SectionTitle title="추천하는 플레이리스트" showMore={false} />

        <div className="connect-following-playlists__swiper-shell">
        <Swiper
          key={swiperKey}
          className="connect-following-playlists__list"
          freeMode
          navigation
          modules={[FreeMode, Navigation]}
          slidesPerView="auto"
          spaceBetween={22}
          observer
          observeParents
          onSwiper={(s) => { swiperRef.current = s; }}
          breakpoints={{
            0: { spaceBetween: 14 },
            861: { spaceBetween: 22 },
          }}
        >
          {dummyPlaylists.map((playlist) => (
            <SwiperSlide
              className="connect-following-playlists__slide"
              key={playlist.userId}
            >
              <Link className="connect-following-playlists__card" href={`/playlist/${playlist.userId}/${playlist.listId}`}>
                <span className="connect-following-playlists__poster-grid">
                  {playlist.posters.map((poster, index) => (
                    <img src={poster} alt="" aria-hidden="true" key={index} />
                  ))}
                </span>
                <span className="connect-following-playlists__meta">
                  <span className="connect-following-playlists__badge">
                    {playlist.category ?? "영화"}
                  </span>
                  <span className="connect-following-playlists__title">
                    {playlist.nickname}님의 추천작품
                  </span>
                  <span className="connect-following-playlists__arrow" aria-hidden="true">
                    ↗
                  </span>
                </span>
              </Link>
            </SwiperSlide>
          ))}
        </Swiper>
        </div>
      </div>
    </section>
  );
}
