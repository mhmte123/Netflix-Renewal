"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, notFound } from "next/navigation";
import { customMenus } from "@/data/mainMenu";
import "../../scss/category.scss";
import PosterCard from "@/components/common/PosterCard";
import PosterGridSkeleton from "@/components/common/PosterGridSkeleton";
import CustomSelect from "@/components/common/CustomSelect";
import { filterHidden } from "@/data/hiddenContent";
import { filterByExcludedGenres, useExcludedGenres } from "@/data/excludedGenres";
import { useMaturityFiltered } from "@/data/maturityFilter";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

type SortType = "popularity.desc" | "vote_average.desc" | "release_date.desc";

// 장르 path → TMDB genre_id 매핑
const genreMap: Record<string, { name: string; movieId: number; tvId: number; description: string }> = {
  action: { name: "액션", movieId: 28, tvId: 10759, description: "심장이 멎을 듯한 액션의 세계" },
  animation: { name: "애니메이션", movieId: 16, tvId: 16, description: "상상력이 폭발하는 애니메이션" },
  comedy: { name: "코미디", movieId: 35, tvId: 35, description: "유쾌하고 즐거운 웃음 한 스푼" },
  documentary: { name: "다큐멘터리", movieId: 99, tvId: 99, description: "현실보다 더 흥미로운 진짜 이야기" },
  drama: { name: "드라마", movieId: 18, tvId: 18, description: "마음 깊이 울리는 드라마" },
  fantasy: { name: "판타지", movieId: 14, tvId: 10765, description: "꿈과 마법이 가득한 판타지 세계" },
  horror: { name: "공포", movieId: 27, tvId: 9648, description: "심장이 쫄깃해지는 공포의 밤" },
  mystery: { name: "미스터리", movieId: 9648, tvId: 9648, description: "끝까지 멈출 수 없는 미스터리" },
  romance: { name: "로맨스", movieId: 10749, tvId: 10749, description: "설레는 로맨스의 모든 것" },
  scifi: { name: "SF", movieId: 878, tvId: 10765, description: "상상을 넘어선 미래의 이야기" },
  thriller: { name: "스릴러", movieId: 53, tvId: 9648, description: "긴장의 끈을 놓을 수 없는 스릴러" },
  war: { name: "전쟁", movieId: 10752, tvId: 10768, description: "역사와 인간을 그린 전쟁 이야기" },
};

interface MediaItem {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  media_type: "movie" | "tv";
}

interface TmdbListItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
}

export default function GenrePage() {
  const params = useParams();
  const genreName = params.name as string;

  const [type, setType] = useState<"movie" | "tv" | "animation">("movie");
  const [sort, setSort] = useState<SortType>("popularity.desc");
  const excludedGenres = useExcludedGenres();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const info = genreMap[genreName];
  const menuItem = customMenus.find((m) => m.path === `/genre/${genreName}`);

  if (!info) {
    notFound();
  }

  useEffect(() => {
    if (!info) return;

    const fetchGenre = async () => {
      setLoading(true);
      const endpoint: "movie" | "tv" = type === "tv" ? "tv" : "movie";
      const genreId =
        type === "animation" ? 16 : type === "tv" ? info.tvId : info.movieId;
      // TV에는 release_date 정렬이 없어 first_air_date로 보정
      const sortBy =
        endpoint === "tv" && sort === "release_date.desc" ? "first_air_date.desc" : sort;
      const res = await fetch(
        `https://api.themoviedb.org/3/discover/${endpoint}?api_key=${TMDB_KEY}&language=ko-KR&with_genres=${genreId}&sort_by=${sortBy}&page=1&vote_count.gte=20&with_watch_providers=8&watch_region=KR`
      );
      const data = (await res.json()) as { results?: TmdbListItem[] };
      const list: MediaItem[] = (data.results || []).map((item) => ({
        id: item.id,
        title: item.title || item.name || "",
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        overview: item.overview ?? "",
        vote_average: item.vote_average ?? 0,
        release_date: item.release_date,
        first_air_date: item.first_air_date,
        genre_ids: item.genre_ids ?? [],
        media_type: endpoint,
      }));
      // 제외 장르 숨김 (단, 지금 보고 있는 이 장르 자체는 면제)
      setItems(filterByExcludedGenres(filterHidden(list), excludedGenres, [genreName]));
      setLoading(false);
    };

    fetchGenre().catch(() => {
      setItems([]);
      setLoading(false);
    });
  }, [type, genreName, info, sort, excludedGenres]);

  const visibleItems = useMaturityFiltered(items, (it) => it.media_type);

  if (!info) return null;

  const featured = visibleItems[0] ?? null;
  const hasHeroImage = Boolean(featured?.backdrop_path);
  const otherItems = visibleItems.slice(1);

  return (
    <div className="category-page mood-variant">
      {/* 히어로 영역 */}
      <div
        className={
          hasHeroImage
            ? "category-hero"
            : "category-hero category-hero--fallback"
        }
      >
        {hasHeroImage && featured && (
          <img
            src={`https://image.tmdb.org/t/p/original${featured.backdrop_path}`}
            alt={featured.title}
            className="hero-bg"
          />
        )}
        <div className="hero-overlay"></div>
        <div className="hero-content inner">
          <div className="hero-eyebrow">
            {menuItem && <Image src={menuItem.imgUrl} alt={info.name} width={32} height={32} />}
            <span>장르</span>
          </div>
          <h1>{info.name}</h1>
          <p className="hero-desc">{info.description}</p>
          {featured && (
            <div className="hero-actions">
              <Link href={`/detail/${featured.media_type}/${featured.id}`} className="btn-play">
                ▶ {featured.title} 보러가기
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="inner">
        <div className="type-filter">
          <button className={type === "movie" ? "active" : ""} onClick={() => setType("movie")}>
            영화
          </button>
          <button className={type === "tv" ? "active" : ""} onClick={() => setType("tv")}>
            시리즈
          </button>
          <button className={type === "animation" ? "active" : ""} onClick={() => setType("animation")}>
            애니메이션
          </button>
        </div>

        <section className="result-section">
          <div className="section-head result-head">
            <h2>전체 작품</h2>
            <div className="result-tools">
              <span>{otherItems.length.toLocaleString()}편</span>
              <div style={{ width: 140 }}>
                <CustomSelect
                  options={[
                    { value: "popularity.desc", label: "인기순" },
                    { value: "vote_average.desc", label: "평점순" },
                    { value: "release_date.desc", label: "최신순" },
                  ]}
                  value={sort}
                  onChange={(v) => setSort(v as SortType)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <PosterGridSkeleton />
          ) : otherItems.length > 0 ? (
            <div className="poster-grid">
              {otherItems.map((item) => (
                <PosterCard
                  key={`${item.media_type}-${item.id}`}
                  id={item.id}
                  mediaType={item.media_type}
                  title={item.title}
                  posterPath={item.poster_path}
                  voteAverage={item.vote_average}
                  year={(item.release_date || item.first_air_date || "").slice(0, 4)}
                  backdropPath={item.backdrop_path}
                  overview={item.overview}
                  genreIds={item.genre_ids}
                />
              ))}
            </div>
          ) : (
            <div className="state-text">조건에 맞는 작품이 없습니다.</div>
          )}
        </section>
      </div>
    </div>
  );
}
