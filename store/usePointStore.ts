"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { db } from "@/firebase/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useAuthStore } from "@/store/useAuthStore";
import { earnedBadgePoints } from "@/data/badge";

function uid(): string | null {
  const u = useAuthStore.getState().user;
  return u?.userId ?? (u as { uid?: string } | null)?.uid ?? null;
}

interface PointState {
  usedPoints: number;
  usedLoaded: boolean;
  gamePoints: number;       // 게임으로 적립한 누적 포인트 (Firestore: gamePoints)
  gamePointsLoaded: boolean;
  loadUsed: () => Promise<void>;
  bumpUsed: (delta: number) => void;
  addGamePoints: (delta: number) => Promise<void>;
}

export const usePointStore = create<PointState>((set, get) => ({
  usedPoints: 0,
  usedLoaded: false,
  gamePoints: 0,
  gamePointsLoaded: false,

  loadUsed: async () => {
    const userId = uid(); // 현재 로그인한 유저의 ID
    const currentProfile = useAuthStore.getState().currentProfile;
    const profileId = currentProfile?.id;
    if (!userId || !profileId) {
      set({ usedPoints: 0, usedLoaded: true, gamePoints: 0, gamePointsLoaded: true });
      return;
    }
    
    try {
      // 1. users 컬렉션에서 해당 유저의 문서 전체를 가져옴
      const userDocRef = doc(db, "users", userId);
      const snap = await getDoc(userDocRef);
      
      if (snap.exists()) {
        const userData = snap.data();
        // 2. profile 배열에서 현재 profileId와 일치하는 항목을 찾음
        const profile = userData.profile?.find((p: any) => p.id === profileId);
        
        // 3. 찾은 프로필 내부에서 데이터 추출
        // 구조: profile -> payment -> pointsUsed / gamePoints
        const used = Number(profile?.pointsUsed ?? 0);
        const game = Number(profile?.gamePoints ?? 0);

        set({
          usedPoints: Number.isFinite(used) ? used : 0,
          usedLoaded: true,
          gamePoints: Number.isFinite(game) ? game : 0,
          gamePointsLoaded: true,
        });
      } else {
        throw new Error("User document not found");
      }
    } catch (e) {
      console.error("[point] 포인트 불러오기 실패:", e);
      set({ usedPoints: 0, usedLoaded: true, gamePoints: 0, gamePointsLoaded: true });
    }
  },
  // loadUsed: async () => {
  //   const id = uid();
  //   if (!id) {
  //     set({ usedPoints: 0, usedLoaded: true, gamePoints: 0, gamePointsLoaded: true });
  //     return;
  //   }
  //   try {
  //     const snap = await getDoc(doc(db, "users", id));
  //     const used = snap.exists() ? Number(snap.data().pointsUsed ?? 0) : 0;
  //     const game = snap.exists() ? Number(snap.data().gamePoints ?? 0) : 0;
  //     set({
  //       usedPoints: Number.isFinite(used) ? used : 0,
  //       usedLoaded: true,
  //       gamePoints: Number.isFinite(game) ? game : 0,
  //       gamePointsLoaded: true,
  //     });
  //   } catch (e) {
  //     console.error("[point] 포인트 불러오기 실패:", e);
  //     set({ usedPoints: 0, usedLoaded: true, gamePoints: 0, gamePointsLoaded: true });
  //   }
  // },

  bumpUsed: (delta) => set({ usedPoints: Math.max(0, get().usedPoints + delta) }),

  addGamePoints: async (delta) => {
    if (delta <= 0) return;
    
    const userId = uid();
    const currentProfile = useAuthStore.getState().currentProfile;
    const profileId = currentProfile?.id;
    
    // 상태(Zustand)는 즉시 업데이트
    const next = get().gamePoints + delta;
    set({ gamePoints: next });
    
    if (!userId || !profileId) return;

    try {
      const userRef = doc(db, "users", userId);
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        const userData = snap.data();
        const profiles = userData.profile || [];

        // 1. 프로필 배열에서 해당 ID를 찾아 gamePoints 업데이트
        const updatedProfiles = profiles.map((p: any) =>
          p.id === profileId
            ? { ...p, gamePoints: (p.gamePoints || 0) + delta }
            : p
        );

        // 2. Firestore에 반영
        await updateDoc(userRef, { profile: updatedProfiles });
      }
    } catch (e) {
      console.error("[point] 게임 포인트 저장 실패:", e);
      // 에러 시 상태를 다시 원복하고 싶다면 여기서 처리 가능
    }
  },
}));

// 적립(뱃지 + 게임) − 사용 = 보유 포인트
export function useAvailablePoints() {
  const currentProfile = useAuthStore((s) => s.currentProfile);
  const { usedPoints, usedLoaded, gamePoints, loadUsed } = usePointStore();

  useEffect(() => {
    if (!usedLoaded) loadUsed();
  }, [usedLoaded, loadUsed]);

  const badgeEarned = earnedBadgePoints(currentProfile?.badges?.earnedBadges);
  const earned = badgeEarned + gamePoints;
  const available = Math.max(0, earned - usedPoints);
  return { earned, used: usedPoints, available, loaded: usedLoaded };
}
