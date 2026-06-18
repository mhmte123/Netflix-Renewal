"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GoodsProduct } from "@/types/goods";
import { categoryMeta, pts, won } from "@/data/goods";
import CategoryIcon from "./CategoryIcon";

export default function GoodsCard({
  product,
  affordable,
}: {
  product: GoodsProduct;
  affordable: boolean;
}) {
  const router = useRouter();
  const meta = categoryMeta(product.category);
  const soldOut = product.stock <= 0;
  const [imgError, setImgError] = useState(false);
  const showImg = !!product.thumbUrl && !imgError;

  return (
    <button
      type="button"
      className="goods-card"
      onClick={() => router.push(`/shop/${product.id}`)}
    >
      <div
        className="goods-card__thumb"
        style={showImg ? undefined : { background: meta.gradient }}
      >
        {showImg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="goods-card__img"
            src={product.thumbUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <CategoryIcon name={meta.iconKey} size={48} className="goods-card__emoji" aria-hidden />
        )}
        {product.badge && (
          <span className={`goods-card__badge goods-card__badge--${product.badge}`}>
            {product.badge}
          </span>
        )}
        {soldOut && <span className="goods-card__sold">품절</span>}
      </div>
      <div className="goods-card__body">
        <div className="goods-card__cat">{meta.label}</div>
        <div className="goods-card__name">{product.name}</div>
        <div className="goods-card__points-row">
          <span className="goods-card__points">{pts(product.points)}</span>
          {!soldOut && affordable && <span className="goods-card__ok">교환 가능</span>}
        </div>
        <div className="goods-card__ship">배송비 {won(product.shippingFee)}</div>
      </div>
    </button>
  );
}
