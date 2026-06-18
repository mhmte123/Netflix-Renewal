import { create } from "zustand";
import type { Movie, TV } from "@/types/movie";
import type { PlayListItem, PlayListState } from "@/types/playList";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, query, where, getDocs, setDoc } from "firebase/firestore";
import { useAuthStore } from "./useAuthStore";
import { PlaylistDocument } from "@/types/playList";
import { useMovieStore } from "./useMovieStore";
import { BADGE_LIST } from "@/data/badge";
import { BadgeList } from "@/types/auth";
import { filters } from "@/app/category/page";
import { dummyPlaylists } from "@/data/dummyPlaylist";

const MAX_LIST_COUNT = 20;

type MediaType = "movie" | "tv";
type UserListField = "watchingVideos" | "playlistVideos";
type UserMovieData = {
    movies?: {
        watchingVideos?: string[];
        playlist?: {
            playlistVideos?: string[];
        };
    };
};

export const getMediaType = (item: Movie | TV): MediaType => (
    "title" in item ? "movie" : "tv"
);

const makePlayListItem = (item: Movie | TV): PlayListItem => ({
    id: item.id,
    title: ("title" in item ? item.title : item.name) as string,
    poster_path: item.poster_path ?? "",
    backdrop_path: item.backdrop_path ?? "",
    mediaType: getMediaType(item),
    playTime: new Date().toISOString(),
    progress:  0, 
    episodeProgress: {},
    first_air_date: "",
    release_date: "",
    vote_average: 0,
    overview: "",
});

export const getItemKey = (item: Pick<PlayListItem, "id" | "mediaType">) => (
    `${item.mediaType}-${item.id}`
);

export const getKeyFromParts = (id: number, mediaType: MediaType) => (
    `${mediaType}-${id}`
);

const putLatestFirst = (items: PlayListItem[], newItem: PlayListItem) => {
    const existing = items.find((item) => getItemKey(item) === getItemKey(newItem));
    const filtered = items.filter((item) => getItemKey(item) !== getItemKey(newItem));
    const merged = existing
        ? { ...newItem, progress: existing.progress, episodeProgress: existing.episodeProgress }
        : newItem;

    return [merged, ...filtered].slice(0, MAX_LIST_COUNT);
};

const loadLocalList = (key: string) => {
    if (typeof window === "undefined") return [];

    try {
        const stored = window.localStorage.getItem(key);
        return stored ? JSON.parse(stored) as PlayListItem[] : [];
    } catch (err) {
        console.log("Failed to load local list", err);
        return [];
    }
};

const getUserMovieIds = (data: UserMovieData, fieldName: UserListField): string[] => {
    if (fieldName === "watchingVideos") {
        return data?.movies?.watchingVideos || [];
    }

    return data?.movies?.playlist?.playlistVideos || [];
};

const getUserMoviePath = (fieldName: UserListField) => (
    fieldName === "watchingVideos"
        ? "movies.watchingVideos"
        : "movies.playlist.playlistVideos"
);

// 1. 장르 통계 계산을 위한 유틸리티 함수
const countStats = (currentStats: Record<string, number>, ids: string[]) => {
  const newStats = { ...currentStats };
  ids.forEach(id => {
    // 국가 코드 등은 대문자 통일 권장
    const key = id.toUpperCase();
    newStats[key] = (newStats[key] || 0) + 1;
  });
  return newStats;
};

const COUNTRY_CODE_TO_BADGE_ID: Record<string, string> = {
  KR: "culture_k_drama",
  UK: "culture_uk_drama", // 데이터에 따라 UK 혹은 GB로 맞춰주세요
  JP: "culture_jp_drama",
  CN: "culture_cn_drama",
};

// 장르 ID(숫자) -> badgeId 매핑 생성
export const GENRE_ID_TO_BADGE_ID: Record<string, string[]> = {};

