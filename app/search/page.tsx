"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addRecentSearch,
  clearRecentSearches,
  genreOptions,
  loadRecentSearches,
  moodOptions,
  removeRecentSearch,
} from "@/lib/searchOptions";
import "./search.scss";

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
const creators = ["송강호", "전도연", "이병헌", "박찬욱", "봉준호", "놀란", "스필버그", "타란티노"];

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeMoods, setActiveMoods] = useState<string[]>([]);
  const [activeGenres, setActiveGenres] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeTags = [
    ...genreOptions.filter((option) => activeGenres.includes(option.value)),
    ...moodOptions.filter((option) => activeMoods.includes(option.value)),
  ];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRecentSearches(loadRecentSearches());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

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
    }
  };

  const handleRemoveRecentSearch = (event: React.MouseEvent, targetKeyword: string) => {
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
    <section className="search-page">
      <div className="search-page__inner">
        <div className="search-page__field">
          <Image src="/images/header/search.svg" alt="" width={22} height={22} />
          <input
            ref={inputRef}
            type="search"
            placeholder="제목, 배우, 감독 검색..."
            aria-label="검색어 입력"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                goToResults();
              }
            }}
          />
          {keyword.trim().length > 0 && (
            <button
              type="button"
              className="search-page__clear"
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
            type="button"
            className="search-page__submit"
            onClick={() => goToResults()}
            disabled={!keyword.trim() && activeGenres.length === 0 && activeMoods.length === 0}
          >
            검색
          </button>
        </div>

        {activeTags.length > 0 && (
          <div className="search-page__selected-row">
            <div className="search-page__selected-tags" aria-label="선택한 검색 태그">
              {activeTags.map((option) => (
                <button
                  type="button"
                  key={`${option.group}-${option.value}`}
                  onClick={() => {
                    if (option.group === "genre") {
                      setActiveGenres(activeGenres.filter((value) => value !== option.value));
                    } else {
                      setActiveMoods(activeMoods.filter((value) => value !== option.value));
                    }
                  }}
                >
                  <span>{option.label}</span>
                  <em aria-hidden="true">×</em>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="search-page__tag-submit"
              onClick={() => goToResults()}
            >
              선택한 태그로 검색
            </button>
          </div>
        )}

        <div className="search-page__top-grid">
          <section className="search-block search-block--recent">
            <div className="search-block__header">
              <h2>최근 검색어</h2>
              {recentSearches.length > 0 && (
                <button type="button" onClick={handleClearRecentSearches}>
                  모두 삭제
                </button>
              )}
            </div>

            {recentSearches.length > 0 ? (
              <ul className="recent-list">
                {recentSearches.map((keyword) => (
                  <li key={keyword}>
                    <button
                      type="button"
                      className="recent-keyword-btn"
                      onClick={() => goToResults(keyword)}
                    >
                      <span>{keyword}</span>
                    </button>
                    <button
                      type="button"
                      className="recent-remove-btn"
                      aria-label={`${keyword} 최근 검색어 삭제`}
                      onClick={(event) => handleRemoveRecentSearch(event, keyword)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="recent-empty">최근 검색어가 없어요.</div>
            )}
          </section>

          <section className="search-block">
            <div className="search-block__header">
              <h2>추천 검색어</h2>
              <span>실시간 인기</span>
            </div>

            <div className="keyword-cloud">
              {recommendedSearches.map((keyword) => (
                <button
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

        <section className="finder-section">
          <div className="finder-section__header">
            <h2>무드로 찾기</h2>
            <p>오늘 보고 싶은 감정에 맞춰 골라보세요.</p>
          </div>

          <div className="option-grid option-grid--mood">
            {moodOptions.map((option) => {
              const isActive = activeMoods.includes(option.value);

              return (
                <button
                  className={isActive ? "option-card active" : "option-card"}
                  type="button"
                  key={option.value}
                  onClick={() => toggleOption(option.value, activeMoods, setActiveMoods)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && isActive) {
                      event.preventDefault();
                      goToResults();
                    }
                  }}
                >
                  <span className="option-card__icon">
                    <Image src={option.icon} alt="" width={42} height={42} />
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="finder-section">
          <div className="finder-section__header">
            <h2>장르로 찾기</h2>
            <p>자주 찾는 장르 아이콘만 먼저 담았어요.</p>
          </div>

          <div className="option-grid option-grid--genre">
            {genreOptions.map((option) => {
              const isActive = activeGenres.includes(option.value);

              return (
                <button
                  className={isActive ? "option-card active" : "option-card"}
                  type="button"
                  key={option.value}
                  onClick={() => toggleOption(option.value, activeGenres, setActiveGenres)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && isActive) {
                      event.preventDefault();
                      goToResults();
                    }
                  }}
                >
                  <span className="option-card__icon">
                    <Image src={option.icon} alt="" width={42} height={42} />
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="creator-section">
          <div className="search-block__header">
            <h2>배우 · 감독으로 찾기</h2>
            <button type="button">전체보기 →</button>
          </div>

          <div className="creator-list">
            {creators.map((creator) => (
              <button type="button" key={creator} onClick={() => goToResults(creator)}>
                <span aria-hidden="true">{creator.slice(0, 1)}</span>
                <strong>{creator}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
