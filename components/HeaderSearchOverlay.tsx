"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  addRecentSearch,
  clearRecentSearches,
  genreOptions,
  loadRecentSearches,
  moodOptions,
  removeRecentSearch,
} from "@/lib/searchOptions";
import {
  fetchKeywordPreviewMedia,
  fetchNetflixSeriesRecommendations,
  fetchTaggedPreviewMedia,
  intersectTrendingItems,
  type TrendingMediaItem,
} from "@/lib/trendingContent";
import TrendingVideoSection from "./search/TrendingVideoSection";
import "./scss/searchOverlay.scss";

const recommendedSearches = [
  "오징어 게임",
  "기묘한 이야기",
  "더 글로리",
  "흑백요리사",
  "웬즈데이",
  "지금 우리 학교는",
  "마스크걸",
  "스위트홈",
];
const creators = ["송강호", "전도연", "이병헌", "박찬욱", "봉준호", "놀란"];

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HeaderSearchOverlay({
  isOpen,
  onClose,
}: SearchOverlayProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeMoods, setActiveMoods] = useState<string[]>([]);
  const [activeGenres, setActiveGenres] = useState<string[]>([]);
  const [previewItems, setPreviewItems] = useState<TrendingMediaItem[]>([]);

  const [isAnimate, setIsAnimate] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const canSearch =
    keyword.trim().length > 0 ||
    activeGenres.length > 0 ||
    activeMoods.length > 0;
  const hasPreviewQuery = canSearch;
  const previewSectionTitle = hasPreviewQuery
    ? "검색 결과 미리보기"
    : "넷플릭스 추천작";

  useEffect(() => {
    if (isOpen) {
      // 모바일에선 자동 포커스 시 키보드가 바로 올라오므로,
      // 입력창을 직접 탭했을 때만 키보드가 뜨도록 데스크탑에서만 자동 포커스
      const isTouchDevice =
        typeof window !== "undefined" && window.innerWidth <= 600;
      if (!isTouchDevice) inputRef.current?.focus();
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        setRecentSearches(loadRecentSearches());
        setIsAnimate(true);
      }, 10);

      return () => {
        clearTimeout(timer);
      };
    } else {
      document.body.style.overflow = "";
      const timer = window.setTimeout(() => {
        setIsAnimate(false);
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmedKeyword = keyword.trim();
    const hasTags = activeGenres.length > 0 || activeMoods.length > 0;

    const limit = isMobile ? 6 : 5;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const previewRequest = (() => {
        if (trimmedKeyword && hasTags) {
          return Promise.all([
            fetchKeywordPreviewMedia(trimmedKeyword, controller.signal, limit * 3),
            fetchTaggedPreviewMedia(
              activeGenres,
              activeMoods,
              controller.signal,
              limit * 5,
            ),
          ]).then(([keywordItems, taggedItems]) =>
            intersectTrendingItems(keywordItems, taggedItems).slice(0, limit),
          );
        }

        if (trimmedKeyword) {
          return fetchKeywordPreviewMedia(trimmedKeyword, controller.signal, limit);
        }

        if (hasTags) {
          return fetchTaggedPreviewMedia(
            activeGenres,
            activeMoods,
            controller.signal,
            limit,
          );
        }

        return fetchNetflixSeriesRecommendations(controller.signal, limit);
      })();

      previewRequest
        .then(setPreviewItems)
        .catch((error: Error) => {
          if (error.name !== "AbortError") setPreviewItems([]);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeGenres, activeMoods, isOpen, isMobile, keyword]);

  if (!isOpen) return null;

  const goToResults = (nextKeyword = keyword) => {
    const params = new URLSearchParams();
    const trimmedKeyword = nextKeyword.trim();

    if (trimmedKeyword) params.set("q", trimmedKeyword);
    if (activeGenres.length > 0) params.set("genres", activeGenres.join(","));
    if (activeMoods.length > 0) params.set("moods", activeMoods.join(","));

    if (params.toString()) {
      if (trimmedKeyword) {
        setRecentSearches(addRecentSearch(trimmedKeyword, recentSearches));
      }
      router.push(`/search/results?${params.toString()}`);
      onClose();
    }
  };

  const handleRemoveRecentSearch = (
    event: React.MouseEvent,
    targetKeyword: string,
  ) => {
    event.stopPropagation();
    setRecentSearches(removeRecentSearch(targetKeyword, recentSearches));
  };

  const handleClearRecentSearches = () => {
    setRecentSearches(clearRecentSearches());
  };

  const toggleOption = (
    value: string,
    selectedValues: string[],
    setSelectedValues: (values: string[]) => void,
  ) => {
    setSelectedValues(
      selectedValues.includes(value)
        ? selectedValues.filter((selectedValue) => selectedValue !== value)
        : [...selectedValues, value],
    );
  };

  return (
    <div className={`search-overlay ${isAnimate ? "show" : ""}`}>
      <div className="search-overlay__backdrop" onClick={onClose} />

      <div className="search-overlay__content">
        <button
          type="button"
          className="search-overlay__close"
          onClick={onClose}
          aria-label="검색창 닫기"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="search-overlay__inner">
          <form
            className="search-overlay__field"
            onSubmit={(event) => {
              event.preventDefault();
              goToResults();
            }}
          >
            <Image
              src="/images/header/search.svg"
              alt=""
              width={20}
              height={20}
            />
            <input
              ref={inputRef}
              type="search"
              placeholder="제목, 배우, 감독 검색..."
              aria-label="검색어 입력"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            {keyword.trim().length > 0 && (
              <button
                type="button"
                className="search-overlay__clear"
                onClick={() => {
                  setKeyword("");
                  inputRef.current?.focus();
                }}
                aria-label="검색어 지우기"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
            <button
              type="submit"
              className="search-overlay__submit"
              disabled={!canSearch}
            >
              검색
            </button>
          </form>

          {/* 2. 최근 / 추천 검색어 */}
          <div className="search-overlay__top-row">
            <section className="overlay-block overlay-block--recent">
              <div className="overlay-block__header">
                <h3>최근 검색어</h3>
                {recentSearches.length > 0 && (
                  <button type="button" onClick={handleClearRecentSearches}>
                    모두 삭제
                  </button>
                )}
              </div>
              {recentSearches.length > 0 ? (
                <ul className="horizontal-tags horizontal-tags--recent">
                  {recentSearches.map((keyword) => (
                    <li key={keyword}>
                      <button
                        type="button"
                        className="tag-item tag-item--keyword"
                        onClick={() => goToResults(keyword)}
                      >
                        <span>{keyword}</span>
                      </button>
                      <button
                        type="button"
                        className="tag-remove-btn"
                        aria-label={`${keyword} 최근 검색어 삭제`}
                        onClick={(event) =>
                          handleRemoveRecentSearch(event, keyword)
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overlay-recent-empty">
                  최근 검색어가 없어요.
                </div>
              )}
            </section>

            <section className="overlay-block overlay-block--recommend">
              <h3>추천 검색어</h3>
              <div className="horizontal-tags">
                {recommendedSearches.map((keyword) => (
                  <button
                    className="tag-item"
                    type="button"
                    key={keyword}
                    onClick={() => goToResults(keyword)}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* 3. 무드로 찾기 (mainMenu 데이터 반영) */}
          <section className="overlay-finder">
            <div className="overlay-block__header">
              <h3>무드로 찾기</h3>
              {activeMoods.length > 0 && (
                <button type="button" onClick={() => setActiveMoods([])}>
                  모두 삭제
                </button>
              )}
            </div>
            <div className="scroll-row">
              {moodOptions.map((option) => {
                const isActive = activeMoods.includes(option.value);
                return (
                  <button
                    className={isActive ? "slim-card active" : "slim-card"}
                    type="button"
                    key={option.value}
                    onClick={() =>
                      toggleOption(option.value, activeMoods, setActiveMoods)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && isActive) {
                        event.preventDefault();
                        goToResults();
                      }
                    }}
                  >
                    <Image src={option.icon} alt="" width={24} height={24} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. 장르로 찾기 (mainMenu 데이터 반영) */}
          <section className="overlay-finder">
            <div className="overlay-block__header">
              <h3>장르로 찾기</h3>
              {activeGenres.length > 0 && (
                <button type="button" onClick={() => setActiveGenres([])}>
                  모두 삭제
                </button>
              )}
            </div>
            <div className="scroll-row">
              {genreOptions.map((option) => {
                const isActive = activeGenres.includes(option.value);
                return (
                  <button
                    className={isActive ? "slim-card active" : "slim-card"}
                    type="button"
                    key={option.value}
                    onClick={() =>
                      toggleOption(option.value, activeGenres, setActiveGenres)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && isActive) {
                        event.preventDefault();
                        goToResults();
                      }
                    }}
                  >
                    <Image src={option.icon} alt="" width={24} height={24} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 5. 인물로 찾기 */}
          <section className="overlay-finder overlay-finder--creator">
            <h3>배우 · 감독으로 찾기</h3>
            <div className="scroll-row scroll-row--creator">
              {creators.map((creator) => (
                <button
                  type="button"
                  className="creator-item"
                  key={creator}
                  onClick={() => goToResults(creator)}
                >
                  <span className="avatar" aria-hidden="true">
                    {creator.slice(0, 1)}
                  </span>
                  <strong>{creator}</strong>
                </button>
              ))}
            </div>
          </section>

          <TrendingVideoSection
            items={previewItems}
            title={previewSectionTitle}
            variant="overlay"
            onSelect={onClose}
            disableVideo
          />
        </div>
      </div>
    </div>
  );
}
