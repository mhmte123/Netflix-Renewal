"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGoodsStore } from "@/store/useGoodsStore";
import { useAvailablePoints } from "@/store/usePointStore";
import { categoryMeta, pts, won } from "@/data/goods";
import ShopTopBar from "./ShopTopBar";
import ShopIcon from "./ShopIcon";
import CategoryIcon from "./CategoryIcon";
import "./scss/shop.scss";

function CartThumb({ thumbUrl, gradient, iconKey }: { thumbUrl?: string; gradient: string; iconKey: string }) {
  const [imgError, setImgError] = useState(false);
  const showImg = !!thumbUrl && !imgError;
  return (
    <div className="cart-row__thumb" style={showImg ? undefined : { background: gradient }}>
      {showImg ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={thumbUrl} alt="" className="goods-card__img" onError={() => setImgError(true)} />
      ) : (
        <CategoryIcon name={iconKey} size={28} aria-hidden />
      )}
    </div>
  );
}

export default function ShopCartClient() {
  const router = useRouter();
  const { products, cart, cartLoaded, loadProducts, loadCart, updateQty, removeFromCart } =
    useGoodsStore();
  const { available } = useAvailablePoints();

  useEffect(() => {
    loadProducts();
    if (!cartLoaded) loadCart();
  }, [loadProducts, loadCart, cartLoaded]);

  const lines = useMemo(
    () =>
      cart
        .map((c) => ({ item: c, product: products.find((p) => p.id === c.productId) }))
        .filter((l) => l.product),
    [cart, products],
  );

  const pointsTotal = lines.reduce((s, l) => s + l.product!.points * l.item.qty, 0);
  const shippingTotal = lines.reduce((s, l) => s + l.product!.shippingFee, 0);
  const enough = available >= pointsTotal;

  if (!cartLoaded) {
    return (
      <div className="shop-page">
        <div className="shop-shell">
          <ShopTopBar title="장바구니" showShopHome />
          <div className="shop-loading">불러오는 중…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-page">
      <div className="shop-shell">
        <ShopTopBar title="장바구니" showShopHome />

        {lines.length === 0 ? (
          <div className="shop-empty">
            <div className="shop-empty__emoji"><ShopIcon name="cart" size={48} /></div>
            <div className="shop-empty__msg">장바구니가 비어 있어요.</div>
            <button className="shop-btn shop-btn--primary" onClick={() => router.push("/shop")}>
              굿즈 보러 가기
            </button>
          </div>
        ) : (
          <div className="shop-layout">
            <div>
              {lines.map(({ item, product }) => {
                const meta = categoryMeta(product!.category);
                return (
                  <div className="cart-row" key={`${item.productId}-${item.option ?? ""}`}>
                    <CartThumb thumbUrl={product!.thumbUrl} gradient={meta.gradient} iconKey={meta.iconKey} />
                    {/* <div className="cart-row__thumb" style={{ background: meta.gradient }}>
                      <CategoryIcon name={meta.iconKey} size={28} />
                    </div> */}
                    <div className="cart-row__info">
                      <div className="cart-row__name">{product!.name}</div>
                      {item.option && (
                        <div className="cart-row__opt">
                          {product!.optionLabel ?? "옵션"}: {item.option}
                        </div>
                      )}
                      <div className="cart-row__opt">배송비 {won(product!.shippingFee)}</div>
                      <div className="cart-row__bottom">
                        <div className="shop-qty">
                          <button
                            className="shop-qty__btn"
                            onClick={() => updateQty(item.productId, item.option, item.qty - 1)}
                            disabled={item.qty <= 1}
                          >
                            −
                          </button>
                          <span className="shop-qty__val">{item.qty}</span>
                          <button
                            className="shop-qty__btn"
                            onClick={() => updateQty(item.productId, item.option, item.qty + 1)}
                          >
                            ＋
                          </button>
                        </div>
                        <span className="cart-row__price">{pts(product!.points * item.qty)}</span>
                      </div>
                    </div>
                    <button
                      className="cart-row__remove"
                      onClick={() => removeFromCart(item.productId, item.option)}
                    >
                      삭제
                    </button>
                  </div>
                );
              })}
            </div>

            <aside className="shop-summary">
              <h3 className="shop-summary__title">교환 요약</h3>
              <div className="shop-sum-row">
                <span>필요 포인트</span>
                <span>{pts(pointsTotal)}</span>
              </div>
              <div className="shop-sum-row">
                <span>보유 포인트</span>
                <span className={enough ? "" : "point-short"}>{pts(available)}</span>
              </div>
              <div className="shop-sum-total">
                <span>배송비 (실결제)</span>
                <b>{won(shippingTotal)}</b>
              </div>
              <button
                className="shop-btn shop-btn--primary shop-btn--block"
                onClick={() => router.push("/shop/checkout")}
                disabled={!enough}
              >
                {enough ? "교환하기" : "포인트가 부족해요"}
              </button>
              {!enough && (
                <div className="shop-summary__hint">
                  {pts(pointsTotal - available)} 더 모으면 교환할 수 있어요
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
