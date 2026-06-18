"use client";

import { auth } from "@/firebase/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import "../scss/login.scss";
import "../signin/signin.scss";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  // ── 다른 탭에서 비밀번호 재설정이 완료되면 자동으로 로그인 화면으로 이동 ──
  useEffect(() => {
    if (!isSent) return;

    const checkDone = () => {
      try {
        if (window.localStorage.getItem("password-reset-done")) {
          window.localStorage.removeItem("password-reset-done");
          router.push("/login");
        }
      } catch {
        // localStorage 접근 불가 시 무시
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "password-reset-done" && e.newValue) {
        router.push("/login");
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", checkDone);
    checkDone();

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", checkDone);
    };
  }, [isSent, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
      try {
        window.localStorage.removeItem("password-reset-done");
      } catch {
        // localStorage 접근 불가 시 무시
      }
      setIsSent(true);
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" &&
          err !== null &&
          "code" in err &&
          typeof err.code === "string"
          ? err.code
          : "";

      if (errorCode === "auth/user-not-found") {
        setError("해당 이메일로 가입된 계정을 찾을 수 없습니다.");
      } else if (errorCode === "auth/invalid-email") {
        setError("올바른 이메일 형식이 아닙니다.");
      } else if (errorCode === "auth/too-many-requests") {
        setError("너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError("요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-panel" style={{ flex: 1 }}>
        <div className="login-card">
          {isSent ? (
            <div className="signin-form-wrap">
              <div className="verify-icon-wrap" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>

              <h1 className="signin-title">메일함을 확인해주세요</h1>
              <p className="signin-subtitle">
                <strong className="verify-email">{email}</strong> 으로 비밀번호 재설정 메일을 발송했습니다.
              </p>

              {/* <div className="verify-info-box">
                <p className="verify-info-text">
                  메일의 링크에서 새 비밀번호를 설정하면<br />
                  자동으로 로그인 화면으로 이동합니다.
                </p>
                <div className="verify-spinner" aria-label="재설정 확인 중">
                  <span /><span /><span />
                </div>
              </div>

              <p className="verify-spam-hint">메일이 오지 않으면 스팸 폴더를 확인해주세요.</p> */}
            </div>
          ) : (
            <>
              <h2 className="login-title">비밀번호를<br />잊으셨나요?</h2>
              <p className="login-subtitle">
                가입하신 이메일을 입력하면 비밀번호 재설정 링크를 보내드려요.
              </p>

              {error && <div className="login-error" role="alert">{error}</div>}

              <form className="login-form" onSubmit={handleSubmit} noValidate>
                <div className="form-field">
                  <label htmlFor="forgot-email" className="form-label">이메일</label>
                  <input
                    id="forgot-email"
                    type="email"
                    placeholder="example@email.com"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  className={`login-btn${isLoading ? " is-loading" : ""}`}
                  disabled={isLoading}
                >
                  {isLoading ? "" : "재설정 메일 보내기"}
                </button>
              </form>
            </>
          )}

          <div className="form-options" style={{ justifyContent: "center", marginTop: "20px" }}>
            <Link
              href="/login"
              className="login-btn"
              style={{ display: "block", textAlign: "center", textDecoration: "none", lineHeight: "27px" }}
            >
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}