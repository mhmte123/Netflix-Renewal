import { auth, db, kakaoProvider, naverProvider } from "@/firebase/firebase";
import { showToast } from "@/store/useToastStore";
import {
  AuthState,
  type Profile,
  type ProfileSettings,
  type UserProfile,
  type UserDocument,
  type UserInfo,
} from "@/types/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { create } from "zustand";
import { persist } from "zustand/middleware"; // 💡 persist 미들웨어 임포트

const FALLBACK_PROFILE_IMAGE = "/images/profile/image/default_icons/17.png";
const DEFAULT_PAYMENT = {
  pay: "",
  bank: "",
  num: "",
  payDate: "",
  nextDate: "",
};
let kakaoSdkLoadPromise: Promise<void> | null = null;

const loadKakaoSdk = () => {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Kakao SDK requires a browser."));
  if (window.Kakao) return Promise.resolve();
  if (kakaoSdkLoadPromise) return kakaoSdkLoadPromise;

  kakaoSdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://developers.kakao.com/sdk/js/kakao.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Kakao SDK.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://developers.kakao.com/sdk/js/kakao.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Kakao SDK."));
    document.head.appendChild(script);
  });

  return kakaoSdkLoadPromise;
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  maturityRating: "15+",
  verifiedAdult: false,
  subtitles: {
    size: "medium",
    font: "block",
    shadow: "drop",
    shadowColor: "black",
    background: "black",
    window: "white",
  },
  playback: {
    autoplayNext: true,
    autoplayPreview: true,
  },
  hiddenWatchingVideos: [],
  favoriteGenres: [],
  excludedGenres: [],
  favoriteMoods: [],
  excludedMoods: [],
};

const normalizeMaturityRating = (
  rating?: string | null,
): ProfileSettings["maturityRating"] => {
  if (
    rating === "전체관람가" ||
    rating === "12+" ||
    rating === "15+" ||
    rating === "19+"
  ) {
    return rating;
  }
  return rating === "7+" ? "12+" : DEFAULT_PROFILE_SETTINGS.maturityRating;
};

export const normalizeProfileSettings = (
  settings?: Partial<ProfileSettings> | null,
): ProfileSettings => ({
  maturityRating: normalizeMaturityRating(settings?.maturityRating),
  verifiedAdult: settings?.verifiedAdult ?? false,
  subtitles: {
    ...DEFAULT_PROFILE_SETTINGS.subtitles,
    ...(settings?.subtitles ?? {}),
  },
  playback: {
    ...DEFAULT_PROFILE_SETTINGS.playback,
    ...(settings?.playback ?? {}),
  },
  hiddenWatchingVideos: settings?.hiddenWatchingVideos ?? [],
  favoriteGenres: settings?.favoriteGenres ?? [],
  excludedGenres: settings?.excludedGenres ?? [],
  favoriteMoods: settings?.favoriteMoods ?? [],
  excludedMoods: settings?.excludedMoods ?? [],
});

// 이미지 경로 정규화 함수
const normalizeProfileImage = (imgUrl: string | null | undefined) => {
  if (
    !imgUrl ||
    imgUrl === "/images/profile/normal.svg" ||
    imgUrl === "images/profile/1.png"
  ) {
    return FALLBACK_PROFILE_IMAGE;
  }
  if (imgUrl.startsWith("/images/profile/default_icons/")) {
    return imgUrl.replace(
      "/images/profile/default_icons/",
      "/images/profile/image/default_icons/",
    );
  }
  if (
    imgUrl.startsWith("/images/profile/") &&
    !imgUrl.startsWith("/images/profile/image/")
  ) {
    return imgUrl.replace("/images/profile/", "/images/profile/image/");
  }
  return imgUrl;
};

