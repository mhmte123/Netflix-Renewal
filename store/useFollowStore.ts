import { create } from "zustand";
import { auth, db } from "@/firebase/firebase";
import { collection, doc, getDoc, getDocs, limit, query, updateDoc } from "firebase/firestore";
import { useAuthStore } from "./useAuthStore";
import { dummyPlaylists } from "@/data/dummyPlaylist";
import { BadgeList } from "@/types/auth";
import { GENRE_SLUG_META } from "@/data/excludedGenres";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

export interface FollowUser {
  userId: string;
  profileId?: number;
  nickname: string;
  imgUrl: string;
  badge?: string; // 장착 뱃지(대표 칭호) ID
}

export interface FollowingPlaylist {
  userId: string;
  nickname: string;
  category?: string;
  posters: string[];
}

export interface SimilarUser {
  userId: string;
  nickname: string;
  badge: string;
  imgUrl: string;
  matchRate: number;
  followersCount: number;
  tags: string[];
  genreStats: Record<string, number>;
  favoriteMovie: {
    title: string;
    poster: string;
    description: string;
  };
}

interface FollowState {
  followingUsers: FollowUser[];
  followingPlaylists: FollowingPlaylist[];
  followingUserCards: SimilarUser[];
  similarUsers: SimilarUser[];
  isLoadingFollowing: boolean;
  isLoadingSimilar: boolean;
  fetchFollowingUsers: () => Promise<void>;
  fetchSimilarUsers: () => Promise<void>;
  follow: (targetUserId: string) => Promise<void>;
  unfollow: (targetUserId: string) => Promise<void>;
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, normA = 0, normB = 0;
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Firestore에 저장된 미디어 id는 "123", 123, "movie-123", {id, mediaType} 등
 *  형태가 섞여 있을 수 있다. 전부 { id, mediaType? }로 정규화하고,
 *  유효하지 않으면 null을 반환해 "[object Object]" URL 요청을 원천 차단한다. */
type RawMediaId =
  | string
  | number
  | { id?: string | number; mediaType?: string; media_type?: string };

function normalizeMediaId(raw: RawMediaId | null | undefined): { id: string; mediaType?: "movie" | "tv" } | null {
  if (raw == null) return null;
  if (typeof raw === "string" || typeof raw === "number") {
    const s = String(raw).trim();
    const prefixed = s.match(/^(movie|tv)-(\d+)$/);
    if (prefixed) return { id: prefixed[2], mediaType: prefixed[1] as "movie" | "tv" };
    return /^\d+$/.test(s) ? { id: s } : null;
  }
  if (typeof raw === "object") {
    const rawId = (raw as { id?: string | number }).id;
    if (rawId == null) return null;
    const mt = (raw as { mediaType?: string }).mediaType ?? (raw as { media_type?: string }).media_type;
    return { id: String(rawId), mediaType: mt === "movie" || mt === "tv" ? mt : undefined };
  }
  return null;
}

/** TMDB 단건 조회. 타입을 알면 해당 엔드포인트만, 모르면 movie → (실패 시) tv 순차 조회.
 *  기존처럼 movie/tv를 동시에 쏘면 둘 중 하나는 반드시 404라 콘솔이 에러로 뒤덮인다.
 *  동일 id 반복 조회를 막기 위해 세션 단위로 결과(실패 포함)를 캐시한다. */
const tmdbDetailCache = new Map<string, Promise<any | null>>();

async function fetchTmdbDetail(raw: RawMediaId): Promise<any | null> {
  const normalized = normalizeMediaId(raw);
  if (!normalized) return null;
  const { id, mediaType } = normalized;
  const cacheKey = `${mediaType ?? "any"}-${id}`;
  const cached = tmdbDetailCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    const types: Array<"movie" | "tv"> = mediaType ? [mediaType] : ["movie", "tv"];
    for (const type of types) {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&language=ko-KR`,
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.poster_path) return data;
      } catch {
        // 네트워크 오류는 다음 타입으로 폴백
      }
    }
    return null;
  })();

  tmdbDetailCache.set(cacheKey, request);
  return request;
}

async function fetchMediaInfo(rawId: RawMediaId): Promise<{ title: string; poster: string; genres: string[] } | null> {
  const data = await fetchTmdbDetail(rawId);
  if (!data) return null;
  const title = data.title ?? data.name;
  if (!title || !data.poster_path) return null;
  const genres = (data.genres ?? []).slice(0, 4).map((g: any) => g.name as string);
  return { title, poster: `${TMDB_IMG}${data.poster_path}`, genres };
}

const FAVORITE_DESCRIPTIONS = [
  "가장 인상적인 작품",
  "오래 기억에 남은 작품",
  "취향에 맞는 작품",
  "반복해서 본 작품",
  "가장 여운이 남은 작품",
];

async function fetchPoster(rawId: RawMediaId): Promise<string> {
  const data = await fetchTmdbDetail(rawId);
  return data?.poster_path ? `${TMDB_IMG}${data.poster_path}` : "";
}

async function fetchPostersForIds(mediaIds: RawMediaId[]): Promise<string[]> {
  const results = await Promise.all(mediaIds.slice(0, 6).map(fetchPoster));
  return results.filter(Boolean).slice(0, 4);
}

export const getFollowBadge = (currentBadges: BadgeList): BadgeList => {
  const updatedEarnedBadges = [...currentBadges.earnedBadges];
  let newEquipped = currentBadges.equippedBadges;

  // 첫 팔로우 뱃지 체크
  if (!updatedEarnedBadges.some(b => b.id === "social_first_follower")) {
    updatedEarnedBadges.push({
      id: "social_first_follower",
      progress: 1,
      isComplete: true
    });
    if (!newEquipped) newEquipped = "social_first_follower";
  }

  return {
    earnedBadges: updatedEarnedBadges,
    equippedBadges: newEquipped
  };
};

export const useFollowStore = create<FollowState>()((set, get) => ({
  followingUsers: [],
  followingPlaylists: [],
  followingUserCards: [],
  similarUsers: [],
  isLoadingFollowing: true,
  isLoadingSimilar: true,

  fetchSimilarUsers: async () => {
    const { currentProfile } = useAuthStore.getState();
    if (!currentProfile) {
      set({ isLoadingSimilar: false });
      return;
    }

    const myUserId = auth.currentUser?.uid ?? useAuthStore.getState().user?.userId ?? "";

    const myGenreStats: Record<string, number> = currentProfile.movies?.genreStats ?? {};
    const myMoodStats: Record<string, number> = (currentProfile.movies as any)?.moodStats ?? {};
    // 콜드스타트: 시청 이력이 없어도 온보딩 선호 장르로 취향 벡터를 시드
    const favSeed: Record<string, number> = {};
    for (const slug of currentProfile.settings?.favoriteGenres ?? []) {
      const meta = GENRE_SLUG_META[slug];
      if (!meta) continue;
      favSeed[String(meta.movieId)] = (favSeed[String(meta.movieId)] ?? 0) + 3;
      favSeed[String(meta.tvId)] = (favSeed[String(meta.tvId)] ?? 0) + 3;
    }
    const myCombined = { ...favSeed, ...myGenreStats, ...myMoodStats };
    const myVideos: string[] = [
      ...(currentProfile.movies?.watchingVideos ?? []),
      ...(currentProfile.movies?.playlist?.playlistVideos ?? []),
    ];
    const alreadyFollowing = new Set<string>(currentProfile.community?.following ?? []);

    set({ isLoadingSimilar: true });
    try {
      const usersSnap = await getDocs(query(collection(db, "users"), limit(30)));

      const candidates: { userId: string; profile: any; similarity: number }[] = [];

      for (const docSnap of usersSnap.docs) {
        const userId = docSnap.id;
        if (userId === myUserId || alreadyFollowing.has(userId)) continue;

        const theirProfile = docSnap.data().profile?.[0];
        if (!theirProfile) continue;

        const theirGenre: Record<string, number> = theirProfile.movies?.genreStats ?? {};
        const theirMood: Record<string, number> = theirProfile.movies?.moodStats ?? {};
        const theirCombined = { ...theirGenre, ...theirMood };
        const theirVideos: string[] = [
          ...(theirProfile.movies?.watchingVideos ?? []),
          ...(theirProfile.movies?.playlist?.playlistVideos ?? []),
        ];

        const hasStat = Object.keys(myCombined).length > 0 && Object.keys(theirCombined).length > 0;
        const similarity = hasStat
          ? cosineSimilarity(myCombined, theirCombined)
          : jaccardSimilarity(myVideos, theirVideos);

        candidates.push({ userId, profile: theirProfile, similarity });
      }

      candidates.sort((a, b) => b.similarity - a.similarity);
      const top = candidates.slice(0, 8);

      const results = await Promise.all(
        top.map(async ({ userId, profile, similarity }) => {
          const matchRate = Math.round(similarity * 100);

          const videoIds: RawMediaId[] = [
            ...(profile.movies?.watchingVideos ?? []),
            ...(profile.movies?.playlist?.playlistVideos ?? []),
          ];

          let favoriteMovie = { title: "", poster: "", description: "" };
          let tags: string[] = [];
          for (const id of videoIds.slice(0, 5)) {
            const info = await fetchMediaInfo(id);
            if (info) {
              const desc = FAVORITE_DESCRIPTIONS[userId.charCodeAt(0) % FAVORITE_DESCRIPTIONS.length];
              favoriteMovie = { title: info.title, poster: info.poster, description: desc };
              tags = info.genres;
              break;
            }
          }

          return {
            userId,
            badge: profile.badges?.equippedBadges ?? "",
            nickname: profile.nickname ?? "유저",
            imgUrl: profile.imgUrl ?? "",
            matchRate,
            followersCount: profile.community?.followers?.length ?? 0,
            tags,
            genreStats: profile.movies?.genreStats ?? {},
            favoriteMovie,
          } as SimilarUser;
        })
      );

      set({ similarUsers: results });
    } catch (e) {
      console.error("[similarUsers] 오류:", e);
    } finally {
      set({ isLoadingSimilar: false });
    }
  },

  fetchFollowingUsers: async () => {
    const { currentProfile } = useAuthStore.getState();
    if (!currentProfile) {
      set({ isLoadingFollowing: false });
      return;
    }

    const followingIds: string[] = currentProfile.community?.following ?? [];
    if (followingIds.length === 0) {
      set({ followingUsers: [], followingPlaylists: [], isLoadingFollowing: false });
      return;
    }

    set({ isLoadingFollowing: true });

    // 더미 유저(dummy-*)는 Firestore 에 없으므로 로컬 더미 데이터로 유저화해서 합친다
    const dummyIds = followingIds.filter((id) => id.startsWith("dummy"));
    const realIds = followingIds.filter((id) => !id.startsWith("dummy"));
    const findDummy = (id: string) => dummyPlaylists.find((p) => p.userId === id);
    const dummyUsers: FollowUser[] = dummyIds.map((id) => {
      const d = findDummy(id);
      return { userId: id, nickname: d?.nickname ?? "유저", imgUrl: d?.imgUrl ?? "", badge: d?.badge ?? "" };
    });
    const dummyPls = dummyIds.reduce<FollowingPlaylist[]>((acc, id) => {
      const d = findDummy(id);
      if (d) {
        acc.push({ userId: id, nickname: d.nickname, category: d.category, posters: d.posters });
      }
      return acc;
    }, []);
    const dummyCards: SimilarUser[] = dummyIds.map((id) => {
      const d = findDummy(id);
      return {
        userId: id,
        nickname: d?.nickname ?? "유저",
        badge: d?.badge ?? "",
        imgUrl: d?.imgUrl ?? "",
        matchRate: 0,
        followersCount: 0,
        tags: d?.tags ?? [],
        genreStats: d?.genreStats ?? {},
        favoriteMovie: { title: d?.name ?? "", poster: d?.posters?.[0] ?? "", description: d?.content ?? "" },
      };
    });

    try {
      // 1단계: 실제 유저 문서만 병렬 fetch (더미는 위에서 처리)
      const snapshots = await Promise.all(
        realIds.map((userId) => getDoc(doc(db, "users", userId)))
      );

      const validEntries = snapshots
        .map((snap, i) => {
          if (!snap.exists()) return null;
          const firstProfile = snap.data().profile?.[0];
          if (!firstProfile) return null;
          return { userId: realIds[i], firstProfile };
        })
        .filter((e): e is { userId: string; firstProfile: any } => e !== null);

      // 2단계: 더미 + 실제 유저 목록 표시
      const users: FollowUser[] = validEntries.map(({ userId, firstProfile }) => ({
        userId,
        profileId: firstProfile.id,
        nickname: firstProfile.nickname ?? "유저",
        imgUrl: firstProfile.imgUrl ?? "",
        badge: firstProfile.badges?.equippedBadges ?? "",
      }));
      set({ followingUsers: [...dummyUsers, ...users] });

      // 3단계: 플레이리스트 포스터 + 카드용 대표 영화를 병렬로 fetch
      const [playlistResults, cardResults] = await Promise.all([
        Promise.all(
          validEntries.map(async ({ userId, firstProfile }) => {
            const ids: RawMediaId[] =
              firstProfile.movies?.playlist?.playlistVideos?.length
                ? firstProfile.movies.playlist.playlistVideos
                : firstProfile.movies?.watchingVideos ?? [];
            if (ids.length === 0) return null;
            const posters = await fetchPostersForIds(ids);
            if (posters.length === 0) return null;
            return { userId, nickname: firstProfile.nickname ?? "유저", posters };
          })
        ),
        Promise.all(
          validEntries.map(async ({ userId, firstProfile }) => {
            const videoIds: RawMediaId[] = [
              ...(firstProfile.movies?.watchingVideos ?? []),
              ...(firstProfile.movies?.playlist?.playlistVideos ?? []),
            ];

            let favoriteMovie = { title: "", poster: "", description: "" };
            let tags: string[] = [];
            for (const id of videoIds.slice(0, 5)) {
              const info = await fetchMediaInfo(id);
              if (info) {
                const desc = FAVORITE_DESCRIPTIONS[userId.charCodeAt(0) % FAVORITE_DESCRIPTIONS.length];
                favoriteMovie = { title: info.title, poster: info.poster, description: desc };
                tags = info.genres;
                break;
              }
            }

            return {
              userId,
              nickname: firstProfile.nickname ?? "유저",
              imgUrl: firstProfile.imgUrl ?? "",
              matchRate: 0,
              followersCount: firstProfile.community?.followers?.length ?? 0,
              tags,
              genreStats: firstProfile.movies?.genreStats ?? {},
              favoriteMovie,
            } as SimilarUser;
          })
        ),
      ]);

      const playlists = playlistResults.filter(
        (p): p is FollowingPlaylist => p !== null
      );
      set({
        followingPlaylists: [...dummyPls, ...playlists],
        followingUserCards: [...dummyCards, ...cardResults],
      });
    } finally {
      set({ isLoadingFollowing: false });
    }
  },

  follow: async (targetUserId: string) => {
      const { user, currentProfile } = useAuthStore.getState();
      if (!user || !currentProfile) return;

      const myUserId = auth.currentUser?.uid ?? user.userId;
      if (!myUserId) return;
      const myFollowing: string[] = currentProfile.community?.following ?? [];
      if (myFollowing.includes(targetUserId)) return;

      // 1. 팔로우 및 뱃지 데이터 업데이트
      const newFollowing = [...myFollowing, targetUserId];
      const updatedProfiles = user.profile.map((p) => {
          if (p.id === currentProfile.id) {
              // 뱃지 업데이트 적용
              const updatedBadges = getFollowBadge(p.badges || { earnedBadges: [], equippedBadges: "" });
              return { 
                  ...p, 
                  community: { ...p.community, following: newFollowing },
                  badges: updatedBadges 
              };
          }
          return p;
      });

      // 2. DB 업데이트 (팔로잉 정보 + 뱃지 정보 한 번에)
      await updateDoc(doc(db, "users", myUserId), { profile: updatedProfiles });

      // 3. 스토어 상태 갱신
      const updatedProfile = updatedProfiles.find(p => p.id === currentProfile.id);
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, profile: updatedProfiles } : null,
        currentProfile: updatedProfile ?? null
      }));

      // 4. 상대방 팔로워 추가 로직 (기존과 동일)
      try {
        const targetSnap = await getDoc(doc(db, "users", targetUserId));
        if (targetSnap.exists()) {
          const targetData = targetSnap.data();
          const targetProfiles = targetData.profile.map((p: any, idx: number) =>
            idx === 0
              ? { ...p, community: { ...p.community, followers: [...(p.community?.followers ?? []), myUserId] } }
              : p
          );
          await updateDoc(doc(db, "users", targetUserId), { profile: targetProfiles });
        }
      } catch (e) {
        console.error("상대방 팔로워 추가 실패:", e);
      }

      await get().fetchFollowingUsers();
  },

  unfollow: async (targetUserId: string) => {
    const { user, currentProfile } = useAuthStore.getState();
    if (!user || !currentProfile) return;

    const myUserId = auth.currentUser?.uid ?? user.userId;
    if (!myUserId) return;
    const myFollowing: string[] = currentProfile.community?.following ?? [];
    const newFollowing = myFollowing.filter((id) => id !== targetUserId);
    const updatedProfiles = user.profile.map((p) =>
      p.id === currentProfile.id
        ? { ...p, community: { ...p.community, following: newFollowing } }
        : p
    );

    await updateDoc(doc(db, "users", myUserId), { profile: updatedProfiles });

    useAuthStore.setState((state) => ({
      user: state.user ? { ...state.user, profile: updatedProfiles } : null,
      currentProfile: state.currentProfile
        ? { ...state.currentProfile, community: { ...state.currentProfile.community, following: newFollowing } }
        : null,
    }));

    try {
      const targetSnap = await getDoc(doc(db, "users", targetUserId));
      if (targetSnap.exists()) {
        const targetData = targetSnap.data();
        const targetProfiles = targetData.profile.map((p: any, idx: number) =>
          idx === 0
            ? { ...p, community: { ...p.community, followers: (p.community?.followers ?? []).filter((id: string) => id !== myUserId) } }
            : p
        );
        await updateDoc(doc(db, "users", targetUserId), { profile: targetProfiles });
      }
    } catch {
      // 상대방 업데이트 실패해도 내 팔로잉은 유지
    }

    set((state) => ({
      followingUsers: state.followingUsers.filter((u) => u.userId !== targetUserId),
      followingPlaylists: state.followingPlaylists.filter((p) => p.userId !== targetUserId),
    }));
  },
}));
