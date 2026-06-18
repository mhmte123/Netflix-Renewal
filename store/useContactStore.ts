import { create } from "zustand";
import { addDoc, collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { ContactDocument, ContactStore } from "@/types/contact";

// users 컬렉션과 분리된 별도 문의 컬렉션
// 구조: contacts/{userId}/items/{문의ID}
//  - userId 가 문서 "키(경로)" 가 되어 유저별로 문의가 쌓임
const CONTACTS_COLLECTION = "contacts";
const ITEMS_SUBCOLLECTION = "items";

export const useContactStore = create<ContactStore>((set, get) => ({
  myContacts: [],
  loading: false,
  submitting: false,

  // 1. 문의 등록 — contacts/{userId}/items 아래에 새 문서 추가
  submitContact: async (input) => {
    set({ submitting: true });
    try {
      const newDoc = {
        ...input, // userId, profileId, category, title, content, email
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };

      // 유저 아이디를 키로: contacts/{userId}/items/{자동ID}
      const itemsRef = collection(
        db,
        CONTACTS_COLLECTION,
        input.userId,
        ITEMS_SUBCOLLECTION,
      );
      const ref = await addDoc(itemsRef, newDoc);

      // 부모 문서(키 = userId)를 메타데이터와 함께 생성/갱신
      // → 콘솔에서 유저 아이디 단위로 문의가 묶여 보이고, 경로 키가 실존하게 됨
      await setDoc(
        doc(db, CONTACTS_COLLECTION, input.userId),
        { userId: input.userId, updatedAt: newDoc.createdAt },
        { merge: true },
      );

      // 낙관적 갱신: 방금 등록한 문의를 목록 맨 앞에 끼워넣어 즉시 보이게 함
      set((state) => ({
        myContacts: [{ id: ref.id, ...newDoc }, ...state.myContacts],
        submitting: false,
      }));
      return true;
    } catch (error) {
      console.error("문의 등록 실패:", error);
      set({ submitting: false });
      return false;
    }
  },

  // 2. 내 문의 내역 조회 — 내 경로(contacts/{userId}/items)만 읽음
  //    where 필터·복합 인덱스 불필요
  fetchMyContacts: async (userId, profileId) => {
    if (!userId) return;
    set({ loading: true });
    try {
      const itemsRef = collection(
        db,
        CONTACTS_COLLECTION,
        userId,
        ITEMS_SUBCOLLECTION,
      );

      const snapshot = await getDocs(itemsRef);
      let data = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as ContactDocument),
      );

      // 특정 프로필로 한정해서 보고 싶을 때만 필터링
      if (profileId !== undefined) {
        data = data.filter((c) => c.profileId === profileId);
      }

      // 최신순 정렬
      data.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      set({ myContacts: data, loading: false });
    } catch (error) {
      console.error("문의 내역 조회 실패:", error);
      set({ loading: false });
    }
  },

  // 3. 내 문의 삭제 — contacts/{userId}/items/{contactId} 문서 제거
  deleteContact: async (userId, contactId) => {
    if (!userId || !contactId) return false;
    try {
      await deleteDoc(
        doc(db, CONTACTS_COLLECTION, userId, ITEMS_SUBCOLLECTION, contactId),
      );
      // 낙관적 갱신: 목록에서 즉시 제거
      set((state) => ({
        myContacts: state.myContacts.filter((c) => c.id !== contactId),
      }));
      return true;
    } catch (error) {
      console.error("문의 삭제 실패:", error);
      return false;
    }
  },

  // 4. 문의에 답변 달기 — answer/answeredAt 기록 + status 를 answered 로 전환
  //    (운영 환경에서는 상담원/관리자 권한에서 호출하는 동작)
  answerContact: async (userId, contactId, answer) => {
    if (!userId || !contactId || !answer.trim()) return false;
    try {
      const answeredAt = new Date().toISOString();

      await updateDoc(
        doc(db, CONTACTS_COLLECTION, userId, ITEMS_SUBCOLLECTION, contactId),
        {
          status: "answered",
          answer: answer.trim(),
          answeredAt,
        },
      );

      // 낙관적 갱신: 해당 문의의 상태/답변을 즉시 반영 → 뱃지가 '답변 완료'로 전환
      set((state) => ({
        myContacts: state.myContacts.map((c) =>
          c.id === contactId
            ? { ...c, status: "answered", answer: answer.trim(), answeredAt }
            : c,
        ),
      }));
      return true;
    } catch (error) {
      console.error("답변 처리 실패:", error);
      return false;
    }
  },
}));