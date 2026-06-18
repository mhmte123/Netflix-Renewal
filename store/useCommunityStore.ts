import { create } from 'zustand';
import { collection, getDocs, arrayUnion, doc, getDoc, writeBatch, runTransaction, type Transaction } from 'firebase/firestore';
import { db } from '@/firebase/firebase';
import { ReviewDocument, CommunityStore } from '@/types/community';
import { useAuthStore } from './useAuthStore';
import { BadgeList } from '@/types/auth';
import { dummyPlaylists } from '@/data/dummyPlaylist';

// ───────────────────────────────────────────────────────────
// 더미 리뷰 생성기 (videoId 기반 결정적 생성 — 새로고침해도 동일)
// 실제 작품 대부분에 더미 유저들의 리뷰가 보이도록 채운다.
// ───────────────────────────────────────────────────────────
const DUMMY_REVIEW_TEXTS = [
  "기대 이상이었어요. 몰입해서 끝까지 봤네요.",
  "연출이랑 음악이 진짜 좋았습니다.",
  "배우들 연기가 자연스러워서 푹 빠져들었어요.",
  "초반은 살짝 느렸지만 후반부가 정말 몰아쳐요.",
  "분위기 있는 작품 좋아하면 강력 추천합니다.",
  "다시 봐도 좋을 것 같은 작품이에요.",
  "스토리가 탄탄해서 시간 가는 줄 몰랐어요.",
  "영상미가 예술이네요. 장면 하나하나가 그림 같아요.",
  "가볍게 보기 좋으면서도 여운이 남습니다.",
  "주말에 정주행하기 딱 좋은 작품!",
  "기분 전환하고 싶을 때 보기 좋아요.",
  "캐릭터들이 매력 있어서 더 보고 싶어졌어요.",
  "생각보다 훨씬 재밌어서 놀랐어요.",
  "결말이 깔끔해서 만족스러웠습니다.",
  "오랜만에 인생작 만난 기분이에요.",
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDummyReviews(videoId: string): ReviewDocument[] {
  if (!videoId) return [];
  const rand = mulberry32(hashStr(videoId));
  // 약 8%는 더미 리뷰 0개 → "등록된 리뷰가 없습니다" 빈 상태도 자연스럽게 노출
  if (rand() < 0.08) return [];
  const count = 2 + Math.floor(rand() * 5); // 2~6개

  // 리뷰어(더미 유저) 셔플 후 중복 없이 선택
  const pool = [...dummyPlaylists];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, Math.min(count, pool.length));

  const now = Date.now();
  return picked.map((d, i) => {
    const rating = 3 + Math.floor(rand() * 3); // 3~5
    const text = DUMMY_REVIEW_TEXTS[Math.floor(rand() * DUMMY_REVIEW_TEXTS.length)];
    const daysAgo = 1 + Math.floor(rand() * 120);
    const createdAt = new Date(now - daysAgo * 86400000).toISOString();
    return {
      reviewId: `dummy-${videoId}-${i}`,
      userId: d.userId, // dummy-N → 현재 유저와 절대 겹치지 않음(수정/삭제 버튼 안 뜸)
      content: text,
      videoId,
      likesCount: Math.floor(rand() * 40),
      isSpoiler: false,
      reportsCount: 0,
      nickname: d.nickname,
      createdAt,
      profileId: 1000 + i,
      rating,
      equippedBadge: d.badge, // 이름이지만 RepBadge가 id/이름 모두 해석
    } as ReviewDocument;
  });
}


export const getReviewCreatedBadge = (currentBadges: BadgeList): BadgeList => {
  const updatedEarnedBadges = [...currentBadges.earnedBadges];
  let newEquipped = currentBadges.equippedBadges;

  // 첫 리뷰 등록 뱃지 체크
  if (!updatedEarnedBadges.some(b => b.id === "social_reviewer")) {
    updatedEarnedBadges.push({
      id: "social_reviewer",
      progress: 1,
      isComplete: true
    });
    if (!newEquipped) newEquipped = "social_reviewer";
  }

  return {
    earnedBadges: updatedEarnedBadges,
    equippedBadges: newEquipped
  };
};


