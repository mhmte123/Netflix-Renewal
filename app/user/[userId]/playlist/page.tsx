"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { db } from "@/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { PlaylistDocument } from "@/types/playList";
import { customMenus } from "@/data/mainMenu";
import "../../../scss/mediaList.scss";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

const PLAYLIST_MOOD_TAGS = customMenus.filter((menu) => menu.path.startsWith("/mood/"));
const getMoodIcon = (tag: string) => PLAYLIST_MOOD_TAGS.find((mood) => mood.title === tag)?.imgUrl;

const getPosterUrl = (path?: string) =>
  path ? `https://image.tmdb.org/t/p/w500${path}` : "";

async function fetchPoster(key: string): Promise<{ key: string; poster: string; title: string }> {
  const [mediaType, id] = key.split("-");
  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=ko-KR`),
      fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&language=ko-KR`),
    ]);
    const [movie, tv] = await Promise.all([movieRes.json(), tvRes.json()]);
    if (movie.poster_path) return { key, poster: getPosterUrl(movie.poster_path), title: movie.title ?? "" };
    if (tv.poster_path) return { key, poster: getPosterUrl(tv.poster_path), title: tv.name ?? "" };
  } catch {}
  return { key, poster: "", title: "" };
}

const formatDate = (value: string) => new Date(value).toLocaleDateString("ko-KR");

export default function UserPlaylistPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [nickname, setNickname] = useState("");
  const [playlists, setPlaylists] = useState<PlaylistDocument[]>([]);
  const [posterCache, setPosterCache] = useState<Record<string, { poster: string; title: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);
      try {
        const [userSnap, playlistSnap] = await Promise.all([
          getDoc(doc(db, "users", userId)),
          getDoc(doc(db, "playlists", userId)),
        ]);

        if (userSnap.exists()) {
          const firstProfile = userSnap.data().profile?.[0];
          setNickname(firstProfile?.nickname ?? "유저");
        }

        if (playlistSnap.exists()) {
          const all: PlaylistDocument[] = playlistSnap.data().playlists ?? [];
          const visible = all.filter((p) => p.isDelete !== true);
          setPlaylists(visible);

          const allKeys = Array.from(new Set(visible.flatMap((p) => p.videoIds)));
          const results = await Promise.all(allKeys.map(fetchPoster));
          const cache: Record<string, { poster: string; title: string }> = {};
          results.forEach(({ key, poster, title }) => {
            cache[key] = { poster, title };
          });
          setPosterCache(cache);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  const renderPlaylist = (playlist: PlaylistDocument) => {
    const items = playlist.videoIds.map((k) => posterCache[k]).filter(Boolean);
    const preview = items.slice(0, 4);

    return (
      <article className="custom-playlist-card" key={playlist.listId}>
        <div className="playlist-mosaic">
          {preview.map((item, i) => (
            <div key={i}>
              {item.poster && <img src={item.poster} alt={item.title} />}
            </div>
          ))}
          {items.length > 4 && <span>+{items.length - 4}</span>}
        </div>

        <h3>{playlist.name}</h3>
        {playlist.content && <p className="playlist-description">{playlist.content}</p>}

        {playlist.tags?.length > 0 && (
          <div className="playlist-tag-row">
            {playlist.tags.map((tag) => {
              const icon = getMoodIcon(tag);
              return (
                <span key={tag}>
                  {icon && <img src={icon} alt="" />}
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        <div className="playlist-extra-area">
          <p>{items.length}개 작품 · {formatDate(playlist.createdAt)}</p>
        </div>
      </article>
    );
  };

  return (
    <div className="media-list-page activity-page">
      <div className="inner">
        <div className="activity-hero">
          <div className="page-head">
            {loading ? (
              <h1>플레이리스트 불러오는 중...</h1>
            ) : (
              <>
                <h1>{nickname}님의 플레이리스트</h1>
                <p>플레이리스트 {playlists.length}개</p>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="custom-playlist-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <article className="custom-playlist-card" key={i}>
                <div className="playlist-mosaic" style={{ background: "#1a1a1a", borderRadius: 8 }} />
              </article>
            ))}
          </div>
        ) : playlists.length === 0 ? (
          <div className="playlist-empty-state">
            <p>아직 플레이리스트가 없어요.</p>
            <Link href="/connect" style={{ color: "#e50914", marginTop: 16, display: "inline-block" }}>
              돌아가기
            </Link>
          </div>
        ) : (
          <div className="custom-playlist-grid">
            {playlists.map(renderPlaylist)}
          </div>
        )}
      </div>
    </div>
  );
}
