// 관람등급(maturityRating)에 따른 콘텐츠 필터 헬퍼
// - 프로필 settings.maturityRating ("전체관람가"|"12+"|"15+"|"19+") 을 허용 최대 레벨로 변환
// - 각 작품의 TMDB KR 등급(certifications 맵, `${mediaType}-${id}`)을 레벨로 변환해 비교
// - 등급을 아직 못 불러온 항목은 genre_ids 로 먼저 추정한다.
//   명확히 제한 장르인 항목은 즉시 숨기고, 안전 추정 항목은 화면을 비우지 않도록 노출한다.

import { useAuthStore } from "@/store/useAuthStore";
import type { MaturityRating } from "@/types/auth";
import { useEffect, useMemo } from "react";
import { useMovieStore } from "@/store/useMovieStore";

// TMDB KR 등급 문자열 → 숫자 레벨
export function certToLevel(cert?: string): number {
  if (!cert) return -1; // 미상
  const c = cert.toString().trim().toLowerCase().replace(/\s/g, "");
  if (c === "all" || c === "g" || c.includes("전체")) return 0;
  if (c.includes("청소년관람불가") || c.includes("restricted") || c === "r" || c.startsWith("19")) return 19;
  if (c.startsWith("15")) return 15;
  if (c.startsWith("12")) return 12;
  if (c.startsWith("7")) return 7;
  const n = parseInt(c, 10);
  return Number.isNaN(n) ? -1 : n;
}

// 프로필 등급 → 허용 최대 레벨
export function ratingCeiling(rating?: MaturityRating): number {
  switch (rating) {
    case "전체관람가":
      return 0;
    case "12+":
      return 12;
    case "15+":
      return 15;
    case "19+":
      return 19;
    default:
      return 19; // 설정이 없으면 제한 없음
  }
}

// 현재 프로필의 허용 최대 레벨
export function useMaturityCeiling(): number {
  const rating = useAuthStore((s) => s.currentProfile?.settings?.maturityRating);
  return ratingCeiling(rating);
}

export function useMaturityFilterSnapshot() {
  const ceiling = useMaturityCeiling();
  return useMemo(
    () => ({
      ceiling,
      certifications: useMovieStore.getState().certifications,
    }),
    [ceiling],
  );
}

// 등급 데이터가 없을 때 장르로 연령을 보수적으로 추정 (TMDB genre id 기준)
// 등급 데이터가 없을 때만 쓰는 장르 추정(최소 세트).
// 장르 범위를 넓히면 한국 인기작(스릴러·범죄 多)이 과도하게 사라지므로 공포만 둠.
// 더 엄격히/느슨히 하려면 여기서 조정 (예: 53 스릴러:15, 80 범죄:15 추가).
const RESTRICTED_GENRES: Record<number, number> = {
  27: 19, // 공포(Horror)
};

export function genreLevel(genreIds?: number[]): number {
  if (!genreIds || !genreIds.length) return -1;
  let max = -1;
  for (const id of genreIds) {
    const lv = RESTRICTED_GENRES[id];
    if (lv !== undefined && lv > max) max = lv;
  }
  return max; // 제한 장르가 없으면 -1
}

// items 를 등급으로 필터링. getKey 로 certifications 맵 키(`${mediaType}-${id}`)를 만든다.
// undefined/""는 등급 미확인 또는 등급 없음이므로 genre_ids 로 먼저 추정한다.
export function filterByMaturity<T>(
  items: T[],
  ceiling: number,
  certifications: Record<string, string>,
  getKey: (item: T) => string,
): T[] {
  if (ceiling >= 19) return items; // 19+ 프로필은 전체 허용
  return items.filter((item) => {
    const cert = certifications[getKey(item)];

    let level = certToLevel(cert);
    if (level < 0) {
      const gl = genreLevel((item as { genre_ids?: number[] }).genre_ids);
      level = gl < 0 ? 0 : gl; // 등급·제한장르 모두 없으면 전체관람가로 간주
    }
    return level <= ceiling;
  });
}

// 리스트에 대해 등급(certification) 을 미리 로드하고 필터링까지 해주는 훅.
// hover 전에도 등급 필터가 동작하도록 현재 목록의 등급을 선반입한다.
export function useMaturityFiltered<T extends { id: number }>(
  items: T[],
  getMediaType: (item: T) => "movie" | "tv",
): T[] {
  const { ceiling, certifications } = useMaturityFilterSnapshot();
  const onFetchCertification = useMovieStore((s) => s.onFetchCertification);

  useEffect(() => {
    if (ceiling >= 19) return;
    items.forEach((it) => onFetchCertification(it.id, getMediaType(it)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, ceiling]);

  return useMemo(
    () => filterByMaturity(items, ceiling, certifications, (it) => `${getMediaType(it)}-${it.id}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, ceiling, certifications],
  );
}

// 커뮤니티/커넥트 모드 노출 여부.
// - 프로필 isCommunity 플래그(기본 true)를 기본 게이트로 사용
// - 관람등급 12세 이하(전체관람가·12+) 프로필은 자동으로 비활성화
export function useCommunityEnabled(): boolean {
  const isCommunity = useAuthStore((s) => s.currentProfile?.isCommunity);
  const ceiling = useMaturityCeiling();
  return (isCommunity ?? true) && ceiling > 12;
}
