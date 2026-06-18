"use client";

import { useState } from "react";
import { FaqItem } from "@/types/faq";
import "./faqAccordion.scss";

interface FaqAccordionProps {
  items: FaqItem[];
  defaultOpen?: number | null; // 처음에 펼쳐둘 항목 인덱스 (없으면 모두 닫힘)
}

// 모든 페이지에서 공통으로 쓰는 FAQ 아코디언.
// 디자인/동작을 한 곳에서 관리하기 위해 컴포넌트로 분리했습니다.
export default function FaqAccordion({ items, defaultOpen = null }: FaqAccordionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(defaultOpen);

  if (!items.length) {
    return <div className="faq-accordion-empty">표시할 질문이 없습니다.</div>;
  }

  return (
    <ul className="faq-accordion">
      {items.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <li key={idx} className={`faq-acc-item ${isOpen ? "open" : ""}`}>
            <button
              type="button"
              className="faq-acc-q"
              aria-expanded={isOpen}
              onClick={() => setOpenIdx(isOpen ? null : idx)}
            >
              <span className="q-text">{item.q}</span>
              <svg
                className={`q-arrow ${isOpen ? "is-open" : ""}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <div className={`faq-acc-a ${isOpen ? "open" : ""}`}>
              <p>{item.a}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
