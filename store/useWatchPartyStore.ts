"use client";

import { create } from "zustand";
import { db } from "@/firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  arrayUnion,
  getDocs,
  deleteDoc,
  type Unsubscribe,
} from "firebase/firestore";

export type PartyAccessMode = "open" | "invite";

const OPEN_PARTY_VISIBLE_MS = 3 * 60 * 1000;

export interface PartyDoc {
  partyId: string;
  hostId: string;
  hostActorId?: string;
  hostNickname: string;
  hostProfileId?: number;
  hostImgUrl?: string;
  hostBadge?: string;
  type: "movie" | "tv";
  mediaId: number;
  title: string;
  partyName?: string;
  accessMode?: PartyAccessMode;
  invitedUserIds?: string[];
  invitedProfileIds?: string[];
  partyPassword?: string;
  posterPath?: string;
  backdropPath?: string;
  isPlaying: boolean;
  positionPct: number; // 0~100 (호스트 진행 위치)
  updatedAt: number;
  playbackUpdatedBy?: string;
  participants: string[];
  createdAt: number;
}

export interface PartyMessage {
  id: string;
  userId: string;
  profileId?: number;
  actorId?: string;
  nickname: string;
  badge?: string;
  text: string;
  createdAt: number;
}

interface PartyUser {
  userId: string;
  nickname: string;
  profileId?: number;
  imgUrl?: string;
  badge?: string;
}

interface WatchPartyState {
  partyId: string | null;
  party: PartyDoc | null;
  messages: PartyMessage[];
  isHost: boolean;
  openParties: PartyDoc[];
  invitedParties: PartyDoc[];
  createParty: (args: {
    type: "movie" | "tv";
    mediaId: number;
    title: string;
    posterPath?: string;
    backdropPath?: string;
    host: PartyUser;
    partyName?: string;
    invitedProfileIds?: string[];
    partyPassword?: string;
  }) => Promise<string | null>;
  subscribe: (partyId: string) => void;
  join: (
    partyId: string,
    user: PartyUser,
    partyPassword?: string | null,
  ) => Promise<boolean>;
  updateInvitedProfiles: (
    partyId: string,
    actorIds: string[],
    requester: PartyUser,
  ) => Promise<boolean>;
  verifyPartyPassword: (
    partyId: string,
    partyPassword: string,
  ) => Promise<PartyDoc | null>;
  deleteParty: (
    partyId: string,
    requester: PartyUser,
  ) => Promise<boolean>;
  loadInvitedParties: (userId: string, profileId?: number) => Promise<void>;
  subscribeInvitedParties: (userId: string, profileId?: number) => void;
  unsubscribeInvitedParties: () => void;
  sendMessage: (text: string, user: PartyUser) => Promise<void>;
  updatePlayback: (data: { positionPct: number; isPlaying: boolean; userId?: string }) => Promise<void>;
  updatePlaybackNow: (data: { positionPct: number; isPlaying: boolean; userId?: string }) => Promise<void>;
  subscribeOpenParties: () => void;
  unsubscribeOpenParties: () => void;
  leave: () => void;
}

let unsubParty: Unsubscribe | null = null;
let unsubMessages: Unsubscribe | null = null;
let unsubOpen: Unsubscribe | null = null;
let unsubInvited: Unsubscribe | null = null;
let openPartyExpiryInterval: ReturnType<typeof setInterval> | null = null;
let invitedSubscriptionKey: string | null = null;
let lastPlaybackPush = 0;
let lastNowPush = 0;

function randomCode() {
  return Math.random().toString(36).slice(2, 8);
}

export function getWatchPartyActorId(
  userId: string,
  profileId?: number | null,
) {
  return profileId == null ? userId : `${userId}:${profileId}`;
}

function getActorUserId(actorId: string) {
  return actorId.split(":")[0] ?? actorId;
}

export function isWatchPartyHost(
  party: PartyDoc,
  userId: string,
  profileId?: number | null,
) {
  const actorId = getWatchPartyActorId(userId, profileId);
  const hostActorId =
    party.hostActorId ??
    getWatchPartyActorId(party.hostId, party.hostProfileId);

  return hostActorId === actorId;
}

export function canProfileAccessWatchParty(
  party: PartyDoc,
  userId: string,
  profileId?: number | null,
  partyPassword?: string | null,
) {
  if (party.accessMode !== "invite") return true;
  if (
    partyPassword &&
    partyPassword === party.partyPassword
  ) {
    return true;
  }
  if (isWatchPartyHost(party, userId, profileId)) return true;

  const actorId = getWatchPartyActorId(userId, profileId);
  if (party.invitedProfileIds) {
    return party.invitedProfileIds.includes(actorId);
  }

  // Legacy parties without profile ownership keep their account-level access.
  if (party.hostProfileId == null) {
    return (party.invitedUserIds ?? []).includes(userId);
  }

  return false;
}

