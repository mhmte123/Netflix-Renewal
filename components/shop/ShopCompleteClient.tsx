"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { pts, won } from "@/data/goods";
import ShopTopBar from "./ShopTopBar";
import "./scss/shop.scss";

export default function ShopCompleteClient() {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order");
  const used = Number(params.get("used") ?? 0);
  const ship = Number(params.get("ship") ?? 0);

  return (
    <div className="shop-page">
      <div className="shop-shell">
        <ShopTopBar title="교환 완료" />

        <div className="shop-complete">
          <div className="shop-complete__circle" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="shop-complete__title">교환이 완료되었어요!</h2>
          <p className="shop-complete__sub">
            포인트로 굿즈를 교환하고 배송비 결제가 완료됐어요.<br />
            배송 준비가 시작되면 알려드릴게요.
          </p>
          {(used > 0 || ship > 0) && (
            <div className="shop-complete__points">
              <b>{pts(used)}</b> 사용 · 배송비 <b>{won(ship)}</b> 결제
            </div>
          )}
          {orderId && <div className="shop-complete__order">주문번호 · {orderId}</div>}

          <div className="shop-complete__actions">
            <button className="shop-btn shop-btn--ghost" onClick={() => router.push("/shop")}>
              쇼핑 계속하기
            </button>
            <button className="shop-btn shop-btn--primary" onClick={() => router.push("/shop/orders")}>
              교환내역 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
