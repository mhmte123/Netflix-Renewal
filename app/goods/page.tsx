"use client";
import React, { useMemo, useState } from "react";
import "../scss/goods.scss";
import { BADGE_LIST } from "@/data/badge";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import BackButton from "@/components/common/BackButton";
import ShopIcon from "@/components/shop/ShopIcon";
import { useAvailablePoints } from "@/store/usePointStore";
import { pts } from "@/data/goods";

const limitedGoods = [
  { id: 1, name: "오리지널 시리즈 포스터 (A2 사이즈)", desc: "시즌2 메인 비주얼 · 액자 별매", price: 3500, stock: 234, type: "LIMITED" as const },
  { id: 2, name: "감독 사인 한정판 시나리오북", desc: "친필 사인 · 일련번호 부여", price: 25000, stock: 12, type: "PREMIUM" as const },
  { id: 3, name: "콜라보 굿즈 세트", desc: "키링·스티커·뱃지 3종", price: 8000, stock: 0, type: "SOLD_OUT" as const },
  { id: 4, name: "캐릭터 머그컵", desc: "오리지널 캐릭터 4종", price: 4500, stock: 156, type: "LIMITED" as const },
  { id: 5, name: "OST 한정판 LP", desc: "10인치 컬러 바이닐", price: 32000, stock: 30, type: "PREMIUM" as const },
];

const events = [
  { id: 1, name: "5월의 마니아 챌린지 — 30편 시청하고 한정 뱃지 받기", period: "2026.05.01 ~ 2026.05.31", desc: "한 달 동안 30편 시청을 완료하면 한정판 '5월의 영화광' 뱃지와 5,000P 적립금을 드려요", status: "active" as const, dday: 12 },
  { id: 2, name: "친구 초대 이벤트 — 함께 하면 5,000P", period: "2026.05.18 ~ 2026.05.27", desc: "초대한 친구가 가입 시 두 분 모두 5,000P 적립. 최대 5명까지 가능합니다", status: "active" as const, dday: 5 },
  { id: 3, name: "봄맞이 리뷰 이벤트", period: "2026.04.01 ~ 2026.04.30", desc: "리뷰 작성 시 추첨을 통해 굿즈 증정 · 당첨자 발표 완료", status: "ended" as const },
];

export default function GoodsPage() {
  const { user, currentProfile, equipBadge } = useAuthStore();
  const { available } = useAvailablePoints();

  const displayBadges = useMemo(() => {    
    // 1. 데이터가 없을 경우 처리
    if (!user || !user.profile || !currentProfile) return [];

    // 2. 현재 프로필 찾기
    // const activeProfile = user.profile.find((p: any) => p.id === currentProfile.id);
    
    // 뱃지 데이터가 아예 없을 경우를 대비해 빈 객체 제공
    const bagesData = currentProfile?.badges || { earnedBadges: [], equippedBadges: null };
    const { earnedBadges, equippedBadges } = bagesData;

    return BADGE_LIST.map((masterBadge) => {
      // 3. 뱃지 정보 계산
      const userBadgeInfo = earnedBadges?.find((b: any) => b.id === masterBadge.id);

      const unlocked = userBadgeInfo ? userBadgeInfo.isComplete : false;
      const mainTitle = equippedBadges === masterBadge.id;
      const progress = userBadgeInfo ? userBadgeInfo.progress : 0;

      return {
        ...masterBadge,
        unlocked,
        locked: !unlocked,
        mainTitle,
        progress,
      };
    });
  }, [currentProfile]);

  // 장착된 대표 칭호/뱃지 찾기
  const matchedBadge = BADGE_LIST.find((b) => b.id === currentProfile?.badges?.equippedBadges);

  return (
    <div className="goods-page">
      <div className="inner">
        <BackButton fallback="/mypage" />
        {/* 히어로 */}
        <div className="goods-hero">
          <div className="hero-eyebrow">REWARDS</div>
          <h2 className="hero-title">
            시청할수록 모이는<br />
            나만의 컬렉션
          </h2>
          <p>뱃지를 모으고 칭호를 획득하세요</p>
          <Link href="/shop" className="goods-hero__cta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <ShopIcon name="gift" size={18} /> 모은 포인트로 굿즈 받기 →
            </span>
          </Link>
        

          {/* 컬렉션 통계 */}
          <div className="collection-stats">
            <div className="stat-card">
              <div className="num">{currentProfile?.badges?.earnedBadges.length}</div>
              <div className="label">획득 뱃지</div>
              <div className="hint">전체 {BADGE_LIST.length}개</div>
            </div>
            <div className="stat-card">
              <div className="label">대표 칭호</div>
              <div className="matche">{matchedBadge ? matchedBadge.name : "없음"}</div>
              {/* <div className="hint">대표: 한국영화 마니아</div> */}
            </div>
            <div className="stat-card">
              <div className="label">보유 포인트</div>
              <div className="num-point">{pts(available)}</div>
            </div>
          </div>
        </div>

        {/* 뱃지 탭 */}
        {/* <h2 className="section-h">뱃지 보상 — 칭호 시스템</h2> */}
        <div className="badge-grid">
          {displayBadges.map((b) => (
            <article
            key={b.id}
            className={`badge-card ${b.unlocked ? "unlocked" : ""} ${b.locked ? "locked" : ""}`}
            >
              {/* 뱃지 아이콘 */}
              <div className="badge-icon">
                <img src={b.imgUrl} alt={b.name} />
              </div>

              {/* 뱃지 타이틀 및 칭호 */}
              <h3>{b.title}</h3>
              <div className="title-tag">{b.name}</div>
              <p>{b.content}</p>
              
              {/* 1. 획득 완료 상태 렌더링 */}
              {b.unlocked && (
                <div className="status-done">
                  ✓ 획득 완료
                  {b.mainTitle ? (
                    <span className="current-badge"> · 현재 대표 칭호</span>
                  ) : (
                    <button 
                      type="button"
                      className="equip-btn"
                      onClick={() => equipBadge(b.id)}
                    >
                      대표로 설정
                    </button>
                  )}
                </div>
              )}
            
              {/* 2. 미획득 상태일 때만 게이지바 및 진행도 렌더링 (목표치 total이 설정되어 있을 때만) */}
              {!b.unlocked && b.total !== undefined && (
                <>
                  <div className="progress-bar">
                    <div 
                      className="fill" 
                      style={{ width: `${Math.min((b.progress / b.total) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {b.progress} / {b.total} 진행 중
                  </div>
                </>
              )}
            </article>
          ))}
        </div>

      </div>
    </div>
  );
}