export const getNewlyEarnedBadges = (
    currentBadges: BadgeList,
    genreStats: Record<string, number>,
    countryStats: Record<string, number>
): BadgeList => {
    const updatedEarnedBadges = [...currentBadges.earnedBadges];
    let newEquipped = currentBadges.equippedBadges;

    const processBadge = (badgeId: string, count: number, total: number) => {
        const existing = updatedEarnedBadges.find((b) => b.id === badgeId);
        if (existing) {
        existing.progress = count;
        existing.isComplete = count >= total;
        } else if (count >= total) {
        updatedEarnedBadges.push({ id: badgeId, progress: count, isComplete: true });
        if (!newEquipped) newEquipped = badgeId;
        }
    };

    // 1. 장르 뱃지: genreStats의 모든 키를 순회하며 매핑 확인
    Object.entries(genreStats).forEach(([id, count]) => {

    // 초기화 로직 수정
    if (filters && filters.genre) {
        filters.genre.forEach((g) => {
            const ids = [
                ...(g.query?.with_genres?.split(",") || []),
                ...(g.tvQuery?.with_genres?.split(",") || []),
            ];
            
            ids.forEach((id) => {
                const trimmedId = id.trim();
                if (trimmedId) {
                    // 배열이 없으면 초기화 후 push
                    if (!GENRE_ID_TO_BADGE_ID[trimmedId]) {
                        GENRE_ID_TO_BADGE_ID[trimmedId] = [];
                    }
                    GENRE_ID_TO_BADGE_ID[trimmedId].push(`genre_${g.id}`);
                }
            });
        });
    }
    // 배열로 받아옴
    const badgeIds = GENRE_ID_TO_BADGE_ID[id] || [];

    badgeIds.forEach((badgeId) => {
        const config = BADGE_LIST.find(b => b.id === badgeId);
        if (config) {
        processBadge(badgeId, count, config.total);
        }
    });
    });

    // 1. 일반 뱃지 처리 (첫 스트리밍)
    if (!updatedEarnedBadges.some(b => b.id === "first_streaming")) {
        processBadge("first_streaming", 1, 1);
    }

    // 2. 국가 뱃지: countryStats의 모든 키를 순회
    Object.entries(countryStats).forEach(([code, count]) => {
        const badgeId = COUNTRY_CODE_TO_BADGE_ID[code];
        if (badgeId) {
        const config = BADGE_LIST.find(b => b.id === badgeId);
        if (config) processBadge(badgeId, count, config.total);
        }
    });

    return { earnedBadges: updatedEarnedBadges, equippedBadges: newEquipped };
};

export const getPlaylistCreatedBadge = (
  currentBadges: BadgeList, 
  isShare: boolean
): BadgeList => {
  const updatedEarnedBadges = [...currentBadges.earnedBadges];
  let newEquipped = currentBadges.equippedBadges;

  // 1. 플레이리스트 제작자 뱃지 (공유 여부 상관없음)
  if (!updatedEarnedBadges.some(b => b.id === "social_playlist_creator")) {
    updatedEarnedBadges.push({
      id: "social_playlist_creator",
      progress: 1,
      isComplete: true
    });
    if (!newEquipped) newEquipped = "social_playlist_creator";
  }

  // 2. 취향 공유러 뱃지 (공유 시에만)
  if (isShare && !updatedEarnedBadges.some(b => b.id === "social_taste_sharer")) {
    updatedEarnedBadges.push({
      id: "social_taste_sharer",
      progress: 1,
      isComplete: true
    });
    // 이미 제작자 뱃지가 장착되었다면 유지하고, 아니면 공유러 뱃지로 설정
    if (!newEquipped) newEquipped = "social_taste_sharer";
  }

  return {
    earnedBadges: updatedEarnedBadges,
    equippedBadges: newEquipped
  };
};

