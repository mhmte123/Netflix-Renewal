"use client";

import { auth } from "@/firebase/firebase";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useState } from "react";
import "../scss/login.scss";

type Status = "verifying" | "ready" | "invalid" | "done" | "email-verified";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const mode = searchParams.get("mode");

  const [status, setStatus] = useState<Status>("verifying");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 비밀번호 변경 완료를 원래 탭(forgot-password)에 알리고 이 창은 닫는다
  const notifyDoneAndClose = () => {
    try {
      window.localStorage.setItem("password-reset-done", String(Date.now()));
    } catch {
      // localStorage 접근 불가 시 무시
    }
    setStatus("done");
    window.close();
  };

  useEffect(() => {
    if (!oobCode) {
      // Firebase 기본 페이지의 "계속" 버튼이 continueUrl로 파라미터 없이
      // 넘어온 경우 → 비밀번호 변경이 이미 완료된 것으로 간주
      notifyDoneAndClose();
      return;
    }

    // 회원가입 이메일 인증 메일의 링크인 경우
    // 실제 인증 처리는 Firebase가 oobCode를 받는 시점에 이미 완료되며,
    // 가입 화면(StepVerify)의 폴링이 이를 감지하므로 안내만 표시한다.
    if (mode === "verifyEmail") {
      setStatus("email-verified");
      return;
    }

    if (mode !== "resetPassword") {
      setStatus("invalid");
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setStatus("ready");
      })
      .catch(() => {
        // Firebase 기본 비밀번호 재설정 페이지에서 이미 oobCode가 소모된
        // 상태로 "계속" 버튼을 통해 넘어온 경우 → 변경이 이미 완료된 것으로 간주
        notifyDoneAndClose();
      });
  }, [oobCode, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newPassword || !newPasswordConfirm) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (!oobCode) {
      setError("잘못된 요청입니다. 다시 시도해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("done");
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" &&
          err !== null &&
          "code" in err &&
          typeof err.code === "string"
          ? err.code
          : "";

      if (errorCode === "auth/expired-action-code") {
        setError("재설정 링크가 만료되었습니다. 다시 요청해 주세요.");
      } else if (errorCode === "auth/invalid-action-code") {
        setError("유효하지 않은 링크입니다. 다시 요청해 주세요.");
      } else if (errorCode === "auth/weak-password") {
        setError("비밀번호가 너무 약합니다. 다른 비밀번호를 사용해 주세요.");
      } else {
        setError("비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-panel" style={{ flex: 1 }}>
        <div className="login-card">
          {status === "email-verified" && (
            <>
              <h2 className="login-title">이메일 인증<br />완료</h2>
              <p className="login-subtitle">
                이메일 인증이 완료되었어요. 가입 화면으로 돌아가면 자동으로
                다음 단계로 넘어갑니다.
              </p>
              <Link
                href="/signin"
                className="login-btn"
                style={{ display: "block", textAlign: "center", textDecoration: "none", lineHeight: "27px" }}
              >
                가입 화면으로 돌아가기
              </Link>
            </>
          )}

          {status === "verifying" && (
            <>
              <h2 className="login-title">확인 중이에요</h2>
              <p className="login-subtitle">잠시만 기다려 주세요.</p>
            </>
          )}

          {status === "invalid" && (
            <>
              <h2 className="login-title">링크가 유효하지<br />않아요</h2>
              <p className="login-subtitle">
                재설정 링크가 만료되었거나 잘못되었습니다. 비밀번호 찾기를
                다시 시도해 주세요.
              </p>
              <Link
                href="/forgot-password"
                className="login-btn"
                style={{ display: "block", textAlign: "center", textDecoration: "none", lineHeight: "27px" }}
              >
                비밀번호 찾기로 이동
              </Link>
            </>
          )}

          {status === "ready" && (
            <>
              <h2 className="login-title">새 비밀번호<br />설정</h2>
              <p className="login-subtitle">
                {email} 계정의 새 비밀번호를 입력해 주세요.
              </p>

              {error && <div className="login-error" role="alert">{error}</div>}

              <form className="login-form" onSubmit={handleSubmit} noValidate>
                <div className="form-field">
                  <label htmlFor="new-password" className="form-label">새 비밀번호</label>
                  <input
                    id="new-password"
                    type="password"
                    placeholder="8자 이상 입력"
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="new-password-confirm" className="form-label">새 비밀번호 확인</label>
                  <input
                    id="new-password-confirm"
                    type="password"
                    className="form-input"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  className={`login-btn${isSubmitting ? " is-loading" : ""}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "" : "비밀번호 변경"}
                </button>
              </form>
            </>
          )}

          {status === "done" && (
            <>
              <h2 className="login-title">비밀번호 변경<br />완료</h2>
              <p className="login-subtitle">
                비밀번호가 안전하게 변경되었어요. 이 창은 닫으셔도 되고,
                기존에 열려있던 화면에서 자동으로 로그인 화면으로
                이동합니다.
              </p>
              <button
                type="button"
                className="login-btn"
                onClick={() => {
                  window.close();
                  router.push("/login");
                }}
              >
                창 닫기 / 로그인으로 이동
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}