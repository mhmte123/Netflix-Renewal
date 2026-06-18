"use client";

import Image from "next/image";
import AppIcon from "@/components/common/AppIcon";
import { useEffect, useState } from "react";
import { customMenus } from "@/data/mainMenu";
import "../../scss/selectGenre.scss";
import { DEFAULT_PROFILE_SETTINGS, useAuthStore } from "@/store/useAuthStore";
import BackButton from "@/components/common/BackButton";

// --- 메타데이터 없이 오직 path 기준으로만 데이터 분리 ---
const genreOptions = customMenus
  .filter((menu) => menu.path.startsWith("/genre/"))
  .map((menu) => ({
    ...menu,
    slug: menu.path.replace("/genre/", ""), // 'action', 'comedy' 등 상태 관리에 쓸 key 추출
  }));

export default function SelectGenre() {
  // 장르 탭 (선호 / 제외)
  const [genreTab, setGenreTab] = useState<"favorite" | "exclude">("favorite");

  // 현재 프로필의 settings 에서 불러오고, 저장도 여기에 함
  const currentProfile = useAuthStore((s) => s.currentProfile);
  const onUpdateProfile = useAuthStore((s) => s.onUpdateProfile);

  // 선호 / 제외 장르 슬러그 목록 (무드 기능은 제거된 상태 유지)
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [excludedGenres, setExcludedGenres] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 프로필이 로드/전환되면 저장된 설정을 불러옴
  useEffect(() => {
    const s = currentProfile?.settings;
    setFavoriteGenres(s?.favoriteGenres ?? []);
    setExcludedGenres(s?.excludedGenres ?? []);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.id]);

  // 장르 선택 토글 — 선호/제외는 상호 배타 (한쪽에 넣으면 다른쪽에서 제거)
  const toggleGenre = (slug: string) => {
    setSaved(false);
    if (genreTab === "favorite") {
      if (favoriteGenres.includes(slug)) {
        setFavoriteGenres(favoriteGenres.filter((g) => g !== slug));
      } else {
        setFavoriteGenres([...favoriteGenres, slug]);
        setExcludedGenres(excludedGenres.filter((g) => g !== slug));
      }
    } else {
      if (excludedGenres.includes(slug)) {
        setExcludedGenres(excludedGenres.filter((g) => g !== slug));
      } else {
        setExcludedGenres([...excludedGenres, slug]);
        setFavoriteGenres(favoriteGenres.filter((g) => g !== slug));
      }
    }
  };

  // 초기화 (선호/제외 장르 비우기)
  const handleReset = () => {
    setFavoriteGenres([]);
    setExcludedGenres([]);
    setSaved(false);
  };

  // 프로필 settings 에 저장 — 장르 선호/제외만 갱신, 나머지 설정(무드 등)은 그대로 유지
  const handleSave = async () => {
    if (!currentProfile) return;
    setSaving(true);
    setSaved(false);
    try {
      await onUpdateProfile({
        ...currentProfile,
        settings: {
          ...currentProfile.settings,
          maturityRating:
            currentProfile.settings?.maturityRating ?? DEFAULT_PROFILE_SETTINGS.maturityRating,
          verifiedAdult:
            currentProfile.settings?.verifiedAdult ?? DEFAULT_PROFILE_SETTINGS.verifiedAdult,
          subtitles: currentProfile.settings?.subtitles ?? DEFAULT_PROFILE_SETTINGS.subtitles,
          playback: currentProfile.settings?.playback ?? DEFAULT_PROFILE_SETTINGS.playback,
          hiddenWatchingVideos: currentProfile.settings?.hiddenWatchingVideos ?? [],
          favoriteMoods: currentProfile.settings?.favoriteMoods ?? [],
          excludedMoods: currentProfile.settings?.excludedMoods ?? [],
          favoriteGenres,
          excludedGenres,
        },
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="menu-custom-page">
      <div className="menu-custom-page__inner">
        <BackButton fallback="/mypage" />
        <div className="menu-custom-page__hero">
          <h1>장르 관리</h1>
          <p>선호하는 장르와 추천에서 제외할 장르를 설정할 수 있어요</p>
        </div>

        {/* 장르 설정 섹션 */}
        <section className="custom-panel">
          <div className="custom-panel__header">
            <h2><AppIcon name="masks" size={20} /> 장르 설정</h2>
            <p>
              선호 장르는 홈 상단에서 우선 추천되고, 제외 장르는 모든 목록에서 숨겨져요
            </p>
          </div>

          <div className="genre-tabs" role="tablist" aria-label="장르 설정">
            <button
              className={genreTab === "favorite" ? "active" : ""}
              type="button"
              onClick={() => setGenreTab("favorite")}
            >
              선호 장르 ({favoriteGenres.length})
            </button>
            <button
              className={genreTab === "exclude" ? "active" : ""}
              type="button"
              onClick={() => setGenreTab("exclude")}
            >
              제외 장르 ({excludedGenres.length})
            </button>
          </div>

          <div className="genre-grid">
            {genreOptions.map((genre) => {
              const isSelected =
                genreTab === "favorite"
                  ? favoriteGenres.includes(genre.slug)
                  : excludedGenres.includes(genre.slug);

              return (
                <button
                  className={isSelected ? "genre-button active" : "genre-button"}
                  type="button"
                  key={genre.slug}
                  onClick={() => toggleGenre(genre.slug)}
                >
                  {/* 메인메뉴의 이미지를 그대로 출력 */}
                  <Image src={genre.imgUrl} alt="" width={22} height={22} />
                  {/* 메인메뉴의 타이틀("액션", "애니메이션" 등)을 그대로 출력 */}
                  <span>{genre.title}</span>
                  {genreTab === "exclude" && isSelected ? <strong aria-hidden="true">×</strong> : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* 저장 바 */}
        <section className="save-panel">
          <p>{saved ? "설정이 저장되었어요." : "변경한 선호/제외 장르 설정을 저장합니다."}</p>
          <button type="button" onClick={handleSave} disabled={saving || !currentProfile}>
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </section>

        {/* 초기화 판넬 */}
        <section className="reset-panel">
          <p>설정을 초기 상태로 되돌리고 싶으신가요?</p>
          <button type="button" onClick={handleReset}>기본값 복원</button>
        </section>
      </div>
    </section>
  );
}
