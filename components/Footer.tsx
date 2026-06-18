"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useLangStore, LANG_LABELS, labelToLang } from "@/store/useLangStore";
import { useT } from "@/lib/i18n";
import AppIcon from "@/components/common/AppIcon";
import { FOOTER_MENU_GROUPS } from "@/data/footerMenu";
import "./scss/footer.scss";

const BUSINESS_INFO = [
  "넷플릭스서비스코리아 유한회사  통신판매업신고번호: 제2018-서울종로-0426호  전화번호: 00-308-321-0161 (수신자 부담)  대표: 레지널드 숀 톰프슨",
  "주소: 대한민국 서울특별시 종로구 우정국로 26, 센트로폴리스 A동 20층 우편번호 03161  사업자등록번호: 165-87-00119",
  "이메일 주소: korea@netflix.com  클라우드 호스팅: Amazon Web Services Inc.  공정거래위원회 웹사이트",
];

const SOCIAL = [
  { src: "/images/footer/sns-youtube.svg", alt: "YouTube", href: "https://www.youtube.com/channel/UCiEEF51uRAeZeCo8CJFhGWw/featured" },
  { src: "/images/footer/sns-twitter.svg", alt: "Twitter", href: "https://twitter.com/NetflixKR" },
  { src: "/images/footer/sns-instagram.svg", alt: "Instagram", href: "https://www.instagram.com/netflixkr/" },
  { src: "/images/footer/sns-facebook.svg", alt: "Facebook", href: "https://www.facebook.com/NetflixKR" },
];

const LANGUAGES = ["한국어", "English"];

export default function Footer() {
  const [langOpen, setLangOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { lang, setLang } = useLangStore();
  const t = useT();
  const contactHref = user ? "/contact?tab=inquiry" : "/login";

  const handleLanguageChange = (label: string) => {
    const nextLang = labelToLang(label);
    setLangOpen(false);

    if (nextLang === lang) return;

    setLang(nextLang);
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    window.requestAnimationFrame(() => window.location.reload());
  };

  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-sns-row">
          <Image
            src="/images/logo/Netflix_Logo_RGB.png"
            alt="Netflix"
            width={100}
            height={27}
            className="footer-logo"
          />
          <div className="footer-sns">
            {SOCIAL.map(({ src, alt, href }) => (
              <a key={alt} href={href} aria-label={alt} target="_blank" rel="noreferrer" className="sns-icon">
                <Image src={src} alt={alt} width={20} height={20} />
              </a>
            ))}
          </div>
        </div>

        <hr className="footer-divider" />

        <div className="footer-menu-groups" aria-label="푸터 메뉴">
          {FOOTER_MENU_GROUPS.map((group) => {
            const isOpen = openGroup === group.label;
            return (
              <div className="footer-menu-group" key={group.label}>
                {isOpen && (
                  <ul className="footer-menu-dropdown">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.label === "문의하기" ? contactHref : item.href}
                          onClick={() => setOpenGroup(null)}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="footer-menu-trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                >
                  <span>{group.label}</span>
                  <span className={`footer-menu-arrow${isOpen ? " open" : ""}`}>
                    <AppIcon name="chevron" size={14} color="currentColor" />
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="footer-biz">
          {BUSINESS_INFO.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <hr className="footer-divider" />

        <div className="footer-bottom-bar">
          <div className="footer-copyright">
            <p>© 2026 NETFLIX, Inc. All rights reserved.</p>
            <p>{t("footer.disclaimer")}</p>
          </div>

          <div className="lang-wrap">
            {langOpen && (
              <ul className="lang-dropdown">
                {LANGUAGES.map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      className={LANG_LABELS[lang] === label ? "active" : ""}
                      onClick={() => handleLanguageChange(label)}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="lang-btn"
              onClick={() => setLangOpen((o) => !o)}
              aria-expanded={langOpen}
            >
              <span className="lang-globe">
                <AppIcon name="globe" size={16} color="currentColor" />
              </span>
              <span>{LANG_LABELS[lang]}</span>
              <span className={`lang-arrow${langOpen ? " open" : ""}`}>
                <AppIcon name="chevron" size={14} color="currentColor" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
