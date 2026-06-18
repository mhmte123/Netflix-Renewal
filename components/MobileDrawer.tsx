"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { customMenus, mainMenus } from "@/data/mainMenu";
import { useMenuLabel } from "@/lib/i18n";
import { useAuthStore } from "@/store/useAuthStore";
import type { UserProfile } from "@/types/auth";
import "./scss/mobileDrawer.scss";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProfileSwitch?: (profile: UserProfile) => Promise<void>;
}

const DEFAULT_HEADER_MENU_PATHS = [
  "/category",
  "/mypage/playlist?tab=playlists",
  "/mypage/playlist?tab=history",
];

const CATEGORY_MENU = {
  title: "카테고리",
  imgUrl: "/images/header/menu/category.png",
  path: "/category?tab=all",
};

const allSelectablePool = [...mainMenus, CATEGORY_MENU, ...customMenus];

const normalizeMenuPath = (path: string) =>
  path === "/mypage/playhist" ? "/mypage/playlist?tab=history" : path;

const uniqueMenuPaths = (paths: string[]) =>
  Array.from(new Set(paths.map(normalizeMenuPath)));

const isCountableCategoryChild = (path: string) =>
  path.startsWith("/genre/") || path.startsWith("/mood/");

const normalizeHeaderMenuPaths = (paths: string[]) => {
  const normalizedPaths = uniqueMenuPaths(paths);
  const hasCategoryItems = normalizedPaths.some(isCountableCategoryChild);
  return hasCategoryItems
    ? normalizedPaths
    : normalizedPaths.filter((path) => path !== CATEGORY_MENU.path);
};

type DrawerMenuItem = (typeof allSelectablePool)[number];
type DrawerMenuRow =
  | { type: "link"; menu: DrawerMenuItem }
  | { type: "category"; menu: DrawerMenuItem; children: DrawerMenuItem[] };