export const useCommunityStore = create<CommunityStore>((set, get) => ({
  reviews: [],

  fetchUserReviews: async () => {
    const { user } = useAuthStore.getState();
    if (!user?.userId) return;

    try {
      const docRef = doc(db, "userReviews", user.userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const reviewList = (data.reviews || []) as ReviewDocument[];
        
        // 최신순으로 정렬 후 상태 업데이트
        const sortedReviews = reviewList.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        set({ reviews: sortedReviews });
      } else {
        set({ reviews: [] });
      }
    } catch (error) {
      console.error("유저 리뷰 페칭 에러:", error);
    }
  },

  fetchAllReviews: async () => {
    try {
      const snapshot = await getDocs(collection(db, "videoReviews"));
      const reviewMap = new Map<string, ReviewDocument>();

      snapshot.docs.forEach((reviewDoc) => {
        const data = reviewDoc.data();
        const reviewList = Array.isArray(data.reviews) ? data.reviews : [];

        reviewList.forEach((review: ReviewDocument) => {
          if (!review?.reviewId || !review?.videoId) return;
          reviewMap.set(`${review.videoId}#${review.reviewId}`, review);
        });
      });

      const sortedReviews = Array.from(reviewMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      set({ reviews: sortedReviews });
    } catch (error) {
      console.error("전체 리뷰 수집 에러:", error);
      set({ reviews: [] });
    }
  },

  fetchVideoReviews: async (videoId: string) => {
    // videoId 기반 결정적 더미 리뷰 (실제 리뷰와 합쳐서 노출)
    const dummies = buildDummyReviews(videoId);
    const mergeSort = (real: ReviewDocument[]) =>
      [...real, ...dummies].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    try {
      // videoId를 문서 ID로 가지는 문서를 직접 조회
      const docRef = doc(db, "videoReviews", videoId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const reviewList = (data.reviews || []) as ReviewDocument[];
        
        // 클라이언트 측에서 최신순 정렬 (배열은 쿼리로 정렬 불가)
        const sortedReviews = reviewList.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // 작성자별 대표 칭호(장착 뱃지) 부착: userId 문서를 조회해 profileId 별 equippedBadges 매핑
        try {
          const uniqueUserIds = Array.from(
            new Set(sortedReviews.map((r) => r.userId).filter(Boolean))
          ) as string[];
          const userSnaps = await Promise.all(
            uniqueUserIds.map((uid) => getDoc(doc(db, "users", uid)))
          );
          const badgeByKey = new Map<string, string>();
          userSnaps.forEach((snap, i) => {
            if (!snap.exists()) return;
            const profiles = (snap.data().profile ?? []) as Array<{ id: number; badges?: BadgeList }>;
            profiles.forEach((p) => {
              badgeByKey.set(`${uniqueUserIds[i]}:${p.id}`, p.badges?.equippedBadges ?? "");
            });
          });
          const reviewsWithBadge = sortedReviews.map((r) => ({
            ...r,
            equippedBadge: r.userId ? badgeByKey.get(`${r.userId}:${r.profileId}`) ?? "" : "",
          }));
          set({ reviews: mergeSort(reviewsWithBadge) });
        } catch {
          // 칭호 부착 실패해도 리뷰 자체는 그대로 노출
          set({ reviews: mergeSort(sortedReviews) });
        }
      } else {
        // 실제 리뷰가 없으면 더미 리뷰만 노출 (없으면 빈 배열)
        set({ reviews: mergeSort([]) });
      }
    } catch (error) {
      console.error("영상 리뷰 페칭 에러:", error);
      set({ reviews: mergeSort([]) });
    }
  },

  fetchUserReviewsById: async (targetUserId: string) => {
    if (!targetUserId) return null;

    try {
      const docRef = doc(db, "userReviews", targetUserId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const reviewList = data.reviews || [];
        
        // 최신순으로 정렬
        const sortedReviews = reviewList.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        return sortedReviews;
      } else {
        // 데이터가 없을 경우 빈 배열 반환
        return [];
      }
    } catch (error) {
      console.error(`${targetUserId} 유저 리뷰 페칭 에러:`, error);
      return null;
    }
  },

  addReview: async (newReviewData) => {
      const { user, currentProfile } = useAuthStore.getState();
      if (!user?.userId || !currentProfile) return;

      // 1. 유저 데이터 및 프로필 가져오기 (뱃지 업데이트를 위해 필요)
      const userDocRef = doc(db, "users", user.userId);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) return;

      const userData = userDocSnap.data();
      const profiles = userData.profile || [];
      const profileIndex = profiles.findIndex((p:any) => p.id === currentProfile.id);
      if (profileIndex === -1) return;

      // 2. 뱃지 업데이트
      const updatedProfiles = [...profiles];
      const targetProfile = { ...updatedProfiles[profileIndex] };
      
      targetProfile.badges = getReviewCreatedBadge(
          targetProfile.badges || { earnedBadges: [], equippedBadges: "" }
      );
      updatedProfiles[profileIndex] = targetProfile;

      // 3. 리뷰 데이터 구성
      const newReview = {
        reviewId: crypto.randomUUID(),
        ...newReviewData,
        userId: user.userId,
        profileId: currentProfile.id,
        nickname: currentProfile.nickname,
        createdAt: new Date().toISOString(),
        likesCount: 0,
        reportsCount: 0,
      };// 기존 리뷰 생성 로직 동일

      // 4. Batch 작업 구성
      const batch = writeBatch(db);
      
      // 유저 리뷰 추가
      const userReviewDocRef = doc(db, "userReviews", user.userId);
      batch.set(userReviewDocRef, { reviews: arrayUnion(newReview) }, { merge: true });
      
      // 비디오 리뷰 추가
      const videoDocRef = doc(db, "videoReviews", newReviewData.videoId);
      batch.set(videoDocRef, { reviews: arrayUnion(newReview) }, { merge: true });
      
      // 유저 프로필(뱃지 정보) 업데이트
      batch.update(userDocRef, { profile: updatedProfiles });

      useAuthStore.getState().onInitAuth();

      try {
          await batch.commit();
          set((state) => ({ reviews: [newReview, ...state.reviews] }));
      } catch (error) {
          console.error("저장 실패:", error);
      }
  },
  updateReview: async (reviewId, videoId, data) => {
    const { user } = useAuthStore.getState();
    if (!user?.userId) return;

    const userDocRef = doc(db, "userReviews", user.userId);
    const videoDocRef = doc(db, "videoReviews", videoId);
    const updatedAt = new Date().toISOString();

    try {
      const [userDoc, videoDoc] = await Promise.all([
        getDoc(userDocRef),
        getDoc(videoDocRef),
      ]);

      const updateArray = (arr: ReviewDocument[] = []) =>
        arr.map((review) =>
          review.reviewId === reviewId
            ? { ...review, ...data, updatedAt }
            : review,
        );

      const batch = writeBatch(db);
      if (userDoc.exists()) {
        batch.update(userDocRef, { reviews: updateArray(userDoc.data().reviews) });
      }
      if (videoDoc.exists()) {
        batch.update(videoDocRef, { reviews: updateArray(videoDoc.data().reviews) });
      }

      await batch.commit();
      set((state) => ({ reviews: updateArray(state.reviews) }));
    } catch (error) {
      console.error("리뷰 수정 실패:", error);
      throw error;
    }
  },
  deleteReview: async (reviewId, videoId) => {
    const { user } = useAuthStore.getState();
    if (!user?.userId) return;

    const userDocRef = doc(db, "userReviews", user.userId);
    const videoDocRef = doc(db, "videoReviews", videoId);

    try {
      const [userDoc, videoDoc] = await Promise.all([
        getDoc(userDocRef),
        getDoc(videoDocRef),
      ]);

      const removeFromArray = (arr: ReviewDocument[] = []) =>
        arr.filter((review) => review.reviewId !== reviewId);

      const batch = writeBatch(db);
      if (userDoc.exists()) {
        batch.update(userDocRef, { reviews: removeFromArray(userDoc.data().reviews) });
      }
      if (videoDoc.exists()) {
        batch.update(videoDocRef, { reviews: removeFromArray(videoDoc.data().reviews) });
      }

      await batch.commit();
      set((state) => ({ reviews: removeFromArray(state.reviews) }));
    } catch (error) {
      console.error("리뷰 삭제 실패:", error);
      throw error;
    }
  },
  reportReview: async (reviewId: string, videoId: string) => {
    const { user } = useAuthStore.getState();
    if (!user?.userId) return;

    try {
      const userDocRef = doc(db, "userReviews", user.userId);
      const videoDocRef = doc(db, "videoReviews", videoId);

      const batch = writeBatch(db);

      // 1. 문서 데이터 가져오기
      const [userDoc, videoDoc] = await Promise.all([
        getDoc(userDocRef),
        getDoc(videoDocRef)
      ]);

      // 2. 각 문서의 리뷰 배열 수정 로직
      const updateArray = (arr: ReviewDocument[] = []) => arr.map((r) => 
        r.reviewId === reviewId 
          ? { ...r, reportsCount: (r.reportsCount || 0) + 1 } 
          : r
      );

      // 3. 배치 작업 추가
      if (userDoc.exists()) {
        batch.update(userDocRef, { reviews: updateArray(userDoc.data().reviews) });
      }
      if (videoDoc.exists()) {
        batch.update(videoDocRef, { reviews: updateArray(videoDoc.data().reviews) });
      }

      // 4. 커밋
      await batch.commit();

      // 5. 상태 동기화 (전역 상태의 reviews 배열도 업데이트)
      set((state) => ({
        reviews: updateArray(state.reviews)
      }));

    } catch (error) {
      console.error("신고 처리 중 에러 발생:", error);
      throw error; // 컴포넌트에서 catch하여 알림창 띄우기용
    }
  },
  updateReviewLikeCount: async (videoId: string, reviewId: string, isLiked: boolean) => {
    const { user, currentProfile } = useAuthStore.getState();
    if (!user?.userId || !currentProfile) return;

    const targetReview = get().reviews.find((review) => review.reviewId === reviewId);
    if (!targetReview) return;

    // 더미 리뷰는 Firestore 문서에 없으므로 현재 목록에서 카운트만 갱신한다.
    if (reviewId.startsWith("dummy-")) {
      set((state) => ({
        reviews: state.reviews.map((review) =>
          review.reviewId === reviewId
            ? {
                ...review,
                likesCount: Math.max(
                  0,
                  (review.likesCount || 0) + (isLiked ? -1 : 1),
                ),
              }
            : review,
        ),
      }));
      return;
    }

    const videoDocRef = doc(db, "videoReviews", videoId);
    const authorReviewDocRef = targetReview.userId
      ? doc(db, "userReviews", targetReview.userId)
      : null;

    try {
      const newLikesCount = await runTransaction(db, async (transaction: Transaction) => {
        // 1. 문서 가져오기
        const videoDoc = await transaction.get(videoDocRef);
        const authorReviewDoc = authorReviewDocRef
          ? await transaction.get(authorReviewDocRef)
          : null;

        if (!videoDoc.exists()) throw "Video review document does not exist!";
        
        const currentReviews = [...((videoDoc.data().reviews || []) as ReviewDocument[])];
        const rIndex = currentReviews.findIndex((r) => r.reviewId === reviewId);
        if (rIndex === -1) throw "Review not found!";

        // 2. 좋아요 수 계산 (최솟값 0 보장)
        const newLikesCount = Math.max(0, (currentReviews[rIndex].likesCount || 0) + (isLiked ? -1 : 1));

        // 3. videoReviews 데이터 업데이트
        currentReviews[rIndex] = { ...currentReviews[rIndex], likesCount: newLikesCount };
        transaction.update(videoDocRef, { reviews: currentReviews });

        // 4. userReviews 데이터 업데이트 (작성자의 문서도 동일하게 반영)
        if (authorReviewDocRef && authorReviewDoc?.exists()) {
          const userReviews = [...((authorReviewDoc.data().reviews || []) as ReviewDocument[])];
          const urIndex = userReviews.findIndex((r) => r.reviewId === reviewId);
          
          if (urIndex !== -1) {
            userReviews[urIndex] = { ...userReviews[urIndex], likesCount: newLikesCount };
            transaction.update(authorReviewDocRef, { reviews: userReviews });
          }
        }

        return newLikesCount;
      });

      // 목록 전체를 Firestore 배열로 교체하지 않고 현재 표시 순서를 유지한다.
      set((state) => ({
        reviews: state.reviews.map((review) =>
          review.reviewId === reviewId
            ? { ...review, likesCount: newLikesCount }
            : review,
        ),
      }));
    } catch (error) {
      console.error("좋아요 카운트 업데이트 트랜잭션 실패:", error);
    }
  }
}));
