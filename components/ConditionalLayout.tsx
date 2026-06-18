"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoginBanner from "@/components/LoginBanner";
import MobileBottomNav from "@/components/MobileBottomNav";
import Toaster from "@/components/common/Toaster";
import SubscribeModal from "@/components/SubscribeModal";
import { useAuthStore } from "@/store/useAuthStore";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";

// 헤더/푸터/배너를 숨길 경로 목록
const HIDE_LAYOUT_PATHS = ["/signin", "/onboarding", "/profiles"];
const FULLSCREEN_PATHS = ["/watch"];

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideLayout = HIDE_LAYOUT_PATHS.some((path) => pathname.startsWith(path));
  const isFullscreenPage = FULLSCREEN_PATHS.some((path) =>
    pathname.startsWith(path),
  );
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const showChrome = hasHydrated && !hideLayout && !isFullscreenPage;
  const { isOpen, closeModal } = useSubscribeModalStore();

  return (
    <>
      {showChrome && <Header />}
      <main
        className={
          isFullscreenPage ? "fullscreen-page" : hideLayout ? undefined : "has-nav"
        }
      >
        <div key={pathname} style={{ animation: "pageFadeIn 0.8s ease both" }}>
          {children}
        </div>
      </main>
      {!isFullscreenPage && !hideLayout && <Footer />}
      {showChrome && <LoginBanner />}
      {showChrome && <MobileBottomNav />}
      <Toaster />
      {isOpen && <SubscribeModal onClose={closeModal} />}
    </>
  );
}
