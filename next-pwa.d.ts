// next-pwa.d.ts
declare module 'next-pwa' {
  import { NextConfig } from 'next';
  
  interface PWAConfig {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    // 필요한 다른 옵션들이 있다면 여기에 추가 가능합니다
  }

  export default function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
}