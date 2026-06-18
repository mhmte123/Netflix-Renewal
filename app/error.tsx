"use client";
import React, { useEffect } from "react";
import AppIcon from "@/components/common/AppIcon";
import Link from "next/link";
import "./scss/error.scss";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Error caught:", error);
  }, [error]);

  // 에러 메시지 추정
  const isNetworkError =
    error.message?.toLowerCase().includes("fetch") ||
    error.message?.toLowerCase().includes("network");

  return (
    <div className="error-page">
      <div className="inner">
        <div className="error-container">
          <div className="error-graphic network"><AppIcon name="mood-exciting" size={44} color="#e50914" /></div>
          <div className="error-code">{isNetworkError ? "CONNECTION ERROR" : "SOMETHING WENT WRONG"}</div>
          <h1>
            {isNetworkError ? (
              <>
                네트워크 연결을<br />
                확인해주세요
              </>
            ) : (
              <>
                일시적인 문제가<br />
                발생했어요
              </>
            )}
          </h1>
          <p className="error-desc">
            {isNetworkError
              ? "인터넷 연결이 불안정하거나 끊어진 것 같아요. Wi-Fi 또는 데이터 연결 상태를 확인하고 다시 시도해주세요."
              : "예상치 못한 오류가 발생했어요. 잠시 후 다시 시도해주시거나, 문제가 계속되면 고객센터로 문의해주세요."}
          </p>

          <div className="error-actions">
            <button className="btn-primary" onClick={reset}>
              ⟳ 다시 시도
            </button>
            <Link href="/" className="btn-outline">
              홈으로 가기
            </Link>
          </div>

          <div className="error-suggest">
            <h3>{isNetworkError ? "확인 사항" : "도움이 필요하신가요?"}</h3>
            {isNetworkError ? (
              <ul className="suggest-list">
                <li>
                  <span>
                    <span>Wi-Fi 연결 상태 확인</span>
                    <span className="arrow">›</span>
                  </span>
                </li>
                <li>
                  <span>
                    <span>비행기 모드 해제</span>
                    <span className="arrow">›</span>
                  </span>
                </li>
                <li>
                  <span>
                    <span>VPN 설정 확인</span>
                    <span className="arrow">›</span>
                  </span>
                </li>
              </ul>
            ) : (
              <ul className="suggest-list">
                <li>
                  <Link href="/contact">
                    <span>고객센터 문의하기</span>
                    <span className="arrow">→</span>
                  </Link>
                </li>
                <li>
                  <Link href="/">
                    <span>홈으로 돌아가기</span>
                    <span className="arrow">→</span>
                  </Link>
                </li>
              </ul>
            )}
          </div>

          {/* 에러 상세 (개발용) */}
          {process.env.NODE_ENV === "development" && (
            <details className="error-detail">
              <summary>에러 상세 정보</summary>
              <pre>{error.message}</pre>
              {error.digest && <p className="digest">Digest: {error.digest}</p>}
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
