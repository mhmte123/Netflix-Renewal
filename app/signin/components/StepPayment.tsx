"use client";

import { auth } from "@/firebase/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updatePayment, useSignUpStore } from "@/store/useSignUpStore";
import type { PayInfo } from "@/types/auth";

// ─── 타입 ──────────────────────────────────────────────────────────────────────

type PayTab = "card" | "quick" | "transfer" | "phone";
type BillingCycle = "monthly" | "annual";

interface SelectedPlan {
  name: string;
  billing: BillingCycle;
  monthlyPrice: number;
  annualTotal: number;
  annualDiscount: number;
}

interface StepPaymentProps {
  plan: SelectedPlan;
  onBack: () => void;       // 이전으로 → 플랜 선택
  onComplete: () => void | Promise<void>; // 결제하기 → 시청 시작
  hidePlanSummary?: boolean;
  currentPayInfo?: PayInfo | null;
  submitLabel?: string;
  amountLabel?: string;
  hideTitle?: boolean; // 타이틀 숨김 여부
  // ── 외부(굿즈 배송비 등) 1회성 결제용 — 구독 로직 없이 선택한 결제수단만 전달 ──
  onPaySubmit?: (payInfo: PayInfo, payLabel: string) => void | Promise<void>;
  hideAmountBox?: boolean; // 결제 금액 박스 숨김 (외부에서 요약을 따로 보여줄 때)
  hideAgree?: boolean;     // 자동결제 동의 영역 숨김 (1회성 결제)
  noticeText?: string;     // 안내 문구 교체 ("" 이면 숨김)
}

// ─── 은행 목록 ────────────────────────────────────────────────────────────────

const BANKS = ["국민은행", "신한은행", "우리은행", "하나은행", "카카오뱅크", "토스뱅크"];
const QUICK_PAYS = [
  { id: "kakao", label: "카카오페이", icon: "/images/social/kakao_login.svg" },
  { id: "naver", label: "네이버페이", icon: "/images/social/naver_login.svg" },
];

