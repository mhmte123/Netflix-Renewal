"use client";
import React from "react";
import AppIcon from "@/components/common/AppIcon";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import Image from "next/image";
import { customMenus } from "@/data/mainMenu";
import "../scss/moodMain.scss";

// 각 무드별 부가 설명과 색상
const moodMeta: Record<string, { desc: string; color: string; emoji: string }> = {
  // DS: 강조색은 빨강 계열만 사용 (무드별 임의 색상 금지)
  "/mood/chill": { desc: "조용히 마음을 어루만지는 잔잔한 작품들", color: "#60a5fa", emoji: "🌊" },
  "/mood/exciting": { desc: "에너지 가득한 신나는 작품들", color: "#f97316", emoji: "⚡" },
  "/mood/emotional": { desc: "마음 깊이 스며드는 감성 작품", color: "#ec4899", emoji: "💧" },
  "/mood/scary": { desc: "오싹한 공포와 스릴이 가득한 작품", color: "#7c3aed", emoji: "👻" },
  "/mood/funny": { desc: "마음 가볍게 웃을 수 있는 유쾌한 작품", color: "#eab308", emoji: "😄" },
  "/mood/thoughtful": { desc: "깊은 여운을 남기는 작품들", color: "#a78bfa", emoji: "💭" },
  "/mood/romantic": { desc: "심장이 두근거리는 낭만적인 작품들", color: "#f472b6", emoji: "💕" },
  "/mood/dark": { desc: "묵직하고 어두운 분위기의 작품들", color: "#475569", emoji: "🌙" },
};

export default function MoodMainPage() {
  const t = useT();

  // customMenus에서 무드만 필터링
  const moods = customMenus.filter((m) => m.path.startsWith("/mood/"));

  return (
    <div className="mood-main-page">
      {/* 히어로 */}
      <div className="mood-hero">
        <div className="inner">
          <div className="hero-eyebrow">{t("mood.curation.eyebrow")}</div>
          <h1>
            {t("mood.curation.titleLine1")}<br />
            {" "}
            <span className="accent">{t("mood.curation.titleAccent")}</span>
          </h1>
          <p>{t("mood.curation.desc")}</p>
        </div>
      </div>

      <div className="inner">
        {/* 무드 그리드 */}
        <div className="mood-grid">
          {moods.map((mood) => {
            const meta = moodMeta[mood.path] || { desc: "", color: "#888", emoji: "✨" };
            return (
              <Link key={mood.path} href={mood.path} className="mood-card">
                <div
                  className="mood-card-bg"
                  style={{
                    background: `radial-gradient(circle at 70% 30%, ${meta.color}30, transparent 70%)`,
                  }}
                ></div>
                <div className="mood-card-main">
                  <div className="mood-icon-wrap" style={{ borderColor: meta.color }}>
                    <Image src={mood.imgUrl} alt={mood.title} width={36} height={36} />
                  </div>
                  <div className="mood-card-copy">
                    <h3>{mood.title}</h3>
                    <p>{meta.desc}</p>
                  </div>
                </div>
                {/* <div className="mood-emoji">{meta.emoji}</div> */}
                <span className="mood-cta" style={{ color: meta.color }}>
                  작품 보기 →
                </span>
              </Link>
            );
          })}
        </div>

        {/* 안내 섹션 */}
        <section className="mood-info">
          <div className="info-card">
            <h3><AppIcon name="target" size={18} /> 무드 큐레이션이란?</h3>
            <p>
              영화·시리즈를 단순 장르가 아닌 <strong>분위기</strong>로 분류한 큐레이션이에요.
              비 오는 날 잔잔한 영화, 우울할 때 유쾌한 작품처럼 그때그때 기분에 맞는 작품을 추천받을 수 있어요.
            </p>
          </div>
          <div className="info-card">
            <h3><AppIcon name="gear" size={18} /> 더 정확한 추천을 받고 싶다면?</h3>
            <p>
              <Link href="/mypage/genre">장르 관리</Link>에서 선호 무드와 제외 무드를 설정하세요. 추천 알고리즘이
              여러분의 취향을 더 잘 학습해드려요.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
