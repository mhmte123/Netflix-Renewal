"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * 앱 시작 시 Firebase 인증 상태를 복원하는 Provider
 * - onAuthStateChanged를 구독해서 새로고침/페이지 이동 후에도 로그인 유지
 * - 이게 없으면 auth.currentUser가 null로 시작해서 찜/위시리스트가 동작 안 함
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const onInitAuth = useAuthStore((state) => state.onInitAuth);

  useEffect(() => {
    return onInitAuth();
  }, [onInitAuth]);

  return <>{children}</>;
}
