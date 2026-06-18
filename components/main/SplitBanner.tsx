"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_PROFILE_SETTINGS, useAuthStore } from "@/store/useAuthStore";
import "./scss/splitBanner.scss";
import SectionTitle from "@/components/common/SectionTitle";

import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";

const PANEL_COUNT = 7;
const TITLE = "넷플릭스 화제작";

interface BannerConfig {
  image: string;       // 분할 배경 메인 이미지
  logoUrl: string;     // 좌측(첫 패널) 작품 로고
  rightLogoUrl: string; // 우측 로고
  stills: string[];    // hover 시 보이는 스틸 7장
  detailHref: string;  // 클릭 시 이동할 상세 경로
}

// ⚠️ 등급별 배너 세트.
// 19+ 는 기존 이미지를 그대로 사용. 전체관람가/12+/15+ 는 아래 경로에 맞춰
// 이미지를 넣으면 됩니다(폴더/파일명 규칙: /images/banner/{all|12|15}/...).
const BANNERS: Record<string, BannerConfig> = {
  "19+": {
    image: "/images/banner/If-Wishes-Could-Kill-img.png",
    logoUrl: "https://image.tmdb.org/t/p/w500/yxwiC5BpJ5UVBY6BtguH0DwBVTA.png",
    rightLogoUrl: "/images/banner/If-Wishes-Could-Kill-right-logo.png",
    stills: [
      "/images/banner/If-Wishes-Could-Kill-01.jpg",
      "/images/banner/If-Wishes-Could-Kill-02.jpg",
      "/images/banner/If-Wishes-Could-Kill-03.jpg",
      "/images/banner/If-Wishes-Could-Kill-04.jpg",
      "/images/banner/If-Wishes-Could-Kill-05.jpg",
      "/images/banner/If-Wishes-Could-Kill-06.jpg",
      "/images/banner/If-Wishes-Could-Kill-07.jpg",
    ],
    detailHref: "/detail/tv/285838",
  },
  // ───── 아래는 자리표시(가짜) 경로. 실제 이미지를 같은 이름으로 넣어주세요 ─────
  "15+": {
    image: "/images/banner/15/main.png",
    logoUrl: "/images/banner/15/logo.png",
    rightLogoUrl: "/images/banner/15/right-logo.png",
    stills: [
      "/images/banner/15/still-01.jpg",
      "/images/banner/15/still-02.jpg",
      "/images/banner/15/still-03.jpg",
      "/images/banner/15/still-04.jpg",
      "/images/banner/15/still-05.jpg",
      "/images/banner/15/still-06.jpg",
      "/images/banner/15/still-07.jpg",
    ],
    detailHref: "/detail/tv/195670", // XO, Kitty
  },
  "12+": {
    image: "/images/banner/12/main.png",
    logoUrl: "/images/banner/12/logo.png",
    rightLogoUrl: "/images/banner/12/right-logo.png",
    stills: [
      "/images/banner/12/still-01.jpg",
      "/images/banner/12/still-02.jpg",
      "/images/banner/12/still-03.jpg",
      "/images/banner/12/still-04.jpg",
      "/images/banner/12/still-05.jpg",
      "/images/banner/12/still-06.jpg",
      "/images/banner/12/still-07.jpg",
    ],
    detailHref: "/detail/tv/219246",
  },
  "전체관람가": {
    image: "/images/banner/all/main.png",
    logoUrl: "/images/banner/all/logo.png",
    rightLogoUrl: "/images/banner/all/right-logo.png",
    stills: [
      "/images/banner/all/still-01.jpg",
      "/images/banner/all/still-02.jpg",
      "/images/banner/all/still-03.jpg",
      "/images/banner/all/still-04.jpg",
      "/images/banner/all/still-05.jpg",
      "/images/banner/all/still-06.jpg",
      "/images/banner/all/still-07.jpg",
    ],
    detailHref: "/detail/movie/508965", // Klaus
  },
};

export default function SplitBanner() {
  const router = useRouter();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);


  // 현재 프로필 관람등급에 맞는 배너 선택 (없으면 19+ 기본)
  const rating =
    useAuthStore((s) => s.currentProfile?.settings?.maturityRating) ??
    DEFAULT_PROFILE_SETTINGS.maturityRating;
  const banner =
    BANNERS[rating] ?? BANNERS[DEFAULT_PROFILE_SETTINGS.maturityRating];


  return (
    <section className="split-banner">
      <SectionTitle title={TITLE} showMore={false} />
      <div className="split-panels">
        {Array.from({ length: PANEL_COUNT }).map((_, i) => {
          const stillUrl = banner.stills[i % banner.stills.length];
          return (
            <div
              key={i}
              className="split-panel-wrap"
              style={{
                backgroundImage: `url(${banner.image})`,
                backgroundSize: `${PANEL_COUNT * 100}% auto`,
                backgroundPosition: `${(i / (PANEL_COUNT - 1)) * 100}% center`,
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => { if (isUnsubscribed) { openModal(); return; } router.push(banner.detailHref); }}
            >
              <div
                className="split-panel-still"
                style={{
                  backgroundImage: `url(${stillUrl})`,
                  opacity: hoveredIndex === i ? 1 : 0,
                }}
              />
              {i === 0 && (
                <div className="split-panel-logo">
                  <Image src="/images/logo/Netflix_Logo_RGB.png" alt="Netflix" width={80} height={22} style={{ objectFit: "contain" }} />
                  <Image src={banner.logoUrl} alt={TITLE} width={160} height={80} style={{ objectFit: "contain" }} />
                </div>
              )}
              {i === PANEL_COUNT - 2 && (
                <div className="split-panel-right-logo" style={{ opacity: hoveredIndex === PANEL_COUNT - 2 ? 0 : 1 }}>
                  <Image src={banner.rightLogoUrl} alt={TITLE} width={228} height={114} style={{ objectFit: "contain" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