// 프로필 데이터 내부 이미지 주소 정규화
const normalizeProfile = <T extends Partial<UserProfile>>(
  profile: T,
): T & UserProfile =>
  ({
    ...profile,
    id: profile.id ?? Date.now(),
    nickname: profile.nickname ?? (profile as any).name ?? "프로필",
    imgUrl: normalizeProfileImage(profile.imgUrl),
    viewAge: profile.viewAge ?? "15",
    movies: {
      watchingVideos: profile.movies?.watchingVideos ?? [],
      histMovies: profile.movies?.histMovies ?? [],
      wishlist: profile.movies?.wishlist ?? [],
      playlist: {
        playlistVideos: profile.movies?.playlist?.playlistVideos ?? [],
        customPlaylists: profile.movies?.playlist?.customPlaylists ?? [],
      },
      genreStats: profile.movies?.genreStats ?? {},
      countryStats: profile.movies?.countryStats ?? {},
    },
    community: {
      followers: profile.community?.followers ?? [],
      following: profile.community?.following ?? [],
      reviews: profile.community?.reviews ?? [],
      likedfeeds: profile.community?.likedfeeds ?? [],
      commentfeeds: profile.community?.commentfeeds ?? [],
      reportfeeds: profile.community?.reportfeeds ?? [],
    },
    headerMenus: profile.headerMenus ?? [],
    badges: {
      equippedBadges: profile.badges?.equippedBadges ?? "",
      earnedBadges: profile.badges?.earnedBadges ?? [],
    },
    alarm: profile.alarm ?? [],
    isCommunity: profile.isCommunity ?? true,
    settings: normalizeProfileSettings(profile.settings),
  }) as T & UserProfile;

