"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import { useSignUpStore } from "@/store/useSignUpStore";
import StepPlan, { SelectedPlan } from "@/app/signin/components/StepPlan";
import StepPlanComplete from "./components/StepPlanComplete";
import BackButton from "@/components/common/BackButton";
import "@/app/signin/signin.scss";

export default function PlanPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const setPendingPlan = useSignUpStore((s) => s.setPendingPlan);  // ← 추가
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>({
    name: "스탠다드",
    billing: "monthly",
    monthlyPrice: 13500,
    annualTotal: 135000,
    annualDiscount: 27000,
  });
  const [planType, setPlanType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentBilling, setCurrentBilling] = useState<string>("");

  useEffect(() => {
    const uid = user?.userId ?? auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    getDoc(doc(db, "users", uid)).then((snap) => {
      setPlanType(snap.exists() ? (snap.data().planType ?? "") : "");
      setCurrentBilling(snap.exists() ? (snap.data().billing ?? "monthly") : "monthly");
    }).finally(() => setLoading(false));
  }, [user?.userId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentStep]);

  if (loading) return null;

  const isLoggedIn = !!(user?.userId ?? auth.currentUser?.uid);

  // 비로그인 or 비구독자
  if (!isLoggedIn || planType === "") {
    return (
      <div className="signin-page">
        <div className="plan-page">
          <p className="plan-eyebrow">멤버십 플랜</p>
          <h1 className="plan-title">지금 바로 시작하세요</h1>
          <p className="plan-subtitle">지금 가입하고 다양한 콘텐츠를 무제한으로 즐겨보세요</p>
          <StepPlan
            hideTitle
            skipFirestore
            submitLabel="구독 시작하기"
            onNext={(plan) => {
              // 선택한 플랜 임시 저장
              setPendingPlan({
                planType: plan.name === "베이직" ? "basic" : plan.name === "스탠다드" ? "standard" : "premium",
                billing: plan.billing,
              });
              const uid = user?.userId ?? auth.currentUser?.uid;
              if (uid) {
                router.push("/payment");
              } else {
                router.push("/login");
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="signin-page">

      {currentStep === 1 && (
        <>
          <StepPlan
            currentPlanType={planType ?? ""}
            currentBilling={currentBilling}
            submitLabel="변경하기"
            onNext={(plan) => {
              setSelectedPlan(plan);
              setCurrentStep(2);
            }}
          />
          <button
            type="button"
            className="payment-back-btn"
            style={{ maxWidth: "260px" }}
            onClick={() => router.push("/settings?tab=membership")}
          >
            이전으로
          </button>
        </>
      )}
      {currentStep === 2 && (
        <StepPlanComplete
          plan={selectedPlan}
          onGoSettings={() => router.push("/settings")}
        />
      )}
    </div>
  );
}
