import { auth, db } from "@/firebase/firebase";
import {
  FeedReview,
  type FeedCategory,
  INITIAL_REVIEW_COMMENTS,
  INITIAL_REVIEWS,
  SEED_AUTHOR_NAMES,
  MediaType,
  parseVideoId,
} from "@/types/feedData";
import { FeedComment } from "@/types/community";
import type { BadgeList, FeedActivity } from "@/types/auth";
import { useAuthStore } from "@/store/useAuthStore";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { create } from "zustand";

interface FeedState {
  feeds: FeedView[];
  isLoading: boolean;
  onHydrateFeeds: () => Promise<void>;
  onHydrateMyFeeds: () => Promise<void>;
  onAddFeed: (review: FeedReview) => Promise<void>;
  onUpdateFeed: (review: FeedReview) => Promise<void>;
  onDeleteFeed: (feedId: string) => Promise<void>;
  onAddComment: (feedId: string, comment: FeedComment) => Promise<void>;
  onUpdateComment: (feedId: string, commentId: string, content: string) => Promise<void>;
  onDeleteComment: (feedId: string, commentId: string) => Promise<void>;
  onToggleLike: (feedId: string) => Promise<void>;
  onToggleCommentLike: (feedId: string, commentId: string) => Promise<void>;
  onReportFeed: (feedId: string, shouldReport: boolean, reason?: string) => Promise<void>;
}

export interface FeedCommentView extends FeedComment {
  author?: string;      // ? 추가
  authorImage?: string;
  isMine?: boolean;     // ? 추가
  liked?: boolean;      // ? 추가
  likedUserIds?: string[];
}

export interface FeedView extends FeedReview {
  feedId: string;
  author: string;
  authorImage?: string;
  authorBadgeIds: string[];
  authorEquippedBadge?: string; // 작성자의 대표 칭호(장착 뱃지) ID
  isMine: boolean;
  isFollowing: boolean;
  mediaId?: number;
  mediaType?: MediaType;
  mediaTitle?: string;
  mediaPoster?: string;
  mediaMeta: string;
  liked: boolean;
  likedUserIds: string[];
  comments: number;
  commentsList: FeedCommentView[];
}

type StoredFeedReview = FeedReview & {
  commentsList?: FeedComment[];
};
type FirestoreRecord = Record<string, unknown>;
type UserProfileRecord = {
  id?: number;
  nickname?: string;
  imgUrl?: string;
  badges?: BadgeList;
  community?: {
    feeds?: FeedActivity[];
    following?: string[];
  };
};
type MediaDetail = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string;
  meta: string;
};

const FEEDS_COLLECTION = "feeds";
const COMMENTS_COLLECTION = "comments";
const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

const mediaCache = new Map<string, MediaDetail>();
const authorCache = new Map<string, string>();
const authorImageCache = new Map<string, string>();
const authorProfileCache = new Map<
  string,
  Promise<UserProfileRecord | undefined>
>();

const readString = (data: FirestoreRecord, key: string, fallback = "") => {
  const value = data[key];
  return typeof value === "string" ? value : fallback;
};

const readNumber = (data: FirestoreRecord, key: string, fallback = 0) => {
  const value = data[key];
  return typeof value === "number" ? value : fallback;
};

const readBoolean = (data: FirestoreRecord, key: string, fallback = false) => {
  const value = data[key];
  return typeof value === "boolean" ? value : fallback;
};