function normalizeProfileImage(imgUrl?: string | null) {
  if (!imgUrl) return "";
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
}

async function enrichPartyHost(party: PartyDoc): Promise<PartyDoc> {
  try {
    const userSnap = await getDoc(doc(db, "users", party.hostId));
    if (!userSnap.exists()) return party;

    const profiles = userSnap.data().profile;
    if (!Array.isArray(profiles) || profiles.length === 0) return party;

    const hostProfile =
      party.hostProfileId == null
        ? profiles.find(
            (profile) => profile.nickname === party.hostNickname,
          ) ?? profiles[0]
        : profiles.find(
            (profile) =>
              String(profile.id) === String(party.hostProfileId),
          );
    if (!hostProfile) return party;

    return {
      ...party,
      hostProfileId: hostProfile.id ?? party.hostProfileId,
      hostImgUrl:
        normalizeProfileImage(party.hostImgUrl) ||
        normalizeProfileImage(hostProfile.imgUrl),
      hostBadge:
        party.hostBadge || hostProfile.badges?.equippedBadges || "",
    };
  } catch (error) {
    console.error("[watchParty] host profile load failed:", error);
    return party;
  }
}

export const useWatchPartyStore = create<WatchPartyState>((set, get) => ({
  partyId: null,
  party: null,
  messages: [],
  isHost: false,
  openParties: [],
  invitedParties: [],

  createParty: async ({
    type,
    mediaId,
    title,
    posterPath,
    backdropPath,
    host,
    partyName,
    invitedProfileIds = [],
    partyPassword,
  }) => {
    try {
      const partyId = randomCode();
      const now = Date.now();
      const data: PartyDoc = {
        partyId,
        hostId: host.userId,
        hostActorId: getWatchPartyActorId(host.userId, host.profileId),
        hostNickname: host.nickname,
        hostProfileId: host.profileId,
        hostImgUrl: host.imgUrl ?? "",
        hostBadge: host.badge ?? "",
        type,
        mediaId,
        title,
        partyName: partyName?.trim() || `${title} 같이보기`,
        accessMode: partyPassword ? "invite" : "open",
        invitedUserIds: [
          ...new Set(invitedProfileIds.map(getActorUserId)),
        ],
        invitedProfileIds,
        partyPassword: partyPassword ?? "",
        posterPath: posterPath ?? "",
        backdropPath: backdropPath ?? "",
        isPlaying: true,
        positionPct: 0,
        updatedAt: now,
        participants: [getWatchPartyActorId(host.userId, host.profileId)],
        createdAt: now,
      };
      await setDoc(doc(db, "watchParties", partyId), data);
      return partyId;
    } catch (e) {
      console.error("[watchParty] createParty 실패:", e);
      return null;
    }
  },

  subscribe: (partyId) => {
    // 기존 구독 정리
    get().leave();
    set({ partyId, messages: [] });

    unsubParty = onSnapshot(doc(db, "watchParties", partyId), (snap) => {
      if (!snap.exists()) {
        set({ party: null });
        return;
      }

      const party = snap.data() as PartyDoc;
      void enrichPartyHost(party).then((enrichedParty) => {
        if (get().partyId === partyId) set({ party: enrichedParty });
      });
    });

    unsubMessages = onSnapshot(
      query(collection(db, "watchParties", partyId, "messages"), orderBy("createdAt", "asc")),
      (snap) => {
        const list: PartyMessage[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PartyMessage, "id">),
        }));
        set({ messages: list });
      },
    );
  },

  join: async (partyId, user, partyPassword) => {
    try {
      const partySnap = await getDoc(doc(db, "watchParties", partyId));
      if (!partySnap.exists()) return false;
      const party = partySnap.data() as PartyDoc;
      const canEnter = canProfileAccessWatchParty(
        party,
        user.userId,
        user.profileId,
        partyPassword,
      );
      if (!canEnter) return false;

      try {
        await updateDoc(doc(db, "watchParties", partyId), {
          participants: arrayUnion(
            getWatchPartyActorId(user.userId, user.profileId),
          ),
        });
      } catch (error) {
        console.warn(
          "[watchParty] participant count update skipped:",
          error,
        );
      }
      return true;
    } catch (e) {
      console.error("[watchParty] join 실패:", e);
      return false;
    }
  },

  updateInvitedProfiles: async (partyId, actorIds, requester) => {
    const uniqueActorIds = [...new Set(actorIds)].filter(Boolean);
    try {
      const partySnap = await getDoc(doc(db, "watchParties", partyId));
      if (
        !partySnap.exists() ||
        !isWatchPartyHost(
          partySnap.data() as PartyDoc,
          requester.userId,
          requester.profileId,
        )
      ) {
        return false;
      }
      const party = partySnap.data() as PartyDoc;
      if (party.accessMode !== "invite") {
        return false;
      }
      const mergedActorIds = [
        ...new Set([
          ...(party.invitedProfileIds ?? []),
          ...uniqueActorIds,
        ]),
      ];
      const mergedUserIds = [
        ...new Set([
          ...(party.invitedUserIds ?? []),
          ...mergedActorIds.map(getActorUserId),
        ]),
      ];
      await updateDoc(doc(db, "watchParties", partyId), {
        accessMode: "invite",
        invitedUserIds: mergedUserIds,
        invitedProfileIds: mergedActorIds,
      });
      return true;
    } catch (e) {
      console.error("[watchParty] updateInvitedProfiles failed:", e);
      return false;
    }
  },

  verifyPartyPassword: async (partyId, partyPassword) => {
    if (!partyId || !partyPassword) return null;

    try {
      const partyRef = doc(db, "watchParties", partyId);
      const partySnap = await getDoc(partyRef);
      if (!partySnap.exists()) return null;

      const party = partySnap.data() as PartyDoc;
      if (party.accessMode !== "invite") return null;
      if (partyPassword !== party.partyPassword) return null;

      return enrichPartyHost(party);
    } catch (error) {
      console.error("[watchParty] password verification failed:", error);
      return null;
    }
  },

  deleteParty: async (partyId, requester) => {
    if (!partyId || !requester.userId) return false;

    try {
      const partyRef = doc(db, "watchParties", partyId);
      const partySnap = await getDoc(partyRef);
      if (
        !partySnap.exists() ||
        !isWatchPartyHost(
          partySnap.data() as PartyDoc,
          requester.userId,
          requester.profileId,
        )
      ) {
        return false;
      }

      await deleteDoc(partyRef);
      if (get().partyId === partyId) get().leave();
      return true;
    } catch (error) {
      console.error("[watchParty] deleteParty failed:", error);
      return false;
    }
  },

  loadInvitedParties: async (userId, profileId) => {
    if (!userId) {
      set({ invitedParties: [] });
      return;
    }
    try {
      const snap = await getDocs(
        query(collection(db, "watchParties"), orderBy("createdAt", "desc"), limit(50)),
      );
      const cutoff = Date.now() - 6 * 60 * 60 * 1000;
      const actorId = getWatchPartyActorId(userId, profileId);
      const invited = snap.docs
        .map((item) => item.data() as PartyDoc)
        .filter(
          (party) =>
            (party.createdAt ?? 0) >= cutoff &&
            party.accessMode === "invite" &&
            (party.invitedProfileIds
              ? party.invitedProfileIds.includes(actorId)
              : party.hostProfileId == null &&
                (party.invitedUserIds ?? []).includes(userId)),
        );
      set({ invitedParties: await Promise.all(invited.map(enrichPartyHost)) });
    } catch (e) {
      console.error("[watchParty] invited parties load failed:", e);
      set({ invitedParties: [] });
    }
  },

  subscribeInvitedParties: (userId, profileId) => {
    if (unsubInvited) {
      unsubInvited();
      unsubInvited = null;
    }
    if (!userId) {
      invitedSubscriptionKey = null;
      set({ invitedParties: [] });
      return;
    }

    const subscriptionKey = getWatchPartyActorId(userId, profileId);
    invitedSubscriptionKey = subscriptionKey;
    unsubInvited = onSnapshot(
      query(
        collection(db, "watchParties"),
        orderBy("createdAt", "desc"),
        limit(50),
      ),
      async (snap) => {
        if (invitedSubscriptionKey !== subscriptionKey) return;

        const cutoff = Date.now() - 6 * 60 * 60 * 1000;
        const invited = snap.docs
          .map((item) => item.data() as PartyDoc)
          .filter(
            (party) =>
              (party.createdAt ?? 0) >= cutoff &&
              party.accessMode === "invite" &&
              (party.invitedProfileIds
                ? party.invitedProfileIds.includes(subscriptionKey)
                : party.hostProfileId == null &&
                  (party.invitedUserIds ?? []).includes(userId)),
          );
        const enrichedParties = await Promise.all(invited.map(enrichPartyHost));
        if (invitedSubscriptionKey !== subscriptionKey) return;

        set({
          invitedParties: enrichedParties,
        });
      },
      (error) => {
        console.error(
          "[watchParty] invited parties subscription failed:",
          error,
        );
        set({ invitedParties: [] });
      },
    );
  },

  unsubscribeInvitedParties: () => {
    invitedSubscriptionKey = null;
    if (unsubInvited) {
      unsubInvited();
      unsubInvited = null;
    }
    set({ invitedParties: [] });
  },

  sendMessage: async (text, user) => {
    const { partyId } = get();
    const trimmed = text.trim();
    if (!partyId || !trimmed) return;
    try {
      await addDoc(collection(db, "watchParties", partyId, "messages"), {
        userId: user.userId,
        actorId: getWatchPartyActorId(user.userId, user.profileId),
        ...(user.profileId == null ? {} : { profileId: user.profileId }),
        nickname: user.nickname,
        badge: user.badge ?? "",
        text: trimmed,
        createdAt: Date.now(),
      });
    } catch (e) {
      console.error("[watchParty] sendMessage 실패:", e);
    }
  },

  updatePlayback: async ({ positionPct, isPlaying, userId }) => {
    const { partyId } = get();
    if (!partyId) return;
    // 너무 잦은 쓰기 방지: 3초에 한 번만 동기화
    const now = Date.now();
    if (now - lastPlaybackPush < 3000) return;
    lastPlaybackPush = now;
    try {
      await updateDoc(doc(db, "watchParties", partyId), {
        positionPct: Math.round(positionPct),
        isPlaying,
        updatedAt: now,
        playbackUpdatedBy: userId ?? "",
      });
    } catch (e) {
      console.error("[watchParty] updatePlayback 실패:", e);
    }
  },

  updatePlaybackNow: async ({ positionPct, isPlaying, userId }) => {
    const { partyId } = get();
    if (!partyId) return;
    // 즉시 동기화(재생/정지/탐색). 드래그 연타 방지로 0.5초 스로틀
    const now = Date.now();
    if (now - lastNowPush < 500) return;
    lastNowPush = now;
    lastPlaybackPush = now; // 주기 동기화 타이머도 함께 밀어줌
    try {
      await updateDoc(doc(db, "watchParties", partyId), {
        positionPct: Math.round(positionPct),
        isPlaying,
        updatedAt: now,
        playbackUpdatedBy: userId ?? "",
      });
    } catch (e) {
      console.error("[watchParty] updatePlaybackNow 실패:", e);
    }
  },

  subscribeOpenParties: () => {
    if (unsubOpen) {
      unsubOpen();
      unsubOpen = null;
    }
    if (openPartyExpiryInterval) {
      clearInterval(openPartyExpiryInterval);
      openPartyExpiryInterval = null;
    }
    unsubOpen = onSnapshot(
      query(collection(db, "watchParties"), orderBy("createdAt", "desc"), limit(20)),
      async (snap) => {
        const cutoff = Date.now() - OPEN_PARTY_VISIBLE_MS;
        const recentParties = snap.docs
          .map((d) => d.data() as PartyDoc)
          .filter((party) => (party.createdAt ?? 0) >= cutoff);
        const list = await Promise.all(recentParties.map(enrichPartyHost));
        set({ openParties: list });
      },
      (e) => console.error("[watchParty] openParties 구독 실패:", e),
    );
    openPartyExpiryInterval = setInterval(() => {
      const cutoff = Date.now() - OPEN_PARTY_VISIBLE_MS;
      const visibleParties = get().openParties.filter(
        (party) => (party.createdAt ?? 0) >= cutoff,
      );

      if (visibleParties.length !== get().openParties.length) {
        set({ openParties: visibleParties });
      }
    }, 1000);
  },

  unsubscribeOpenParties: () => {
    if (unsubOpen) {
      unsubOpen();
      unsubOpen = null;
    }
    if (openPartyExpiryInterval) {
      clearInterval(openPartyExpiryInterval);
      openPartyExpiryInterval = null;
    }
    set({ openParties: [] });
  },

  leave: () => {
    if (unsubParty) {
      unsubParty();
      unsubParty = null;
    }
    if (unsubMessages) {
      unsubMessages();
      unsubMessages = null;
    }
    set({ partyId: null, party: null, messages: [], isHost: false });
  },
}));
