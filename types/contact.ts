// 1:1 문의(contacts) 관련 타입
// Firestore 의 별도 컬렉션 "contacts" 에 저장됩니다. (users 컬렉션과 분리)

export type ContactStatus = "pending" | "processing" | "answered";

export interface ContactDocument {
  id: string; // Firestore 문서 ID (자동 생성)

  userId: string; // 작성자 UID — 조회(내 문의 뽑기)의 키로 사용
  profileId: number; // 작성 당시 프로필 ID — 어떤 프로필로 썼는지 기록

  category: string; // 문의 유형 (account / payment / watch / device / plan / other)
  title: string; // 제목
  content: string; // 내용
  email: string; // 답변 받을 이메일

  status: ContactStatus; // 처리 상태 (등록 시 항상 pending)
  createdAt: string; // 작성 시각 (ISO 문자열, 정렬용)

  answer?: string; // 상담원 답변 본문 (답변 완료 시에만 존재)
  answeredAt?: string; // 답변 등록 시각 (ISO 문자열)
}

// 문의 등록 시 입력으로 받는 값 (id/status/createdAt 은 스토어에서 채움)
export type ContactInput = Omit<ContactDocument, "id" | "status" | "createdAt">;

export interface ContactStore {
  myContacts: ContactDocument[];
  loading: boolean;
  submitting: boolean;

  // 문의 등록 → contacts 컬렉션에 추가. 성공 시 true 반환
  submitContact: (input: ContactInput) => Promise<boolean>;

  // 내 문의 내역 조회 (userId 기준, profileId 주면 해당 프로필로 한정)
  fetchMyContacts: (userId: string, profileId?: number) => Promise<void>;

  // 내 문의 삭제 (contacts/{userId}/items/{contactId})
  deleteContact: (userId: string, contactId: string) => Promise<boolean>;

  // 문의에 답변 달기 → 해당 문서에 answer/answeredAt 기록 + status 를 answered 로 전환
  answerContact: (
    userId: string,
    contactId: string,
    answer: string,
  ) => Promise<boolean>;
}
