"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useGoodsStore } from "@/store/useGoodsStore";
import { useAvailablePoints } from "@/store/usePointStore";
import { pts } from "@/data/goods";

export default function ShopTopBar({ title, hidePoints, showShopHome }: { title: string; hidePoints?: boolean; showShopHome?: boolean }) {
  const { cart, cartLoaded, loadCart } = useGoodsStore();
  const { available } = useAvailablePoints();

  useEffect(() => {
    if (!cartLoaded) loadCart();
  }, [cartLoaded, loadCart]);

  const count = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="shop-topbar">
      <div className="shop-topbar__brand">
        <Image src="/images/logo-icon.svg" alt="Netflix" width={28} height={28} className="shop-topbar__logo" />
        <h2 className="shop-topbar__title">{title}</h2>
      </div>
      <div className="shop-topbar__actions">
        {showShopHome && (
          <Link href="/shop" className="shop-topbar__link shop-topbar__home">
            ‹ 굿즈샵
          </Link>
        )}
        {!hidePoints && (
          <span className="shop-point-chip" title="보유 포인트 (적립 − 사용)">
            {pts(available)}
          </span>
        )}
        <Link href="/shop/orders" className="shop-topbar__link">
          교환내역
        </Link>
        <Link href="/shop/cart" className="shop-topbar__link shop-cart-btn">
          장바구니
          {count > 0 && <span className="shop-cart-badge">{count}</span>}
        </Link>
      </div>
    </div>
  );
}