export const usePlayListStore = create<PlayListState>((set, get) => ({
    playList: [],
    playHist: [],
    myList: [],
    customPlaylists: [],
    currentPlaylist: null,
    onAddPlayList: async (item) => {
        try {
            const authState = useAuthStore.getState();
            const userId = authState.user?.userId;
            const currentProfile = authState.currentProfile;
            if (!userId || !currentProfile) return false;

            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) return false;

            const userData = userDocSnap.data();
            const profiles = userData.profile || [];
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            if (profileIndex === -1) return false;

            // 1. 필요한 데이터 생성
            const playItem = makePlayListItem(item);
            const itemKey = `${playItem.mediaType}-${playItem.id}`;

            // 2. 프로필 복사본 및 통계 업데이트
            const updatedProfiles = [...profiles];
            const targetProfile = { ...updatedProfiles[profileIndex] };
            
            // 기존 통계 데이터 가져오기
            const movies = targetProfile.movies || { 
                genreStats: {}, 
                countryStats: {}, 
                watchingVideos: [], 
                histMovies: [] 
            };

            // 1. 통계 데이터 정규화 (string으로 통일)
            const genreIds = item.genres?.map((g: any) => String(g.id).trim()) || [];
            const countryCodes = item.origin_country || [];

            // 2. 통계 업데이트 (새로운 객체 생성 보장)
            const newGenreStats = countStats({ ...movies.genreStats }, genreIds);
            const newCountryStats = countStats({ ...movies.countryStats }, countryCodes);

            // 3. 뱃지 로직 실행 (최신 stats 전달)
            const updatedBadgeList = getNewlyEarnedBadges(
                targetProfile.badges || { earnedBadges: [], equippedBadges: "" },
                newGenreStats,
                newCountryStats
            );

            // 업데이트된 뱃지 리스트 반영
            targetProfile.badges = updatedBadgeList;

            // --- watchingVideos & histMovies 처리 ---
            const newWatchingVideos = putLatestFirst(movies.watchingVideos || [], playItem);
            const newHistMovies = [itemKey, ...(movies.histMovies || []).filter((k: string) => k !== itemKey)].slice(0, 50);

            // 3. 데이터 구조 반영
            targetProfile.movies = {
                ...movies,
                watchingVideos: newWatchingVideos,
                histMovies: newHistMovies,
                genreStats: newGenreStats,
                countryStats: newCountryStats
            };

            updatedProfiles[profileIndex] = targetProfile;
            await updateDoc(userDocRef, { profile: updatedProfiles });

            // 4. 상태 동시 업데이트
            set({ 
                playList: newWatchingVideos,
                playHist: newHistMovies 
            });
            
            return true;
        } catch (err) {
            console.error("데이터 저장 실패:", err);
            return false;
        }
    },
    onRemovePlayList: async (id: number) => {
        try {
            const authState = useAuthStore.getState();
            const userId = authState.user?.userId;
            const currentProfile = authState.currentProfile;
            if (!userId || !currentProfile) return false;

            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) return false;

            const profiles = userDocSnap.data().profile;
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            
            const updatedProfiles = [...profiles];
            const targetProfile = { ...updatedProfiles[profileIndex] };
            
            // ID가 일치하지 않는 것들만 필터링
            const nextList = (targetProfile.movies?.watchingVideos || []).filter((p: any) => p.id !== id);

            targetProfile.movies = { ...targetProfile.movies, watchingVideos: nextList };
            updatedProfiles[profileIndex] = targetProfile;

            await updateDoc(userDocRef, { profile: updatedProfiles });
            set({ playList: nextList });
            return true;
        } catch (err) {
            console.error("삭제 실패:", err);
            return false;
        }
    },
    onRemovePlayHist: async (id, type) => {
        try {
            const itemKey = `${type}-${id}`;
            const authState = useAuthStore.getState();
            const userId = authState.user?.userId;
            const currentProfile = authState.currentProfile;
            if (!userId || !currentProfile) return false;

            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) return false;

            const profiles = userDocSnap.data().profile;
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            
            const updatedProfiles = [...profiles];
            const targetProfile = { ...updatedProfiles[profileIndex] };
            
            // ID가 일치하지 않는 것들만 필터링
            const nextList = (targetProfile.movies?.watchingVideos || []).filter((p: any) => p.id !== id);
            const newHistMovies = (targetProfile.movies.histMovies || []).filter((k: any) => k !== itemKey).slice(0, 50);

            targetProfile.movies = { ...targetProfile.movies, watchingVideos: nextList, histMovies: newHistMovies };
            updatedProfiles[profileIndex] = targetProfile;

            await updateDoc(userDocRef, { profile: updatedProfiles });
            set({ playList: nextList, playHist: newHistMovies });
            return true;
        } catch (err) {
            console.error("삭제 실패:", err);
            return false;
        }
    },
    onLoadPlayList: async () => {
        const authState = useAuthStore.getState();
        const userId = authState.user?.userId;
        const currentProfile = authState.currentProfile;

        if (!userId || !currentProfile) {
            set({ playList: [] });
            return;
        }

        try {
            const userDocSnap = await getDoc(doc(db, "users", userId));
            if (!userDocSnap.exists()) return set({ playList: [] });

            const profiles = userDocSnap.data()?.profile || [];
            const targetProfile = profiles.find((p: any) => p.id === currentProfile.id);
            
            // 저장된 객체 배열을 그대로 가져옴
            set({ 
                playList: targetProfile?.movies?.watchingVideos ?? [],
                playHist: targetProfile?.movies?.histMovies ?? []
            });
        } catch (err) {
            console.error("데이터 로드 실패:", err);
            set({ playList: [] });
        }
    },
    fetchMyCustomPlaylists: async () => {
        const { user, currentProfile } = useAuthStore.getState();
        if (!user?.userId || !currentProfile) return;

        try {
            const docRef = doc(db, "playlists", user.userId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const allPlaylists = docSnap.data().playlists || [];
                // 현재 프로필의 데이터만 필터링하여 상태에 저장
                const myPlaylists = allPlaylists.filter((p: any) => p.profileId === currentProfile.id);
                set({ customPlaylists: myPlaylists });
            }
        } catch (error) {
            console.error("로딩 실패:", error);
        }
    },
    createMyCustomPlaylist: async (data) => {
        const { user, currentProfile } = useAuthStore.getState();
        if (!user?.userId || !currentProfile) {
            throw new Error("로그인 또는 프로필 정보가 없습니다.");
        }

        try {
            const userDocRef = doc(db, "users", user.userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                throw new Error("사용자 정보를 찾을 수 없습니다.");
            }

            const userData = userDocSnap.data();
            const profiles = userData.profile || [];
            const profileIndex = profiles.findIndex((p:any) => p.id === currentProfile.id);
            if (profileIndex === -1) {
                throw new Error("현재 프로필 정보를 찾을 수 없습니다.");
            }

            // 1. 프로필 복사본 생성
            const updatedProfiles = [...profiles];
            const targetProfile = { ...updatedProfiles[profileIndex] };

            // 2. 플레이리스트 생성 데이터
            const newPlaylist = {
                ...data,
                listId: crypto.randomUUID(),
                profileId: currentProfile.id,
                createdAt: new Date().toISOString(),
            };

            // 3. 뱃지 업데이트 적용
            const updatedBadgeList = getPlaylistCreatedBadge(
                targetProfile.badges || { earnedBadges: [], equippedBadges: "" },
                data.isShare === true
            );
            targetProfile.badges = updatedBadgeList;

            // 4. Firebase 업데이트 (프로필 정보 전체 저장)
            updatedProfiles[profileIndex] = targetProfile;
            
            // 플레이리스트를 따로 저장하는 로직 + 프로필 뱃지 업데이트를 동시에 진행
            await updateDoc(userDocRef, { profile: updatedProfiles });

            // 기존처럼 playlists 컬렉션에도 추가
            const playlistDocRef = doc(db, "playlists", user.userId);
            await setDoc(playlistDocRef, { playlists: arrayUnion(newPlaylist) }, { merge: true });

            // 5. 로컬 상태 업데이트
            set((state) => ({ 
                customPlaylists: [newPlaylist, ...state.customPlaylists] 
            }));

            useAuthStore.getState().onInitAuth();

        } catch (error) {
            console.error("생성 실패:", error);
            throw error;
        }
    },
    updateCustomPlaylist: async (listId, updatedData) => {
        const { user, currentProfile } = useAuthStore.getState();
        if (!user?.userId || !currentProfile) {
            throw new Error("로그인 또는 프로필 정보가 없습니다.");
        }

        try {
            const docRef = doc(db, "playlists", user.userId);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                throw new Error("플레이리스트 정보를 찾을 수 없습니다.");
            }

            const allPlaylists = docSnap.data().playlists || [];
            if (!allPlaylists.some((p: any) => p.listId === listId)) {
                throw new Error("수정할 플레이리스트를 찾을 수 없습니다.");
            }
            const nextPlaylists = allPlaylists.map((p: any) => 
                p.listId === listId ? { ...p, ...updatedData } : p
            );

            await updateDoc(docRef, { playlists: nextPlaylists });
            
            // 상태 업데이트 (현재 프로필 것만 필터링)
            set({ customPlaylists: nextPlaylists.filter((p: any) => p.profileId === currentProfile.id) });
        } catch (error) {
            console.error("업데이트 실패:", error);
            throw error;
        }
    },
    deleteCustomPlaylist: async (listId: string) => {
        const { user, currentProfile } = useAuthStore.getState();
        if (!user?.userId || !currentProfile) {
            throw new Error("로그인 또는 프로필 정보가 없습니다.");
        }

        try {
            const docRef = doc(db, "playlists", user.userId);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                throw new Error("플레이리스트 정보를 찾을 수 없습니다.");
            }

            const allPlaylists = docSnap.data().playlists || [];
            if (!allPlaylists.some((p: any) => p.listId === listId)) {
                throw new Error("삭제할 플레이리스트를 찾을 수 없습니다.");
            }
            const nextPlaylists = allPlaylists.filter((p: any) => p.listId !== listId);

            await updateDoc(docRef, { playlists: nextPlaylists });
            
            set({ customPlaylists: nextPlaylists.filter((p: any) => p.profileId === currentProfile.id) });
        } catch (error) {
            console.error("삭제 실패:", error);
            throw error;
        }
    },
    onAddMyList: async (item) => {
        try {
            const authState = useAuthStore.getState();
            const userId = authState.user?.userId;
            const currentProfile = authState.currentProfile;

            if (!userId || !currentProfile) return false;

            const userDocRef = doc(db, "users", userId);
            
            // 1. 현재 파이어스토어의 전체 유저 문서를 가져옵니다.
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) return false;

            const userData = userDocSnap.data();
            const profiles = userData.profile || [];

            // 2. 현재 프로필의 인덱스를 찾습니다.
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            if (profileIndex === -1) return false;

            // 3. 기존 프로필 데이터는 그대로 유지하고, movies.playlist.playlistVideos만 업데이트합니다.
            const itemKey = getItemKey(makePlayListItem(item));
            
            // 기존 배열에 안전하게 값을 추가
            const updatedProfiles = [...profiles];
            const targetProfile = { ...updatedProfiles[profileIndex] }; // 프로필 복사
            
            // movies와 playlist 객체가 없을 경우를 대비해 구조 보존
            targetProfile.movies = {
                ...targetProfile.movies,
                playlist: {
                    ...targetProfile.movies?.playlist,
                    playlistVideos: [
                        ...(targetProfile.movies?.playlist?.playlistVideos || []),
                        itemKey
                    ]
                }
            };

            updatedProfiles[profileIndex] = targetProfile;

            // 4. 전체 프로필 배열을 업데이트
            await updateDoc(userDocRef, {
                profile: updatedProfiles
            });

            set({ myList: targetProfile.movies?.playlist?.playlistVideos });

            // console.log("프로필 데이터 보존하며 성공적으로 업데이트");
            return true;
        } catch (err) {
            console.error("업데이트 실패:", err);
            return false;
        }
    },
    onRemoveMyList: async (id, mediaType) => {
        try {
            const authState = useAuthStore.getState();
            const userId = authState.user?.userId;
            const currentProfile = authState.currentProfile;

            if (!userId || !currentProfile) return false;

            const userDocRef = doc(db, "users", userId);
            const itemKey = getKeyFromParts(id, mediaType);

            // 1. 파이어스토어에서 현재 유저 데이터 전체를 가져옵니다. (데이터 보존을 위해 필수)
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) return false;
            
            const userData = userDocSnap.data();
            const profiles = userData.profile || [];

            // 2. 현재 프로필의 인덱스를 찾습니다.
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            if (profileIndex === -1) return false;

            // 3. 기존 프로필 배열 복사 및 해당 프로필의 playlistVideos만 수정
            const updatedProfiles = [...profiles];
            const targetProfile = { ...updatedProfiles[profileIndex] };

            // 기존 배열에서 해당 itemKey만 제거
            const currentVideos = targetProfile.movies?.playlist?.playlistVideos || [];
            targetProfile.movies = {
                ...targetProfile.movies,
                playlist: {
                    ...targetProfile.movies?.playlist,
                    playlistVideos: currentVideos.filter((key: string) => key !== itemKey)
                }
            };

            updatedProfiles[profileIndex] = targetProfile;

            // 4. 전체 프로필 배열을 업데이트 (데이터가 사라지지 않도록 전체 배열을 다시 저장)
            await updateDoc(userDocRef, {
                profile: updatedProfiles
            });

            // 5. 로컬 상태(Zustand) 업데이트 (객체 형태 유지)
            set((state) => ({
                myList: state.myList.filter((item) => item !== itemKey)
            }));

            // console.log("기존 프로필 정보 보존하며 삭제 완료");
            return true;
        } catch (err) {
            console.error("삭제 실패:", err);
            return false;
        }
    },
    onLoadMyList: async () => {
        try {
            const { user, currentProfile } = useAuthStore.getState();
            if (!user?.userId || !currentProfile) {
                set({ myList: [] }); // 비로그인 시 빈 배열
                return;
            }

            const userDocRef = doc(db, "users", user.userId);
            const snap = await getDoc(userDocRef);
            
            if (snap.exists()) {
                const userData = snap.data();
                const profile = userData.profile.find((p: any) => p.id === currentProfile.id);
                const keys = profile?.movies?.playlist?.playlistVideos || [];
                
                set({ myList: keys });
            }
        } catch (err) {
            console.error("Load failed:", err);
            set({ myList: [] }); // 에러 시 초기화
        }
    },
    onUpdateProgress: async (id, mediaType, progress, episodeNumber) => {
        // 즉시 Zustand 인메모리 업데이트 (UI 즉각 반영)
        set((state) => ({
            playList: state.playList.map((item) =>
                item.id === id && item.mediaType === mediaType
                    ? { ...item, progress, ...(episodeNumber != null ? { lastEpisodeNumber: episodeNumber } : {}) }
                    : item
            ),
        }));

        const authState = useAuthStore.getState();
        const userId = authState.user?.userId;
        const currentProfile = authState.currentProfile;
        if (!userId || !currentProfile) return;

        try {
            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) return;

            const profiles = userDocSnap.data().profile;
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            const targetProfile = { ...profiles[profileIndex] };

            // 1. progress 업데이트 또는 100% 시 삭제 필터링
            let updatedList = (targetProfile.movies?.watchingVideos || []).map((item: any) =>
                item.id === id && item.mediaType === mediaType
                    ? { ...item, progress, ...(episodeNumber != null ? { lastEpisodeNumber: episodeNumber } : {}) }
                    : item
            );

            if (progress >= 100) {
                updatedList = updatedList.filter((item: any) => !(item.id === id && item.mediaType === mediaType));
            }

            // 2. 프로필 업데이트
            targetProfile.movies = { ...targetProfile.movies, watchingVideos: updatedList };
            const updatedProfiles = [...profiles];
            updatedProfiles[profileIndex] = targetProfile;

            await updateDoc(userDocRef, { profile: updatedProfiles });
            set({ playList: updatedList });
        } catch (err) {
            console.error("Progress 업데이트 및 자동 삭제 실패:", err);
        }
    },
    onUpdateEpisodeProgress: async (id, mediaType, episodeId, progress, episodeNumber) => {
        // 1. Zustand 상태 업데이트
        const updated = get().playList.map((item) =>
            item.id === id && item.mediaType === mediaType
                ? {
                    ...item,
                    episodeProgress: { ...(item.episodeProgress ?? {}), [episodeId]: progress },
                    // 마지막 시청 회차 번호 기록 (시청중 섹션 표시용)
                    ...(episodeNumber != null ? { lastEpisodeNumber: episodeNumber } : {}),
                }
                : item
        );
        set({ playList: updated });

        // 2. Firestore 동기화
        const authState = useAuthStore.getState();
        const userId = authState.user?.userId;
        const currentProfile = authState.currentProfile;
        if (!userId || !currentProfile) return;

        try {
            const userDocRef = doc(db, "users", userId);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) return;

            const profiles = userDoc.data().profile;
            const profileIndex = profiles.findIndex((p: any) => p.id === currentProfile.id);
            
            const updatedProfiles = [...profiles];
            updatedProfiles[profileIndex].movies.watchingVideos = updated;

            await updateDoc(userDocRef, { profile: updatedProfiles });
        } catch (err) {
            console.error("Episode Progress Firestore 동기화 실패:", err);
        }
    },
    fetchPlaylist: async (userId, listId) => {
        try {
            const fetchMedia = useMovieStore.getState().fetchMediaDetail;

            // 더미(추천하는 플레이리스트)면 로컬 데이터에서 찾고, 아니면 Firestore에서 조회
            let foundList: any = null;
            if (userId.startsWith("dummy")) {
                foundList = dummyPlaylists.find((p) => p.listId === listId) ?? null;
            } else {
                const docRef = doc(db, "playlists", userId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    foundList = docSnap.data().playlists?.find((p: any) => p.listId === listId) ?? null;
                }
            }

            if (foundList && foundList.videoIds) {
                // 모든 상세 정보를 한 번에 병렬로 가져옴
                const detailedItems = await Promise.all(
                foundList.videoIds.map(async (item: string) => {
                    const [mediaType, id] = item.split("-");
                    const data = await fetchMedia(id, mediaType as "movie" | "tv");
                    return {
                        id: Number(id),
                        mediaType: mediaType as "movie" | "tv",
                        title: data?.title || data?.name || "제목 없음",
                        poster_path: data?.poster_path ?? "",
                        backdrop_path: data?.backdrop_path ?? "",
                        genre_ids: data?.genre_ids ?? [],
                        overview: data?.overview ?? "",
                        vote_average: data?.vote_average ?? 0,
                        release_date: data?.release_date,
                        first_air_date: data?.first_air_date
                    };
                })
                );
                set({ currentPlaylist: { ...foundList, items: detailedItems } });
            }
        } catch (err) {
            console.error("데이터 로드 실패:", err);
        }
    },

    togglePlaylistLike: async (ownerUserId, listId) => {
        const myUserId = useAuthStore.getState().user?.userId ?? auth.currentUser?.uid;
        if (!myUserId) return;

        // 더미 플레이리스트는 Firestore 문서가 없으므로 로컬 상태만 토글
        if (ownerUserId.startsWith("dummy")) {
            set((state) => {
                if (!state.currentPlaylist) return {} as any;
                const likedBy: string[] = (state.currentPlaylist as any).likedBy ?? [];
                const has = likedBy.includes(myUserId);
                const next = has ? likedBy.filter((id) => id !== myUserId) : [...likedBy, myUserId];
                return {
                    currentPlaylist: { ...state.currentPlaylist, likedBy: next, likesCount: next.length },
                };
            });
            return;
        }

        try {
            const docRef = doc(db, "playlists", ownerUserId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;

            const all = snap.data().playlists ?? [];
            let updatedLikedBy: string[] = [];
            const nextPlaylists = all.map((p: any) => {
                if (p.listId !== listId) return p;
                const likedBy: string[] = p.likedBy ?? [];
                const has = likedBy.includes(myUserId);
                updatedLikedBy = has
                    ? likedBy.filter((id: string) => id !== myUserId)
                    : [...likedBy, myUserId];
                return { ...p, likedBy: updatedLikedBy, likesCount: updatedLikedBy.length };
            });

            await updateDoc(docRef, { playlists: nextPlaylists });

            set((state) =>
                state.currentPlaylist
                    ? {
                          currentPlaylist: {
                              ...state.currentPlaylist,
                              likedBy: updatedLikedBy,
                              likesCount: updatedLikedBy.length,
                          },
                      }
                    : ({} as any),
            );
        } catch (e) {
            console.error("좋아요 저장 실패:", e);
        }
    },
}));
