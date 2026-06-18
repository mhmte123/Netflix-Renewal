"use client";

import Link from "next/link";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import "./posterCard.scss";
import WishlistButton from "./WishlistButton";
import ShareButton from "./ShareButton";
import { formatFivePointRating, toFivePointRating } from "@/lib/rating";

const GENRE_MAP: Record<number, string> = {
  28: "액션",
  12: "모험",
  16: "애니메이션",
  35: "코미디",
  80: "범죄",
  99: "다큐",
  18: "드라마",
  10751: "가족",
  14: "판타지",
  36: "역사",
  27: "공포",
  10402: "음악",
  9648: "미스터리",
  10749: "로맨스",
  878: "SF",
  53: "스릴러",
  10752: "전쟁",
  37: "서부",
  10759: "액션",
  10762: "키즈",
  10765: "SF",
  10768: "전쟁",
};

interface PosterCardProps {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  voteAverage?: number;
  year?: string;
  backdropPath?: string | null;
  overview?: string;
  genreIds?: number[];
}

export default function PosterCard({
  id,
  mediaType,
  title,
  posterPath,
  voteAverage,
  year,
  backdropPath,
  overview,
  genreIds = [],
}: PosterCardProps) {
  const prefetchRoute = useRoutePrefetch();
  const detailHref = `/detail/${mediaType}/${id}`;
  const score = toFivePointRating(voteAverage);
  const imagePath = backdropPath || posterPath;
  const genreText = genreIds
    .slice(0, 2)
    .map((genreId) => GENRE_MAP[genreId])
    .filter(Boolean)
    .join(" · ");
  const item = {
    id,   
    mediaType,
    title,
    posterPath,
    voteAverage,
    year,
    backdropPath,
    overview,
    genreIds
  };

  return (
    <Link
      href={detailHref}
      className="poster-card"
      onPointerEnter={() => prefetchRoute(detailHref)}
      onFocus={() => prefetchRoute(detailHref)}
    >
      <div className="poster">
        {posterPath ? (
          <img
            src={`https://image.tmdb.org/t/p/w342${posterPath}`}
            alt={title}
            loading="lazy"
          />
        ) : (
          <div className="no-image">이미지 없음</div>
        )}
        {score > 0 && <span className="rating">★ {formatFivePointRating(voteAverage)}</span>}
      </div>

      <div className="search-hover-card">
        <div className="search-hover-card__media">
          {imagePath ? (
            <img
              src={`https://image.tmdb.org/t/p/${
                imagePath === backdropPath ? "w780" : "w500"
              }${imagePath}`}
              alt={title}
              loading="lazy"
            />
          ) : (
            <div className="no-image">이미지 없음</div>
          )}
        </div>
        <div className="search-hover-card__info">
          <div className="search-hover-card__title-row">
            <h3>{title}</h3>
          </div>
          <div className="search-hover-card__meta">
            {score > 0 && (
              <>
                <span className="meta-star">★</span>
                <span className="meta-score">{formatFivePointRating(voteAverage)}</span>
                {(year || genreText) && <span className="meta-sep">|</span>}
              </>
            )}
            {year && (
              <>
                <span>{year}</span>
                {genreText && <span className="meta-sep">|</span>}
              </>
            )}
            {genreText && <span>{genreText}</span>}
          </div>
          {overview && (
            <p className="search-hover-card__overview">{overview}</p>
          )}
          <div className="search-hover-card__actions">
            <span className="btn-play" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              재생
            </span>
            <span className="btn-detail" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              상세정보
            </span>
            <WishlistButton item={item} mediaType={mediaType} stopPropagation className="card-wish" />
            <ShareButton mediaType={mediaType} id={id} stopPropagation className="card-wish" />
          </div>
        </div>
      </div>
    </Link>
  );
}
