"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import "@/app/signin/signin.scss";
import "./cancel.scss";  // ← 추가
type Step = 1 | 2;

export default function CancelPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    const uid = user?.userId ?? auth.currentUser?.uid;
    // console.log("uid:", uid);
    if (!uid) {
      setError("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const snap = await getDoc(doc(db, "users", uid));
      const currentPlanType = snap.exists() ? (snap.data().planType ?? "") : "";

      await updateDoc(doc(db, "users", uid), {
        planType: "",
        "payment.lastPlanType": currentPlanType,
        updatedAt: serverTimestamp(),
      });
      setStep(2);
    } catch {
      setError("해지 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };
  const [nextDate, setNextDate] = useState<string>("");

  useEffect(() => {
    const uid = user?.userId ?? auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return;
      setNextDate(snap.data().payment?.nextDate ?? "");
    });
  }, [user?.userId]);

  return (
    <div className="signin-page">

      {/* step 1 — 해지 확인 */}
      {step === 1 && (
        <div className="complete-page">
          <div className="cancel-check-circle" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#f40612" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>

          <h1 className="complete-title">정말 해지하시겠어요?</h1>
          <p className="complete-sub">해지하면 현재 구독 기간 만료일까지 서비스를 이용할 수 있으며,<br /> 이후 모든 콘텐츠 이용이 제한됩니다.</p>

          <div className="complete-receipt" style={{ marginBottom: "28px" }}>
            <div className="receipt-body">
              <div className="receipt-row">
                <span className="receipt-label">해지 후 변경사항</span>
                <span className="receipt-value" style={{ color: "#f40612" }}>플랜 해지</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">콘텐츠 이용</span>
                <span className="receipt-value">{nextDate ? `${nextDate} 까지 유지` : "만료일까지 유지"}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">자동 결제</span>
                <span className="receipt-value">즉시 중단</span>
              </div>
            </div>
          </div>

          {error && <div className="signin-error" role="alert" style={{ marginBottom: "16px", width: "100%" }}>{error}</div>}

          <button
            type="button"
            className={`cancel-btn${isLoading ? " is-loading" : ""}`}
            onClick={handleCancel}
            disabled={isLoading}
          >
            {isLoading ? "" : "해지하기"}
          </button>
          <button
            type="button"
            className="payment-back-btn"
            onClick={() => router.push("/settings?tab=membership")}
            disabled={isLoading}
          >
            돌아가기
          </button>
        </div>
      )}

      {/* step 2 — 해지 완료 */}
      {step === 2 && (
        <div className="complete-page">
          <div className="complete-check-circle" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="complete-title">구독이 해지되었어요</h1>
          <p className="complete-sub">그동안 이용해주셔서 감사합니다. 언제든 다시 구독하실 수 있어요.</p>

          <button
            type="button"
            className="complete-home-btn"
            onClick={() => router.push("/")}
          >
            메인으로 가기
          </button>
        </div>
      )}

    </div>
  );
}