export default function MobileDrawer({
  isOpen,
  onClose,
  onProfileSwitch,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tm = useMenuLabel();
  const { currentProfile, user, onSetProfile, onLogout } = useAuthStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [storageRevision, setStorageRevision] = useState(0);
  const [liveMenuPaths, setLiveMenuPaths] = useState<string[] | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const profiles = user?.profile ?? [];
  const switchableProfiles = profiles.filter(
    (profile) => String(profile.id) !== String(currentProfile?.id),
  );
  const homeMenu = mainMenus.find((menu) => menu.path === "/");
  const queryString = searchParams.toString();
  const currentUrl = queryString ? `${pathname}?${queryString}` : pathname;

  const drawerMenus = useMemo(() => {
    void storageRevision;

    const pathsToMenus = (paths: string[]) =>
      normalizeHeaderMenuPaths(paths)
        .map((path) => allSelectablePool.find((menu) => menu.path === path))
        .filter((menu): menu is (typeof allSelectablePool)[number] => !!menu);

    if (!isMounted) {
      return pathsToMenus(DEFAULT_HEADER_MENU_PATHS);
    }

    if (liveMenuPaths) {
      return pathsToMenus(liveMenuPaths);
    }

    if (currentProfile) {
      return currentProfile.headerMenus?.length
        ? pathsToMenus(currentProfile.headerMenus)
        : pathsToMenus(DEFAULT_HEADER_MENU_PATHS);
    }

    const saved = localStorage.getItem("custom_header_menus");
    if (saved) {
      try {
        return pathsToMenus(JSON.parse(saved) as string[]);
      } catch (e) {
        console.error("모바일 메뉴 동기화 실패:", e);
      }
    }

    return pathsToMenus(DEFAULT_HEADER_MENU_PATHS);
  }, [currentProfile, isMounted, liveMenuPaths, storageRevision]);

  const isMenuActive = (menuPath: string) => {
    const [targetPathname, targetQuery = ""] = menuPath.split("?");

    if (targetPathname !== pathname) return false;
    if (!targetQuery) return true;

    const targetParams = new URLSearchParams(targetQuery);
    return Array.from(targetParams.entries()).every(
      ([key, value]) => searchParams.get(key) === value,
    );
  };

  const handleDrawerLinkClick = () => {
    onClose();
  };

  const categoryChildren = drawerMenus.filter((menu) =>
    isCountableCategoryChild(menu.path),
  );
  const hasCategoryDropdown = categoryChildren.length > 0;
  const categoryParent = hasCategoryDropdown ? CATEGORY_MENU : undefined;
  const drawerMenuRows = useMemo<DrawerMenuRow[]>(() => {
    const rows: DrawerMenuRow[] = [];
    let insertedCategory = false;

    drawerMenus.forEach((menu) => {
      if (hasCategoryDropdown && isCountableCategoryChild(menu.path)) {
        if (!insertedCategory && categoryParent) {
          rows.push({
            type: "category",
            menu: categoryParent,
            children: categoryChildren,
          });
          insertedCategory = true;
        }
        return;
      }

      if (hasCategoryDropdown && menu.path === CATEGORY_MENU.path) {
        if (!insertedCategory && categoryParent) {
          rows.push({
            type: "category",
            menu: categoryParent,
            children: categoryChildren,
          });
          insertedCategory = true;
        }
        return;
      }

      rows.push({ type: "link", menu });
    });

    if (hasCategoryDropdown && !insertedCategory && categoryParent) {
      rows.push({
        type: "category",
        menu: categoryParent,
        children: categoryChildren,
      });
    }

    return rows;
  }, [categoryChildren, categoryParent, drawerMenus, hasCategoryDropdown]);
  const isCategoryActive = categoryChildren.some((menu) =>
    isMenuActive(menu.path),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveMenuPaths(null);
  }, [currentProfile?.id]);

  useEffect(() => {
    const handleCustomMenuStorageUpdate = (event: Event) => {
      const paths = (event as CustomEvent<{ paths?: string[] }>).detail?.paths;
      if (Array.isArray(paths)) {
        setLiveMenuPaths(paths);
      }
      setStorageRevision((revision) => revision + 1);
    };

    window.addEventListener(
      "customMenuStorageUpdate",
      handleCustomMenuStorageUpdate,
    );

    return () => {
      window.removeEventListener(
        "customMenuStorageUpdate",
        handleCustomMenuStorageUpdate,
      );
    };
  }, []);

  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";

      resetTimer = setTimeout(() => {
        setIsProfileModalOpen(false);
        setIsCategoryOpen(false);
      }, 350);
    }

    return () => {
      document.body.style.overflow = "";
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) onClose();
  }, [pathname, queryString]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProfileSelect = (profile: UserProfile) => {
    if (profile.id === currentProfile?.id) {
      setIsProfileModalOpen(false);
      return;
    }
    setIsProfileModalOpen(false);
    onClose();
    if (onProfileSwitch) {
      void onProfileSwitch(profile);
      return;
    }
    onSetProfile(profile);
    router.replace("/");
  };

  const handleLogout = async () => {
    await onLogout();
    setIsProfileModalOpen(false);
    onClose();
    router.push("/");
  };

  return (
    <>
      <div
        className={`mobile-drawer-backdrop${isOpen ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`mobile-drawer${isOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
      >
        <div className="mobile-drawer-header">
          {user && currentProfile ? (
            <button
              type="button"
              className="mobile-drawer-profile"
              onClick={() => setIsProfileModalOpen(true)}
            >
              <Image
                src={
                  currentProfile.imgUrl ??
                  "/images/profile/image/default_icons/17.png"
                }
                alt={currentProfile.nickname ?? "프로필"}
                width={40}
                height={40}
                className="mobile-drawer-profile__img"
              />
              <span className="mobile-drawer-profile__name">
                {currentProfile.nickname ?? "프로필"}
              </span>
              <svg
                className="mobile-drawer-profile__arrow"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          ) : (
            <Link href="/login" className="mobile-drawer-profile">
              <div className="mobile-drawer-profile__placeholder">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <span className="mobile-drawer-profile__name">로그인</span>
            </Link>
          )}
          <button
            className="mobile-drawer-close"
            onClick={onClose}
            aria-label="메뉴 닫기"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="mobile-drawer-nav">
          {homeMenu && (
            <Link
              href={homeMenu.path}
              className={`mobile-drawer-item${isMenuActive(homeMenu.path) ? " active" : ""}`}
              onClick={handleDrawerLinkClick}
            >
              <Image
                src={homeMenu.imgUrl}
                alt=""
                width={22}
                height={22}
                aria-hidden="true"
              />
              <span>{tm(homeMenu.title)}</span>
            </Link>
          )}
          <div className="mobile-drawer-divider" />
          {drawerMenuRows.map((row) =>
            row.type === "link" ? (
              <Link
                key={row.menu.path}
                href={row.menu.path}
                className={`mobile-drawer-item${isMenuActive(row.menu.path) ? " active" : ""}`}
                onClick={handleDrawerLinkClick}
              >
                <Image
                  src={row.menu.imgUrl}
                  alt=""
                  width={22}
                  height={22}
                  aria-hidden="true"
                />
                <span>{tm(row.menu.title)}</span>
              </Link>
            ) : (
              <div
                key="category-dropdown"
                className={`mobile-drawer-category${isCategoryOpen ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className={`mobile-drawer-item mobile-drawer-category__toggle${isCategoryActive ? " active" : ""}`}
                  onClick={() => setIsCategoryOpen((open) => !open)}
                  aria-expanded={isCategoryOpen}
                >
                  <Image
                    src={row.menu.imgUrl}
                    alt=""
                    width={22}
                    height={22}
                    aria-hidden="true"
                  />
                  <span>{tm(row.menu.title)}</span>
                  <svg
                    className="mobile-drawer-category__arrow"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isCategoryOpen && (
                  <div className="mobile-drawer-submenu">
                    {row.children.map((menu) => (
                      <Link
                        key={menu.path}
                        href={menu.path}
                        className={`mobile-drawer-subitem${isMenuActive(menu.path) ? " active" : ""}`}
                        onClick={handleDrawerLinkClick}
                      >
                        <Image
                          src={menu.imgUrl}
                          alt=""
                          width={18}
                          height={18}
                          aria-hidden="true"
                        />
                        <span>{tm(menu.title)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
          <div className="mobile-drawer-divider" />
          <Link
            href="/menu/custom"
            className={`mobile-drawer-item${pathname === "/menu/custom" ? " active" : ""}`}
            onClick={handleDrawerLinkClick}
          >
            <Image
              src="/images/header/menu/custom.svg"
              alt=""
              width={22}
              height={22}
              aria-hidden="true"
            />
            <span>{tm("커스텀")}</span>
          </Link>
        </nav>
      </div>

      {/* 프로필 바텀시트 */}
      {isProfileModalOpen && (
        <>
          <div
            className="profile-modal-backdrop"
            onClick={() => setIsProfileModalOpen(false)}
            aria-hidden="true"
          />
          <div
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="프로필"
          >
            <div className="profile-modal__handle" />

            {switchableProfiles.length > 0 && (
              <ul className="profile-modal__switch-list">
                {switchableProfiles.map((profile) => (
                  <li key={profile.id}>
                    <button
                      type="button"
                      className="profile-modal__switch-btn"
                      onClick={() => handleProfileSelect(profile)}
                    >
                      <Image
                        src={
                          profile.imgUrl ??
                          "/images/profile/image/default_icons/17.png"
                        }
                        alt={profile.nickname ?? "프로필"}
                        width={44}
                        height={44}
                        className="profile-modal__switch-img"
                      />
                      <span>{profile.nickname}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="profile-modal__divider" />

            <ul className="profile-modal__link-list">
              <li>
                <Link
                  href="/mypage"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    onClose();
                  }}
                >
                  마이페이지
                </Link>
              </li>
              <li>
                <Link
                  href="/profiles"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    onClose();
                  }}
                >
                  프로필 전환
                </Link>
              </li>
              <li>
                <Link
                  href="/settings"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    onClose();
                  }}
                >
                  설정
                </Link>
              </li>
            </ul>

            <div className="profile-modal__divider" />

            <button
              type="button"
              className="profile-modal__logout"
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </div>
        </>
      )}
    </>
  );
}
