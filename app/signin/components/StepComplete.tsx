"use client";

import { useRouter } from "next/navigation";
import { useSignUpStore } from "@/store/useSignUpStore";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/firebase";

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface SelectedPlan {
  name: string;
  billing: "monthly" | "annual";
  monthlyPrice: number;
  annualTotal: number;
  annualDiscount: number;
}

interface StepCompleteProps {
  plan: SelectedPlan;
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("ko-KR");

function generateOrderId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${date}-${rand}`;
}

function getNextBillingDate(billing: "monthly" | "annual"): string {
  const d = new Date();
  if (billing === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function getNow(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function StepComplete({ plan }: StepCompleteProps) {
  const router = useRouter();
  const uid = useSignUpStore((s) => s.uid);
  const payInfo = useSignUpStore((s) => s.payInfo);  // ← 아래에서 추가 예정

  const isAnnual = plan.billing === "annual";
  const orderId = generateOrderId();
  const paidAmount = isAnnual ? plan.annualTotal : plan.monthlyPrice;
  const clear = useSignUpStore((s) => s.clear);

  // 결제 수단 표기 텍스트
  const payLabel = (() => {
    if (!payInfo) return "결제 완료";
    if (payInfo.pay === "card") return `카드 ****-${payInfo.num}`;
    if (payInfo.pay === "kakao") return "카카오페이";
    if (payInfo.pay === "naver") return "네이버페이";
    if (payInfo.pay === "transfer") return `계좌이체 (${payInfo.bank})`;
    if (payInfo.pay === "phone") return `휴대폰 결제 (${payInfo.bank})`;
    return "결제 완료";
  })();


  return (
    <div className="complete-page">

      {/* 체크 아이콘 */}
      <div className="complete-check-circle" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="complete-title">결제가 완료되었어요!</h1>
      <p className="complete-sub">이제 12,000편 이상의 콘텐츠를 무제한 시청하실 수 있어요</p>

      {/* 영수증 카드 */}
      <div className="complete-receipt">
        <div className="receipt-body">
          <div className="receipt-row">
            <span className="receipt-label">플랜</span>
            <span className="receipt-value">{plan.name} ({isAnnual ? "연간" : "월간"})</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">결제 수단</span>
            <span className="receipt-value">{payLabel}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">결제 일시</span>
            <span className="receipt-value">{getNow()}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">다음 결제일</span>
            <span className="receipt-value">{getNextBillingDate(plan.billing)}</span>
          </div>
        </div>

        <div className="receipt-total">
          <span className="receipt-total-label">결제 금액</span>
          <span className="receipt-total-value">{fmt(paidAmount)}원</span>
        </div>
      </div>

      {/* 로그인으로 버튼 */}
      <button
        type="button"
        className="complete-home-btn"
        onClick={async () => {
          clear(); // pendingPlan 포함 스토어 초기화
          await signOut(auth);
          router.push("/login");
        }}
      >
        로그인하러 가기
      </button>

    </div>
  );
}
