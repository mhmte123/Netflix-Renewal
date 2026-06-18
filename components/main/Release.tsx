"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import SectionTitle from "../common/SectionTitle";
import { filterByExcludedGenres, useExcludedGenres } from "@/data/excludedGenres";
import { fetchUpcomingItems, type UpcomingItem } from "@/lib/upcoming";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "./scss/release.scss";

import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";

export default function Release() {
  const [upcomings, setUpcomings] = useState<UpcomingItem[]>([]);
  const excludedGenres = useExcludedGenres();

  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);

  useEffect(() => {
    let ignore = false;

    fetchUpcomingItems()
      .then((items) => {
        if (!ignore) setUpcomings(items);
      })
      .catch((error) => {
        console.error("공개예정 TMDB 요청 실패:", error);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const filteredUpcomings = useMemo(
    () => filterByExcludedGenres(upcomings, excludedGenres),
    [upcomings, excludedGenres],
  );
  const cards = filteredUpcomings.slice(0, 12);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 공개`;
  };

  const getDday = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const release = new Date(dateStr);
    const diff = Math.ceil((release.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "오늘 공개";
    if (diff < 0) return "공개중";
    return `D-${diff}`;
  };


  return (
    <section className="release-section">
      <div className="section-title-outer">
        <SectionTitle title="공개예정 미리보기" subTitle="새로운 작품들을 시청해보세요" href="/release" />
      </div>
      <div className="release-swiper-outer">
        <Swiper
          modules={[Navigation]}
          navigation
          spaceBetween={12}
          slidesPerView={5.5}
          breakpoints={{
            0:    { slidesPerView: 2.5, spaceBetween: 10 },
            480:  { slidesPerView: 2.2 },
            768:  { slidesPerView: 3 },
            1024: { slidesPerView: 4 },
            1280: { slidesPerView: 5.5 },
          }}
          className="release-swiper"
        >
          {cards.map((movie) => (
            <SwiperSlide key={`${movie.media_type}-${movie.id}`}>
              <Link
                href={`/detail/${movie.media_type}/${movie.id}?upcoming=1`}
                className="release-card"
                onClick={(e) => { if (isUnsubscribed) { e.preventDefault(); openModal(); } }}
              >
                <Image
                  src={`https://image.tmdb.org/t/p/w780${movie.backdrop_path}`}
                  alt={movie.title}
                  className="card-image"
                  width={780}
                  height={439}
                  sizes="(max-width: 480px) 40vw, (max-width: 768px) 45vw, (max-width: 1280px) 25vw, 18vw"
                />
                <span className="card-badge">{getDday(movie.release_date)}</span>
                <div className="card-info">
                  <div className="card-meta">
                    <span className="card-type">{movie.media_type === "movie" ? "영화" : "시리즈"}</span>
                  </div>
                  <h3 className="card-title">{movie.title}</h3>
                  <p className="card-date">{formatDate(movie.release_date)}</p>
                </div>
              </Link>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
