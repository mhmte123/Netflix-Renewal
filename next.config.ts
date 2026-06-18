import type { NextConfig } from "next";
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "*.kakaocdn.net", // 카카오 관련 모든 서브도메인 허용
      },
      {
        protocol: "https",
        hostname: "img1.kakaocdn.net", // 에러 메시지에 명시된 특정 호스트
      },
      {
        protocol: "https",
        hostname: "t1.kakaocdn.net", // 카카오 프로필 이미지 호스트
      },
      {
        protocol: "https",
        hostname: "*.pstatic.net", // 네이버 프로필 이미지 도메인 허용
      },
      {
        protocol: "https",
        hostname: "profile-phinf.pstatic.net", // 네이버 프로필 이미지 호스트 예시
      },
      {
        protocol: "http", // 카카오 이미지 URL이 http인 경우도 대비
        hostname: "*.kakaocdn.net",
      },
    ],
  },
  allowedDevOrigins: ["172.16.54.18", "175.192.236.31"],
  turbopack: {
    root: process.cwd(),
  },
};

export default withPWA(nextConfig);
