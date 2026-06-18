"use client";
import React from "react";
import Link from "next/link";
import { useMovieStore } from "@/store/useMovieStore";
import { useEffect } from "react";
import "./scss/error.scss";

export default function NotFound() {
  const { popMovies, onFetchPopular } = useMovieStore();

  useEffect(() => {
    if (popMovies.length === 0) onFetchPopular();
  }, []);

  return (
    <div className="error-page">
      <div className="inner">
        <div className="error-container">
          <div className="error-graphic">?</div>
          <div className="error-code">ERROR 404</div>
          <h1>페이지를 찾을 수 없어요</h1>
          <p className="error-desc">
            요청하신 페이지가 삭제되었거나, 주소가 변경되었거나, 일시적으로 사용할 수 없는 상태예요.
          </p>

          <div className="error-actions">
            <Link href="/" className="btn-primary">
              홈으로 가기
            </Link>
            <button className="btn-outline" onClick={() => window.history.back()}>
              이전 페이지로
            </button>
          </div>

          <div className="error-suggest">
            <h3>이런 페이지는 어떠세요?</h3>
            <ul className="suggest-list">
              <li>
                <Link href="/">
                  <span>오늘의 추천 작품</span>
                  <span className="arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/category">
                  <span>장르별 카테고리</span>
                  <span className="arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/mood">
                  <span>분위기로 작품 찾기</span>
                  <span className="arrow">→</span>
                </Link>
              </li>
              <li>
                <Link href="/release">
                  <span>공개 예정 작품</span>
                  <span className="arrow">→</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* 인기 작품 미리보기 */}
          {popMovies.length > 0 && (
            <div className="popular-preview">
              <h3>지금 인기있는 작품</h3>
              <div className="popular-row">
                {popMovies.slice(0, 6).map((m) => (
                  <Link key={m.id} href={`/detail/movie/${m.id}`} className="poster-mini">
                    {m.poster_path && (
                      <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} alt={m.title} />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
