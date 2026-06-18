"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import "./scss/loginBanner.scss";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";


/**
 * 비로그인 사용자에게 화면 하단에 고정으로 노출되는 배너
 * - 로그인 상태면 표시 안 함
 * - 로그인/회원가입/결제 등 인증 관련 페이지에서는 표시 안 함
 * - "구독 시작하기" → /signin
 * - "플랜 소개" → /plan
 */

// 배너를 표시하지 않을 경로들
const HIDDEN_PATHS = ["/login", "/signin", "/payment", "/forgot-password", "/plan"];

export default function LoginBanner() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [planType, setPlanType] = useState<string | null>(null);

  useEffect(() => {
    // 로그인 상태가 아니면 planType 초기화
    if (!user?.userId) {
      setPlanType(null);
      return;
    }
    // Firestore에서 구독 플랜 정보 조회
    getDoc(doc(db, "users", user.userId)).then((snap) => {
      if (!snap.exists()) return;
      // planType이 없으면 빈 문자열 (미구독 상태)
      setPlanType(snap.data().planType ?? "");
    });
  }, [user?.userId, pathname]); // 유저 변경 시마다 재조회

  // 표시 안 함 조건들
  // 로그인 + 구독 중이면 숨김, 로그인 + 미구독이면 표시
  if (user && planType) return null;
  if (user && planType === null) return null; // 아직 로딩 중
  if (HIDDEN_PATHS.some((path) => pathname?.startsWith(path))) return null;

  return (
    <div className="login-banner" role="region" aria-label="로그인 안내">
      <div className="banner-inner">
        {/* 넷플릭스 로고 */}
        <Image
          src="/images/logo/Netflix_Logo_RGB.png"
          alt="Netflix"
          width={90}
          height={24}
          className="banner-logo"
        />

        {/* 좌측 안내 텍스트 */}
        <div className="banner-text">
          <h3 className="banner-title">12,000편 이상의 콘텐츠, 취향대로 발견하세요.</h3>
          <p className="banner-desc">
            취향에 맞는 작품 추천부터 평점과 리뷰까지, 새로운 인생작을 더 쉽고 빠르게 만나보세요.
          </p>
        </div>

        {/* 우측 버튼 그룹 */}
        <div className="banner-actions">
          {/* <Link href="/plan" className="banner-btn banner-btn-ghost">
            플랜 소개
          </Link> */}
          <Link href="/plan" className="banner-btn banner-btn-primary">
            구독 시작하기
          </Link>
        </div>
      </div>
    </div>
  );
}
