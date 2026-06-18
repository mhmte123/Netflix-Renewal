// 제외 장르(슬러그) → 전역 필터 헬퍼
// 사용처: 메인(테마/추천/랭킹/히어로), 큐레이션/장르/무드 페이지, 검색 결과 등 "추천·탐색" 목록.
// (시청중·위시리스트에는 적용하지 않음)
//
// excludedGenres 는 프로필 settings 에 슬러그("horror" 등)로 저장된다.
// TMDB 작품은 genre_ids(숫자 배열)를 가지므로, 슬러그 → genre_id 로 변환해 비교한다.

import { useAuthStore } from "@/store/useAuthStore";

// 슬러그 → TMDB genre_id 목록 (영화/시리즈 ID 모두 포함)
// ※ TMDB 의 TV 장르는 거칠어서 일부 ID가 겹친다.
//    예) 9648(미스터리)은 공포/미스터리/스릴러 시리즈에 공통으로 붙는다.
//    이 매핑은 app/genre/[name] 의 genreMap, app/category 의 tvQuery 와 동일하게 맞춰둔 것.
export const GENRE_SLUG_TO_IDS: Record<string, number[]> = {
  action: [28, 10759],
  animation: [16],
  comedy: [35],
  documentary: [99],
  drama: [18],
  fantasy: [14, 10765],
  horror: [27, 9648],
  mystery: [9648],
  romance: [10749],
  scifi: [878, 10765],
  thriller: [53, 9648],
  war: [10752, 10768],
};

// selector 가 매 렌더마다 새 배열을 만들지 않도록 고정 빈 배열 사용
const EMPTY_SLUGS: string[] = [];

// 슬러그 → 표시용 타이틀 + discover 엔드포인트용 movie/tv genre_id
// (app/genre/[name] 의 genreMap 과 동일하게 맞춤 — 선호 장르 추천 줄을 만들 때 사용)
export const GENRE_SLUG_META: Record<string, { title: string; movieId: number; tvId: number }> = {
  action: { title: "액션", movieId: 28, tvId: 10759 },
  animation: { title: "애니메이션", movieId: 16, tvId: 16 },
  comedy: { title: "코미디", movieId: 35, tvId: 35 },
  documentary: { title: "다큐멘터리", movieId: 99, tvId: 99 },
  drama: { title: "드라마", movieId: 18, tvId: 18 },
  fantasy: { title: "판타지", movieId: 14, tvId: 10765 },
  horror: { title: "공포", movieId: 27, tvId: 9648 },
  mystery: { title: "미스터리", movieId: 9648, tvId: 9648 },
  romance: { title: "로맨스", movieId: 10749, tvId: 10749 },
  scifi: { title: "SF", movieId: 878, tvId: 10765 },
  thriller: { title: "스릴러", movieId: 53, tvId: 9648 },
  war: { title: "전쟁", movieId: 10752, tvId: 10768 },
};

// 제외 슬러그 목록 → 제외 genre_id Set
export function excludedSlugsToIdSet(slugs: string[]): Set<number> {
  const ids = new Set<number>();
  for (const slug of slugs) {
    const mapped = GENRE_SLUG_TO_IDS[slug];
    if (mapped) mapped.forEach((id) => ids.add(id));
  }
  return ids;
}

// 한 작품이 제외 대상인지 판별 (genre_ids 중 하나라도 제외 ID에 걸리면 true)
export function isGenreExcluded(
  genreIds: number[] | undefined,
  excludedIds: Set<number>,
): boolean {
  if (excludedIds.size === 0 || !genreIds || genreIds.length === 0) return false;
  return genreIds.some((id) => excludedIds.has(id));
}

// 목록에서 제외 장르 작품 제거 — genre_ids 를 가진 어떤 목록에도 사용 가능
//  · excludedSlugs : 프로필에 저장된 제외 슬러그 목록
//  · exceptSlugs   : 제외에서 "면제"할 슬러그 (예: /genre/horror 페이지에선 horror 자신은 면제)
export function filterByExcludedGenres<T extends { genre_ids?: number[] }>(
  items: T[],
  excludedSlugs: string[],
  exceptSlugs: string[] = [],
): T[] {
  if (!excludedSlugs || excludedSlugs.length === 0) return items;
  const effective = excludedSlugs.filter((slug) => !exceptSlugs.includes(slug));
  if (effective.length === 0) return items;
  const excludedIds = excludedSlugsToIdSet(effective);
  if (excludedIds.size === 0) return items;
  return items.filter((item) => !isGenreExcluded(item.genre_ids, excludedIds));
}

// 현재 프로필의 제외 장르 슬러그 목록을 구독하는 훅 (클라이언트 컴포넌트 전용)
export function useExcludedGenres(): string[] {
  return useAuthStore((s) => s.currentProfile?.settings?.excludedGenres ?? EMPTY_SLUGS);
}

// 현재 프로필의 선호 장르 슬러그 목록을 구독하는 훅 (클라이언트 컴포넌트 전용)
export function useFavoriteGenres(): string[] {
  return useAuthStore((s) => s.currentProfile?.settings?.favoriteGenres ?? EMPTY_SLUGS);
}
