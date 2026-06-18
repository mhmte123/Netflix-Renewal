"use client";

import { mainMenus, customMenus } from "@/data/mainMenu";
import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useMenuLabel } from "@/lib/i18n";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";
import { useCommunityEnabled } from "@/data/maturityFilter";

const CATEGORY_MENU = {
  title: "카테고리",
  imgUrl: "/images/header/menu/category.png",
  path: "/category?tab=all",
};

const allSelectablePool = [...mainMenus, CATEGORY_MENU, ...customMenus];

const DEFAULT_HEADER_MENU_PATHS = [
  "/category",
  "/category?tab=movie",
  "/category?tab=tv",
  "/category?tab=animation",
  "/mypage/playlist?tab=playlists",
  "/mypage/playlist?tab=history",
];

const normalizeMenuPath = (path: string) =>
  path === "/mypage/playhist" ? "/mypage/playlist?tab=history" : path;

const uniqueMenuPaths = (paths: string[]) =>
  Array.from(new Set(paths.map(normalizeMenuPath)));

const isCategoryMenuPath = (path: string) =>
  path.startsWith("/category?") ||
  path.startsWith("/genre/") ||
  path.startsWith("/mood/");

const ensureCategoryMenuPath = (paths: string[]) => {
  const normalizedPaths = uniqueMenuPaths(paths);
  const hasCategoryChildren = normalizedPaths.some(
    (path) => path !== CATEGORY_MENU.path && isCategoryMenuPath(path),
  );

  return hasCategoryChildren
    ? normalizedPaths
    : normalizedPaths.filter((path) => path !== CATEGORY_MENU.path);
};

