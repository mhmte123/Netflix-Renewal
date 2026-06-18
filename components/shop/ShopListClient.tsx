"use client";

import { useEffect, useMemo, useState } from "react";
import { useGoodsStore } from "@/store/useGoodsStore";
import { useAvailablePoints } from "@/store/usePointStore";
import { GOODS_CATEGORIES, pts } from "@/data/goods";
import type { GoodsCategory } from "@/types/goods";
import ShopTopBar from "./ShopTopBar";
import GoodsCard from "./GoodsCard";
import CategoryIcon from "./CategoryIcon";
import "./scss/shop.scss";

type SortKey = "recommend" | "pointLow" | "pointHigh";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recommend", label: "추천순" },
  { key: "pointLow", label: "포인트 낮은순" },
  { key: "pointHigh", label: "포인트 높은순" },
];

export default function ShopListClient() {
  const { products, loadProducts } = useGoodsStore();
  const { available } = useAvailablePoints();
  const [cat, setCat] = useState<GoodsCategory | "all">("all");
  const [sort, setSort] = useState<SortKey>("recommend");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const list = useMemo(() => {
    let arr = products;
    if (cat !== "all") arr = arr.filter((p) => p.category === cat);
    arr = [...arr];
    if (sort === "pointLow") arr.sort((a, b) => a.points - b.points);
    else if (sort === "pointHigh") arr.sort((a, b) => b.points - a.points);
    return arr;
  }, [products, cat, sort]);

  return (
    <div className="shop-page">
      <div className="shop-shell">
        <ShopTopBar title="굿즈샵" hidePoints />

        <div className="shop-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/shop/kpop-still-01.jpg" alt="" className="shop-hero__bg" aria-hidden />
          <div className="shop-hero__inner">
            <div className="shop-hero__text">
              <div className="shop-hero__eyebrow">POINT EXCHANGE</div>
              <h1 className="shop-hero__title">
                <span className="shop-hero__title--accent">모은 포인트</span>로<br />
                굿즈를 받아보세요
              </h1>
              <p className="shop-hero__sub">
                뱃지로 모은 포인트로 교환 · 배송비만 결제하면 끝
              </p>
            </div>
            <div className="shop-hero__point-box">
              <span className="shop-hero__point-label">보유 포인트</span>
              <span className="shop-hero__point-value">{pts(available)}</span>
            </div>
          </div>
        </div>

        <div className="shop-toolbar">
          <div className="shop-chips">
            <button
              className={`shop-chip${cat === "all" ? " active" : ""}`}
              onClick={() => setCat("all")}
            >
              전체
            </button>
            {GOODS_CATEGORIES.map((c) => (
              <button
                key={c.key}
                className={`shop-chip${cat === c.key ? " active" : ""}`}
                onClick={() => setCat(c.key)}
              >
                <CategoryIcon name={c.iconKey} size={14} /> {c.label}
              </button>
            ))}
          </div>
          <div className="shop-sort-wrap">
            <button
              className="shop-sort"
              onClick={() => setSortOpen((o) => !o)}
            >
              {SORT_OPTIONS.find((o) => o.key === sort)?.label}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.15s", transform: sortOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {sortOpen && (
              <>
                <div className="shop-sort-backdrop" onClick={() => setSortOpen(false)} />
                <div className="shop-sort-dropdown">
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      className={`shop-sort-option${sort === o.key ? " active" : ""}`}
                      onClick={() => { setSort(o.key); setSortOpen(false); }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="shop-loading">상품을 불러오는 중…</div>
        ) : (
          <div className="shop-grid">
            {list.map((p) => (
              <GoodsCard key={p.id} product={p} affordable={available >= p.points} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
