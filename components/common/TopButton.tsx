"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import styles from "./TopButton.module.scss";

export default function TopButton() {
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [animClass, setAnimClass] = useState(styles.enter);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      setAnimClass(styles.enter);
    } else if (rendered) {
      setAnimClass(styles.exit);
      const timer = setTimeout(() => setRendered(false), 220);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  if (!mounted || !rendered) return null;

  return createPortal(
    <button
      className={`${styles.topBtn} ${animClass}`}
      onClick={scrollToTop}
      aria-label="맨 위로"
    >
      <Image src="/images/icon/top-icon-white.svg" alt="top" width={24} height={24} />
    </button>,
    document.body
  );
}
