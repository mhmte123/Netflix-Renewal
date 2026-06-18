"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMovieStore } from "@/store/useMovieStore";
import type { PersonCredit } from "@/types/movie";
import AppIcon from "../common/AppIcon";

interface PersonDetailProps {
  personId: number;
}

function imageUrl(path?: string | null, size = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
}

function formatBirthday(dateStr: string | null): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

const GENRE_MAP: Record<number, string> = {
  28: "액션", 12: "모험", 16: "애니메이션", 35: "코미디", 80: "범죄",
  99: "다큐", 18: "드라마", 10751: "가족", 14: "판타지", 36: "역사",
  27: "공포", 10402: "음악", 9648: "미스터리", 10749: "로맨스", 878: "SF",
  53: "스릴러", 10752: "전쟁", 37: "서부",
};
void GENRE_MAP;

export default function PersonDetail({ personId }: PersonDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const { personDetails, personCredits, personExternalIds, onFetchPersonDetail, onFetchPersonCredits, onFetchPersonExternalIds } = useMovieStore();

  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioOverflows, setBioOverflows] = useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const [vw, setVw] = useState(1920);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = vw <= 600;
  const gridCols = vw <= 480 ? 2 : vw <= 768 ? 3 : vw <= 1024 ? 4 : 6;

  const person = personDetails[personId];
  const credits: PersonCredit[] = personCredits[personId] ?? [];
  const extIds = personExternalIds[personId];

  useEffect(() => {
    onFetchPersonDetail(personId);
    onFetchPersonCredits(personId);
    onFetchPersonExternalIds(personId);
  }, [personId, onFetchPersonDetail, onFetchPersonCredits, onFetchPersonExternalIds]);

  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    setBioOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [person?.biography]);

  const filteredCredits = credits
    .filter((c) => filter === "all" ? true : c.media_type === filter)
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id && x.media_type === c.media_type) === i);

  const isLoading = !person;

  const socialLinks = extIds ? [
    extIds.facebook_id && {
      href: `https://www.facebook.com/${extIds.facebook_id}`,
      label: "Facebook",
      svg: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>,
    },
    extIds.twitter_id && {
      href: `https://twitter.com/${extIds.twitter_id}`,
      label: "X (Twitter)",
      svg: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    },
    extIds.instagram_id && {
      href: `https://www.instagram.com/${extIds.instagram_id}`,
      label: "Instagram",
      svg: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
    },
    extIds.tiktok_id && {
      href: `https://www.tiktok.com/@${extIds.tiktok_id}`,
      label: "TikTok",
      svg: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/></svg>,
    },
    extIds.youtube_id && {
      href: `https://www.youtube.com/${extIds.youtube_id}`,
      label: "YouTube",
      svg: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    },
    extIds.homepage && {
      href: extIds.homepage,
      label: "홈페이지",
      svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
    },
  ].filter(Boolean) as { href: string; label: string; svg: React.ReactNode }[] : [];

  const backBtn = (opts: { overlay?: boolean }) => (
    <button
      type="button"
      onClick={() => from ? router.push(from) : router.back()}
      aria-label="뒤로가기"
      style={opts.overlay ? {
        position: "absolute",
        top: 68,
        left: 20,
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "rgba(0,0,0,0.45)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        cursor: "pointer",
        zIndex: 10,
        flexShrink: 0,
      } : {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        margin: "16px 0",
        padding: "8px 14px 8px 10px",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 8,
        color: "#fff",
        fontSize: 14,
        lineHeight: "1",
        cursor: "pointer",
      }}
    >
      <svg width={opts.overlay ? 20 : 18} height={opts.overlay ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {!opts.overlay && <span>뒤로</span>}
    </button>
  );

  const filmographySection = (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: 0 }}>필모그래피</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "movie", "tv"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: isMobile ? "6px 12px" : "8px 18px",
                color: filter === f ? "#fff" : "#999",
                border: `1px solid ${filter === f ? "#e50914" : "#3a3a3a"}`,
                background: filter === f ? "#e50914" : "transparent",
                borderRadius: "100px",
                fontSize: isMobile ? 12 : 13,
                cursor: "pointer",
                transition: "all 0.2s",
                fontWeight: filter === f ? 600 : "normal",
              }}
            >
              {f === "all" ? "전체" : f === "movie" ? "영화" : "시리즈"}
            </button>
          ))}
        </div>
      </div>

      {filteredCredits.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>등록된 작품이 없습니다.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 16, paddingBottom: 80 }}>
          {filteredCredits.map((credit) => {
            const key = `${credit.media_type}-${credit.id}`;
            const isHovered = hoveredId === key;
            return (
              <a
                key={key}
                href={`/detail/${credit.media_type}/${credit.id}`}
                onMouseEnter={() => setHoveredId(key)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: "block",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "#1a1a22",
                  textDecoration: "none",
                  position: "relative",
                  aspectRatio: "2/3",
                  transform: isHovered ? "scale(1.04)" : "scale(1)",
                  transition: "transform 0.2s",
                }}
              >
                {credit.poster_path ? (
                  <img
                    src={imageUrl(credit.poster_path, "w300")}
                    alt={credit.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", opacity: isHovered ? 0.55 : 0.9, transition: "opacity 0.2s" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, color: "#333" }}>
                    <AppIcon name="clapper" size={16} />
                  </div>
                )}
                <span style={{ position: "absolute", top: 6, right: 6, padding: "2px 7px", borderRadius: 3, background: "rgba(0,0,0,0.7)", color: "#ccc", fontSize: 11 }}>
                  {credit.media_type === "tv" ? "시리즈" : "영화"}
                </span>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 10, background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)", gap: 3 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 } as React.CSSProperties}>
                    {credit.title}
                  </p>
                  {credit.release_date && (
                    <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{credit.release_date.slice(0, 4)}</p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );

  if (isLoading) {
    return (
      <div style={{ background: "#141414", minHeight: "100vh", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#e50914", borderRadius: "50%", animation: "person-spin 0.8s linear infinite" }} />
        <style>{`@keyframes person-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  /* ── Mobile layout ── */
  if (isMobile) {
    const birthInfo = [
      formatBirthday(person.birthday),
      person.place_of_birth,
    ].filter(Boolean).join(", ");

    return (
      <div style={{ background: "#141414", minHeight: "100vh", color: "#fff" }}>
        {/* Hero — margin-top으로 헤더 영역까지 이미지 확장 */}
        <div style={{ position: "relative", width: "100%", height: "calc(60vh + 56px)", marginTop: -56, overflow: "hidden" }}>
          {person.profile_path ? (
            <img
              src={imageUrl(person.profile_path, "w500")}
              alt={person.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#2a2a35", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AppIcon name="faq-account" size={64} />
            </div>
          )}

          {/* 그라데이션 오버레이 */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 30%, rgba(20,20,20,0.55) 65%, #141414 100%)" }} />

          {/* 뒤로가기 */}
          {backBtn({ overlay: true })}

          {/* 이름 + 정보 */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 20px 24px" }}>
            {person.known_for_department && (
              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 100, border: "1px solid rgba(229,9,20,0.6)", color: "#e50914", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                {person.known_for_department === "Acting" ? "배우" : person.known_for_department}
              </span>
            )}
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.2, textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}>
              {person.name}
            </h1>
            {birthInfo && (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", margin: "6px 0 0", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                {birthInfo}
              </p>
            )}
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: "20px 20px 0" }}>
          {/* 작품 수 */}
          <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#888", marginBottom: 16 }}>
            <span>작품</span>
            <span style={{ color: "#ccc", fontWeight: 600 }}>{credits.length}편</span>
          </div>

          {/* 소셜 링크 */}
          {socialLinks.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#bbb" }}
                >
                  {link.svg}
                </a>
              ))}
            </div>
          )}

          {/* 약력 */}
          {person.biography && (
            <div style={{ marginBottom: 28 }}>
              <p
                ref={bioRef}
                style={{ fontSize: 14, color: "#aaa", lineHeight: 1.75, margin: 0, overflow: "hidden", display: bioExpanded ? "block" : "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: bioExpanded ? undefined : 3 } as React.CSSProperties}
              >
                {person.biography}
              </p>
              {(bioOverflows || bioExpanded) && (
                <button onClick={() => setBioExpanded((v) => !v)} style={{ marginTop: 6, background: "none", border: "none", color: "#e50914", fontSize: 13, cursor: "pointer", padding: 0 }}>
                  {bioExpanded ? "접기 ▴" : "더보기 ▾"}
                </button>
              )}
            </div>
          )}

          {filmographySection}
        </div>
      </div>
    );
  }

  /* ── Desktop layout ── */
  return (
    <div style={{ background: "#141414", minHeight: "100vh", color: "#fff" }}>
      <div style={{ padding: vw <= 1024 ? "80px 24px 0 88px" : vw <= 1440 ? "80px 40px 0 120px" : "80px 40px 0", maxWidth: 1400, margin: "0 auto" }}>
        {backBtn({ overlay: false })}

        {/* 프로필 헤더 */}
        <div style={{ display: "flex", gap: 40, marginBottom: 56 }}>
          {/* 프로필 사진 */}
          <div style={{ flexShrink: 0, width: 200, height: 280, borderRadius: 12, overflow: "hidden", background: "#2a2a35", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
            {person.profile_path ? (
              <img src={imageUrl(person.profile_path, "w300")} alt={person.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#444" }}>
                <AppIcon name="faq-account" size={30} />
              </div>
            )}
          </div>

          {/* 기본 정보 */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {person.known_for_department && (
              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(229,9,20,0.5)", color: "#e50914", fontSize: 12, fontWeight: 600, width: "fit-content" }}>
                {person.known_for_department === "Acting" ? "배우" : person.known_for_department}
              </span>
            )}

            <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.2, letterSpacing: -0.5 }}>
              {person.name}
            </h1>

            {(() => {
              const englishName = person.also_known_as?.find(n => /^[A-Za-z\s\-'\.]+$/.test(n));
              return englishName ? <p style={{ fontSize: 14, color: "#888", margin: 0 }}>{englishName}</p> : null;
            })()}

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                <span style={{ color: "#555", minWidth: 60 }}>작품 수</span>
                <span style={{ color: "#ccc" }}>{credits.length}편</span>
              </div>
            </div>

            {/* 소셜 링크 */}
            {socialLinks.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {socialLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.label}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#bbb", transition: "background 0.15s, color 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.color = "#bbb"; }}
                  >
                    {link.svg}
                  </a>
                ))}
              </div>
            )}

            {/* 약력 */}
            {person.biography && (
              <div style={{ marginTop: 8 }}>
                <p
                  ref={bioRef}
                  style={{ fontSize: 14, color: "#aaa", lineHeight: 1.75, margin: 0, overflow: "hidden", display: bioExpanded ? "block" : "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: bioExpanded ? undefined : 2 } as React.CSSProperties}
                >
                  {person.biography}
                </p>
                {(bioOverflows || bioExpanded) && (
                  <button onClick={() => setBioExpanded((v) => !v)} style={{ marginTop: 6, background: "none", border: "none", color: "#e50914", fontSize: 13, cursor: "pointer", padding: 0 }}>
                    {bioExpanded ? "접기 ▴" : "더보기 ▾"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {filmographySection}
      </div>
    </div>
  );
}
