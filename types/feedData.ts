import type {
  // FeedComment as CommunityFeedComment,
  FeedDocument as CommunityFeedDocument,
} from "@/types/community";
import { FeedComment } from "@/types/community";

export type FeedTab = "all" | "following";
export type MediaType = "movie" | "tv";
export type FeedPostType = "general" | "media";
export type FeedCategory =
  | "recommendation"
  | "discussion"
  | "question"
  | "daily"
  | "watch-party";

export const FEED_CATEGORY_LABELS: Record<FeedCategory, string> = {
  // 기존에 저장된 작품추천 게시물 호환용
  recommendation: "작품",
  discussion: "토론",
  question: "질문",
  daily: "일상",
  "watch-party": "같이보기",
};

// export interface FeedComment extends CommunityFeedComment {
//   profileId?: number;
//   createdAt: string;
//   updatedAt?: string;
//   likedUserIds?: string[];
// }

export interface FeedReview extends Omit<
  CommunityFeedDocument,
  "comments" | "feedId" | "videoId"
> {
  feedId?: string;
  postType?: FeedPostType;
  category?: FeedCategory;
  videoId?: string;
  profileId?: number;
  rating: number;
  isSpoiler: boolean;
  isPublic: boolean;
  updatedAt?: string;
  likedUserIds?: string[];
}

export interface FeedMediaOption {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string;
  meta: string;
}

export const parseFeedMediaMeta = (meta: string) => {
  const parts = meta
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    primary: parts.filter((part) => !part.startsWith("평균")).join(" · "),
    average: parts.find((part) => part.startsWith("평균")) || "",
  };
};

export const REPORT_REASONS = [
  "내용이 부적절해요",
  "스포일러가 포함되어 있어요",
  "욕설 또는 혐오 표현이에요",
  "광고나 홍보예요",
  "기타",
];

export const getPosterUrl = (path?: string) =>
  path ? `https://image.tmdb.org/t/p/w300${path}` : "";

export const getInitial = (name?: string | null) =>
  name?.trim().charAt(0) || "?";

export const parseVideoId = (
  videoId: string,
): { mediaType: MediaType; mediaId: number } => {
  const [type, id] = videoId.split("-");
  return {
    mediaType: type === "tv" ? "tv" : "movie",
    mediaId: Number(id || 0),
  };
};

export const getRelativeTime = (value?: string) => {
  if (!value) return "";

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return value;

  const diffMs = Date.now() - createdAt.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return createdAt.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

//firestore 임시데이터
export const SEED_AUTHOR_NAMES: Record<string, string> = {
  "seed-user-1": "민서",
  "seed-user-2": "지아",
  "seed-comment-user-1": "수진",
  "seed-comment-user-2": "도윤",
  "seed-comment-user-3": "하린",
  "seed-comment-user-4": "재현",
  "seed-comment-user-5": "유나",
};

export const INITIAL_REVIEWS: FeedReview[] = [
  {
    feedId: "seed-1",
    userId: "seed-user-1",
    videoId: "movie-872585",
    content:
      "러닝타임은 길지만 장면마다 긴장감이 높아서 끝까지 몰입됐어요. 인물의 선택을 보여주는 방식이 묵직했고, 마지막 사운드가 오래 남았습니다.",
    likesCount: 132,
    reportsCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    rating: 4.5,
    isSpoiler: false,
    isPublic: true,
    likedUserIds: [],
  },
  {
    feedId: "seed-2",
    userId: "seed-user-2",
    videoId: "tv-1399",
    content:
      "초반부의 선택 때문에 인물관계가 갈리는 지점이 인상적이었어요. 특정 인물의 퇴장 장면은 정말 충격적이었습니다.",
    likesCount: 45,
    reportsCount: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    rating: 4,
    isSpoiler: true,
    isPublic: true,
    likedUserIds: [],
  },
];

export const INITIAL_REVIEW_COMMENTS: Record<string, FeedComment[]> = {
  "seed-1": [
    {
      commentId: "seed-101",
      userId: "seed-comment-user-1",
      content: "마지막 장면 여운이 진짜 오래 가더라.",
      reportsCount: 0,
      likesCount: 12,
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      commentId: "seed-102",
      userId: "seed-comment-user-2",
      content: "사운드 좋은 관에서 다시 보고 싶었어.",
      reportsCount: 0,
      likesCount: 6,
      createdAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    },
    {
      commentId: "seed-103",
      userId: "seed-comment-user-3",
      content: "긴 영화인데도 후반부 집중력이 대단했음.",
      reportsCount: 0,
      likesCount: 4,
      createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    },
  ],
  "seed-2": [
    {
      commentId: "seed-201",
      userId: "seed-comment-user-4",
      content: "스포일러 보기 누르고 읽었는데 공감합니다.",
      reportsCount: 0,
      likesCount: 8,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      commentId: "seed-202",
      userId: "seed-comment-user-5",
      content: "초반 정치극 분위기가 제일 좋았어요.",
      reportsCount: 0,
      likesCount: 3,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ],
};
