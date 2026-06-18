"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import "./scss/moodBanner.scss";

import { useSubscriptionGuard } from "@/lib/subscription";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";
import { useT } from "@/lib/i18n";

export default function MoodBanner() {
  const sectionRef = useRef<HTMLElement>(null);
  const { isUnsubscribed } = useSubscriptionGuard();
  const openModal = useSubscribeModalStore((state) => state.openModal);
  const t = useT();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const rect = section.getBoundingClientRect();

    if (rect.top < window.innerHeight) {
      // 이미 뷰포트 안에 있으면 트랜지션 없이 즉시 표시
      section.classList.add("is-visible--instant");
      return;
    }

    // 뷰포트 밖(아래)에 있을 때만 스크롤 애니메이션 등록
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          section.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);


  return (
    <section className="mood-banner-section" ref={sectionRef}>
      <Link
        href="/mood"
        className="mood-banner"
        onClick={(e) => { if (isUnsubscribed) { e.preventDefault(); openModal(); } }}
      >
        <div className="mood-banner__bg" aria-hidden="true">
          <span className="mood-banner__orb mood-banner__orb--1" />
          <span className="mood-banner__orb mood-banner__orb--2" />
          <span className="mood-banner__orb mood-banner__orb--3" />
        </div>

        <div className="mood-banner__inner">
          <div className="mood-banner__content">
            <p className="mood-banner__eyebrow">{t("mood.banner.eyebrow")}</p>
            <h2 className="mood-banner__title">
              {t("mood.banner.titlePre")}
              <em>{t("mood.banner.titleAccent")}</em>
              {t("mood.banner.titlePost")}
            </h2>
            <p className="mood-banner__desc">
              {t("mood.banner.desc")}
            </p>
          </div>

          <div className="mood-banner__image" aria-hidden="true">
            <Image
              src="/images/banner/moodBanner-img-02.png"
              alt=""
              width={400}
              height={260}
              sizes="(max-width: 700px) 70vw, 400px"
              quality={72}
            />
          </div>
        </div>
      </Link>
    </section>
  );
}
