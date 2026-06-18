"use client";

import { useState } from "react";
import { auth } from "@/firebase/firebase";
import { updatePlan, useSignUpStore } from "@/store/useSignUpStore";
import { getFaqItems } from "@/data/faq";
import FaqAccordion from "@/components/common/FaqAccordion";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

// ─── 타입 ──────────────────────────────────────────────────────────────────────

type BillingCycle = "monthly" | "annual";

export interface SelectedPlan {
  name: string;
  billing: BillingCycle;
  monthlyPrice: number;
  annualTotal: number;
  annualDiscount: number;
}

interface StepPlanProps {
  onNext: (plan: SelectedPlan) => void;
  currentPlanType?: string;
  currentBilling?: string;
  submitLabel?: string;
  hideTitle?: boolean;
  skipFirestore?: boolean;
}

interface PlanData {
  id: string;
  name: string;
  desc: string;
  monthly: { price: number };
  annual: { monthlyEquiv: number; total: number; originalTotal: number };
  features: { label: string; included: boolean }[];
  recommended: boolean;
}

// ─── 플랜 데이터 ──────────────────────────────────────────────────────────────

const PLANS: PlanData[] = [
  {
    id: "basic",
    name: "베이직",
    desc: "광고 포함 · 표준 화질",
    monthly: { price: 7000 },
    annual: { monthlyEquiv: 5810, total: 69720, originalTotal: 84000 },
    features: [
      { label: "HD 화질 (720p)", included: true },
      { label: "1개 기기 동시 시청", included: true },
      { label: "모바일·태블릿·노트북·TV", included: true },
      { label: "광고 없는 시청", included: false },
      { label: "콘텐츠 다운로드", included: false },
    ],
    recommended: false,
  },
  {
    id: "standard",
    name: "스탠다드",
    desc: "광고 없음 · FHD 화질",
    monthly: { price: 13500 },
    annual: { monthlyEquiv: 11250, total: 135000, originalTotal: 162000 },
    features: [
      { label: "FHD 화질 (1080p)", included: true },
      { label: "2개 기기 동시 시청", included: true },
      { label: "모바일·태블릿·노트북·TV", included: true },
      { label: "광고 없는 시청", included: true },
      { label: "2대 기기에 콘텐츠 저장", included: true },
    ],
    recommended: true,
  },
  {
    id: "premium",
    name: "프리미엄",
    desc: "광고 없음 · UHD 화질",
    monthly: { price: 17000 },
    annual: { monthlyEquiv: 14167, total: 170000, originalTotal: 204000 },
    features: [
      { label: "UHD 4K + HDR", included: true },
      { label: "4개 기기 동시 시청", included: true },
      { label: "모바일·태블릿·노트북·TV", included: true },
      { label: "광고 없는 시청", included: true },
      { label: "6대 기기에 콘텐츠 저장", included: true },
    ],
    recommended: false,
  },
];

const COMPARE_ROWS = [
  {
    label: "월 요금",
    monthly: ["7,000원", "13,500원", "17,000원"],
    annual: ["4,583원", "11,250원", "14,167원"],
  },
  {
    label: "연간 청구액",
    monthly: ["—", "—", "—"],
    annual: ["55,000원", "135,000원", "170,000원"],
  },
  {
    label: "절약 금액",
    monthly: ["—", "—", "—"],
    annual: ["11,000원", "27,000원", "34,000원"],
  },
  {
    label: "광고",
    monthly: ["포함", "없음", "없음"],
    annual: ["포함", "없음", "없음"],
  },
  {
    label: "화질",
    monthly: ["HD 720p", "FHD 1080p", "UHD 4K+HDR"],
    annual: ["HD 720p", "FHD 1080p", "UHD 4K+HDR"],
  },
  {
    label: "동시 시청",
    monthly: ["1대", "2대", "4대"],
    annual: ["1대", "2대", "4대"],
  },
  {
    label: "다운로드",
    monthly: ["불가", "2대까지", "6대까지"],
    annual: ["불가", "2대까지", "6대까지"],
  },
];

// 플랜 관련 FAQ 는 data/faq.ts 의 "plan" 카테고리에서 가져옵니다.
const PLAN_FAQS = getFaqItems("plan");

