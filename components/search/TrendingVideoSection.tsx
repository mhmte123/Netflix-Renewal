"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  fetchTrendingTrailerKey,
  getTrendingYear,
  type TrendingMediaItem,
} from "@/lib/trendingContent";
import "./trendingVideoSection.scss";
import { formatFivePointRating } from "@/lib/rating";

type TrendingVideoSectionProps = {
  items: TrendingMediaItem[];
  title?: string;
  variant?: "overlay" | "results";
  onSelect?: () => void;
  disableVideo?: boolean;
};

const getItemKey = (item: TrendingMediaItem) => `${item.media_type}-${item.id}`;

export default function TrendingVideoSection({
  items,
  title = "지금 많이 찾는 작품",
  variant = "results",
  onSelect,
  disableVideo = false,
}: TrendingVideoSectionProps) {
  const [activeItemKey, setActiveItemKey] = useState("");
  const [trailerKeys, setTrailerKeys] = useState<Record<string, string | null>>({});
  const trailerControllers = useRef<Record<string, AbortController>>({});

  useEffect(
    () => () => {
      Object.values(trailerControllers.current).forEach((controller) => {
        controller.abort();
      });
      trailerControllers.current = {};
    },
    [],
  );

  useEffect(() => {
    if (disableVideo) return;
    items.forEach((item) => {
      const itemKey = getItemKey(item);
      if (itemKey in trailerKeys || trailerControllers.current[itemKey]) return;

      const controller = new AbortController();
      trailerControllers.current[itemKey] = controller;

      fetchTrendingTrailerKey(item, controller.signal)
        .then((trailerKey) => {
          setTrailerKeys((prev) => ({ ...prev, [itemKey]: trailerKey }));
        })
        .catch((error: Error) => {
          if (error.name !== "AbortError") {
            setTrailerKeys((prev) => ({ ...prev, [itemKey]: null }));
          }
        })
        .finally(() => {
          delete trailerControllers.current[itemKey];
        });
    });
  }, [items, trailerKeys, disableVideo]);

  const loadTrailer = (item: TrendingMediaItem) => {
    if (disableVideo) return;
    const itemKey = getItemKey(item);
    setActiveItemKey(itemKey);

    if (itemKey in trailerKeys || trailerControllers.current[itemKey]) return;

    const controller = new AbortController();
    trailerControllers.current[itemKey] = controller;

    fetchTrendingTrailerKey(item, controller.signal)
      .then((trailerKey) => {
        setTrailerKeys((prev) => ({ ...prev, [itemKey]: trailerKey }));
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setTrailerKeys((prev) => ({ ...prev, [itemKey]: null }));
        }
      })
      .finally(() => {
        delete trailerControllers.current[itemKey];
      });
  };

  if (items.length === 0) return null;

  return (
    <section className={`trending-video-section trending-video-section--${variant}`}>
      <h3>{title}</h3>
      <div className="trending-video-grid">
        {items.map((item) => {
          const itemKey = getItemKey(item);
          const year = getTrendingYear(item);
          const trailerKey = trailerKeys[itemKey];
          const hasLoadedTrailer = itemKey in trailerKeys;
          const isTrailerActive =
            !disableVideo && activeItemKey === itemKey && Boolean(trailerKey);
          const isPreviewActive = !disableVideo && activeItemKey === itemKey;
          const stillPath = item.backdrop_path || item.poster_path;
          const stillSize = item.backdrop_path ? "w780" : "w342";

          return (
            <Link
              href={`/detail/${item.media_type}/${item.id}`}
              className="trending-video-card"
              key={itemKey}
              onClick={onSelect}
              onFocus={() => loadTrailer(item)}
              onMouseMove={() => loadTrailer(item)}
              onMouseEnter={() => loadTrailer(item)}
              onMouseOver={() => loadTrailer(item)}
              onMouseLeave={() => setActiveItemKey("")}
              onPointerEnter={() => loadTrailer(item)}
            >
              <span className="trending-video-card__media">
                {isTrailerActive ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${trailerKey}&modestbranding=1&rel=0`}
                    title={`${item.title} 트레일러`}
                    allow="autoplay; encrypted-media; picture-in-picture"
                  />
                ) : stillPath ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/${stillSize}${stillPath}`}
                    alt=""
                    width={780}
                    height={439}
                  />
                ) : (
                  <em>이미지 없음</em>
                )}
                {!disableVideo && (
                  <span className="trending-video-card__play" aria-hidden="true">
                    ▶
                  </span>
                )}
                {isPreviewActive && !isTrailerActive && (
                  <span className="trending-video-card__status">
                    {hasLoadedTrailer ? "트레일러 준비중" : "트레일러 불러오는 중"}
                  </span>
                )}
              </span>
              <span className="trending-video-card__body">
                <strong>{item.title}</strong>
                <span>
                  ★ {formatFivePointRating(item.vote_average)}
                  {year && ` · ${year}`}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
