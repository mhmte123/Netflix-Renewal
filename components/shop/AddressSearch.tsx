"use client";

import { useCallback, useState } from "react";

// 케이스티파이에서 쓰던 주소 자동입력(다음 우편번호)을 넷플릭스 굿즈 결제에 이식.
// react-daum-postcode 패키지 의존 없이, 공식 스크립트를 동적 로드해서 사용한다.
const SCRIPT_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type AddressResult = { zipcode: string; address: string };

type Props = {
  onSelect: (result: AddressResult) => void;
  className?: string;
  label?: string;
};

declare global {
  interface Window {
    // 다음 우편번호 전역 객체 (스크립트 로드 후 주입됨)
    daum?: { Postcode: new (opts: Record<string, unknown>) => { open: () => void } };
  }
}

function loadPostcodeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    if (window.daum?.Postcode) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load error")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("load error"));
    document.body.appendChild(script);
  });
}

export default function AddressSearch({
  onSelect,
  className,
  label = "주소 검색",
}: Props) {
  const [loading, setLoading] = useState(false);

  const open = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await loadPostcodeScript();
      if (!window.daum?.Postcode) return;
      new window.daum.Postcode({
        oncomplete: (raw: unknown) => {
          const data = raw as {
            zonecode: string;
            address: string;
            roadAddress?: string;
            addressType?: string;
            bname?: string;
            buildingName?: string;
          };
          // 도로명 주소 우선, 참고항목(법정동/건물명)을 괄호로 덧붙임 (케이스티파이와 동일 규칙)
          let full = data.roadAddress || data.address || "";
          if (data.addressType === "R") {
            let extra = "";
            if (data.bname) extra += data.bname;
            if (data.buildingName)
              extra += extra ? `, ${data.buildingName}` : data.buildingName;
            if (extra) full += ` (${extra})`;
          }
          onSelect({ zipcode: data.zonecode, address: full });
        },
      }).open();
    } catch {
      // 스크립트 로드 실패 시: 수동 입력으로 진행 가능하므로 조용히 무시
    } finally {
      setLoading(false);
    }
  }, [loading, onSelect]);

  return (
    <button
      type="button"
      className={className ?? "address-search-btn"}
      onClick={open}
      disabled={loading}
    >
      {loading ? "여는 중…" : label}
    </button>
  );
}
