"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function IntroVideo() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shown = sessionStorage.getItem("intro_shown");
    if (!shown) {
      setVisible(true);
      sessionStorage.setItem("intro_shown", "1");
    }
  }, []);

  useEffect(() => {
    if (!visible || !videoRef.current) return;
    const video = videoRef.current;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }, [visible]);

  const dismiss = () => {
    if (user) {
      // 오버레이를 검은색으로 유지한 채 먼저 이동, 페이지 로드 후 페이드아웃
      router.push("/profiles");
      setTimeout(() => {
        setFading(true);
        setTimeout(() => setVisible(false), 700);
      }, 350);
    } else {
      setFading(true);
      setTimeout(() => setVisible(false), 800);
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.8s ease",
      }}
      onClick={dismiss}
    >
      <video
        ref={videoRef}
        src="/Netflix_Intro_intro.mp4"
        playsInline
        onEnded={dismiss}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    </div>
  );
}
