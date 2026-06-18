import type { Movie, TV } from "./movie";

export interface WishItem {
  id: number;
  title: string;
  poster_path: string;
  mediaType: "movie" | "tv";
  genre: "movie" | "drama" | "animation";
  vote_average: number;
  addedAt: string; // ID만 저장하는 구조에선 빈 문자열 (찜 시각 미보관)
}

export interface WishlistState {
  wishlist: WishItem[];     // 화면 표시용 (TMDB API로 채운 객체 배열)
  wishlistIds: string[];    // Firestore movies.wishlist 에 저장되는 ID 배열 (팀 표준)
  onAddWish: (item: Movie | TV) => Promise<void>;
  onRemoveWish: (item: Movie | TV) => Promise<void>;
  onLoadWishlist: () => Promise<void>;
  isWished: (id: string) => boolean;
}
