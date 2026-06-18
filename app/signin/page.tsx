"use client";

import React, { useState, useEffect } from "react";
import "./signin.scss";
import StepRegister from "./components/StepRegister";
import StepVerify from "./components/StepVerify";
import StepPlan from "./components/StepPlan";
import StepPayment from "./components/StepPayment";
import StepComplete from "./components/StepComplete";
import { auth } from "@/firebase/firebase";
import { signOut } from "firebase/auth";

// ─── 타입 ──────────────────────────────────────────────────────────────────────

type StepStatus = "active" | "done" | "idle";
type BillingCycle = "monthly" | "annual";

interface Step { label: string; status: StepStatus; }

interface SelectedPlan {
  name: string;
  billing: BillingCycle;
  monthlyPrice: number;
  annualTotal: number;
  annualDiscount: number;
}

// step 0,1 → 계정 만들기 active
// step 2   → 플랜 선택 active
// step 3   → 결제 active
// step 4   → 구독 완료 active
function buildSteps(current: number): Step[] {
  const labels = ["계정 만들기", "플랜 선택", "결제", "구독 완료"];
  const indicatorStep = current <= 1 ? 0 : current - 1;
  return labels.map((label, i) => ({
    label,
    status: i < indicatorStep ? "done" : i === indicatorStep ? "active" : "idle",
  }));
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function SigninPage() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [sentEmail, setSentEmail] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>({
    name: "스탠다드",
    billing: "monthly",
    monthlyPrice: 13500,
    annualTotal: 135000,
    annualDiscount: 27000,
  });

  // currentStep 바뀔때마다 스크롤 초기화
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const steps = buildSteps(currentStep);

  const handleVerificationSent = (email: string) => {
    setSentEmail(email);
    setCurrentStep(1);
  };

  const handleVerified = () => setCurrentStep(2);
  const handlePlanNext = (plan: SelectedPlan) => { setSelectedPlan(plan); setCurrentStep(3); };
  const handlePayBack = () => setCurrentStep(2);
  const handlePayComplete = () => setCurrentStep(4);

  // 뒤로가기: 로그인 페이지로 이동
  const handleGoBack = async () => {
    const user = auth.currentUser;
    if (user) {
      // 회원가입 중 이탈 시 생성된 계정 삭제 (인증 여부 무관)
      await user.delete().catch(() => { });
      // 혹시 남아있는 세션도 정리
      await signOut(auth).catch(() => { });
    }
    window.location.href = "/login";
  };
  // 완료 단계(step 4)에서는 뒤로가기 버튼 숨김
  const showBackButton = currentStep < 4;

  return (
    <div className="signin-page">

      {/* ── 뒤로가기 버튼 ──────────────────────────────────────────────── */}
      {showBackButton && (
        <button
          className="signin-back-btn"
          onClick={handleGoBack}
          aria-label="뒤로가기"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 18L9 12L15 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* ── 스텝 인디케이터 ──────────────────────────────────────────────── */}
      <div className="step-bar" aria-label="가입 단계">
        {steps.map((step, idx) => (
          <React.Fragment key={step.label}>
            <div className="step-node">
              <div className={`step-circle ${step.status}`}>{idx + 1}</div>
              <span className={`step-name ${step.status}`}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className="step-connector">
                <div className={`step-line ${step.status === "done" ? "done" : ""}`} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── 단계별 컴포넌트 ───────────────────────────────────────────────── */}
      {currentStep === 0 && (
        <StepRegister onVerificationSent={handleVerificationSent} />
      )}
      {currentStep === 1 && (
        <StepVerify email={sentEmail} onVerified={handleVerified} />
      )}
      {currentStep === 2 && (
        <StepPlan onNext={handlePlanNext} submitLabel="선택하기" />
      )}
      {currentStep === 3 && (
        <StepPayment
          plan={selectedPlan}
          onBack={handlePayBack}
          onComplete={handlePayComplete}
        />
      )}
      {currentStep === 4 && (
        <StepComplete plan={selectedPlan} />
      )}

    </div>
  );
}