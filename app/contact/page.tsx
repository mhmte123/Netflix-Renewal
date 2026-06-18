"use client";
import React, { Suspense, useState, useEffect, useMemo } from "react";
import AppIcon, { type AppIconName } from "@/components/common/AppIcon";
import { showToast } from "@/store/useToastStore";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import "../scss/contact.scss";

import { useAuthStore } from "@/store/useAuthStore";
import { auth } from "@/firebase/firebase";
import { useContactStore } from "@/store/useContactStore";
import { FAQ_CATEGORIES, FAQ_CATEGORY_LABELS } from "@/data/faq";
import { ContactStatus } from "@/types/contact";
import FaqAccordion from "@/components/common/FaqAccordion";
import CustomSelect from "@/components/common/CustomSelect";
import FooterMenuNav from "@/components/common/FooterMenuNav";

type TabType = "faq" | "inquiry" | "history";
type FilterStatusType = "all" | "pending" | "processing" | "answered";

// 문의 유형 select 옵션 (FAQ 카테고리 + 기타)
const INQUIRY_TYPES = [
  ...FAQ_CATEGORIES.map((c) => ({ value: c.id, label: c.name })),
  { value: "other", label: "기타" },
];

const STATUS_MAP: Record<ContactStatus, { label: string; className: string }> = {
  answered: { label: "답변 완료", className: "answered" },
  processing: { label: "처리 중", className: "processing" },
  pending: { label: "답변 대기", className: "pending" },
};

function ContactPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user, currentProfile } = useAuthStore();
  const { myContacts, loading, submitting, submitContact, fetchMyContacts, deleteContact, answerContact } =
    useContactStore();

  // 로그인 식별자: 스토어 user 우선, 없으면 Firebase 현재 유저로 보강
  const uid = user?.userId ?? auth.currentUser?.uid ?? null;

  // URL ?tab= 동기화
  const currentTabParam = (searchParams.get("tab") as TabType) || "faq";
  const [tab, setTab] = useState<TabType>(currentTabParam);

  // FAQ 상태
  const [category, setCategory] = useState<string>(FAQ_CATEGORIES[0]?.id ?? "account");
  const [faqKeyword, setFaqKeyword] = useState("");

  // 문의 폼 상태
  const [inquiryType, setInquiryType] = useState("");
  const [inquiryTitle, setInquiryTitle] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");

  // 내역 필터
  const [historyFilter, setHistoryFilter] = useState<FilterStatusType>("all");

  // 펼쳐서 본문/답변을 보여줄 문의 항목 (한 번에 하나만 펼침)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const validTabs: TabType[] = ["faq", "inquiry", "history"];
    if (validTabs.includes(currentTabParam)) setTab(currentTabParam);
  }, [currentTabParam]);

  // 로그인 이메일 기본값 채우기
  useEffect(() => {
    if (user?.email && !inquiryEmail) setInquiryEmail(user.email);
  }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  // 내역 탭 진입 시 내 문의 불러오기
  useEffect(() => {
    if (tab === "history" && uid) {
      fetchMyContacts(uid);
    }
  }, [tab, uid, fetchMyContacts]);

  const handleTabChange = (targetTab: TabType) => {
    setTab(targetTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", targetTab);
    // 탭 전환은 히스토리에 쌓지 않음 → 뒤로가기 시 탭을 거치지 않고 이전 페이지(마이페이지)로 바로 이동
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // 현재 카테고리 + 검색어 적용된 FAQ
  const activeCategory = FAQ_CATEGORIES.find((c) => c.id === category);
  const faqItems = useMemo(() => {
    const items = activeCategory?.items ?? [];
    const kw = faqKeyword.trim();
    if (!kw) return items;
    return items.filter((f: any) => f.q.includes(kw) || f.a.includes(kw));
  }, [activeCategory, faqKeyword]);

  // 문의 등록
  const handleSubmit = async () => {
    if (!uid) {
      showToast("문의 작성은 로그인 후 이용할 수 있어요.");
      router.push("/login");
      return;
    }
    if (!inquiryType || !inquiryTitle.trim() || !inquiryContent.trim()) {
      showToast("필수 항목을 모두 입력해주세요.");
      return;
    }

    const ok = await submitContact({
      userId: uid,
      profileId: currentProfile?.id ?? user?.profile?.[0]?.id ?? 0,
      category: inquiryType,
      title: inquiryTitle.trim(),
      content: inquiryContent.trim(),
      email: inquiryEmail.trim() || user?.email || "",
    });

    if (ok) {
      showToast("문의가 등록되었습니다. 영업일 기준 24시간 내 답변드릴게요.");
      setInquiryType("");
      setInquiryTitle("");
      setInquiryContent("");
      setHistoryFilter("all");
      handleTabChange("history");
    } else {
      showToast("문의 등록 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  const filteredHistories = myContacts.filter((h) =>
    historyFilter === "all" ? true : h.status === historyFilter,
  );

  // 내 문의 삭제
  const handleDeleteContact = async (contactId: string) => {
    if (!uid) return;
    const ok = await deleteContact(uid, contactId);
    showToast(ok ? "문의가 삭제되었습니다." : "문의 삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
  };

  // 데모용 답변 문구 — 문의 유형/제목을 반영해 상담원 답변처럼 생성
  // (실제 운영에서는 상담원이 작성한 답변 본문이 들어오는 자리)
  const buildDemoAnswer = (categoryLabel: string, title: string) =>
    `안녕하세요, NETFLIX : CONNECT 고객센터입니다.\n` +
    `문의해 주신 '${title}' (${categoryLabel}) 건 확인했습니다.\n` +
    `요청하신 내용은 정상적으로 처리되었으며, 추가로 궁금하신 점이 있으면 언제든 다시 문의해 주세요. 감사합니다.`;

  // 문의에 답변 달기 → 상태가 '답변 완료'로 전환되고 답변 본문이 노출됨
  // (데모/관리자 동작: 운영 시 관리자 권한 화면으로 이동하거나 제거)
  const handleAnswerContact = async (h: (typeof myContacts)[number]) => {
    if (!uid) return;
    const categoryLabel = FAQ_CATEGORY_LABELS[h.category] ?? h.category;
    const ok = await answerContact(uid, h.id, buildDemoAnswer(categoryLabel, h.title));
    if (ok) {
      setExpandedId(h.id); // 답변이 바로 보이도록 해당 항목을 펼침
      showToast("답변이 등록되었습니다.");
    } else {
      showToast("답변 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div className="contact-page">
      <div className="footer-menu-page">
        <FooterMenuNav />
        <main className="footer-menu-content inner">
        <div className="page-head">
          <h1>고객 센터</h1>
        </div>

        <div className="contact-tabs" aria-label="고객센터 메뉴">
          <button type="button" className={tab === "faq" ? "active" : ""} onClick={() => handleTabChange("faq")}>
            자주 묻는 질문
          </button>
          <button type="button" className={tab === "inquiry" ? "active" : ""} onClick={() => handleTabChange("inquiry")}>
            1:1 문의하기
          </button>
          <button type="button" className={tab === "history" ? "active" : ""} onClick={() => handleTabChange("history")}>
            내 문의 내역
          </button>
        </div>

        {/* ── [A] 자주 묻는 질문(FAQ) ── */}
        {tab === "faq" && (
          <div className="tab-content-panel">
            <div className="section-title-row">
              <h2>자주 묻는 질문</h2>
              <Link href="/faq" className="view-all-link">전체 한눈에 보기 →</Link>
            </div>

            <div className="faq-search">
              <span className="icon">⌕</span>
              <input
                type="text"
                placeholder="궁금한 내용을 검색해보세요 (예: 결제 변경, 다운로드)"
                value={faqKeyword}
                onChange={(e) => setFaqKeyword(e.target.value)}
              />
            </div>

            <div className="faq-categories">
              {FAQ_CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`faq-category ${category === c.id ? "active" : ""}`}
                  onClick={() => {
                    setCategory(c.id);
                    setFaqKeyword("");
                  }}
                >
                  <div className="cat-icon"><AppIcon name={c.icon as AppIconName} size={22} /></div>
                  <h3>{c.name}</h3>
                  <p>{c.items.length}개</p>
                </button>
              ))}
            </div>

            <div className="faq-results-wrapper">
              <div className="section-title-row sub-title">
                <h2>{activeCategory?.name}</h2>
                <span className="total-count">{faqItems.length}개 질문</span>
              </div>

              <FaqAccordion items={faqItems} defaultOpen={0} />
            </div>
          </div>
        )}

        {/* ── [B] 1:1 문의 작성 ── */}
        {tab === "inquiry" && (
          <div className="tab-content-panel">
            <div className="section-title-row">
              <h2>1:1 문의하기</h2>
            </div>

            <div className="inquiry-form-wrap">
              <p className="form-info">
                평균 답변 시간: 영업일 기준 24시간 이내. 답변은 등록한 이메일로 알려드려요.
              </p>

              <div className="inquiry-form">
                <div className="form-field">
                  <label>문의 유형 *</label>
                  <CustomSelect
                    options={INQUIRY_TYPES}
                    value={inquiryType}
                    onChange={setInquiryType}
                    placeholder="유형을 선택해주세요"
                  />
                </div>

                <div className="form-field">
                  <label>제목 *</label>
                  <input
                    type="text"
                    placeholder="문의 제목을 입력해주세요"
                    value={inquiryTitle}
                    onChange={(e) => setInquiryTitle(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>내용 *</label>
                  <textarea
                    placeholder="자세한 내용을 입력해주세요..."
                    value={inquiryContent}
                    onChange={(e) => setInquiryContent(e.target.value)}
                    rows={8}
                  />
                </div>

                {/* <div className="form-field">
                  <label>첨부파일 (선택)</label>
                  <div className="form-attach">📎 파일 끌어다 놓기 · 클릭하여 업로드 (최대 5MB)</div>
                </div> */}

                <div className="form-field">
                  <label>답변 받을 이메일</label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={inquiryEmail}
                    onChange={(e) => setInquiryEmail(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn-submit"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? "등록 중..." : "문의 등록"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── [C] 내 문의 내역 ── */}
        {tab === "history" && (
          <div className="tab-content-panel">
            <div className="section-title-row">
              <h2>내 문의 내역</h2>
              <span className="total-count">{filteredHistories.length}개</span>
            </div>

            {!uid && !loading ? (
              // 로그인 안 된 경우에도 빈 내역 + 문의하러 가기로 안내 (작성 시 로그인 유도)
              <div className="history-empty">
                <p>아직 등록한 문의가 없어요.</p>
                <div className="new-inquiry-cta">
                  <button type="button" onClick={() => handleTabChange("inquiry")}>문의하러 가기</button>
                </div>
              </div>
            ) : (
              <>
                {myContacts.length > 0 && (
                  <div className="status-filter">
                    {(["all", "pending", "processing", "answered"] as FilterStatusType[]).map((type) => (
                      <button
                        type="button"
                        key={type}
                        className={`status-chip ${historyFilter === type ? "active" : ""}`}
                        onClick={() => setHistoryFilter(type)}
                      >
                        {type === "all" && `전체 ${myContacts.length}`}
                        {type === "pending" && "답변 대기"}
                        {type === "processing" && "처리 중"}
                        {type === "answered" && "완료"}
                      </button>
                    ))}
                  </div>
                )}

                {loading ? (
                  <div className="history-empty"><p>문의 내역을 불러오는 중이에요...</p></div>
                ) : filteredHistories.length > 0 ? (
                  <ul className="history-list">
                    {filteredHistories.map((h) => {
                      const isOpen = expandedId === h.id;
                      const isAnswered = h.status === "answered";
                      return (
                        <li
                          key={h.id}
                          className={`history-item ${isOpen ? "is-open" : ""}`}
                          onClick={() => setExpandedId(isOpen ? null : h.id)}
                        >
                          <div className="history-head">
                            <span className="category-tag">
                              {FAQ_CATEGORY_LABELS[h.category] ?? h.category}
                            </span>
                            <div className="head-right">
                              <span className={`status ${STATUS_MAP[h.status].className}`}>
                                {STATUS_MAP[h.status].label}
                              </span>
                              <span className="date">
                                {new Date(h.createdAt).toLocaleDateString("ko-KR")}
                              </span>
                            </div>
                          </div>
                          <h3>{h.title}</h3>
                          <p className={isOpen ? "expanded" : ""}>{h.content}</p>

                          {/* 답변 영역 — 답변 완료 상태이고 답변 본문이 있을 때만 노출 */}
                          {isAnswered && h.answer && (
                            <div className="history-answer">
                              <div className="answer-head">
                                <span className="answer-badge">답변</span>
                                {h.answeredAt && (
                                  <span className="answer-date">
                                    {new Date(h.answeredAt).toLocaleDateString("ko-KR")}
                                  </span>
                                )}
                              </div>
                              <p className="answer-body">{h.answer}</p>
                            </div>
                          )}

                          <div className="history-actions">
                            {/* 데모/관리자 동작: 답변 대기 상태에서만 노출. 운영 시 관리자 권한 화면으로 분리 */}
                            {!isAnswered && (
                              <button
                                type="button"
                                className="history-answer-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAnswerContact(h);
                                }}
                              >
                                답변 받기(데모)
                              </button>
                            )}
                            <button
                              type="button"
                              className="history-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteContact(h.id);
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  // 문의가 아예 없을 때 vs 필터 결과만 없을 때 구분
                  <div className="history-empty">
                    {myContacts.length === 0 ? (
                      <>
                        <p>아직 등록한 문의가 없어요.</p>
                        <div className="new-inquiry-cta">
                          <button type="button" onClick={() => handleTabChange("inquiry")}>문의하러 가기</button>
                        </div>
                      </>
                    ) : (
                      <p>선택하신 조건에 해당하는 문의 내역이 존재하지 않습니다.</p>
                    )}
                  </div>
                )}

                {filteredHistories.length > 0 && (
                  <div className="new-inquiry-cta">
                    <button type="button" onClick={() => handleTabChange("inquiry")}>＋ 새 문의 작성</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        </main>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="contact-page" />}>
      <ContactPageContent />
    </Suspense>
  );
}