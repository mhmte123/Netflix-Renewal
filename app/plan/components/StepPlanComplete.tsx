"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import { SelectedPlan } from "@/app/signin/components/StepPlan";
import type { PayInfo } from "@/types/auth";

interface Props {
  plan: SelectedPlan;
  onGoSettings: () => void;
}

export default function StepPlanComplete({ plan, onGoSettings }: Props) {
  const isAnnual = plan.billing === "annual";
  const { user } = useAuthStore();
  const [payInfo, setPayInfo] = useState<PayInfo | null>(null);

  useEffect(() => {
    const uid = user?.userId ?? auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      setPayInfo(snap.data().payment ?? null);
    });
  }, [user?.userId]);

  const payLabel = (() => {
    if (!payInfo?.pay) return "-";
    if (payInfo.pay === "card") return `카드 ****-${payInfo.num}`;
    if (payInfo.pay === "kakao") return "카카오페이";
    if (payInfo.pay === "naver") return "네이버페이";
    if (payInfo.pay === "transfer") return `계좌이체 (${payInfo.bank})`;
    if (payInfo.pay === "phone") return `휴대폰 결제 (${payInfo.bank})`;
    return "-";
  })();

  return (
    <div className="complete-page">
      <div className="complete-check-circle" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="complete-title">플랜이 변경되었어요!</h1>
      <p className="complete-sub">새로운 플랜으로 더 많은 콘텐츠를 즐겨보세요</p>

      <div className="complete-receipt">
        <div className="receipt-body">
          <div className="receipt-row">
            <span className="receipt-label">변경된 플랜</span>
            <span className="receipt-value">{plan.name}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">결제 방식</span>
            <span className="receipt-value">{isAnnual ? "연간 결제" : "월간 결제"}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">결제 수단</span>
            <span className="receipt-value">{payLabel}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="complete-home-btn"
        onClick={onGoSettings}
      >
        설정으로 돌아가기
      </button>
    </div>
  );
}
