"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import { updatePlan, useSignUpStore } from "@/store/useSignUpStore";
import StepPayment from "@/app/signin/components/StepPayment";
import type { PayInfo } from "@/types/auth";
import "@/app/signin/signin.scss";
import "./payment.scss";

// 플랜별 가격 매핑
const PLAN_PRICES: Record<string, { monthlyPrice: number; annualTotal: number; annualDiscount: number }> = {
  basic: { monthlyPrice: 7000, annualTotal: 69720, annualDiscount: 14280 },
  standard: { monthlyPrice: 13500, annualTotal: 135000, annualDiscount: 27000 },
  premium: { monthlyPrice: 17000, annualTotal: 170000, annualDiscount: 34000 },
};

export default function PaymentPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const pendingPlan = useSignUpStore((s) => s.pendingPlan);  // ← 비구독자 임시 플랜
  const [done, setDone] = useState(false);
  const [planType, setPlanType] = useState("");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [payInfo, setPayInfo] = useState<PayInfo | null>(null);

  // useEffect 하나로 합침
  useEffect(() => {
    const uid = user?.userId ?? auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setPlanType(data.planType ?? "");
      setPayInfo(data.payment ?? null);
      setBilling(data.billing ?? "monthly");
    });
  }, [user?.userId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [done]);

  const [isNewSubscription, setIsNewSubscription] = useState(false);

  useEffect(() => {
    // pendingPlan 있으면 신규 구독 모드
    if (pendingPlan) setIsNewSubscription(true);
  }, []);

  // 현재 플랜 or 비구독자가 선택한 임시 플랜
  const activePlanType = planType || pendingPlan?.planType || "";
  const activeBilling = (billing || pendingPlan?.billing || "monthly") as "monthly" | "annual";

  const planLabel = (() => {
    if (activePlanType === "basic") return "베이직";
    if (activePlanType === "standard") return "스탠다드";
    if (activePlanType === "premium") return "프리미엄";
    return "-";
  })();

  const payLabel = (() => {
    if (!payInfo?.pay) return "등록된 결제 수단 없음";
    if (payInfo.pay === "card") return `카드 ****-${payInfo.num}`;
    if (payInfo.pay === "kakao") return "카카오페이";
    if (payInfo.pay === "naver") return "네이버페이";
    if (payInfo.pay === "transfer") return `계좌이체 (${payInfo.bank})`;
    if (payInfo.pay === "phone") return `휴대폰 결제 (${payInfo.bank})`;
    return "-";
  })();

  const prices = PLAN_PRICES[activePlanType] ?? { monthlyPrice: 0, annualTotal: 0, annualDiscount: 0 };

  if (done) {
    return (
      <div className="signin-page">
        <div className="complete-page">
          <div className="complete-check-circle" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="complete-title">
            {planType ? "결제 수단이 변경되었어요!" : "구독이 시작되었어요!"}
          </h1>
          <p className="complete-sub">
            {planType ? "새로운 결제 수단으로 변경되었습니다" : `${planLabel} 플랜으로 무제한 시청을 즐겨보세요`}
          </p>
          <button
            type="button"
            className="complete-home-btn"
            onClick={() => router.push(planType ? "/settings?tab=membership" : "/")}
          >
            {planType ? "설정으로 돌아가기" : "메인으로 가기"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signin-page">
      <div className="pay-change-page">
        <h1 className="pay-change-title">
          {pendingPlan ? "결제 수단 선택" : "결제 수단 변경"}
        </h1>

        {/* 구독 중일 때만 현재 구독 정보 요약 표시 */}
        {planType && (
          <div className="pay-change-summary">
            <div className="pay-change-summary-row">
              <span className="pay-change-summary-label">현재 플랜</span>
              <span className="pay-change-summary-value">{planLabel}</span>
            </div>
            <div className="pay-change-summary-row">
              <span className="pay-change-summary-label">현재 결제 수단</span>
              <span className="pay-change-summary-value">{payLabel}</span>
            </div>
            {payInfo?.nextDate && (
              <div className="pay-change-summary-row">
                <span className="pay-change-summary-label">다음 결제일</span>
                <span className="pay-change-summary-value">{payInfo.nextDate}</span>
              </div>
            )}
          </div>
        )}

        <StepPayment
          hideTitle
          plan={{
            name: planLabel,
            billing: activeBilling,
            monthlyPrice: prices.monthlyPrice,
            annualTotal: prices.annualTotal,
            annualDiscount: prices.annualDiscount,
          }}
          hidePlanSummary
          currentPayInfo={planType ? payInfo : null}  // 구독 중일 때만 현재 결제수단 비교
          submitLabel={planType ? "변경하기" : "결제하기"}
          amountLabel="결제 예정 금액"
          onBack={() => router.push(pendingPlan ? "/plan" : "/settings?tab=membership")}
          onComplete={async () => {
            // 비구독자가 새로 구독하는 경우 planType 저장
            if (pendingPlan) {
              const uid = user?.userId ?? auth.currentUser?.uid;
              if (uid) await updatePlan(uid, pendingPlan.planType, pendingPlan.billing);
            }
            setDone(true);
          }}
        />
      </div>
    </div>
  );
}
