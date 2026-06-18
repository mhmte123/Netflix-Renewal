// 목록/히어로에서 숨길 작품 (TMDB id) — 여기에 추가만 하면
// mood · genre · category 등 여러 페이지에서 "전역"으로 제외된다.
//
// ── 추가 방법 ───────────────────────────────────────────────
// 1) 숨기고 싶은 작품을 클릭하면 주소가 /detail/movie/12345 (또는 /detail/tv/12345).
//    그 끝의 숫자(12345)가 TMDB id 다.
// 2) 타입과 무관하게 숨기려면 숫자만:        12345
//    특정 타입만 숨기려면 문자열로:          "movie-12345"  또는  "tv-12345"
//
// 예) 님포매니악: 볼륨 2 를 숨기려면, 그 작품의 detail 주소에서 id를 확인해
//     아래 배열에 "movie-<그 id>" 형태로 넣으면 된다.
export const HIDDEN_TMDB_IDS: Array<number | string> = [
  // 여기에 차단할 작품 id 를 추가하세요. 예: "movie-213681",
  "movie-249397",
  "movie-1446616",
  "tv-113360",
  "tv-95897",
  "tv-283884",
  "movie-1501204",
  "tv-311722",
  "tv-299989",
  "tv-81044",
  "tv-241002",
  "movie-1232221",
  "tv-207840",
  "tv-45950",
  "tv-321942",
  "tv-276880",
  "movie-44980",
  "movie-1367220",
  "movie-1103473",
  "movie-1065834",
  "movie-1057265",
  "movie-719128",
  ""







];

const hiddenSet = new Set(HIDDEN_TMDB_IDS.map((value) => String(value)));

// 특정 작품이 숨김 대상인지 판별
export function isHidden(id: number, mediaType?: "movie" | "tv"): boolean {
  if (hiddenSet.has(String(id))) return true; // 타입 불문 숨김
  if (mediaType && hiddenSet.has(`${mediaType}-${id}`)) return true; // 타입별 숨김
  return false;
}

// 목록에서 숨김 대상 제거 (히어로/그리드 공통)
// media_type(스토어/검색) · mediaType(ThemeItem) 키를 모두 인식한다.
export function filterHidden<
  T extends { id: number; media_type?: "movie" | "tv"; mediaType?: "movie" | "tv" },
>(items: T[]): T[] {
  return items.filter(
    (item) => !isHidden(item.id, item.media_type ?? item.mediaType),
  );
}
