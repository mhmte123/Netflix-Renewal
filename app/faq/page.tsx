"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import AppIcon, { type AppIconName } from "@/components/common/AppIcon";
import FaqAccordion from "@/components/common/FaqAccordion";
import { FAQ_CATEGORIES } from "@/data/faq";
import "../scss/faq.scss";
import BackButton from "@/components/common/BackButton";

type FaqSearchItem = {
  q: string;
  a: string;
};

export default function FaqAllPage() {
  const [keyword, setKeyword] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const kw = keyword.trim();

  const sections = useMemo(() => {
    return FAQ_CATEGORIES.filter(
      (category) => activeCat === "all" || category.id === activeCat,
    )
      .map((category) => ({
        ...category,
        items: kw
          ? category.items.filter(
              (item: FaqSearchItem) =>
                item.q.includes(kw) || item.a.includes(kw),
            )
          : category.items,
      }))
      .filter((category) => category.items.length > 0);
  }, [activeCat, kw]);

  const totalCount = sections.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );

  return (
    <div className="faq-page">
      <div className="inner">
        <BackButton fallback="/contact?tab=faq" />
        <div className="page-head">
          <h1>자주 묻는 질문</h1>
          <p>
            궁금한 점을 카테고리별로 모아봤어요. 원하는 답을 못 찾으셨다면 1:1
            문의를 남겨주세요.
          </p>
        </div>

        <div className="faq-search">
          <span className="icon">⌕</span>
          <input
            type="text"
            placeholder="궁금한 내용을 검색해보세요 (예: 환불, 자막, 플랜 변경)"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>

        <div className="faq-cat-nav">
          <button
            type="button"
            className={`cat-chip ${activeCat === "all" ? "active" : ""}`}
            onClick={() => setActiveCat("all")}
          >
            전체
          </button>
          {FAQ_CATEGORIES.map((category) => (
            <button
              type="button"
              key={category.id}
              className={`cat-chip ${activeCat === category.id ? "active" : ""}`}
              onClick={() => setActiveCat(category.id)}
            >
              <span className="chip-icon">
                <AppIcon name={category.icon as AppIconName} size={18} />
              </span>
              {category.name}
            </button>
          ))}
        </div>

        {sections.length > 0 ? (
          <div className="faq-sections">
            {sections.map((category) => (
              <section key={category.id} className="faq-section">
                <div className="faq-section-head">
                  <span className="head-icon">
                    <AppIcon name={category.icon as AppIconName} size={18} />
                  </span>
                  <h2>{category.name}</h2>
                  <span className="count">{category.items.length}개</span>
                </div>
                <FaqAccordion items={category.items} />
              </section>
            ))}
          </div>
        ) : (
          <div className="faq-no-result">
            <p>{`"${kw}" 에 대한 검색 결과가 없어요.`}</p>
          </div>
        )}

        <div className="faq-foot-cta">
          <p>원하는 답변을 찾지 못하셨나요?</p>
          <Link href="/contact?tab=inquiry" className="cta-btn">
            1:1 문의하기
          </Link>
        </div>

        {totalCount > 0 && (
          <p className="faq-total-hint">
            현재 {totalCount}개의 질문을 보고 있어요.
          </p>
        )}
      </div>
    </div>
  );
}