const normalizeUserDocument = (
  userId: string,
  provider: UserDocument["provider"],
  data: Partial<UserDocument> & Record<string, any>,
): UserDocument => {
  const profiles =
    Array.isArray(data.profile) && data.profile.length > 0
      ? data.profile.map(normalizeProfile)
      : [
        normalizeProfile({
          id: 1,
          nickname: data.displayName ?? data.nickname ?? "프로필",
          imgUrl: FALLBACK_PROFILE_IMAGE,
        }),
      ];

  return {
    ...data,
    userId,
    email: data.email ?? "",
    provider: data.provider ?? provider,
    planType: data.planType ?? "",
    payment: {
      ...DEFAULT_PAYMENT,
      ...(data.payment ?? {}),
    },
    profile: profiles,
  } as UserDocument;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null, // Firestore에서 가져온 순수 데이터
      currentProfile: null, // 현재 선택하여 시청 중인 프로필 (persist가 자동 저장함)
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      // 1. 앱 초기화 및 로그인 상태 실시간 감지 (Fetch)
      onInitAuth: () => {
        return onAuthStateChanged(auth, async (firebaseUser) => {
          if (!firebaseUser) {
            // 💡 카카오/네이버 로그인 유저는 Firebase Auth가 없으므로 건드리지 않음
            const currentUser = get().user;
            if (currentUser?.provider === "kakao" || currentUser?.provider === "naver") {
              return; // 스토어 상태 유지
            }
            set({ user: null, currentProfile: null });
            return;
          }

          // 이메일 인증 가드
          const isEmailProvider =
            firebaseUser.providerData[0]?.providerId === "password";
          if (isEmailProvider && !firebaseUser.emailVerified) {
            set({ user: null, currentProfile: null });
            return;
          }

          try {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              const provider =
                firebaseUser.providerData[0]?.providerId === "google.com"
                  ? "google"
                  : "email";
              const userData = normalizeUserDocument(
                firebaseUser.uid,
                provider,
                userDocSnap.data() as Partial<UserDocument> &
                Record<string, any>,
              );
              await setDoc(userDocRef, userData, { merge: true });

              // 💡 수정: 확실하게 기존에 쓰던 프로필(로컬 영속화 데이터)이 매칭될 때만 유지하고,
              // 아예 첫 로그인이거나 정보가 없으면 null로 비워두어 프로필 선택 화면을 띄우게 만듭니다.
              const existingProfile = get().currentProfile;
              const savedProfile =
                userData.profile?.find((p) => p.id === existingProfile?.id) ||
                null;
              const activeProfile =
                savedProfile || userData.profile?.[0] || null;

              set({
                user: userData,
                currentProfile: activeProfile,
              });
            } else {
              console.warn(
                "Firestore 유저 문서가 없어 기본 문서를 자동으로 생성합니다.",
              );

              const defaultProfile = normalizeProfile({
                id: Date.now(),
                nickname: "나",
                imgUrl: FALLBACK_PROFILE_IMAGE,
                movies: {
                  watchingVideos: [],
                  wishlist: [],
                  playlist: { playlistVideos: [], customPlaylists: [] },
                  genreStats: {},
                  countryStats: {},
                },
                community: {
                  followers: [],
                  following: [],
                  reviews: [],
                  likedfeeds: [],
                  commentfeeds: [],
                  reportfeeds: [],
                },
                badges: { equippedBadges: "", earnedBadges: [] },
              });

              const newUserData = {
                userId: firebaseUser.uid,
                email: firebaseUser.email || "",
                profile: [defaultProfile],
              };

              await setDoc(userDocRef, newUserData);

              set({
                user: newUserData as any,
                currentProfile: get().currentProfile || defaultProfile,
              });
            }
          } catch (error) {
            console.error("유저 정보 로드 중 오류 발생:", error);
            set({ user: null, currentProfile: null });
          }
        });
      },

      // 2. 수동 로그인 혹은 결제 완료 직후 세팅 시 호출
      onLogin: async (firebaseUser) => {
        if (!firebaseUser) return;

        const targetUid = firebaseUser.userId;
        if (!targetUid) return;

        try {
          const userDocRef = doc(db, "users", targetUid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = normalizeUserDocument(
              targetUid,
              "email",
              userDocSnap.data() as Partial<UserDocument> & Record<string, any>,
            );
            await setDoc(userDocRef, userData, { merge: true });

            set({
              user: userData,
              currentProfile: userData.profile?.[0] || null,
            });
          } else {
            const fallbackProfiles =
              (firebaseUser as any).profiles ||
              (firebaseUser as any).profile ||
              [];

            const fixedProfiles =
              fallbackProfiles.length > 0
                ? fallbackProfiles.map((p: any) => ({
                  id: p.id,
                  nickname: p.nickname || "나",
                  imgUrl: p.imgUrl,
                }))
                : [{ id: 1, nickname: "나", imgUrl: FALLBACK_PROFILE_IMAGE }];

            const normalizedFallback = fixedProfiles.map(normalizeProfile);

            set({
              user: {
                uid: targetUid,
                email: firebaseUser.email || "",
                profile: normalizedFallback,
              } as any,
              currentProfile: normalizedFallback[0] || null,
            });
          }
        } catch (error) {
          console.error("onLogin 에러:", error);
        }
      },

      // 카카오 로그인
      onKakaoLogin: async () => {
        try {
          if (auth.currentUser) {
            await signOut(auth);
          }
          await loadKakaoSdk();
          const kakaoKey = kakaoProvider;
          if (!window.Kakao.isInitialized()) {
            window.Kakao.init(kakaoKey);
          }

          const authObj = await new Promise((resolve, reject) => {
            window.Kakao.Auth.login({
              scope: "profile_nickname, profile_image",
              success: resolve,
              fail: reject,
            });
          });

          const res = await window.Kakao.API.request({
            url: "/v2/user/me",
          });

          const uid = res.id.toString();
          const userRef = doc(db, "users", uid);
          const userDoc = await getDoc(userRef);

          // 공통 정규화 로직 적용을 위한 데이터 처리
          if (userDoc.exists()) {
            const userData = normalizeUserDocument(
              uid,
              "kakao",
              userDoc.data() as Partial<UserDocument> & Record<string, any>,
            );
            await setDoc(userRef, userData, { merge: true });

            // onLogin과 동일하게 profile 정규화
            if (userData.profile) {
              userData.profile = userData.profile.map(normalizeProfile);
            }

            // 외부 Kakao 프로필 이미지는 사용하지 않음 — 기존 프로필 이미지는 변경하지 않습니다.
            // Zustand 상태 설정 (onLogin과 동일한 구조)
            set({
              user: userData,
              currentProfile: userData.profile?.[0] || null,
            });
            return { isNewUser: false }; // 👈 기존 유저
          } else {
            // 카카오 정보를 기반으로 기본 프로필 생성
            const newProfile = normalizeProfile({
              id: Date.now(),
              nickname: res.kakao_account.profile?.nickname || "카카오사용자",
              imgUrl: FALLBACK_PROFILE_IMAGE,
              viewAge: "15",
              movies: {
                watchingVideos: [],
                wishlist: [],
                playlist: {
                  playlistVideos: [],
                  customPlaylists: [],
                },
                genreStats: {},
                countryStats: {},
              },
              community: {
                followers: [],
                following: [],
                reviews: [],
                likedfeeds: [],
                commentfeeds: [],
                reportfeeds: [],
              },
              headerMenus: [],
              badges: {
                earnedBadges: [],
                equippedBadges: "",
              },
              alarm: [],
              isCommunity: true,
            });

            const newUser = {
              userId: uid,
              email: res.kakao_account?.email || "",
              provider: "kakao",
              profile: [newProfile], // 정규화된 프로필 배열
              planType: "",
              payment: {
                pay: "",
                bank: "",
                num: "",
                payDate: "",
                nextDate: "",
              },
              createdAt: serverTimestamp(),
            } as UserDocument;

            await setDoc(userRef, newUser);

            // Zustand 상태 설정 (onLogin과 동일)
            set({
              user: newUser,
              currentProfile: newProfile,
            });
            return { isNewUser: true }; // 👈 신규 유저
          }
        } catch (err) {
          console.error("카카오 로그인 중 오류:", err);
          return { isNewUser: false }; // 👈 에러시 안전하게 기존 유저 취급
        }
      },

      // 네이버 로그인 로직 (카카오 로그인 코드와 비슷한 구조)
      onNaverLogin: async () => {
        try {
          if (auth.currentUser) {
            await signOut(auth);
          }
          // 1. 네이버 로그인 팝업 및 토큰 로직 (기존 유지)
          const clientId = naverProvider;
          const currentUrl = window.location.origin;
          const callbackUrl = encodeURIComponent(currentUrl + "/login/naver");
          const state = "random_string";
          const naverLoginUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=token&client_id=${clientId}&redirect_uri=${callbackUrl}&state=${state}`;

          const popup = window.open(
            naverLoginUrl,
            "naverlogin",
            "width=600,height=700",
          );
          const token = await new Promise((resolve, reject) => {
            const handleMessage = (e: MessageEvent) => {
              if (e.origin !== window.location.origin) return;
              window.removeEventListener("message", handleMessage);
              resolve(e.data.token);
            };
            window.addEventListener("message", handleMessage);
          });

          // 2. 사용자 정보 요청
          const res = await fetch("/api/naver", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }), // 서버로 토큰을 전달
          });

          const data = await res.json();
          const userInfo = data.response;
          const uid = `naver_${userInfo.id}`;

          // 3. Firestore 데이터 처리
          const userRef = doc(db, "users", uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = normalizeUserDocument(
              uid,
              "naver",
              userDoc.data() as Partial<UserDocument> & Record<string, any>,
            );
            await setDoc(userRef, userData, { merge: true });

            // 프로필 정규화 적용
            if (userData.profile) {
              userData.profile = userData.profile.map(normalizeProfile);
            }

            // 네이버에서 받아온 최신 프로필 이미지가 있으면 Firestore와 상태를 업데이트
            try {
              const providerImage = userInfo.profile_image;
              if (providerImage) {
                const updatedProfiles =
                  userData.profile && userData.profile.length
                    ? userData.profile.map((p, idx) =>
                      idx === 0 ? { ...p, imgUrl: providerImage } : p,
                    )
                    : [
                      {
                        id: Date.now(),
                        nickname: userInfo.name || "네이버사용자",
                        imgUrl: providerImage,
                      },
                    ];

                await updateDoc(userRef, { profile: updatedProfiles });
                userData.profile = updatedProfiles.map(normalizeProfile);
              }
            } catch (e) {
              console.warn(
                "기존 유저의 프로필 이미지 업데이트 실패 (네이버):",
                e,
              );
            }

            set({
              user: userData,
              currentProfile: userData.profile?.[0] || null,
            });

            return { isNewUser: false }; // 👈 기존 유저
          } else {
            // 신규 사용자: 프로필 정규화 및 기본 데이터 생성
            const newProfile = normalizeProfile({
              id: Date.now(),
              nickname: userInfo.name || "네이버사용자",
              imgUrl: userInfo.profile_image || FALLBACK_PROFILE_IMAGE,
              viewAge: "15",
              movies: {
                watchingVideos: [],
                wishlist: [],
                playlist: {
                  playlistVideos: [],
                  customPlaylists: [],
                },
                genreStats: {},
                countryStats: {},
              },
              community: {
                followers: [],
                following: [],
                reviews: [],
                likedfeeds: [],
                commentfeeds: [],
                reportfeeds: [],
              },
              headerMenus: [],
              badges: {
                earnedBadges: [],
                equippedBadges: "",
              },
              alarm: [],
              isCommunity: true,
            });

            const newUser = {
              userId: uid,
              email: userInfo.email,
              provider: "naver",
              profile: [newProfile],
              planType: "",
              payment: {
                pay: "",
                bank: "",
                num: "",
                payDate: "",
                nextDate: "",
              },
              createdAt: serverTimestamp(),
            } as UserDocument;

            await setDoc(userRef, newUser);

            set({
              user: newUser,
              currentProfile: newProfile,
            });

            return { isNewUser: true }; // 👈 신규 유저
          }
        } catch (err) {
          console.error("네이버 로그인 오류:", err);
          return { isNewUser: false };
        }
      },

      // 3. 프로필 선택 (시청 프로필 전환)
      onSetProfile: (profile) => {
        // 💡 [수정] localStorage 관련 코드가 전부 빠지고 순수 상태만 변경합니다. 미들웨어가 알아서 감지하여 저장합니다.
        set({ currentProfile: profile });
      },

      // 4. 새로운 프로필 추가 (Firestore DB 저장)
      onAddProfile: async (newProfile) => {
        const currentUser = get().user;
        const uid =
          currentUser?.userId ||
          (currentUser as any)?.uid ||
          auth.currentUser?.uid ||
          null;

        if (!uid || !currentUser) return;

        const currentProfiles = currentUser.profile?.length
          ? currentUser.profile
          : [];
        const nextId =
          Math.max(0, ...currentProfiles.map((item) => item.id)) + 1;

        const formattedProfile = normalizeProfile({
          ...newProfile,
          id: nextId,
          movies: {
            watchingVideos: [],
            wishlist: [],
            playlist: { playlistVideos: [], customPlaylists: [] },
            genreStats: {},
            countryStats: {},
          },
          community: {
            followers: [],
            following: [],
            reviews: [],
            likedfeeds: [],
            commentfeeds: [],
            reportfeeds: [],
          },
          badges: { equippedBadges: "", earnedBadges: [] },
        });

        const nextProfiles = [...currentProfiles, formattedProfile];

        try {
          const userDocRef = doc(db, "users", uid);
          await updateDoc(userDocRef, { profile: nextProfiles });
          set({ user: { ...currentUser, profile: nextProfiles } });
        } catch (error) {
          console.error("프로필 추가 실패:", error);
        }
      },

      // 5. 기존 프로필 수정 (Firestore DB 반영)
      onUpdateProfile: async (updatedProfile) => {
        const currentUser = get().user;
        const uid =
          currentUser?.userId ||
          (currentUser as any)?.uid ||
          auth.currentUser?.uid ||
          null;

        if (!uid || !currentUser) return;

        const currentProfiles = currentUser.profile?.length
          ? currentUser.profile
          : [];
        const nextNormalizedProfile = normalizeProfile(updatedProfile);

        const nextProfiles = currentProfiles.map((item) =>
          item.id === updatedProfile.id
            ? { ...item, ...nextNormalizedProfile }
            : item,
        );

        const isCurrentActive = get().currentProfile?.id === updatedProfile.id;
        const nextCurrentProfile = isCurrentActive
          ? { ...get().currentProfile, ...nextNormalizedProfile }
          : get().currentProfile;

        try {
          const userDocRef = doc(db, "users", uid);
          await updateDoc(userDocRef, { profile: nextProfiles });

          set({
            user: { ...currentUser, profile: nextProfiles },
            currentProfile: nextCurrentProfile,
          });
        } catch (error) {
          console.error("프로필 수정 실패:", error);
        }
      },

      // 6. 프로필 삭제 (Firestore DB 반영)
      onDeleteProfile: async (profileId) => {
        const currentUser = get().user;
        const uid =
          currentUser?.userId ||
          (currentUser as any)?.uid ||
          auth.currentUser?.uid ||
          null;

        if (!uid || !currentUser) return;

        const currentProfiles = currentUser.profile?.length
          ? currentUser.profile
          : [];
        if (currentProfiles.length <= 1) {
          showToast("최소 하나의 프로필은 유지해야 합니다.");
          return;
        }

        const targetProfileId = String(profileId);

        if (String(currentProfiles[0]?.id) === targetProfileId) {
          showToast("기본 프로필은 삭제할 수 없습니다.");
          return;
        }

        const nextProfiles = currentProfiles.filter(
          (profile) => String(profile.id) !== targetProfileId,
        );
        const isDeletingCurrent =
          String(get().currentProfile?.id) === targetProfileId;
        const nextCurrentProfile = isDeletingCurrent
          ? null
          : get().currentProfile;

        try {
          const userDocRef = doc(db, "users", uid);
          await updateDoc(userDocRef, { profile: nextProfiles });

          if (typeof window !== "undefined") {
            window.localStorage.removeItem(
              `netflix-profile-pin-${targetProfileId}`,
            );
          }

          set({
            user: { ...currentUser, profile: nextProfiles },
            currentProfile: nextCurrentProfile,
          });
        } catch (error) {
          console.error("프로필 삭제 실패:", error);
        }
      },

      // 7. 로그아웃
      onLogout: async () => {
        try {
          await signOut(auth);
          set({ user: null, currentProfile: null });
        } catch (err) {
          console.error("로그아웃 실패:", err);
        }
      },

      toggleCommunity: async () => {
        const { user, currentProfile } = get();
        if (!user || !currentProfile) return;

        // 1. 상태 반전 (UI 즉시 반영용)
        const newStatus = !currentProfile.isCommunity;

        // 2. Zustand 스토어 업데이트
        set((state) => ({
          user: {
            ...state.user!,
            profile: state.user!.profile.map((p) =>
              p.id === currentProfile.id ? { ...p, isCommunity: newStatus } : p,
            ),
          },
          currentProfile: { ...currentProfile, isCommunity: newStatus },
        }));

        // 3. Firestore 업데이트 (비동기 처리)
        try {
          const userDocRef = doc(db, "users", user.userId || user.userId);
          await updateDoc(userDocRef, {
            profile: get().user?.profile, // 전체 프로필 배열을 업데이트
          });
        } catch (error) {
          console.error("커뮤니티 설정 변경 실패:", error);
          // 에러 발생 시 원상복구 로직 필요하면 추가
        }
      },
      updateUserLike: async (reviewId: string, videoId: string) => {
        const { user, currentProfile } = get();
        if (!user?.userId || !currentProfile) return;

        const reviewKey = `${videoId}#${reviewId}`;
        const userDocRef = doc(db, "users", user.userId);

        try {
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) return;

          const userData = userDocSnap.data() as UserDocument;
          const profileIndex = userData.profile.findIndex(
            (p) => p.id === currentProfile.id,
          );
          if (profileIndex === -1) return;

          const updatedProfiles = [...userData.profile];
          // 인터페이스 구조에 맞춰 필드명 확인 (reviews 또는 likedReviewKeys)
          const targetCommunity = updatedProfiles[profileIndex].community;
          const isLiked = targetCommunity.reviews.includes(reviewKey); // likedReviewKeys 사용 권장

          if (isLiked) {
            targetCommunity.reviews = targetCommunity.reviews.filter(
              (k) => k !== reviewKey,
            );
          } else {
            targetCommunity.reviews.push(reviewKey);
          }

          await updateDoc(userDocRef, { profile: updatedProfiles });

          // 데이터가 업데이트된 후 AuthStore 상태 최신화
          get().onInitAuth();
        } catch (error) {
          console.error("좋아요 토글 실패:", error);
        }
      },
      // 1. 좋아요 피드 토글
      updateUserLikeFeeds: async (feedId: string) => {
        const { user, currentProfile } = get();
        if (!user?.userId || !currentProfile) return;

        const userDocRef = doc(db, "users", user.userId);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) return;

          const userData = userDocSnap.data() as UserDocument;
          const profileIndex = userData.profile.findIndex(
            (p) => p.id === currentProfile.id,
          );
          if (profileIndex === -1) return;

          const updatedProfiles = [...userData.profile];
          const targetCommunity = updatedProfiles[profileIndex].community;

          // 로컬에서 배열 조작
          const currentFeeds = targetCommunity.likedfeeds || [];
          if (currentFeeds.includes(feedId)) {
            targetCommunity.likedfeeds = currentFeeds.filter(
              (id) => id !== feedId,
            );
          } else {
            targetCommunity.likedfeeds = [...currentFeeds, feedId];
          }

          // 전체 배열을 덮어쓰기 (안전한 방식)
          await updateDoc(userDocRef, { profile: updatedProfiles });
          get().onInitAuth();
        } catch (error) {
          console.error("좋아요 피드 업데이트 실패:", error);
        }
      },

      // 2. 댓글 활동 피드 토글
      updateUserCommentFeed: async (feedId: string, commentId: string) => {
        const { user, currentProfile } = get();
        if (!user?.userId || !currentProfile) return;

        const userDocRef = doc(db, "users", user.userId);
        const compositeId = `${feedId}#${commentId}`;

        try {
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) return;

          const userData = userDocSnap.data() as UserDocument;
          const profileIndex = userData.profile.findIndex(
            (p) => p.id === currentProfile.id,
          );
          if (profileIndex === -1) return;

          const updatedProfiles = [...userData.profile];
          const targetCommunity = updatedProfiles[profileIndex].community;

          const currentFeeds = targetCommunity.commentfeeds || [];
          if (currentFeeds.includes(compositeId)) {
            targetCommunity.commentfeeds = currentFeeds.filter(
              (id) => id !== compositeId,
            );
          } else {
            targetCommunity.commentfeeds = [...currentFeeds, compositeId];
          }

          await updateDoc(userDocRef, { profile: updatedProfiles });
          get().onInitAuth();
        } catch (error) {
          console.error("댓글 활동 업데이트 실패:", error);
        }
      },

      // 3. 신고 피드 토글
      updateUserReportFeed: async (feedId: string) => {
        const { user, currentProfile } = get();
        if (!user?.userId || !currentProfile) return;

        const userDocRef = doc(db, "users", user.userId);

        try {
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) return;

          const userData = userDocSnap.data() as UserDocument;
          const profileIndex = userData.profile.findIndex(
            (p) => p.id === currentProfile.id,
          );
          if (profileIndex === -1) return;

          const updatedProfiles = [...userData.profile];
          const targetCommunity = updatedProfiles[profileIndex].community;

          const currentFeeds = targetCommunity.reportfeeds || [];
          if (currentFeeds.includes(feedId)) {
            targetCommunity.reportfeeds = currentFeeds.filter(
              (id) => id !== feedId,
            );
          } else {
            targetCommunity.reportfeeds = [...currentFeeds, feedId];
          }

          await updateDoc(userDocRef, { profile: updatedProfiles });
          get().onInitAuth();
        } catch (error) {
          console.error("신고 피드 업데이트 실패:", error);
        }
      },
      equipBadge: async (badgeId: string) => {
        const { user, currentProfile } = get();
        if (!user || !currentProfile) return;

        const userDocRef = doc(db, "users", user.userId);
        const updatedProfiles = user.profile.map((p: any) =>
          p.id === currentProfile.id
            ? { ...p, badges: { ...p.badges, equippedBadges: badgeId } }
            : p,
        );

        await updateDoc(userDocRef, { profile: updatedProfiles });
        get().onInitAuth();
      },
    }),
    {
      name: "netflix-auth-storage", // 💡 로컬 스토리지에 저장될 Key 이름입니다.

      // 💡 [중요] 전체 스토어 상태 중에서 오직 'currentProfile'만 로컬 스토리지에 저장되도록 필터링합니다.
      // 이렇게 해야 유저 정보가 꼬이거나 불필요한 대용량 데이터가 스토리지에 쌓이지 않습니다.
      partialize: (state) => ({ user: state.user, currentProfile: state.currentProfile }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