// ─── 숫자 포맷 ────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("ko-KR");

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function StepPayment({ plan, onBack, onComplete, hidePlanSummary, currentPayInfo, hideTitle, submitLabel = "결제하기", amountLabel = "결제 금액", onPaySubmit, hideAmountBox, hideAgree, noticeText }: StepPaymentProps) {
  const router = useRouter();
  const { onLogin } = useAuthStore();

  const [activeTab, setActiveTab] = useState<PayTab>("card");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cardPw, setCardPw] = useState("");
  const [agreeAuto, setAgreeAuto] = useState(true);
  const [agreeSave, setAgreeSave] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [selectedQuickPay, setSelectedQuickPay] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [carrierOpen, setCarrierOpen] = useState(false);

  const defaultProfiles = [{ id: 1, name: "나", imgUrl: "/images/profile/image/default_icons/17.png" }];

  const handlePhoneNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    const formatted =
      raw.length < 4 ? raw :
        raw.length < 8 ? `${raw.slice(0, 3)}-${raw.slice(3)}` :
          `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    setPhoneNumber(formatted);
  };

  // ── 카드 번호 자동 포맷 버그 수정 ────────────────────────────────────
  const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    // 💥 기존 코드의 빈 공백이 뭉개지는 현상 수정 (정확히 1칸의 공백으로 분할)
    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    setCardNumber(formatted);
  };

  // ── 만료일 자동 포맷 (MM/YY) ────────────────────────────────────────────────
  const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    const formatted = raw.length >= 3 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
    setExpiry(formatted);
  };

  // ── 결제하기 ────────────────────────────────────────────────────────────────
  const { user } = useAuthStore();
  const uid = useSignUpStore((s) => s.uid) ?? auth.currentUser?.uid ?? user?.userId;
  // 결제수단
  const setPayInfo = useSignUpStore((s) => s.setPayInfo);

  const handlePay = async () => {
    // 카드
    if (activeTab === "card") {
      if (!cardNumber || !expiry || !cvc || !birthDate || !cardPw) {
        setError("카드 정보를 모두 입력해주세요.");
        return;
      }
      if (!agreeAuto) {
        setError("자동 결제 동의는 필수입니다.");
        return;
      }
    }

    // 간편결제 
    if (activeTab === "quick") {
      if (!selectedQuickPay) {
        setError("간편결제 수단을 선택해주세요.");
        return;
      }
    }

    // 계좌이체 
    if (activeTab === "transfer") {
      if (!selectedBank) {
        setError("은행을 선택해주세요.");
        return;
      }
    }

    // 휴대폰 결제 
    if (activeTab === "phone") {
      if (!phoneNumber) {
        setError("휴대폰 번호를 입력해주세요.");
        return;
      }
      if (!carrier) {
        setError("통신사를 선택해주세요.");
        return;
      }
    }
    // ── 외부(굿즈 배송비 등) 1회성 결제: 구독 로직 없이 선택한 결제수단만 넘김 ──
    if (onPaySubmit) {
      setError("");
      setIsLoading(true);
      try {
        const last4 = cardNumber.replace(/\s/g, "").slice(-4);
        const payLabel =
          activeTab === "card" ? `카드 ****-${last4}`
            : activeTab === "quick" ? (selectedQuickPay === "kakao" ? "카카오페이" : "네이버페이")
              : activeTab === "transfer" ? `계좌이체 (${selectedBank})`
                : `휴대폰 결제 (${carrier})`;
        const payInfo: PayInfo =
          activeTab === "card" ? { pay: "card", bank: "", num: last4, payDate: `${expiry}-${cvc}`, nextDate: "" }
            : activeTab === "quick" ? { pay: selectedQuickPay, bank: "", num: "", payDate: "", nextDate: "" }
              : activeTab === "transfer" ? { pay: "transfer", bank: selectedBank, num: "", payDate: "", nextDate: "" }
                : { pay: "phone", bank: carrier, num: phoneNumber.replace(/-/g, ""), payDate: "", nextDate: "" };
        await onPaySubmit(payInfo, payLabel);
      } catch (err) {
        console.error(err);
        setError("결제에 실패했습니다. 다시 시도해주세요.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 같은 결제수단 체크 
    if (currentPayInfo) {
      const isSameCard = activeTab === "card" &&
        currentPayInfo.pay === "card" &&
        cardNumber.replace(/\s/g, "").slice(-4) === currentPayInfo.num &&
        expiry === currentPayInfo.payDate.split("-")[0];

      const isSameQuick = activeTab === "quick" && currentPayInfo.pay === selectedQuickPay;
      const isSameTransfer = activeTab === "transfer" && currentPayInfo.pay === "transfer" && currentPayInfo.bank === selectedBank;
      const isSamePhone = activeTab === "phone" && currentPayInfo.pay === "phone" && currentPayInfo.num === phoneNumber.replace(/-/g, "");

      if (isSameCard || isSameQuick || isSameTransfer || isSamePhone) {
        setError("현재 사용 중인 결제 수단과 동일해요. 다른 결제 수단을 선택해주세요.");
        return;
      }
    }
    setError("");
    setIsLoading(true);



    try {
      await new Promise((res) => setTimeout(res, 1500));

      const currentUser = auth.currentUser;
      const isLoggedIn = !!(currentUser || user?.userId);

      if (!isLoggedIn) {
        setError("로그인 세션이 만료되었습니다. 다시 로그인 해주세요.");
        return;
      }



      // 결제 정보 Firestore 저장 ← 추가
      if (uid) {
        const nextDate = (() => {
          const d = new Date();
          if (plan.billing === "annual") d.setFullYear(d.getFullYear() + 1);
          else d.setMonth(d.getMonth() + 1);
          return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
        })();

        const paymentInfo: PayInfo =
          activeTab === "card" ? {
            pay: "card",
            bank: "",
            num: cardNumber.replace(/\s/g, "").slice(-4),
            payDate: `${expiry}-${cvc}`,
            nextDate,
          }
            : activeTab === "quick" ? {
              pay: selectedQuickPay,
              bank: "",
              num: "",
              payDate: "",
              nextDate,
            }
              : activeTab === "transfer" ? {
                pay: "transfer",
                bank: selectedBank,
                num: "",
                payDate: "",
                nextDate,
              }
                : {
                  pay: "phone",
                  bank: carrier,
                  num: phoneNumber,
                  payDate: "",
                  nextDate,
                };

        await updatePayment(uid, paymentInfo);
        setPayInfo(paymentInfo);
      }

      if (currentUser) {
        onLogin({
          uid: currentUser.uid,
          email: currentUser.email ?? "",
          displayName: currentUser.displayName ?? "사용자",
          profile: defaultProfiles,
        } as any);
      }

      onComplete();
    } catch (err) {
      console.error(err);
      setError("결제에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  // 통신사 드롭다운
  const CARRIERS = ["SKT", "KT", "LG U+", "알뜰폰"];

  // ── 금액 계산 ────────────────────────────────────────────────────────────────
  const isAnnual = plan.billing === "annual";
  const displayPrice = isAnnual
    ? `${fmt(plan.annualTotal)}원/년`
    : `${fmt(plan.monthlyPrice)}원/월`;

  return (
    <div className="payment-page">
      {!hideTitle && <h1 className="payment-title">결제 수단</h1>}

      {/* 플랜 요약 — hidePlanSummary일 때 숨김 */}
      {!hidePlanSummary && (
        <div className="payment-plan-summary">
          <div className="pps-left">
            <span className="pps-badge">{plan.name}</span>
            <span className="pps-name">{plan.name} 플랜</span>
            <span className="pps-billing">{isAnnual ? "연간 결제" : "월간 결제"}</span>
          </div>
          <div className="pps-right">
            <span className="pps-price">{displayPrice}</span>
            <button type="button" className="pps-change" onClick={onBack}>변경하기</button>
          </div>
        </div>
      )}
      {/* ── 결제수단 탭 ───────────────────────────────────────────────────── */}
      <div className="payment-tabs">
        {(["card", "quick", "transfer", "phone"] as PayTab[]).map((tab) => {
          const labels: Record<PayTab, string> = {
            card: "신용/체크카드", quick: "간편결제",
            transfer: "계좌이체", phone: "휴대폰 결제",
          };
          return (
            <button
              key={tab}
              type="button"
              className={`payment-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => { setActiveTab(tab); setError(""); }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* ── 신용/체크카드 ─────────────────────────────────────────────────── */}
      {activeTab === "card" && (
        <div className="payment-tab-content">
          <div className="payment-card-form">
            <div className="payment-form-field">
              <label htmlFor="card-number" className="payment-form-label">카드 번호</label>
              <input
                id="card-number"
                className="payment-form-input"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={handleCardNumber}
                maxLength={19} // 16자리 숫자 + 공백 3개 = 19자리로 최적화
                autoComplete="cc-number"
              />
            </div>
            <div className="payment-form-row">
              <div className="payment-form-field">
                <label htmlFor="expiry" className="payment-form-label">유효 기간 (MM/YY)</label>
                <input
                  id="expiry"
                  className="payment-form-input"
                  placeholder="MM/YY"
                  value={expiry}
                  onChange={handleExpiry}
                  maxLength={5}
                  autoComplete="cc-exp"
                />
              </div>
              <div className="payment-form-field">
                <label htmlFor="cvc" className="payment-form-label">CVC</label>
                <input
                  id="cvc"
                  className="payment-form-input"
                  placeholder="3자리"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  maxLength={3}
                  autoComplete="cc-csc"
                />
              </div>
            </div>
            <div className="payment-form-row">
              <div className="payment-form-field">
                <label htmlFor="birth-date" className="payment-form-label">생년월일 (YYMMDD)</label>
                <input
                  id="birth-date"
                  className="payment-form-input"
                  placeholder="000000"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                />
              </div>
              <div className="payment-form-field">
                <label htmlFor="card-pw" className="payment-form-label">비밀번호 앞 2자리</label>
                <input
                  id="card-pw"
                  className="payment-form-input"
                  placeholder="••"
                  type="password"
                  value={cardPw}
                  onChange={(e) => setCardPw(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  maxLength={2}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 간편결제 ──────────────────────────────────────────────────────── */}
      {activeTab === "quick" && (
        <div className="payment-tab-content">
          <p className="payment-tab-desc">간편결제 수단을 선택하면 해당 앱으로 연결돼요.</p>
          <div className="payment-quick-grid">
            {QUICK_PAYS.map((pay) => (
              <button
                key={pay.id}
                type="button"
                className={`payment-quick-btn ${pay.id}${selectedQuickPay === pay.id ? " selected" : ""}`}
                onClick={() => setSelectedQuickPay(pay.id)}
              >
                <img src={pay.icon} alt={pay.label} width={22} height={22} />
                {pay.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 계좌이체 ──────────────────────────────────────────────────────── */}
      {activeTab === "transfer" && (
        <div className="payment-tab-content">
          <p className="payment-tab-desc">은행을 선택하면 계좌이체 화면으로 연결돼요.</p>
          <div className="payment-bank-grid">
            {BANKS.map((bank) => (
              <button
                key={bank}
                type="button"
                className={`payment-bank-btn${selectedBank === bank ? " selected" : ""}`}
                onClick={() => setSelectedBank(bank)}
              >
                {bank}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 휴대폰 결제 ───────────────────────────────────────────────────── */}
      {activeTab === "phone" && (
        <div className="payment-tab-content">
          <div className="payment-card-form">
            <div className="payment-form-field">
              <label htmlFor="phone-number" className="payment-form-label">휴대폰 번호</label>
              <input
                id="phone-number"
                className="payment-form-input"
                placeholder="010-0000-0000"
                value={phoneNumber}
                onChange={handlePhoneNumber}
              />
            </div>
            <div className="payment-form-field">
              <label htmlFor="carrier" className="payment-form-label">통신사</label>
              <div className="payment-select-wrap">
                <button
                  type="button"
                  className="payment-select-btn"
                  onClick={() => setCarrierOpen((v) => !v)}
                >
                  <span>{carrier || "통신사를 선택해주세요"}</span>
                  <span className={`payment-select-arrow${carrierOpen ? " open" : ""}`}>▾</span>
                </button>
                {carrierOpen && (
                  <ul className="payment-select-list">
                    {CARRIERS.map((c) => (
                      <li
                        key={c}
                        className={`payment-select-item${carrier === c ? " selected" : ""}`}
                        onClick={() => { setCarrier(c); setCarrierOpen(false); }}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 결제 금액 요약 ────────────────────────────────────────────────── */}
      {!hideAmountBox && (
      <div className="payment-amount-box">
        <div className="payment-amount-row">
          <span className="payment-amount-label">플랜</span>
          <span className="payment-amount-value">
            {plan.name} ({isAnnual ? "연간" : "월간"})
          </span>
        </div>
        {isAnnual && (
          <>
            <div className="payment-amount-row">
              <span className="payment-amount-label">월 환산</span>
              <span className="payment-amount-value">{fmt(plan.monthlyPrice)}원 × 12</span>
            </div>
            <div className="payment-amount-row">
              <span className="payment-amount-label">연간 할인</span>
              <span className="payment-amount-value discount">-{fmt(plan.annualDiscount)}원</span>
            </div>
          </>
        )}
        <hr className="payment-amount-divider" />
        <div className="payment-amount-row">
          <span className="payment-amount-total-label">{amountLabel}</span>
          <span className="payment-amount-total-value">
            {isAnnual ? fmt(plan.annualTotal) : fmt(plan.monthlyPrice)}원
          </span>
        </div>
      </div>
      )}

      {/* 에러 */}
      {error && <div className="signin-error" role="alert">{error}</div>}

      {/* 동의 체크 */}
      {!hideAgree && (
      <div className="payment-agree-list">
        <div
          className="payment-agree-item"
          onClick={() => setAgreeAuto((v) => !v)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") setAgreeAuto((v) => !v); }}
        >
          <div className={`payment-cb${agreeAuto ? " checked" : ""}`} />
          <span className="payment-agree-text">이 결제수단으로 매월 자동 결제에 동의합니다 (필수)</span>
        </div>
        <div
          className="payment-agree-item"
          onClick={() => setAgreeSave((v) => !v)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") setAgreeSave((v) => !v); }}
        >
          <div className={`payment-cb${agreeSave ? " checked" : ""}`} />
          <span className="payment-agree-text">결제 정보 안전하게 저장 (다음 결제부터 간편하게)</span>
        </div>
      </div>
      )}
      {/* 안내 문구 */}
      {noticeText !== "" && (
        <p className="payment-notice">
          {noticeText ??
            "결제 후 즉시 모든 기능을 이용할 수 있어요. 구독은 언제든지 설정에서 해지할 수 있으며, 해지 시 현재 구독 기간 만료일까지 서비스를 이용할 수 있습니다."}
        </p>
      )}

      {/* ── 버튼 ──────────────────────────────────────────────────────────── */}
      <button
        type="button"
        className={`payment-pay-btn${isLoading ? " is-loading" : ""}`}
        onClick={handlePay}
        disabled={isLoading}
      >
        {isLoading ? "" : submitLabel}
      </button>
      <button
        type="button"
        className="payment-back-btn"
        onClick={onBack}
        disabled={isLoading}
      >
        이전으로
      </button>
    </div>
  );
}