"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import AppIcon from "@/components/common/AppIcon";
import { FOOTER_MENU_GROUPS } from "@/data/footerMenu";
import "./footerMenuNav.scss";

const normalizeHref = (href: string) => href.split("?")[0];

export default function FooterMenuNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  const isActive = (href: string) => {
    const hrefPath = normalizeHref(href);
    if (hrefPath !== pathname) return false;
    if (href.startsWith("/contact?tab=")) {
      return currentTab === href.split("tab=")[1];
    }
    return true;
  };

  const activeItem =
    FOOTER_MENU_GROUPS.flatMap((group) => group.items).find((item) =>
      isActive(item.href),
    ) ?? FOOTER_MENU_GROUPS[0]?.items[0];

  return (
    <aside className="footer-menu-nav" aria-label="푸터 메뉴 이동">
      <button
        type="button"
        className="footer-menu-nav__mobile-trigger"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((isOpen) => !isOpen)}
      >
        <span>{activeItem?.label ?? "바로가기"}</span>
        <span className={mobileOpen ? "open" : ""}>
          <AppIcon name="chevron" size={14} color="currentColor" />
        </span>
      </button>

      <div
        className={`footer-menu-nav__list${mobileOpen ? " mobile-open" : ""}`}
      >
        {FOOTER_MENU_GROUPS.map((group) => (
          <div className="footer-menu-nav__group" key={group.label}>
            <h2>{group.label}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    className={isActive(item.href) ? "active" : ""}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