const readStringArray = (data: FirestoreRecord, key: string) => {
  const value = data[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

const getAuthContext = () => {
  const { user, currentProfile } = useAuthStore.getState();
  const storeUserId = user?.userId || (user as { uid?: string } | null)?.uid;
  const userId = storeUserId || auth.currentUser?.uid;

  return {
    userId,
    currentProfile,
    actorId: userId && currentProfile ? `${userId}:${currentProfile.id}` : userId,
  };
};

const getCurrentProfiles = async (userId: string) => {
  const userDocRef = doc(db, "users", userId);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) return null;

  const userData = userDocSnap.data();
  const profiles = Array.isArray(userData.profile) ? userData.profile as UserProfileRecord[] : [];

  return {
    userDocRef,
    profiles,
  };
};

type FeedActivityType = FeedActivity["type"];

const isFeedActivity = (value: unknown): value is FeedActivity => (
  typeof value === "object" &&
  value !== null &&
  typeof (value as FeedActivity).feedId === "string" &&
  (
    (value as FeedActivity).type === "comment" ||
    (value as FeedActivity).type === "like" ||
    (value as FeedActivity).type === "report"
  )
);

const syncProfileFeedActivity = async (
  feedId: string,
  type: FeedActivityType,
  shouldInclude: boolean,
  commentId?: string,
  reason?: string,
) => {
  const { user, currentProfile } = useAuthStore.getState();
  const userId = user?.userId || (user as { uid?: string } | null)?.uid || auth.currentUser?.uid;
  if (!userId || !currentProfile) return;

  const profileData = await getCurrentProfiles(userId);
  if (!profileData) return;

  const profileIndex = profileData.profiles.findIndex((profile) => profile.id === currentProfile.id);
  if (profileIndex === -1) return;

  const updatedProfiles = [...profileData.profiles];
  const targetProfile = { ...updatedProfiles[profileIndex] };
  const currentActivities = (targetProfile.community?.feeds || []).filter(isFeedActivity);
  const isSameActivity = (activity: FeedActivity) => (
    activity.feedId === feedId &&
    activity.type === type &&
    (type !== "comment" || !commentId || activity.commentId === commentId)
  );
  const nextActivities = shouldInclude
    ? [
      ...currentActivities.filter((activity) => !isSameActivity(activity)),
      {
        feedId,
        type,
        ...(commentId ? { commentId } : {}),
        ...(reason ? { reason } : {}),
        createdAt: new Date().toISOString(),
      },
    ]
    : currentActivities.filter((activity) => !isSameActivity(activity));

  targetProfile.community = {
    ...targetProfile.community,
    feeds: nextActivities,
  };

  updatedProfiles[profileIndex] = targetProfile;
  await updateDoc(profileData.userDocRef, { profile: updatedProfiles });
};

const safelySyncProfileFeedActivity = async (
  feedId: string,
  type: FeedActivityType,
  shouldInclude: boolean,
  commentId?: string,
  reason?: string,
) => {
  try {
    await syncProfileFeedActivity(feedId, type, shouldInclude, commentId, reason);
  } catch (error) {
    console.error("피드 활동 기록 실패:", error);
  }
};

const getAuthorProfile = async (userId: string, profileId?: number) => {
  const authorCacheKey = profileId ? `${userId}:${profileId}` : userId;
  const { user, currentProfile } = useAuthStore.getState();
  const currentUserId =
    user?.userId ||
    (user as { uid?: string } | null)?.uid ||
    auth.currentUser?.uid;

  if (
    currentUserId === userId &&
    currentProfile &&
    (!profileId || profileId === currentProfile.id)
  ) {
    return currentProfile as UserProfileRecord;
  }

  if (!authorProfileCache.has(authorCacheKey)) {
    authorProfileCache.set(
      authorCacheKey,
      getCurrentProfiles(userId).then(
        (profileData) =>
          profileData?.profiles.find((item) => item.id === profileId) ||
          profileData?.profiles[0],
      ),
    );
  }

  return authorProfileCache.get(authorCacheKey);
};

const getAuthorName = async (userId: string, profileId?: number) => {
  if (SEED_AUTHOR_NAMES[userId]) return SEED_AUTHOR_NAMES[userId];
  const authorCacheKey = profileId ? `${userId}:${profileId}` : userId;
  if (authorCache.has(authorCacheKey)) return authorCache.get(authorCacheKey)!;

  const { user, currentProfile } = useAuthStore.getState();
  const currentUserId = user?.userId || (user as { uid?: string } | null)?.uid || auth.currentUser?.uid;
  if (currentUserId === userId && currentProfile?.nickname && (!profileId || profileId === currentProfile.id)) {
    authorCache.set(authorCacheKey, currentProfile.nickname);
    return currentProfile.nickname;
  }

  try {
    const profile = await getAuthorProfile(userId, profileId);
    const author = profile?.nickname || "익명";
    authorCache.set(authorCacheKey, author);
    return author;
  } catch {
    return "익명";
  }
};

const getAuthorImage = async (userId: string, profileId?: number) => {
  if (SEED_AUTHOR_NAMES[userId]) return "";
  const authorCacheKey = profileId ? `${userId}:${profileId}` : userId;
  if (authorImageCache.has(authorCacheKey)) return authorImageCache.get(authorCacheKey);

  const { user, currentProfile } = useAuthStore.getState();
  const currentUserId = user?.userId || (user as { uid?: string } | null)?.uid || auth.currentUser?.uid;
  if (currentUserId === userId && currentProfile?.imgUrl && (!profileId || profileId === currentProfile.id)) {
    authorImageCache.set(authorCacheKey, currentProfile.imgUrl);
    return currentProfile.imgUrl;
  }

  try {
    const profile = await getAuthorProfile(userId, profileId);
    const authorImage = profile?.imgUrl || "";
    authorImageCache.set(authorCacheKey, authorImage);
    return authorImage;
  } catch {
    return "";
  }
};

const getAuthorBadges = async (userId: string, profileId?: number) => {
  if (SEED_AUTHOR_NAMES[userId]) return { equippedBadge: "", badgeIds: [] as string[] };

  try {
    const profile = await getAuthorProfile(userId, profileId);
    const completedBadgeIds =
      profile?.badges?.earnedBadges
        ?.filter((badge) => badge.isComplete)
        .map((badge) => badge.id) ?? [];
    const equippedBadgeId = profile?.badges?.equippedBadges ?? "";

    const badgeIds = [
      ...(equippedBadgeId && completedBadgeIds.includes(equippedBadgeId)
        ? [equippedBadgeId]
        : []),
      ...completedBadgeIds.filter((badgeId) => badgeId !== equippedBadgeId),
    ].slice(0, 3);

    return { equippedBadge: equippedBadgeId, badgeIds };
  } catch {
    return { equippedBadge: "", badgeIds: [] as string[] };
  }
};

const getMediaDetail = async (videoId: string): Promise<MediaDetail> => {
  if (mediaCache.has(videoId)) return mediaCache.get(videoId)!;

  const { mediaType, mediaId } = parseVideoId(videoId);
  const fallback: MediaDetail = {
    id: mediaId,
    mediaType,
    title: "제목 없음",
    meta: mediaType === "tv" ? "시리즈" : "영화",
  };

  if (!TMDB_KEY || !mediaId) return fallback;

  try {
    const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${mediaId}?api_key=${TMDB_KEY}&language=ko-KR`);
    if (!res.ok) throw new Error("API Response Failed");
    
    const data = await res.json();
    
    const title = mediaType === "tv" ? data.name : data.title;
    const year = mediaType === "tv" ? data.first_air_date?.slice(0, 4) : data.release_date?.slice(0, 4);
    
    // [수정된 부분] 안전한 숫자 처리
    const rawAverage = data?.vote_average;
    const average = (typeof rawAverage === "number" && !isNaN(rawAverage))
      ? (rawAverage / 2).toFixed(1)
      : "-";

    const detail = {
      id: mediaId,
      mediaType,
      title: title || fallback.title,
      posterPath: data?.poster_path || "",
      meta: `${mediaType === "tv" ? "시리즈" : "영화"} · ${year || "연도 미상"} · 평균 ${average}`,
    };

    mediaCache.set(videoId, detail);
    return detail;
  } catch (error) {
    console.error("미디어 상세 정보 로드 실패:", error);
    return fallback;
  }
};

const normalizeComment = (commentId: string, data: FirestoreRecord): FeedComment => ({
  commentId,
  userId: readString(data, "userId"),
  profileId: readNumber(data, "profileId") || undefined,
  content: readString(data, "content"),
  reportsCount: readNumber(data, "reportsCount"),
  likesCount: readNumber(data, "likesCount"),
  createdAt: readString(data, "createdAt"),
  updatedAt: readString(data, "updatedAt"),
  likedUserIds: readStringArray(data, "likedUserIds"),
});

const normalizeFeed = (feedId: string, data: FirestoreRecord): FeedReview => ({
  feedId,
  userId: readString(data, "userId"),
  videoId: readString(data, "videoId"),
  postType: readString(data, "postType") === "general" ? "general" : "media",
  category: (readString(data, "category") || undefined) as
    | FeedCategory
    | undefined,
  content: readString(data, "content"),
  likesCount: readNumber(data, "likesCount"),
  reportsCount: readNumber(data, "reportsCount"),
  createdAt: readString(data, "createdAt"),
  updatedAt: readString(data, "updatedAt"),
  profileId: readNumber(data, "profileId") || undefined,
  rating: readNumber(data, "rating"),
  isSpoiler: readBoolean(data, "isSpoiler"),
  isPublic: readBoolean(data, "isPublic", true),
  likedUserIds: readStringArray(data, "likedUserIds"),
});

const buildCommentView = async (
  comment: FeedComment,
  currentUserId?: string,
  currentProfileId?: number,
): Promise<FeedCommentView> => {
  const likedUserIds = comment.likedUserIds || [];
  const currentActorId = currentUserId && currentProfileId ? `${currentUserId}:${currentProfileId}` : currentUserId;

  return {
    ...comment,
    author: await getAuthorName(comment.userId, comment.profileId),
    authorImage: await getAuthorImage(comment.userId, comment.profileId),
    isMine: Boolean(
      currentUserId &&
      comment.userId === currentUserId &&
      (!comment.profileId || comment.profileId === currentProfileId)
    ),
    liked: Boolean(currentActorId && likedUserIds.includes(currentActorId)),
    likedUserIds,
  };
};

const buildFeedView = async (
  review: FeedReview,
  commentsList: FeedComment[],
  currentUserId?: string,
  followingIds: string[] = [],
): Promise<FeedView> => {
  const media = review.videoId
    ? await getMediaDetail(review.videoId)
    : null;
  const likedUserIds = review.likedUserIds || [];
  const currentProfileId = useAuthStore.getState().currentProfile?.id;
  const currentActorId = currentUserId && currentProfileId ? `${currentUserId}:${currentProfileId}` : currentUserId;
  const [author, authorImage, authorBadges] = await Promise.all([
    getAuthorName(review.userId, review.profileId),
    getAuthorImage(review.userId, review.profileId),
    getAuthorBadges(review.userId, review.profileId),
  ]);

  return {
    ...review,
    feedId: review.feedId || "",
    author,
    authorImage,
    authorBadgeIds: authorBadges.badgeIds,
    authorEquippedBadge: authorBadges.equippedBadge,
    isMine: Boolean(
      currentUserId &&
      review.userId === currentUserId &&
      (!review.profileId || review.profileId === currentProfileId)
    ),
    isFollowing: followingIds.includes(review.userId),
    mediaId: media?.id,
    mediaType: media?.mediaType,
    mediaTitle: media?.title,
    mediaPoster: media?.posterPath,
    mediaMeta: media?.meta || "",
    liked: Boolean(currentActorId && likedUserIds.includes(currentActorId)),
    likedUserIds,
    comments: commentsList.length,
    commentsList: await Promise.all(commentsList.map((comment) => buildCommentView(comment, currentUserId, currentProfileId))),
  };
};

const seedInitialFeeds = async () => {
  await Promise.all(INITIAL_REVIEWS.map(async (review) => {
    if (!review.feedId) return;

    const feedRef = doc(db, FEEDS_COLLECTION, review.feedId);
    const feedSnap = await getDoc(feedRef);
    if (!feedSnap.exists()) {
      const seedDoc = { ...review };
      delete seedDoc.feedId;
      await setDoc(feedRef, seedDoc);
    }

    const seedComments = INITIAL_REVIEW_COMMENTS[review.feedId] || [];
    await Promise.all(seedComments.map(async (comment) => {
      const commentRef = doc(db, FEEDS_COLLECTION, review.feedId!, COMMENTS_COLLECTION, comment.commentId);
      const commentSnap = await getDoc(commentRef);
      if (!commentSnap.exists()) {
        const { commentId, ...commentDoc } = comment;
        void commentId;
        await setDoc(commentRef, commentDoc);
      }
    }));
  }));
};

const fetchComments = async (feedId: string) => {
  const snapshot = await getDocs(collection(db, FEEDS_COLLECTION, feedId, COMMENTS_COLLECTION));

  return snapshot.docs
    .map((commentDoc) => normalizeComment(commentDoc.id, commentDoc.data()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const getSeedViews = async (currentUserId?: string, followingIds: string[] = []) => (
  Promise.all(INITIAL_REVIEWS.map((review) => (
    buildFeedView(review, INITIAL_REVIEW_COMMENTS[review.feedId || ""] || [], currentUserId, followingIds)
  )))
);

export const useFeedStore = create<FeedState>((set, get) => ({
  feeds: [],
  isLoading: false,

  onHydrateFeeds: async () => {
    const { userId, currentProfile } = getAuthContext();
    const followingIds = currentProfile?.community?.following || [];

    set({ isLoading: true });

    try {
      // 1. 모든 피드 문서 가져오기
      const snapshot = await getDocs(collection(db, FEEDS_COLLECTION));
      
      // 2. 피드 데이터 가공 (병렬 처리)
      const reviews = await Promise.all(
        snapshot.docs.map(async (feedDoc) => {
          const data = feedDoc.data();
          const feedId = feedDoc.id;

          // 데이터 정규화
          const normalized = normalizeFeed(feedId, data);
          
          // 문서 내 commentsList를 즉시 사용 (별도 fetch 불필요)
          const commentsList = data.commentsList || [];
          
          // FeedView 빌드
          return buildFeedView(normalized, commentsList, userId, followingIds);
        })
      );

      // 3. 생성 시간 기준 정렬 및 상태 저장
      const sortedReviews = reviews.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      set({ feeds: sortedReviews, isLoading: false });
      
    } catch (error) {
      console.error("피드 전체 로드 실패:", error);
      set({ feeds: [], isLoading: false });
    }
  },

  onHydrateMyFeeds: async () => {
    const { userId, currentProfile } = getAuthContext();
    // 로그인 및 프로필 정보 확인
    if (!userId || !currentProfile) return;

    set({ isLoading: true });

    try {
      // 1. userId를 문서 ID로 사용하여 userFeeds 문서 가져오기
      const userFeedsRef = doc(db, "userFeeds", userId);
      const userFeedsDoc = await getDoc(userFeedsRef);

      if (!userFeedsDoc.exists()) {
        set({ feeds: [], isLoading: false });
        return;
      }

      const followingIds = currentProfile?.community?.following || [];

      // 2. 문서 내의 feeds 배열 데이터 추출
      const data = userFeedsDoc.data();
      const allMyFeeds = (
        Array.isArray(data.feeds) ? data.feeds : []
      ) as StoredFeedReview[];

      // 3. profileId가 현재 프로필 ID와 일치하는 피드만 필터링
      const filteredFeeds = allMyFeeds.filter(
        (feed) => feed.profileId === currentProfile.id
      );

      // 4. 필터링된 데이터를 FeedView 형식으로 변환 (정규화)
      const myReviews = await Promise.all(filteredFeeds.map((feedData) => {
        
        const normalized = normalizeFeed(
          feedData.feedId || "",
          feedData as unknown as FirestoreRecord,
        );
        
        return buildFeedView(
          normalized, 
          feedData.commentsList || [], 
          userId, 
          followingIds // 본인 피드이므로 팔로잉 목록은 필요 없음
        );
      }));
      
      // 5. 생성 시간 기준 정렬 및 상태 저장
      const sortedReviews = myReviews.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      // console.log(sortedReviews)
      set({ feeds: sortedReviews, isLoading: false });

    } catch (error) {
      console.error("내 프로필 피드 로드 실패:", error);
      set({ feeds: [], isLoading: false });
    }
  },

  onAddFeed: async (review) => {
    const { userId, currentProfile } = getAuthContext();
    if (!userId || !currentProfile) return;

    const now = new Date().toISOString();
    const feedId = doc(collection(db, FEEDS_COLLECTION)).id; // 미리 ID 생성

    const newDoc = {
      feedId, // 생성한 ID 포함
      userId,
      profileId: currentProfile.id,
      videoId: review.videoId || "",
      postType: review.postType || "media",
      ...(review.category ? { category: review.category } : {}),
      content: review.content,
      likesCount: 0,
      reportsCount: 0,
      createdAt: now,
      updatedAt: now,
      rating: review.rating,
      isSpoiler: review.isSpoiler,
      isPublic: review.isPublic,
      likedUserIds: [],
    };

    const batch = writeBatch(db);

    // 1. 전체 피드 컬렉션에 저장
    const feedDocRef = doc(db, FEEDS_COLLECTION, feedId);
    batch.set(feedDocRef, newDoc);

    // 2. 유저별 피드 컬렉션에 배열로 저장 (userFeeds/userId)
    const userFeedsRef = doc(db, "userFeeds", userId);
    batch.set(userFeedsRef, { 
      feeds: arrayUnion(newDoc) 
    }, { merge: true });

    try {
      await batch.commit();

      // 3. 상태 갱신
      const nextReview = await buildFeedView(
        newDoc, 
        [], 
        userId, 
        currentProfile.community?.following || []
      );
      
      set((state) => ({ feeds: [nextReview, ...state.feeds] }));
    } catch (error) {
      console.error("피드 저장 및 배치 업데이트 실패:", error);
    }
  },

  onUpdateFeed: async (review) => {
    if (!review.feedId) return;
    const { userId } = getAuthContext();
    if (!userId) return;

    const updatedAt = new Date().toISOString();
    const feedDocRef = doc(db, FEEDS_COLLECTION, review.feedId);
    const authorUserFeedsRef = doc(db, "userFeeds", review.userId || userId);
    
    const updatedFields = {
      videoId: review.videoId || "",
      postType: review.postType || "media",
      category: review.category || null,
      content: review.content,
      rating: review.rating,
      isSpoiler: review.isSpoiler,
      isPublic: review.isPublic,
      updatedAt,
    };

    try {
      await runTransaction(db, async (transaction) => {
        // [핵심] 수정하려는 모든 문서를 먼저 읽어옵니다 (읽기 작업 우선)
        const feedDoc = await transaction.get(feedDocRef);
        const authorDoc = await transaction.get(authorUserFeedsRef);

        if (!feedDoc.exists()) throw new Error("Feed does not exist");

        // 이제 모든 읽기가 끝났으므로 안심하고 쓰기 작업을 수행합니다.
        
        // 1. 메인 피드 업데이트
        transaction.update(feedDocRef, updatedFields);

        // 2. 작성자 피드 배열 업데이트
        if (authorDoc.exists()) {
          const feeds = [...(authorDoc.data().feeds || [])];
          const fIndex = feeds.findIndex((f) => f.feedId === review.feedId);
          if (fIndex !== -1) {
            feeds[fIndex] = { ...feeds[fIndex], ...updatedFields };
            transaction.update(authorUserFeedsRef, { feeds });
          }
        }
      });

      // 3. 로컬 상태 갱신 (트랜잭션 이후)
      // ... 로컬 상태 업데이트 로직 ...
    } catch (error) {
      console.error("피드 수정 트랜잭션 실패:", error);
    }
  },

  onDeleteFeed: async (feedId: string) => {
    const { userId } = getAuthContext();
    if (!userId) return;

    const feedDocRef = doc(db, FEEDS_COLLECTION, feedId);
    const authorUserFeedsRef = doc(db, "userFeeds", userId);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. [읽기] 모든 필요한 데이터를 먼저 읽어옵니다.
        const authorDoc = await transaction.get(authorUserFeedsRef);

        // 2. [쓰기] 읽기가 끝났으므로, 이제 삭제/수정 작업을 수행합니다.
        
        // 전체 피드 문서 삭제
        transaction.delete(feedDocRef);

        // 작성자의 userFeeds 배열에서 피드 객체 제거
        if (authorDoc.exists()) {
          const feeds = [...(authorDoc.data().feeds || [])];
          const updatedFeeds = feeds.filter((f) => f.feedId !== feedId);
          
          transaction.update(authorUserFeedsRef, { feeds: updatedFeeds });
        }
      });

      // 3. 로컬 Zustand 상태 갱신
      set((state) => ({
        feeds: state.feeds.filter((review) => review.feedId !== feedId),
      }));
    } catch (error) {
      console.error("피드 완전 삭제 및 동기화 트랜잭션 실패:", error);
    }
  },

  onAddComment: async (feedId: string, comment: FeedComment) => {
    const { userId, currentProfile } = getAuthContext();
    if (!userId || !currentProfile) return;

    const targetReview = get().feeds.find((review) => review.feedId === feedId);
    if (!targetReview) return;

    const newComment: FeedComment = {
      ...comment,
      commentId: comment.commentId || Date.now().toString(),
      userId,
      profileId: currentProfile.id,
      reportsCount: 0,
      likesCount: 0,
      content: comment.content,
      createdAt: comment.createdAt || new Date().toISOString(),
      likedUserIds: comment.likedUserIds || [],
    };

    const feedDocRef = doc(db, FEEDS_COLLECTION, feedId);
    const authorUserFeedsRef = doc(db, "userFeeds", targetReview.userId);

    await runTransaction(db, async (transaction) => {
      // [수정] 읽기 작업 우선 수행
      const authorDoc = await transaction.get(authorUserFeedsRef);
      const feedDoc = await transaction.get(feedDocRef);
      if (!feedDoc.exists()) throw new Error("Feed not found");

      // [수정] 읽기 완료 후 쓰기 작업 수행
      transaction.update(feedDocRef, { commentsList: arrayUnion(newComment) });

      if (authorDoc.exists()) {
        const feeds = [...(authorDoc.data().feeds || [])];
        const fIndex = feeds.findIndex((f) => f.feedId === feedId);
        if (fIndex !== -1) {
          feeds[fIndex].commentsList = [...(feeds[fIndex].commentsList || []), newComment];
          transaction.update(authorUserFeedsRef, { feeds });
        }
      }
    });

    const newCommentView = await buildCommentView(newComment, userId, currentProfile.id);

    set((state) => ({
      feeds: state.feeds.map((r) => {
        if (r.feedId !== feedId) return r;
        const commentsList = [...r.commentsList, newCommentView];
        return { ...r, commentsList, comments: commentsList.length };
      }),
    }));
  },

  onToggleLike: async (feedId: string) => {
    const { userId, actorId } = getAuthContext();
    if (!userId || !actorId) return;

    const targetReview = get().feeds.find((review) => review.feedId === feedId);
    if (!targetReview) return;

    const nextLiked = !targetReview.liked;
    const nextLikesCount = Math.max(0, targetReview.likesCount + (nextLiked ? 1 : -1));
    
    const authorUserFeedsRef = doc(db, "userFeeds", targetReview.userId);
    const feedDocRef = doc(db, FEEDS_COLLECTION, feedId);

    try {
      await runTransaction(db, async (transaction) => {
        // [수정] 읽기 작업 우선 수행
        const authorDoc = await transaction.get(authorUserFeedsRef);
        
        // [수정] 쓰기 작업 수행
        transaction.update(feedDocRef, {
          likesCount: nextLikesCount,
          likedUserIds: nextLiked ? arrayUnion(actorId) : arrayRemove(actorId),
        });

        if (authorDoc.exists()) {
          const feeds = [...(authorDoc.data().feeds || [])];
          const fIndex = feeds.findIndex((f) => f.feedId === feedId);
          if (fIndex !== -1) {
            feeds[fIndex] = {
              ...feeds[fIndex],
              likesCount: nextLikesCount,
              likedUserIds: nextLiked 
                ? [...new Set([...(feeds[fIndex].likedUserIds || []), actorId])]
                : (feeds[fIndex].likedUserIds || []).filter((id: string) => id !== actorId)
            };
            transaction.update(authorUserFeedsRef, { feeds });
          }
        }
      });

      set((state) => ({
        feeds: state.feeds.map((review) =>
          review.feedId === feedId
            ? { ...review, liked: nextLiked, likesCount: nextLikesCount, likedUserIds: nextLiked ? [...new Set([...review.likedUserIds, actorId])] : review.likedUserIds.filter((id) => id !== actorId) }
            : review
        ),
      }));
    } catch (error) {
      console.error("좋아요 동기화 트랜잭션 실패:", error);
    }
  },
  onUpdateComment: async (feedId, commentId, content) => {
    const updatedAt = new Date().toISOString();
    const targetReview = get().feeds.find((review) => review.feedId === feedId);
    if (!targetReview) return;

    const feedDocRef = doc(db, FEEDS_COLLECTION, feedId);
    const authorUserFeedsRef = doc(db, "userFeeds", targetReview.userId);

    await runTransaction(db, async (transaction) => {
      const feedDoc = await transaction.get(feedDocRef);
      const authorDoc = await transaction.get(authorUserFeedsRef);
      if (!feedDoc.exists()) throw new Error("Feed not found");

      const updatedComments = (feedDoc.data()?.commentsList || []).map(
        (comment: FeedComment) =>
          comment.commentId === commentId
            ? { ...comment, content, updatedAt }
            : comment,
      );
      transaction.update(feedDocRef, { commentsList: updatedComments });

      if (authorDoc.exists()) {
        const feeds = [...(authorDoc.data().feeds || [])];
        const feedIndex = feeds.findIndex((feed) => feed.feedId === feedId);
        if (feedIndex !== -1) {
          feeds[feedIndex].commentsList = (
            feeds[feedIndex].commentsList || []
          ).map((comment: FeedComment) =>
            comment.commentId === commentId
              ? { ...comment, content, updatedAt }
              : comment,
          );
          transaction.update(authorUserFeedsRef, { feeds });
        }
      }
    });

    set((state) => ({
      feeds: state.feeds.map((review) => {
        if (review.feedId !== feedId) return review;

        return {
          ...review,
          commentsList: review.commentsList.map((comment) => (
            comment.commentId === commentId
              ? { ...comment, content, updatedAt }
              : comment
          )),
        };
      }),
    }));
  },

  onDeleteComment: async (feedId: string, commentId: string) => {
    const targetReview = get().feeds.find((review) => review.feedId === feedId);
    if (!targetReview) return;

    const feedDocRef = doc(db, FEEDS_COLLECTION, feedId);
    const authorUserFeedsRef = doc(db, "userFeeds", targetReview.userId);

    await runTransaction(db, async (transaction) => {
      // 1. 피드 문서에서 삭제
      const feedDoc = await transaction.get(feedDocRef);
      const authorDoc = await transaction.get(authorUserFeedsRef);
      if (!feedDoc.exists()) throw new Error("Feed not found");
      const updatedComments = (feedDoc.data()?.commentsList || []).filter(
        (c: FeedComment) => c.commentId !== commentId
      );
      transaction.update(feedDocRef, { commentsList: updatedComments });

      // 2. 작성자 개인 피드 문서에서 삭제
      if (authorDoc.exists()) {
        const feeds = [...(authorDoc.data().feeds || [])];
        const fIndex = feeds.findIndex((f) => f.feedId === feedId);
        if (fIndex !== -1) {
          feeds[fIndex].commentsList = (feeds[fIndex].commentsList || []).filter(
            (c: FeedComment) => c.commentId !== commentId
          );
          transaction.update(authorUserFeedsRef, { feeds });
        }
      }
    });

    set((state) => ({
      feeds: state.feeds.map((r) => {
        if (r.feedId !== feedId) return r;
        const filtered = r.commentsList.filter((c) => c.commentId !== commentId);
        return { ...r, commentsList: filtered, comments: filtered.length };
      }),
    }));
  },

  onToggleCommentLike: async (feedId: string, commentId: string) => {
    const { userId, actorId } = getAuthContext();
    if (!userId || !actorId) return;

    const feedDocRef = doc(db, FEEDS_COLLECTION, feedId);
    
    // 트랜잭션을 사용하여 서버와 로컬 상태 동기화
    await runTransaction(db, async (transaction) => {
      const feedDoc = await transaction.get(feedDocRef);
      if (!feedDoc.exists()) return;

      const data = feedDoc.data();
      const comments = (data.commentsList || []) as FeedComment[];
      
      // 해당 댓글 찾기
      const targetIndex = comments.findIndex((c) => c.commentId === commentId);
      if (targetIndex === -1) return;

      const targetComment = comments[targetIndex];
      const isAlreadyLiked = targetComment.likedUserIds?.includes(actorId);
      
      // 상태 반전 계산
      const nextLiked = !isAlreadyLiked;
      const nextLikedUserIds = nextLiked
        ? [...(targetComment.likedUserIds || []), actorId]
        : (targetComment.likedUserIds || []).filter((id: string) => id !== actorId);

      // 배열 업데이트
      comments[targetIndex] = {
        ...targetComment,
        likesCount: nextLiked ? (targetComment.likesCount || 0) + 1 : Math.max(0, (targetComment.likesCount || 0) - 1),
        likedUserIds: nextLikedUserIds,
      };

      transaction.update(feedDocRef, { commentsList: comments });
    });

    // 로컬 상태 즉시 갱신
    set((state) => ({
      feeds: state.feeds.map((review) => {
        if (review.feedId !== feedId) return review;
        return {
          ...review,
          commentsList: review.commentsList.map((comment) => {
            if (comment.commentId !== commentId) return comment;
            const isNowLiked = comment.likedUserIds?.includes(actorId) || false;
            return {
              ...comment,
              likesCount: isNowLiked ? (comment.likesCount || 0) - 1 : (comment.likesCount || 0) + 1,
              likedUserIds: isNowLiked 
                ? comment.likedUserIds?.filter((id) => id !== actorId) 
                : [...(comment.likedUserIds || []), actorId],
            };
          }),
        };
      }),
    }));
  },

  onReportFeed: async (feedId: string, shouldReport: boolean) => {
    const { userId, currentProfile } = getAuthContext();
    if (!userId || !currentProfile) return;

    const targetReview = get().feeds.find((review) => review.feedId === feedId);
    if (!targetReview) return;
    
    // 본인 피드는 신고 불가
    if (targetReview.userId === userId && targetReview.profileId === currentProfile.id) return;

    const feedDocRef = doc(db, FEEDS_COLLECTION, feedId);
    
    // 1. 계산된 새로운 신고 카운트
    const newReportsCount = Math.max(0, targetReview.reportsCount + (shouldReport ? 1 : -1));

    try {
      // 2. Firestore 문서 업데이트 (reportsCount만)
      await updateDoc(feedDocRef, {
        reportsCount: newReportsCount
      });

      // 3. 로컬 상태 갱신
      set((state) => ({
        feeds: state.feeds.map((review) => (
          review.feedId === feedId 
            ? { ...review, reportsCount: newReportsCount } 
            : review
        )),
      }));
    } catch (error) {
      console.error("피드 신고 업데이트 실패:", error);
    }
  },
}));