export default function HeaderMenu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tm = useMenuLabel();
  const prefetchRoute = useRoutePrefetch();
  const currentProfile = useAuthStore((state) => state.currentProfile);
  const isCommunityEnabled = useCommunityEnabled();
  const [storageRevision, setStorageRevision] = useState(0);
  const [liveMenuPaths, setLiveMenuPaths] = useState<string[] | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const queryString = searchParams.toString();
  const currentUrl = queryString ? `${pathname}?${queryString}` : pathname;

  const isMenuActive = (menuPath: string) => {
    const [targetPathname, targetQuery = ""] = menuPath.split("?");

    if (targetPathname !== pathname) return false;
    if (!targetQuery) return true;

    const targetParams = new URLSearchParams(targetQuery);
    return Array.from(targetParams.entries()).every(
      ([key, value]) => searchParams.get(key) === value,
    );
  };

  useEffect(() => {
    setIsMounted(true); // 클라이언트에서만 실행
  }, []);

  useEffect(() => {
    setLiveMenuPaths(null);
  }, [currentProfile?.id]);

  const baseDynamicMenus = useMemo(() => {
    // 1. 마운트 전(서버)에는 무조건 기본 메뉴 반환 (Hydration 불일치 방지)
    if (!isMounted) {
      return DEFAULT_HEADER_MENU_PATHS.map((path) =>
        allSelectablePool.find((m) => m.path === path),
      ).filter((menu): menu is (typeof allSelectablePool)[number] => !!menu);
    }

    if (liveMenuPaths) {
      return ensureCategoryMenuPath(liveMenuPaths)
        .map((path) => allSelectablePool.find((m) => m.path === path))
        .filter((menu): menu is (typeof allSelectablePool)[number] => !!menu);
    }

    // 2. 마운트 후(클라이언트)에는 로직대로 메뉴 계산
    if (currentProfile) {
      const profileMenuPaths = currentProfile.headerMenus?.length
        ? ensureCategoryMenuPath(currentProfile.headerMenus)
        : DEFAULT_HEADER_MENU_PATHS;
      return profileMenuPaths
        .map((path) => allSelectablePool.find((m) => m.path === path))
        .filter((menu): menu is (typeof allSelectablePool)[number] => !!menu);
    }

    const saved = localStorage.getItem("custom_header_menus");
    if (saved) {
      try {
        const savedPaths: string[] = JSON.parse(saved);
        const normalizedPaths = ensureCategoryMenuPath(savedPaths);
        return normalizedPaths
          .map((path) => allSelectablePool.find((m) => m.path === path))
          .filter((menu): menu is (typeof allSelectablePool)[number] => !!menu);
      } catch (e) {
        console.error("메뉴 동기화 실패:", e);
      }
    }

    return DEFAULT_HEADER_MENU_PATHS.map((path) =>
      allSelectablePool.find((m) => m.path === path),
    ).filter((menu): menu is (typeof allSelectablePool)[number] => !!menu);
  }, [isMounted, currentProfile, liveMenuPaths, storageRevision]); // 의존성 추가

  // 마이페이지에서 커뮤니티 숨김 모드가 켜져 있으면(=isCommunityEnabled false)
  // 헤더메뉴에 추가된 피드 탭(/feed)을 숨김
  const dynamicMenus = useMemo(() => {
    if (isCommunityEnabled) return baseDynamicMenus;
    return baseDynamicMenus.filter((menu) => menu.path !== "/feed");
  }, [baseDynamicMenus, isCommunityEnabled]);

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

  const homeMenu = mainMenus.find((m) => m.path === "/");

  const CATEGORY_TOP_LEVEL = new Set([
    "/category?type=movie",
    "/category?type=tv",
    "/category?type=animation",
    "/category?tab=movie",
    "/category?tab=tv",
    "/category?tab=animation",
  ]);

  const categoryChildren = dynamicMenus.filter(
    (menu) =>
      menu.path !== CATEGORY_MENU.path &&
      isCategoryMenuPath(menu.path) &&
      !CATEGORY_TOP_LEVEL.has(menu.path),
  );

  const defaultCategoryChildren = mainMenus.filter(
    (menu) =>
      menu.path.startsWith("/category?") && !CATEGORY_TOP_LEVEL.has(menu.path),
  );

  const categoryPanelMenus =
    categoryChildren.length > 0 ? categoryChildren : defaultCategoryChildren;

  const categoryParent = dynamicMenus.find(
    (menu) => menu.path === CATEGORY_MENU.path,
  );

  const isCategoryActive = categoryParent
    ? isMenuActive(categoryParent.path) ||
    categoryPanelMenus.some((menu) => isMenuActive(menu.path))
    : false;

  return (
    <>
      <nav className="sidebar-nav">
        <div className="main-menu sidebar-icons">
          {homeMenu && (
            <div
              className={`sb-icon ${isMenuActive(homeMenu.path) ? "active" : ""}`}
            >
              <Link
                href={homeMenu.path}
                onPointerEnter={() => prefetchRoute(homeMenu.path)}
                onFocus={() => prefetchRoute(homeMenu.path)}
              >
                <Image
                  src={homeMenu.imgUrl}
                  alt={homeMenu.title}
                  width="24"
                  height="24"
                />
                <span className="sb-label">{tm(homeMenu.title)}</span>
              </Link>
            </div>
          )}

          <div className="sb-divider"></div>

          {dynamicMenus.map((menu) => {
            const isCategoryChild =
              menu.path !== CATEGORY_MENU.path && isCategoryMenuPath(menu.path);

            const isCategoryTopLevel = [
              "/category?type=movie",
              "/category?type=tv",
              "/category?type=animation",
              "/category?tab=movie",
              "/category?tab=tv",
              "/category?tab=animation",
            ].includes(menu.path);

            if (isCategoryChild && !isCategoryTopLevel) {
              return null;
            }

            if (menu.path === CATEGORY_MENU.path) {
              return (
                <div
                  key={menu.path}
                  className={`sb-icon sb-category-group ${isCategoryActive ? "active" : ""
                    }`}
                >
                  <Link
                    href={menu.path}
                    onPointerEnter={() => prefetchRoute(menu.path)}
                    onFocus={() => prefetchRoute(menu.path)}
                  >
                    <Image
                      src={menu.imgUrl}
                      alt={menu.title}
                      width="24"
                      height="24"
                    />
                    <span className="sb-label">{tm(menu.title)}</span>
                  </Link>
                </div>
              );
            }

            const isActive = isMenuActive(menu.path);

            return (
              <div
                key={menu.path}
                className={`sb-icon ${isActive ? "active" : ""}`}
              >
                <Link
                  href={menu.path}
                  onPointerEnter={() => prefetchRoute(menu.path)}
                  onFocus={() => prefetchRoute(menu.path)}
                >
                  <Image
                    src={menu.imgUrl}
                    alt={menu.title}
                    width="24"
                    height="24"
                  />
                  <span className="sb-label">{tm(menu.title)}</span>
                </Link>
              </div>
            );
          })}

          <div className="sb-divider"></div>

          <div
            className={`sb-icon ${pathname === "/menu/custom" ? "active" : ""}`}
          >
            <Link
              href="/menu/custom"
              onPointerEnter={() => prefetchRoute("/menu/custom")}
              onFocus={() => prefetchRoute("/menu/custom")}
            >
              <Image
                src="/images/header/menu/custom.svg"
                alt="설정"
                width="24"
                height="24"
              />
              <span className="sb-label">{tm("커스텀")}</span>
            </Link>
          </div>
        </div>

        {/* <div
        className={`sb-icon sb-bottom ${pathname === "/settings" ? "active" : ""
          }`}
      >
        <Link href="/settings">
          <Image
            src="/images/header/menu/setting.svg"
            alt="설정"
            width="24"
            height="24"
          />
          <span className="sb-label">{tm("설정")}</span>
        </Link>
      </div> */}
      </nav>

      {categoryPanelMenus.length > 0 && (
        <div className="category-hover-panel">
          {categoryPanelMenus.map((childMenu) => {
            const isActive = isMenuActive(childMenu.path);
            return (
              <div
                key={childMenu.path}
                className={`category-hover-icon ${isActive ? "active" : ""}`}
              >
                <Link
                  href={childMenu.path}
                  onPointerEnter={() => prefetchRoute(childMenu.path)}
                  onFocus={() => prefetchRoute(childMenu.path)}
                >
                  <Image
                    src={childMenu.imgUrl}
                    alt={childMenu.title}
                    width="24"
                    height="24"
                  />
                  <span className="sb-label">{tm(childMenu.title)}</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}