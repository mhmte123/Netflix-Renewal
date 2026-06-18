"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { filterByExcludedGenres, useExcludedGenres } from "@/data/excludedGenres";
import { fetchUpcomingItems, type UpcomingItem } from "@/lib/upcoming";
import { createUpcomingAlarm, getUpcomingDetailLink, isUpcomingNotificationSet, removeUpcomingAlarm } from "@/lib/upcomingNotifications";
import { useAuthStore } from "@/store/useAuthStore";
import "../scss/release.scss";

type PeriodType = "week" | "month" | "all";

export default function ReleasePage() {
  const [upcomings, setUpcomings] = useState<UpcomingItem[]>([]);
  const [period, setPeriod] = useState<PeriodType>("all");
  const currentProfile = useAuthStore((state) => state.currentProfile);
  const onUpdateProfile = useAuthStore((state) => state.onUpdateProfile);
  const excludedGenres = useExcludedGenres();

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

  const now = new Date();
  const filtered = useMemo(
    () => filterByExcludedGenres(upcomings, excludedGenres).filter((item) => {
      const release = new Date(item.release_date);
      const diff = (release.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (period === "week") return diff >= 0 && diff <= 7;
      if (period === "month") return diff >= 0 && diff <= 30;
      return diff >= 0;
    }),
    [excludedGenres, now, period, upcomings],
  );

  const featured = filtered[0];
  const others = filtered.slice(1);

  const handleNotify = async (item: UpcomingItem, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentProfile) return;

    const alarm = isUpcomingNotificationSet(currentProfile.alarm, item.media_type, item.id)
      ? removeUpcomingAlarm(currentProfile.alarm, item.media_type, item.id)
      : [...(currentProfile.alarm ?? []), createUpcomingAlarm(item)];

    await onUpdateProfile({
      ...currentProfile,
      alarm,
    });
  };

  const getDday = (dateStr: string) => {
    const release = new Date(dateStr);
    const diff = Math.ceil((release.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return "D-Day";
    return `D-${diff}`;
  };

  const isNotified = (item: UpcomingItem) =>
    isUpcomingNotificationSet(currentProfile?.alarm, item.media_type, item.id);

  return (
    <div className="release-page">
      {featured && (
        <div className="release-hero">
          <img
            src={`https://image.tmdb.org/t/p/original${featured.backdrop_path}`}
            alt={featured.title}
            className="hero-bg"
          />
          <div className="hero-overlay" />
          <div className="hero-content inner">
            <div className="hero-eyebrow">
              <span className="dday">{getDday(featured.release_date)}</span>
              <span>공개 예정</span>
            </div>
            <h1>{featured.title}</h1>
            <p className="hero-meta">{featured.release_date}</p>
            <div className="hero-actions">
              <Link href={getUpcomingDetailLink(featured.media_type, featured.id)} className="btn-primary">
                자세히 보기
              </Link>
              <button
                className={`btn-notify ${isNotified(featured) ? "active" : ""}`}
                onClick={(event) => handleNotify(featured, event)}
              >
                <img src="/images/header/alarm.svg" alt="" />
                {isNotified(featured) ? "알림설정됨" : "알림받기"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="inner">
        <div className="page-head">
          <h2>공개 예정 작품</h2>
          <p>메인 공개예정 미리보기와 같은 기준의 작품들을 모아봤어요.</p>
        </div>

        <div className="period-filter">
          <button className={period === "all" ? "active" : ""} onClick={() => setPeriod("all")}>
            전체
          </button>
          <button className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>
            이번 주
          </button>
          <button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>
            이번 달
          </button>
        </div>

        {others.length > 0 ? (
          <div className="release-grid">
            {others.map((item) => (
              <Link
                key={`${item.media_type}-${item.id}`}
                href={getUpcomingDetailLink(item.media_type, item.id)}
                className="release-card"
              >
                <div className="thumb">
                  <img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} alt={item.title} />
                  <span className="dday-badge">{getDday(item.release_date)}</span>
                </div>
                <div className="info">
                  <button
                    className={`notify-btn ${isNotified(item) ? "active" : ""}`}
                    onClick={(event) => handleNotify(item, event)}
                  >
                    <img src="/images/header/alarm.svg" alt="" />
                    {isNotified(item) ? "알림설정됨" : "알림받기"}
                  </button>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">해당 기간의 공개 예정 작품이 없습니다.</div>
        )}
      </div>
    </div>
  );
}
