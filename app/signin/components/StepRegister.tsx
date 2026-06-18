"use client";

import { signUp, useSignUpStore } from "@/store/useSignUpStore";
import { useAuthStore } from "@/store/useAuthStore";
import { auth } from "@/firebase/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";

// ─── 아이콘 ────────────────────────────────────────────────────────────────────

const EyeOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepRegisterProps {
  onVerificationSent: (email: string) => void;
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function StepRegister({ onVerificationSent }: StepRegisterProps) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [agreeAll, setAgreeAll] = useState<boolean>(false);
  const [agreeRequired, setAgreeRequired] = useState<boolean>(false);
  const [agreeMarketing, setAgreeMarketing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // ── 전체 동의 ──────────────────────────────────────────────────────────────
  const handleAgreeAll = () => {
    const next = !agreeAll;
    setAgreeAll(next);
    setAgreeRequired(next);
    setAgreeMarketing(next);
  };

  const handleAgreeRequired = () => {
    const next = !agreeRequired;
    setAgreeRequired(next);
    if (!next) setAgreeAll(false);
    else if (agreeMarketing) setAgreeAll(true);
  };

  const handleAgreeMarketing = () => {
    const next = !agreeMarketing;
    setAgreeMarketing(next);
    if (next && agreeRequired) setAgreeAll(true);
    else setAgreeAll(false);
  };

  const allCheckClass =
    agreeRequired && agreeMarketing
      ? "agree-checkbox checked"
      : agreeRequired
        ? "agree-checkbox partial"
        : "agree-checkbox";

  // ── 이메일 회원가입 + 인증메일 발송 ────────────────────────────────────────
  const setUid = useSignUpStore((s) => s.setUid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("이메일과 비밀번호를 입력해주세요."); return; }
    if (password.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
    if (!agreeRequired) { setError("필수 약관에 동의해주세요."); return; }

    setError("");
    setIsLoading(true);
    try {
      const uid = await signUp(email, password);
      setUid(uid);
      const onLogin = useAuthStore.getState().onLogin;
      if (onLogin) onLogin({ userId: uid } as any);
      onVerificationSent(email);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;

      if (code === "auth/email-already-in-use") {
        // 같은 이메일+비밀번호로 로그인 시도해서 미인증 계정인지 확인
        try {
          const { user: existingUser } = await signInWithEmailAndPassword(auth, email, password);
          if (!existingUser.emailVerified) {
            // 미인증 계정이면 삭제 후 재가입
            await existingUser.delete();
            const uid = await signUp(email, password);
            setUid(uid);
            const onLogin = useAuthStore.getState().onLogin;
            if (onLogin) onLogin({ userId: uid } as any);
            onVerificationSent(email);
            return;
          } else {
            // 인증된 계정이면 진짜 중복
            setError("이미 사용 중인 이메일입니다.");
          }
        } catch {
          // 비밀번호가 달라서 로그인 실패 = 다른 사람 계정
          setError("이미 사용 중인 이메일입니다.");
        }
      } else if (code === "auth/weak-password") {
        setError("비밀번호가 너무 약합니다. 영문+숫자 조합 8자 이상을 사용해주세요.");
      } else {
        setError("회원가입에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="signin-form-wrap">
        <h1 className="signin-title">계정 만들기</h1>
        <p className="signin-subtitle">가입하고 무제한으로 즐기세요</p>

        {error && <div className="signin-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          {/* 이메일 */}
          <div className="form-field">
            <label htmlFor="signin-email" className="form-label">이메일</label>
            <input
              id="signin-email"
              type="email"
              placeholder="user@example.com"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <span className="form-hint">로그인 시 사용할 이메일입니다</span>
          </div>

          {/* 비밀번호 */}
          <div className="form-field">
            <label htmlFor="signin-password" className="form-label">비밀번호</label>
            <div className="input-wrap">
              <input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="form-input has-icon"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? <EyeOpenIcon /> : <EyeOffIcon />}
              </button>
            </div>
            <span className="form-hint">영문, 숫자 포함 8자 이상</span>
          </div>

          {/* 약관 동의 */}
          <div className="agree-section">
            <div className="agree-all" onClick={handleAgreeAll} role="button" tabIndex={0}>
              <div className={allCheckClass} />
              <span className="agree-text all">전체 동의</span>
            </div>
            <div className="agree-row" onClick={handleAgreeRequired} role="button" tabIndex={0}>
              <div className={`agree-checkbox ${agreeRequired ? "checked" : ""}`} />
              <span className="agree-text">[필수] 이용약관 · 개인정보처리방침 동의</span>
            </div>
            <div className="agree-row" onClick={handleAgreeMarketing} role="button" tabIndex={0}>
              <div className={`agree-checkbox ${agreeMarketing ? "checked" : ""}`} />
              <span className="agree-text">[선택] 마케팅 정보 수신 동의</span>
            </div>
          </div>

          <button
            type="submit"
            className={`btn-submit${isLoading ? " is-loading" : ""}`}
            disabled={isLoading}
          >
            {isLoading ? "" : "가입하기"}
          </button>
        </form>

        <p className="signin-login-link">
          이미 회원이신가요?
          <a href="/login">로그인</a>
        </p>
      </div>
    </>
  );
}