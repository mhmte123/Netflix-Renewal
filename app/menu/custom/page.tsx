"use client";

import Image from "next/image";
import AppIcon from "@/components/common/AppIcon";
import { showToast } from "@/store/useToastStore";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { DragEvent } from "react";
import { mainMenus, customMenus } from "@/data/mainMenu";
import { useAuthStore } from "@/store/useAuthStore";
import "../../scss/menuCustom.scss";
import BackButton from "@/components/common/BackButton";

// 전체 선택 풀 생성 (순서 매핑용)
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
const isCategoryMenuPath = (path: string) =>
  path.startsWith("/category?") ||
  path.startsWith("/genre/") ||
  path.startsWith("/mood/");
const isCategoryChildPath = (path: string) =>
  path !== CATEGORY_MENU.path && isCategoryMenuPath(path);
// Only genres and moods count toward the 10-item category limit.
const isCountableCategoryChild = (path: string) =>
  path.startsWith("/genre/") || path.startsWith("/mood/");
const normalizeHeaderMenuPaths = (paths: string[]) => {
  const normalizedPaths = uniqueMenuPaths(paths);
  const hasCategoryItems = normalizedPaths.some(isCountableCategoryChild);
  return hasCategoryItems
    ? normalizedPaths
    : normalizedPaths.filter((path) => path !== CATEGORY_MENU.path);
};
export default function MenuCustomPage() {
  const [selectedMenuPaths, setSelectedMenuPaths] = useState<string[]>([]);
  const [draggedMenuPath, setDraggedMenuPath] = useState<string | null>(null);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const pendingFlowRectsRef = useRef<Map<string, DOMRect> | null>(null);
  const pendingSaveRef = useRef<string[] | null>(null);
  const baseOpen = true;
  const { currentProfile, onUpdateProfile } = useAuthStore();
  const currentProfileId = currentProfile?.id;
  const currentProfileHeaderMenus = currentProfile?.headerMenus;

  // 1. 초기 세팅값 LocalStorage 로드
  useEffect(() => {
    if (currentProfileId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMenuPaths(
        currentProfileHeaderMenus?.length
          ? normalizeHeaderMenuPaths(currentProfileHeaderMenus)
          : DEFAULT_HEADER_MENU_PATHS,
      );
      return;
    }

    const saved = localStorage.getItem("custom_header_menus");
    if (saved) {
      try {
        const normalizedPaths = normalizeHeaderMenuPaths(
          JSON.parse(saved) as string[],
        );
        setSelectedMenuPaths(normalizedPaths);
        localStorage.setItem(
          "custom_header_menus",
          JSON.stringify(normalizedPaths),
        );
      } catch (e) {
        console.error(e);
      }
    } else {
      const defaultPaths = DEFAULT_HEADER_MENU_PATHS;
      setSelectedMenuPaths(defaultPaths);
      localStorage.setItem("custom_header_menus", JSON.stringify(defaultPaths));
    }
  }, [currentProfileId, currentProfileHeaderMenus]);

  // 2. 토글 핸들러 (클릭한 순서대로 배열 끝에 추가됨)
  const syncHeaderMenusLocally = (paths: string[]) => {
    const sanitizedPaths = normalizeHeaderMenuPaths(paths);

    setSelectedMenuPaths(sanitizedPaths);
    localStorage.setItem("custom_header_menus", JSON.stringify(sanitizedPaths));
    window.dispatchEvent(
      new CustomEvent("customMenuStorageUpdate", {
        detail: { paths: sanitizedPaths },
      }),
    );

    return sanitizedPaths;
  };

  const saveHeaderMenus = async (paths: string[]) => {
    const sanitizedPaths = syncHeaderMenusLocally(paths);

    if (!currentProfile) return;

    await onUpdateProfile({
      ...currentProfile,
      headerMenus: sanitizedPaths,
    });
  };

  const handleToggleMenu = async (path: string) => {
    const hasCategoryItems = selectedMenuPaths.some(isCountableCategoryChild);
    if (path === CATEGORY_MENU.path && !hasCategoryItems) {
      showToast("카테고리 메뉴는 장르 또는 무드를 하나 이상 선택해야 활성화됩니다.");
      return;
    }

    let updatedPaths: string[];

    if (selectedMenuPaths.includes(path)) {
      updatedPaths = selectedMenuPaths.filter((p) => p !== path);
    } else {
      const selectedCategoryCount = selectedMenuPaths.filter(
        isCountableCategoryChild,
      ).length;

      if (isCountableCategoryChild(path) && selectedCategoryCount >= 10) {
        showToast("카테고리 메뉴는 최대 10개까지만 선택할 수 있습니다.");
        return;
      }

      updatedPaths = [...selectedMenuPaths, path];
    }

    await saveHeaderMenus(updatedPaths);
  };

  const handleReset = async () => {
    await saveHeaderMenus(DEFAULT_HEADER_MENU_PATHS);
  };

  const handlePreviewDragStart = (
    event: DragEvent<HTMLDivElement>,
    path: string,
  ) => {
    setDraggedMenuPath(path);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", path);

    try {
      const target = event.currentTarget as HTMLElement;
      const clone = target.cloneNode(true) as HTMLElement;
      // copy computed styles to cloned node to avoid CSS loss in drag image
      const copyComputedStyles = (src: HTMLElement, dest: HTMLElement) => {
        const cs = window.getComputedStyle(src);
        for (let i = 0; i < cs.length; i++) {
          const prop = cs.item(i);
          if (prop)
            dest.style.setProperty(
              prop,
              cs.getPropertyValue(prop),
              cs.getPropertyPriority(prop),
            );
        }
        // recursively copy for children nodes
        const srcChildren = Array.from(src.children) as HTMLElement[];
        const destChildren = Array.from(dest.children) as HTMLElement[];
        for (let i = 0; i < srcChildren.length; i++) {
          if (destChildren[i])
            copyComputedStyles(srcChildren[i], destChildren[i] as HTMLElement);
        }
      };
      // place offscreen so it won't affect layout
      clone.style.position = "absolute";
      clone.style.top = "-9999px";
      clone.style.left = "-9999px";
      clone.style.zIndex = "9999";
      // ensure visible look for drag image
      clone.style.opacity = "1";
      // copy computed styles so the ghost looks identical
      copyComputedStyles(target, clone);
      // prevent ghost from catching pointer events
      clone.style.pointerEvents = "none";
      document.body.appendChild(clone);
      // center the pointer on the ghost
      const rect = clone.getBoundingClientRect();
      event.dataTransfer.setDragImage(clone, rect.width / 2, rect.height / 2);
      dragGhostRef.current = clone;
    } catch (e) {
      // fail silently if setDragImage not supported
      // console.debug('setDragImage failed', e);
    }
  };

  const getFlowChipRects = () => {
    const rects = new Map<string, DOMRect>();
    document
      .querySelectorAll<HTMLElement>(".flow-chip[data-menu-path]")
      .forEach((element) => {
        const path = element.dataset.menuPath;
        if (path) {
          rects.set(path, element.getBoundingClientRect());
        }
      });

    return rects;
  };

  const animateFlowChipMove = (previousRects: Map<string, DOMRect>) => {
    requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>(".flow-chip[data-menu-path]")
        .forEach((element) => {
          const path = element.dataset.menuPath;
          if (!path) return;

          const previousRect = previousRects.get(path);
          if (!previousRect) return;

          const nextRect = element.getBoundingClientRect();
          const deltaX = previousRect.left - nextRect.left;
          const deltaY = previousRect.top - nextRect.top;

          if (!deltaX && !deltaY) return;

          // cancel any running animations on the element to avoid stacking
          element.getAnimations().forEach((a) => a.cancel());
          // hint for better performance
          element.style.willChange = "transform";

          // use translate3d for GPU acceleration and smoother motion
          element.animate(
            [
              { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
              { transform: "translate3d(0, 0, 0)" },
            ],
            {
              duration: 360,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "both",
            },
          );
        });
    });
  };

  useLayoutEffect(() => {
    const previousRects = pendingFlowRectsRef.current;
    if (!previousRects) return;

    pendingFlowRectsRef.current = null;
    animateFlowChipMove(previousRects);
  }, [selectedMenuPaths]);

  const handlePreviewDragOver = (
    event: DragEvent<HTMLDivElement>,
    targetPath: string,
  ) => {
    event.preventDefault();

    const sourcePath =
      draggedMenuPath || event.dataTransfer.getData("text/plain");
    if (!sourcePath || sourcePath === targetPath) return;

    const sourceIndex = selectedMenuPaths.indexOf(sourcePath);
    const targetIndex = selectedMenuPaths.indexOf(targetPath);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const targetRect = event.currentTarget.getBoundingClientRect();
    const isMobilePreview = window.matchMedia("(max-width: 760px)").matches;
    const targetMiddle = isMobilePreview
      ? targetRect.top + targetRect.height / 2
      : targetRect.left + targetRect.width / 2;
    const pointerPosition = isMobilePreview ? event.clientY : event.clientX;
    const movingForward = sourceIndex < targetIndex;
    const movingBackward = sourceIndex > targetIndex;

    if (movingForward && pointerPosition < targetMiddle) return;
    if (movingBackward && pointerPosition > targetMiddle) return;

    const nextPaths = [...selectedMenuPaths];
    const [movedPath] = nextPaths.splice(sourceIndex, 1);
    nextPaths.splice(targetIndex, 0, movedPath);
    pendingFlowRectsRef.current = getFlowChipRects();
    setDraggedMenuPath(sourcePath);
    const syncedPaths = syncHeaderMenusLocally(nextPaths);
    // defer Firestore profile persistence until drag end to avoid layout churn
    pendingSaveRef.current = syncedPaths;
  };

  const handlePreviewDragEnd = () => {
    setDraggedMenuPath(null);
    // remove custom drag ghost if present
    if (dragGhostRef.current) {
      try {
        document.body.removeChild(dragGhostRef.current);
      } catch (e) {
        /* ignore */
      }
      dragGhostRef.current = null;
    }
    // persist final order if changed during dragging
    if (pendingSaveRef.current) {
      void saveHeaderMenus(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
  };

  // 데이터 그룹 분리
  const baseOptions = mainMenus.filter((menu) => menu.path !== "/");
  const genreOptions = customMenus.filter((m) => m.path.startsWith("/genre/"));
  const moodOptions = customMenus.filter((m) => m.path.startsWith("/mood/"));

  const selectedGenres = genreOptions.filter((menu) =>
    selectedMenuPaths.includes(menu.path),
  );
  const selectedMoods = moodOptions.filter((menu) =>
    selectedMenuPaths.includes(menu.path),
  );

  // 🌟 선택된 순서대로 정렬된 실제 메뉴 오브젝트 배열 추출
  const orderedSelectedMenus = selectedMenuPaths
    .map((path) => allSelectablePool.find((m) => m.path === path))
    .filter((menu): menu is (typeof mainMenus)[number] => !!menu);

  const selectedBaseMenus = orderedSelectedMenus.filter(
    (menu) =>
      baseOptions.some((base) => base.path === menu.path) ||
      menu.path === CATEGORY_MENU.path,
  );
  const selectedCategoryMenus = orderedSelectedMenus.filter(
    (menu) =>
      !baseOptions.some((base) => base.path === menu.path) &&
      menu.path !== CATEGORY_MENU.path,
  );

  const renderMenuButton = (
    menu: (typeof mainMenus)[number],
    disabled = false,
  ) => {
    const isSelected = selectedMenuPaths.includes(menu.path);

    return (
      <button
        key={menu.path}
        className={`genre-button ${isSelected ? "active" : ""} ${
          disabled ? "is-disabled" : ""
        }`}
        type="button"
        onClick={() => handleToggleMenu(menu.path)}
        disabled={disabled}
        aria-disabled={disabled}
      >
        <Image src={menu.imgUrl} alt="" width={22} height={22} />
        <span>{menu.title}</span>
      </button>
    );
  };

  const renderFlowChip = (
    menu: (typeof mainMenus)[number],
    orderNumber: number,
  ) => (
    <div
      key={menu.path}
      className={`flow-chip dynamic ${
        draggedMenuPath === menu.path ? "is-dragging" : ""
      }`}
      data-menu-path={menu.path}
      draggable
      onDragStart={(event) => handlePreviewDragStart(event, menu.path)}
      onDragOver={(event) => handlePreviewDragOver(event, menu.path)}
      onDragEnd={handlePreviewDragEnd}
      title="홀드해서 좌우로 움직여 순서를 변경"
    >
      <span className="order-number">{orderNumber}</span>
      <Image src={menu.imgUrl} alt="" width={16} height={16} />
      <span>{menu.title}</span>
    </div>
  );

  return (
    <section className="menu-custom-page">
      <div className="menu-custom-page__inner">
        <BackButton fallback="/mypage" />
        {/* 헤더 타이틀 */}
        <div className="menu-custom-page__hero">
          <h1>메뉴 커스텀 설정</h1>
          <p>
            왼쪽 사이드바 메뉴 구성을 내 취향대로 변경합니다. 선택하신 순서대로
            배치됩니다.
          </p>
        </div>

        <section className="menu-flow-panel">
          <div className="menu-flow-panel__header">
            <h3><AppIcon name="eye" size={18} /> 사이드바 메뉴 나열 순서 프리뷰</h3>
            <span>
              홈과 설정은 고정, 추가된 메뉴는 홀드해서 순서를 변경할 수
              있습니다.
            </span>
          </div>

          <div className="menu-flow-container">
            <div className="flow-summary">
              <div className="flow-row">
                <div className="flow-row-label">기본</div>
                <div className="flow-row-items">
                  {selectedBaseMenus.length > 0 ? (
                    selectedBaseMenus.map((menu, index) =>
                      renderFlowChip(menu, index + 1),
                    )
                  ) : (
                    <div className="flow-empty">기본 메뉴를 선택해 주세요</div>
                  )}
                </div>
              </div>

              <div className="flow-row">
                <div className="flow-row-label">카테고리</div>
                <div className="flow-row-items">
                  {selectedCategoryMenus.length > 0 ? (
                    selectedCategoryMenus.map((menu, index) =>
                      renderFlowChip(menu, index + 1),
                    )
                  ) : (
                    <div className="flow-empty">카테고리를 선택해 주세요</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`custom-panel custom-panel--section ${baseOpen ? "is-open" : "is-closed"}`}
        >
          <div className="custom-panel__header custom-panel__toggle-header">
            <div>
              <h2>
                기본 메뉴 설정 <span>Core Menus</span>
              </h2>
              <p>
                플랫폼의 핵심 대메뉴를 사이드바로 바로가기 링크로 배치하거나
                숨길 수 있습니다.
              </p>
              <p className="category-note">
                카테고리 메뉴는 장르 또는 무드를 하나 이상 선택해야 활성화됩니다.
              </p>
            </div>
          </div>
          {baseOpen && (
            <div className="genre-grid co">
              {baseOptions.map((menu) => renderMenuButton(menu))}
              {renderMenuButton(
                CATEGORY_MENU,
                !selectedMenuPaths.some(isCountableCategoryChild),
              )}
            </div>
          )}
        </section>

        <section className="custom-panel custom-panel--section is-open">
          <div className="custom-panel__header custom-panel__toggle-header">
            <div>
              <h2>
                카테고리 메뉴 설정 <span>Genres / Moods</span>
              </h2>
              <p>장르와 무드를 각각 보이기 또는 숨기기로 설정할 수 있습니다.</p>
            </div>
          </div>

          <div className="category-columns">
            <div className="category-box">
              <div className="category-box__header">
                <h3><AppIcon name="masks" size={18} /> 장르</h3>
              </div>
              <p className="category-summary">
                선택된 장르:{" "}
                {selectedGenres.length > 0
                  ? selectedGenres.map((item) => item.title).join(", ")
                  : "없음"}
              </p>
              <div className="genre-grid ct">
                {genreOptions.map((menu) => renderMenuButton(menu))}
              </div>
            </div>

            <div className="category-box">
              <div className="category-box__header">
                <h3><AppIcon name="popcorn" size={18} /> 무드</h3>
              </div>
              <p className="category-summary">
                선택된 무드:{" "}
                {selectedMoods.length > 0
                  ? selectedMoods.map((item) => item.title).join(", ")
                  : "없음"}
              </p>
              <div className="genre-grid ct">
                {moodOptions.map((menu) => renderMenuButton(menu))}
              </div>
            </div>
          </div>
        </section>

        {/* 초기화 바 */}
        <section className="reset-panel">
          <p>모든 설정을 초기 레이아웃 상태(기본 메뉴 3개)로 되돌릴까요?</p>
          <button type="button" onClick={handleReset}>
            기본값 복원
          </button>
        </section>
      </div>
    </section>
  );
}
