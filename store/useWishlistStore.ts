import { create } from "zustand";
import type { WishItem, WishlistState } from "@/types/wishlist";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useAuthStore } from "./useAuthStore";
import { getItemKey, getMediaType } from "./usePlayListStore";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

// 현재 로그인 uid
function getUid(): string | null {
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    return useAuthStore.getState().user?.userId ?? null;
}

// 장르 분류 (16=애니메이션)
function resolveGenre(
    genreIds: number[],
    mediaType: "movie" | "tv"
): "movie" | "drama" | "animation" {
    if (genreIds.includes(16)) return "animation";
    return mediaType === "movie" ? "movie" : "drama";
}

// ID로 TMDB 상세 조회 → movie 먼저, 실패하면 tv 시도
export async function fetchWishItemById(itemKey: string): Promise<WishItem | null> {
    // 1. 내부에서 바로 분리
    const [mediaType, id] = itemKey.split('-');

    if (!mediaType || !id) {
        console.error(`[키 형식 오류] 잘못된 키 값입니다: ${itemKey}`);
        return null;
    }

    // 2. 변형된 값을 사용하여 API 호출
    const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${TMDB_KEY}&language=ko-KR`;

    try {
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        const genreIds: number[] = data.genres?.map((g: { id: number }) => g.id) ?? [];

        return {
            id: Number(id),
            title: mediaType === "movie" ? (data.title ?? data.original_title ?? "") : (data.name ?? data.original_name ?? ""),
            poster_path: data.poster_path ?? "",
            mediaType: mediaType as "movie" | "tv", // 강제 타입 캐스팅
            genre: resolveGenre(genreIds, mediaType as "movie" | "tv"),
            vote_average: data.vote_average ?? 0,
            addedAt: "",
        };
    } catch (err) {
        console.error(`[TMDB 조회 실패] ${itemKey}:`, err);
        return null;
    }
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
    wishlist: [],      // 화면 표시용 객체 배열 (API로 채움)
    wishlistIds: [],   // Firestore에 저장되는 ID 문자열 배열 (팀 표준)

    // ── 찜 추가 ──────────────────────────────────────────────────────────────
    onAddWish: async (item) => {
        try {
            const authState = useAuthStore.getState();
            const userId = getUid() ?? authState.user?.userId;
            const currentProfile = authState.currentProfile ?? authState.user?.profile?.[0];

            if (!userId || !currentProfile) return;

            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) return;

            const userData = userDocSnap.data();
            const profiles = userData.profile || [];

            // 1. 현재 프로필의 인덱스 찾기
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            if (profileIndex === -1) return;

            // 2. 현재 프로필 복사본 생성
            const updatedProfiles = [...profiles];
            const targetProfile = { ...updatedProfiles[profileIndex] };

            // 3. 유틸리티 함수로 키 생성 (예: "movie-12345")
            const mediaType = getMediaType(item as any);
            const itemKey = getItemKey({ id: item.id, mediaType });

            // 기존 wishlist 배열 가져오기 (없으면 빈 배열)
            const prevWishlist = targetProfile.movies?.wishlist || [];

            // 이미 있으면 중복 추가 방지
            if (prevWishlist.includes(itemKey)) return;

            // 4. 프로필 내부의 wishlist 업데이트 (새로운 키 사용)
            targetProfile.movies = {
                ...targetProfile.movies,
                wishlist: [itemKey, ...prevWishlist]
            };

            updatedProfiles[profileIndex] = targetProfile;

            // 5. 전체 프로필 배열을 Firestore에 반영
            await updateDoc(userDocRef, {
                profile: updatedProfiles
            });

            // 6. 상태 관리(Zustand) 업데이트
            const newWishlistIds = targetProfile.movies.wishlist;

            // 화면용 객체 생성 로직
            const genreIds: number[] = (item as any).genre_ids ?? (item as any).genres?.map((g: { id: number }) => g.id) ?? [];

            const newItem: WishItem = {
                id: item.id,
                title: "title" in item ? item.title : (item as any).name,
                poster_path: item.poster_path ?? "",
                mediaType,
                genre: resolveGenre(genreIds, mediaType),
                vote_average: item.vote_average ?? 0,
                addedAt: "",
            };

            set({
                wishlistIds: newWishlistIds,
                wishlist: [newItem, ...get().wishlist.filter((w) => w.id !== item.id)],
            });

            // console.log("프로필 내 위시리스트 성공적으로 업데이트 (Key:", itemKey, ")");
        } catch (err) {
            console.error("위시리스트 업데이트 실패:", err);
        }
    },
    // ── 찜 해제 ──────────────────────────────────────────────────────────────
    onRemoveWish: async (item) => {
        try {
            const authState = useAuthStore.getState();
            const userId = getUid() ?? authState.user?.userId;
            const currentProfile = authState.currentProfile ?? authState.user?.profile?.[0];

            if (!userId || !currentProfile) return;

            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) return;

            const userData = userDocSnap.data();
            const profiles = userData.profile || [];

            // 1. 현재 프로필 인덱스 찾기
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            if (profileIndex === -1) return;

            // 2. 유틸리티 함수로 제거할 키 생성 (예: "movie-12345")
            const mediaType = getMediaType(item as any);
            const itemKey = getItemKey({ id: item.id, mediaType });

            // 3. 프로필 복사 및 삭제 로직
            const updatedProfiles = [...profiles];
            const targetProfile = { ...updatedProfiles[profileIndex] };

            const prevWishlist = targetProfile.movies?.wishlist || [];
            const newWishlist = prevWishlist.filter((key: string) => key !== itemKey);

            targetProfile.movies = {
                ...targetProfile.movies,
                wishlist: newWishlist
            };

            updatedProfiles[profileIndex] = targetProfile;

            // 4. Firestore 업데이트
            await updateDoc(userDocRef, {
                profile: updatedProfiles
            });

            // 5. 상태 업데이트
            set({
                wishlistIds: newWishlist,
                wishlist: get().wishlist.filter((w) => w.id !== item.id),
            });

            // console.log("프로필 내 위시리스트 성공적으로 제거 (Key:", itemKey, ")");
        } catch (err) {
            console.error("위시리스트 제거 실패:", err);
        }
    },
    // ── 찜 목록 불러오기 (ID → TMDB API로 정보 채움) ─────────────────────────
    onLoadWishlist: async () => {
        const authState = useAuthStore.getState();
        const userId = getUid() ?? authState.user?.userId;
        const currentProfile = authState.currentProfile ?? authState.user?.profile?.[0];

        if (!userId || !currentProfile) {
            set({ wishlist: [], wishlistIds: [] });
            return;
        }

        try {
            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                set({ wishlist: [], wishlistIds: [] });
                return;
            }

            const userData = userDocSnap.data();
            const profiles = userData.profile || [];

            // 1. 현재 프로필 정보 찾기
            const targetProfile = profiles.find((p: any) => p.id === currentProfile.id);

            // 2. 프로필 내부의 wishlist ID 가져오기
            const ids: string[] = targetProfile?.movies?.wishlist ?? [];
            set({ wishlistIds: ids });

            if (ids.length === 0) {
                set({ wishlist: [] });
                return;
            }

            // 3. TMDB 조회 (기존 로직 유지)
            const results = await Promise.all(ids.map((id) => fetchWishItemById(id)));
            const items = results.filter((r): r is WishItem => r !== null);

            set({ wishlist: items });
            // console.log("프로필 내 위시리스트 로드 성공");
        } catch (err) {
            console.error("[찜 목록 불러오기 실패]:", err);
        }
    },

    // ── 찜 여부 확인 (ID 배열 기준) ──────────────────────────────────────────
    isWished: (id) => {
        return get().wishlistIds.includes(String(id));
    },
}));