import { Movie, TV } from "./movie";

// 리뷰 타입
export interface ReviewDocument {
  reviewId: string;// 리뷰 고유 ID
  userId?: string;
  content: string;// 리뷰 내용
  videoId: string;// 영상 아이디
  likesCount: number;// 좋아요 수
  isSpoiler: boolean; // 스포일러 여부
  reportsCount: number;// 신고 횟수
  nickname: string;
  createdAt: string;
  updatedAt?: string;
  profileId: number;// 리뷰 작성자 ID
  rating: number;
  mediaInfo? : Movie | TV;
  equippedBadge?: string; // 작성자의 대표 칭호(장착 뱃지) ID
}

// 1. 댓글 인터페이스 (Sub-collection용)
export interface FeedComment {
  commentId: string;        // 댓글 아이디
  userId: string;           // 유저 아이디
  content: string;          // 댓글 내용
  reportsCount: number;     // 신고
  likesCount: number;       // 좋아요
  profileId?: number;
  createdAt: string;
  updatedAt?: string;
  likedUserIds?: string[];
}

// 2. 피드 메인 문서 인터페이스 (Main-collection용)
export interface FeedDocument {
  feedId: string;           // 피드 아이디 (Document ID)
  userId: string;           // 유저 아이디
  videoId: string;          // 영상 아이디
  content: string;          // 피드 내용
  likesCount: number;       // 좋아요
  reportsCount: number;     // 신고
  comments: FeedComment;    // 댓글
  createdAt: string;
}

export interface CommunityStore {
  reviews: ReviewDocument[];
  // 스토어 내부에서 DB 로직을 수행
  fetchUserReviews: () => Promise<void>;
  fetchAllReviews: () => Promise<void>;
  fetchVideoReviews: (videoId: string) => Promise<void>;
  fetchUserReviewsById: (targetUserId: string) => Promise<any>;
  addReview: (data: { content: string; videoId: string; isSpoiler: boolean; rating: number; }) => Promise<void>;
  updateReview: (reviewId: string, videoId: string, data: { content: string; isSpoiler: boolean; rating: number; }) => Promise<void>;
  deleteReview: (reviewId: string, videoId: string) => Promise<void>;
  reportReview: (reviewId: string, videoId: string) => Promise<void>;
  updateReviewLikeCount: (videoId: string, reviewId: string, isLiked: boolean) => Promise<void>;
}
