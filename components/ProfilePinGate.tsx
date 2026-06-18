"use client";

import React, { useRef, useState } from "react";
import type { UserProfile } from "@/types/auth";

type StoredPin = {
  pin?: string;
};

type ProfilePinGateProps = {
  profile: UserProfile | null | undefined;
  description?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
};

export function getProfilePin(profileId: number | null | undefined) {
  if (!profileId || typeof window === "undefined") return "";

  try {
    const savedValue = window.localStorage.getItem(
      `netflix-profile-pin-${profileId}`,
    );
    const parsedValue = savedValue ? (JSON.parse(savedValue) as StoredPin) : null;
    return parsedValue?.pin ?? "";
  } catch {
    return "";
  }
}

export default function ProfilePinGate({
  profile,
  description,
  onCancel,
  onSuccess,
}: ProfilePinGateProps) {
  const [storedPin] = useState(() => {
    return getProfilePin(profile?.id);
  });
  const [draftPin, setDraftPin] = useState(["", "", "", ""]);
  const [isUnlocked, setIsUnlocked] = useState(!storedPin);
  const [error, setError] = useState("");
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  if (!storedPin || isUnlocked) return null;

  const updatePin = (index: number, value: string) => {
    const nextValue = value.replace(/\D/g, "").slice(-1);
    setError("");
    setDraftPin((current) =>
      current.map((digit, digitIndex) =>
        digitIndex === index ? nextValue : digit,
      ),
    );

    if (nextValue && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const submitPin = () => {
    const nextPin = draftPin.join("");

    if (nextPin.length !== 4) {
      setError("4자리 PIN을 모두 입력해 주세요.");
      return;
    }

    if (nextPin !== storedPin) {
      setError("PIN 번호가 일치하지 않습니다.");
      setDraftPin(["", "", "", ""]);
      inputRefs.current[0]?.focus();
      return;
    }

    setIsUnlocked(true);
    onSuccess?.();
  };

  const goBack = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    window.history.back();
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPin();
      return;
    }

    if (event.key === "Backspace" && !draftPin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="profile-pin-gate-backdrop" role="dialog" aria-modal="true">
      <div className="profile-pin-gate">
        <button
          type="button"
          className="profile-pin-gate-back"
          onClick={goBack}
        >
          <span aria-hidden="true" />
          뒤로가기
        </button>
        <h2>PIN 번호를 입력해 주세요</h2>
        <p>
          {description ??
            `${profile?.nickname ?? "프로필"} 설정을 이용하려면 PIN이 필요합니다.`}
        </p>
        <div className="profile-pin-gate-inputs">
          {draftPin.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => updatePin(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className={error ? "is-error" : ""}
              aria-label={`${index + 1}번째 PIN 숫자`}
              autoFocus={index === 0}
            />
          ))}
        </div>
        {error && <span className="profile-pin-gate-error">{error}</span>}
        <button
          type="button"
          className="profile-pin-gate-submit"
          onClick={submitPin}
        >
          확인
        </button>
      </div>
    </div>
  );
}
