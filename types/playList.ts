import type { Movie, TV } from "./movie";

export interface PlayListItem{
    id: number;
    title: string;
    // name?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    genre_ids?: number[];
    mediaType: "movie" | "tv";
    playTime: string;
    vote_average: number;
    overview: string;
    progress: number; // 0~100
    episodeProgress: Record<number, number>; // episodeId → 0~100
    lastEpisodeNumber?: number; // 마지막으로 시청한 회차 번호 (TV)
    first_air_date: string;
    release_date: string;
}

type DetailMedia = (Movie | TV) & {
  adult?: boolean;
  created_by?: { id: number; name: string }[];
  first_air_date?: string;
  genres?: { id: number; name: string }[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  production_countries?: { iso_3166_1: string; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  vote_count?: number;
  origin_country?: string[];
};

export interface PlayListState{
    playList: PlayListItem[],
    playHist: string[],
    myList: string[],
    customPlaylists: PlaylistDocument[],
    currentPlaylist: PlaylistDocument | null,
    onAddPlayList: (item: DetailMedia)=>Promise<boolean>,
    onRemovePlayList: (id: number)=>Promise<boolean>,
    onRemovePlayHist: (id: number, mediaType: "movie" | "tv")=>Promise<boolean>,
    onLoadPlayList: ()=>Promise<void>,
    onAddMyList: (item: Movie | TV, mediaType?: "movie" | "tv")=>Promise<boolean>,
    onRemoveMyList: (id: number, mediaType: "movie" | "tv")=>Promise<boolean>,
    onLoadMyList: ()=>Promise<void>,
    onUpdateProgress: (id: number, mediaType: "movie" | "tv", progress: number, episodeNumber?: number)=>void,
    onUpdateEpisodeProgress: (id: number, mediaType: "movie" | "tv", episodeId: number, progress: number, episodeNumber?: number)=>void,
    createMyCustomPlaylist: (data: any)=>Promise<void>,
    fetchMyCustomPlaylists: ()=>Promise<void>,
    updateCustomPlaylist: (listId: string, updatedData: Partial<PlaylistDocument>) => Promise<void>;
    deleteCustomPlaylist: (listId: string) => Promise<void>;
    fetchPlaylist: (userId: string, listId: string) => Promise<void>;
    togglePlaylistLike: (ownerUserId: string, listId: string) => Promise<void>;
}

// 플리 타입
export interface PlaylistDocument {
  listId: string;          // 플레이리스트 고유 ID (Firestore Document ID)
  name: string;            // 리스트 이름
  content: string;         // 리스트 설명
  videoIds: string[];      // 영상 아이디 리스트 (배열 형태)
  isShare: boolean;        // 공개여부
  tags: string[];          // 태그 (장르, 무드)
  likesCount: number;      // 좋아요
  likedBy?: string[];      // 좋아요한 유저 ID 목록 (likesCount = likedBy.length)
  createdAt: string;
  items?:  string[];
  isDelete?: boolean;

  // 파이어베이스 연동 및 관리를 위한 필수 확장 필드
  //userId: string;         // 플레이리스트 생성자 (유저 ID)
}
