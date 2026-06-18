import { create } from "zustand";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"; // updateDoc 추가
import { auth, db } from "@/firebase/firebase";
import type { UserDocument, PayInfo } from "@/types/auth";

// ─── 회원가입 함수 (계정 생성 + 인증메일 발송만) ──────────────────────────────

/**
 * 1. Firebase Auth 계정 생성
 * 2. 이메일 인증 메일 발송
 * ※ Firestore 저장은 이메일 인증 완료 후 createUserDocument()에서 처리
 * @returns 생성된 유저의 uid
 */
export const signUp = async (
  email: string,
  password: string,
): Promise<string> => {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(user);
    return user.uid;
  } catch (error) {
    console.error("signUp error:", error);
    throw error;
  }
};

// ─── Firestore 유저 문서 생성 (이메일 인증 완료 후 호출) ──────────────────────

/**
 * StepVerify에서 emailVerified 확인 후 호출
 * Firestore users 컬렉션에 유저 문서 저장
 */
export const createUserDocument = async (user: {
  uid: string;
  email: string;
}): Promise<void> => {
  const userDoc: UserDocument = {
    userId: user.uid,
    email: user.email,
    planType: "",
    payment: {
      pay: "",
      bank: "",
      num: "",
      payDate: "",
      nextDate: "",
    },
    profile: [
      {
        id: Date.now(),
        nickname: "나",
        imgUrl: "/images/profile/image/default_icons/17.png",
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
      },
    ],
  };

  await setDoc(doc(db, "users", user.uid), {
    ...userDoc,
    createdAt: serverTimestamp(),
  });
};

/**
 * 결제 수단 저장 함수
 * StepPayment에서 결제 완료 후 호출
 * 카드 번호는 보안상 마지막 4자리만 저장
 */
export const updatePayment = async (
  uid: string,
  payment: PayInfo,
): Promise<void> => {
  await updateDoc(doc(db, "users", uid), {
    payment,
    updatedAt: serverTimestamp(),
  });
};

export const updatePlan = async (
  uid: string,
  planType: string,
  billing: string
): Promise<void> => {
  await updateDoc(doc(db, "users", uid), {
    planType,
    billing,
    updatedAt: serverTimestamp(),
  });
};

// ─── uid 임시 저장 스토어 ──────────────────────────────────────────────────────

/**
 * 회원가입 단계 사이에서 uid를 임시로 공유하기 위한 스토어
 * StepRegister에서 저장 → StepPlan, StepPayment 등에서 꺼내 씀
 * 구독 완료(StepComplete) 시점에 clear()로 초기화
 */
interface SignUpState {
  uid: string | null;
  payInfo: PayInfo | null;
  pendingPlan: { planType: string; billing: string } | null;
  setUid: (uid: string) => void;
  setPayInfo: (payInfo: PayInfo) => void;
  setPendingPlan: (plan: { planType: string; billing: string }) => void;
  clear: () => void;
}

export const useSignUpStore = create<SignUpState>((set) => ({
  uid: null,
  payInfo: null,
  pendingPlan: null,
  setUid: (uid) => set({ uid }),
  setPayInfo: (payInfo) => set({ payInfo }),
  setPendingPlan: (plan) => set({ pendingPlan: plan }),
  clear: () => set({ uid: null, payInfo: null, pendingPlan: null }),
}));
