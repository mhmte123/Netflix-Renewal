"use client";

import { auth } from "@/firebase/firebase";
import { sendEmailVerification } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { createUserDocument } from "@/store/useSignUpStore";

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepVerifyProps {
  email: string;
  onVerified: () => void; // 인증 완료 → 플랜 선택 단계로
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function StepVerify({ email, onVerified }: StepVerifyProps) {
  const [resendCooldown, setResendCooldown] = useState<number>(60); // 재발송 쿨다운(초)
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const [resendMsg, setResendMsg] = useState<string>("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 이메일 인증 여부 폴링 (5초마다) ────────────────────────────────────────
  useEffect(() => {
    pollingRef.current = setInterval(async () => {
      const user = auth.currentUser;
      if (!user) return;
      await user.reload();
      if (user.emailVerified) {
        clearInterval(pollingRef.current!);
        await createUserDocument({ uid: user.uid, email: user.email! });
        onVerified();
      }
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [onVerified]);

  // ── 재발송 쿨다운 카운트다운 ────────────────────────────────────────────────
  useEffect(() => {
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ── 인증 메일 재발송 ────────────────────────────────────────────────────────
  const handleResend = async () => {
    const user = auth.currentUser;
    if (!user || resendCooldown > 0) return;
    setResendLoading(true);
    try {
      await sendEmailVerification(user);
      setResendMsg("인증 메일을 다시 발송했습니다.");
      setResendCooldown(60);
      // 쿨다운 재시작
      cooldownRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setResendMsg("발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="signin-form-wrap">
      {/* 메일 아이콘 */}
      <div className="verify-icon-wrap" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      </div>

      <h1 className="signin-title">메일함을 확인해주세요</h1>
      <p className="signin-subtitle">
        <strong className="verify-email">{email}</strong> 으로 인증 메일을 발송했습니다.
      </p>

      <div className="verify-info-box">
        <p className="verify-info-text">
          메일의 인증 링크를 클릭하면<br />
          자동으로 다음 단계로 넘어갑니다.
        </p>
        <div className="verify-spinner" aria-label="인증 확인 중">
          <span /><span /><span />
        </div>
      </div>

      {resendMsg && (
        <p className="verify-resend-msg">{resendMsg}</p>
      )}

      <button
        type="button"
        className={`btn-resend${resendCooldown > 0 ? " disabled" : ""}${resendLoading ? " is-loading" : ""}`}
        onClick={handleResend}
        disabled={resendCooldown > 0 || resendLoading}
      >
        {resendLoading
          ? ""
          : resendCooldown > 0
            ? `재발송 (${resendCooldown}초 후 가능)`
            : "인증 메일 다시 보내기"}
      </button>

      <p className="verify-spam-hint">메일이 오지 않으면 스팸 폴더를 확인해주세요.</p>
    </div>
  );
}