// ─── 숫자 포맷 ────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("ko-KR");

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function StepPlan({ onNext, currentPlanType, currentBilling, submitLabel = "다음", hideTitle, skipFirestore }: StepPlanProps) {
  const [billing, setBilling] = useState<BillingCycle>("monthly"); // 기본: 월간
  const [selected, setSelected] = useState<string>("standard");
  const router = useRouter();
  const { user } = useAuthStore();

  const uid = useSignUpStore((s) => s.uid) ?? auth.currentUser?.uid ?? user?.userId;

  // 기존과 같은 플랜일경우 경고표시
  const [error, setError] = useState<string>("");

  const handleNext = async () => {
    const planData = PLANS.find((p) => p.id === selected);
    if (!planData) return;

    // 같은 플랜 + 같은 billing 체크 ← 추가
    if (currentPlanType === selected && currentBilling === billing) {
      setError("현재 구독 중인 플랜과 동일해요. 다른 플랜을 선택해주세요.");
      return;
    }

    setError("");

    // skipFirestore가 아닐 때만 Firestore 저장
    if (!skipFirestore && uid) {
      await updatePlan(uid, selected, billing);
    }

    onNext({
      name: planData.name,
      billing,
      monthlyPrice: planData.monthly.price,
      annualTotal: planData.annual.total,
      annualDiscount: planData.annual.originalTotal - planData.annual.total,
    });
  };

  return (
    <div className="plan-page">
      {/* 타이틀 — hideTitle일 때 숨김 */}
      {!hideTitle && (
        <>
          <h1 className="plan-title">나에게 맞는 플랜을 선택하세요</h1>
          <p className="plan-subtitle">언제든 변경하거나 해지할 수 있어요</p>
        </>
      )}

      {/* ── 결제 주기 탭 ──────────────────────────────────────────────────── */}
      <div className="billing-tab-wrap">
        <div className="billing-tabs">
          <button
            type="button"
            className={`billing-tab${billing === "monthly" ? " active" : ""}`}
            onClick={() => setBilling("monthly")}
          >
            월간 결제
          </button>
          <button
            type="button"
            className={`billing-tab${billing === "annual" ? " active" : ""}`}
            onClick={() => setBilling("annual")}
          >
            연간 결제
            <span className="billing-save-badge">최대 17% 절약</span>
          </button>
        </div>
      </div>

      {/* ── 플랜 카드 ─────────────────────────────────────────────────────── */}
      <div className="plan-grid">
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          // 수정 — 플랜 종류 + 결제 주기 둘 다 같아야 사용중
          const isCurrent = currentPlanType === plan.id && currentBilling === billing;
          return (
            <div
              key={plan.id}
              className={`plan-card${plan.recommended && isSelected ? " recommended" : ""}
              ${isSelected ? " selected" : ""} ${isCurrent ? " current" : ""}`}
              onClick={() => setSelected(plan.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setSelected(plan.id)}
            >
              {/* 추천 뱃지 */}
              {plan.recommended && (
                <span className="plan-top-badge">추천</span>
              )}
              {/* 사용중 뱃지 ← 추가 */}
              {isCurrent && <span className="plan-current-badge">사용중</span>}

              <p className="plan-name">{plan.name}</p>

              {/* 가격 */}
              {billing === "monthly" ? (
                <div className="price-block">
                  <div className="price-row">
                    <span className="price-num">{fmt(plan.monthly.price)}</span>
                    <span className="price-unit">원/월</span>
                  </div>
                </div>
              ) : (
                <div className="price-block">
                  <div className="price-row">
                    <span className="price-num">{fmt(plan.annual.monthlyEquiv)}</span>
                    <span className="price-unit">원/월</span>
                  </div>
                  <p className="price-annual-info">
                    연 {fmt(plan.annual.total)}원
                    <span className="price-original">{fmt(plan.annual.originalTotal)}원</span>
                    <span className="price-save">17% 절약</span>
                  </p>
                </div>
              )}

              <hr className="plan-divider" />
              <p className="plan-desc">{plan.desc}</p>

              {/* 기능 목록 */}
              <ul className="feature-list">
                {plan.features.map((f) => (
                  <li key={f.label} className={`feature-item${f.included ? " on" : " off"}`}>
                    {f.included
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e50914" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    }
                    {f.label}
                  </li>
                ))}
              </ul>

              {/* <button
                type="button"
                className={`plan-select-btn${isSelected ? " hot" : " default"}`}
                onClick={(e) => { e.stopPropagation(); setSelected(plan.id); }}
              >
                선택 됨
              </button> */}
            </div>
          );
        })}
      </div>

      {/* ── 상세 비교 ─────────────────────────────────────────────────────── */}
      <p className="section-title">상세 비교</p>
      <div className="compare-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>베이직</th>
              <th>스탠다드</th>
              <th>프리미엄</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => {
              const vals = billing === "monthly" ? row.monthly : row.annual;
              return (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={
                      (selected === "basic" && i === 0) ||
                        (selected === "standard" && i === 1) ||
                        (selected === "premium" && i === 2)
                        ? "highlight" : ""
                    }>{v}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <p className="section-title">자주 묻는 질문</p>
      <FaqAccordion items={PLAN_FAQS} />

      {/* 에러 */}
      {error && (
        <div className="plan-next-wrap">
          <p className="signin-error" style={{ width: "100%", textAlign: "center", marginBottom: "30px" }}>
            {error}
          </p>
        </div>
      )}

      {/* 다음 버튼 */}
      <div className="plan-next-wrap">
        <button
          type="button"
          className="plan-next-btn"
          onClick={handleNext}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
