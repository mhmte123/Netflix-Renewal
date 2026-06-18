"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGoodsStore } from "@/store/useGoodsStore";
import { categoryMeta, pts, won } from "@/data/goods";
import { showToast } from "@/store/useToastStore";
import ShopTopBar from "./ShopTopBar";
import CategoryIcon from "./CategoryIcon";
import ShopIcon from "./ShopIcon";
import "./scss/shop.scss";

// 왼쪽 3단계 스테퍼 라벨 — 결제완료(정상) / 주문취소 / 반품·환불 흐름
const ORDER_STAGES = ["주문완료", "주문배송", "배송완료"];
const CANCEL_STAGES = ["취소신청", "환불배송", "취소완료"];
const RETURN_STAGES = ["반품신청", "회수중", "환불완료"];

// 반품 사유 — 판매자 귀책/상품 하자만 가능. 단순변심은 제외(반품·환불 불가).
const RETURN_REASONS = [
  "상품 불량·파손",
  "오배송 (다른 상품 도착)",
  "구성품 누락",
  "표시·광고와 다른 상품",
  "기타 (상품 하자)",
];

// ▼ 시연 속도 조절: 각 단계로 넘어가는 시간(ms).
//   빠른 시연(기본): [0, 10_000, 20_000]  (10초 → 주문배송, 20초 → 배송완료)
//   실제감(1·2분):   [0, 60_000, 120_000]
const STEP_MS = [0, 10_000, 20_000];

// 시작 시각으로부터 경과 시간으로 현재 단계(0~2)를 계산
function stageIndex(startTs: number, now: number) {
  const t = now - startTs;
  if (t >= STEP_MS[2]) return 2;
  if (t >= STEP_MS[1]) return 1;
  return 0;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function OrderThumb({ thumbUrl, gradient, iconKey }: { thumbUrl?: string; gradient: string; iconKey: string }) {
  const [imgError, setImgError] = useState(false);
  const showImg = !!thumbUrl && !imgError;
  return (
    <div className="order-item__thumb" style={showImg ? undefined : { background: gradient }}>
      {showImg ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={thumbUrl} alt="" className="goods-card__img" onError={() => setImgError(true)} />
      ) : (
        <CategoryIcon name={iconKey} size={28} />
      )}
    </div>
  );
}

export default function ShopOrdersClient() {
  const router = useRouter();
  const { orders, ordersLoaded, loadOrders, cancelOrder, requestReturn, products } = useGoodsStore();

  // 새로고침 없이 단계가 자동으로 넘어가도록 주기적으로 현재 시각을 갱신
  const [now, setNow] = useState(() => Date.now());

  // 반품 사유 입력 패널: 열린 주문 id + 선택한 사유
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="shop-page">
      <div className="shop-shell">
        <ShopTopBar title="교환내역" showShopHome />

        {!ordersLoaded ? (
          <div className="shop-loading">불러오는 중…</div>
        ) : orders.length === 0 ? (
          <div className="shop-empty">
            <div className="shop-empty__emoji"><ShopIcon name="box" size={48} /></div>
            <div className="shop-empty__msg">아직 교환 내역이 없어요.</div>
            <button className="shop-btn shop-btn--primary" onClick={() => router.push("/shop")}>
              굿즈 보러 가기
            </button>
          </div>
        ) : (
          orders.map((o) => {
            const canceled = o.orderStatus === "canceled";
            const returned = o.orderStatus === "returned";
            const stages = canceled ? CANCEL_STAGES : returned ? RETURN_STAGES : ORDER_STAGES;
            const startTs = canceled
              ? o.canceledAt ?? o.createdAt
              : returned
                ? o.returnedAt ?? o.createdAt
                : o.createdAt;
            const activeIdx = stageIndex(startTs, now);
            // 정상 주문에서만: 배송 전(0~1)엔 주문취소, 배송완료(2)면 반품·환불
            const canCancel = !canceled && !returned && activeIdx < 2;
            const canReturn = !canceled && !returned && activeIdx === 2;
            const flowClass = canceled ? " is-cancel-flow" : returned ? " is-return-flow" : "";
            const rightLabel = canceled ? "주문취소" : returned ? "반품·환불" : o.payStatus;
            const rightClass = canceled
              ? " is-canceled"
              : returned
                ? " is-returned"
                : "";

            const handleCancel = async () => {
              const ok = await cancelOrder(o.orderId);
              showToast(ok ? "주문이 취소되었어요" : "주문 취소에 실패했어요");
            };
            const openReturn = () => {
              setReason(RETURN_REASONS[0]);
              setReturnFor(o.orderId);
            };
            const submitReturn = async () => {
              const ok = await requestReturn(o.orderId, reason);
              showToast(
                ok
                  ? `반품·환불 신청이 접수되었어요 · ${pts(o.pointsUsed)} 환원`
                  : "반품·환불 신청에 실패했어요",
              );
              setReturnFor(null);
            };
            const isReturnOpen = returnFor === o.orderId;

            return (
              <div className="order-card" key={o.orderId}>
                <div className="order-card__head">
                  <span className="order-card__date">{formatDate(o.createdAt)}</span>
                  <span className={`order-card__status${rightClass}`}>
                    {rightLabel}
                  </span>
                </div>

                {/* 왼쪽 3단계 스테퍼 — 정상: 주문완료·주문배송·배송완료 / 취소: 취소신청·환불배송·취소완료 / 반품: 반품신청·회수중·환불완료 */}
                <div className={`order-steps${flowClass}`}>
                  {stages.map((label, i) => (
                    <span
                      key={label}
                      className={`order-step${i <= activeIdx ? " is-done" : ""}${i === activeIdx ? " is-current" : ""}`}
                    >
                      {label}
                    </span>
                  ))}
                  {canCancel && (
                    <button type="button" className="order-cancel-btn" onClick={handleCancel}>
                      주문 취소
                    </button>
                  )}
                  {canReturn && !isReturnOpen && (
                    <button type="button" className="order-return-btn" onClick={openReturn}>
                      반품·환불 신청
                    </button>
                  )}
                </div>

                {/* 반품 사유 선택 (단순변심 제외) */}
                {isReturnOpen && (
                  <div className="order-return-form">
                    <label className="order-return-form__label">반품 사유</label>
                    <div className="order-return-form__select-wrap">
                      {/* 기존 클래스명을 유지한 트리거 버튼 */}
                      <button
                        type="button"
                        className="order-return-form__select"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-haspopup="listbox"
                        aria-expanded={isOpen}
                      >
                        {reason || "사유를 선택하세요"}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.15s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {/* 옵션 리스트 */}
                      {isOpen && (
                        <ul className="order-return-form__options" role="listbox">
                          {RETURN_REASONS.map((r) => (
                            <li
                              key={r}
                              role="option"
                              aria-selected={reason === r}
                              onClick={() => {
                                setReason(r);
                                setIsOpen(false);
                              }}
                              className={reason === r ? "selected" : ""}
                            >
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className="order-return-form__note">
                      단순 변심은 반품·환불 대상이 아니에요. 승인 시 사용한 {pts(o.pointsUsed)}가 환원됩니다.
                    </p>
                    <div className="order-return-form__actions">
                      <button type="button" className="order-cancel-btn" onClick={() => setReturnFor(null)}>
                        닫기
                      </button>
                      <button type="button" className="order-return-btn" onClick={submitReturn}>
                        신청하기
                      </button>
                    </div>
                  </div>
                )}

                {/* 취소/반품 완료 안내 (사유·포인트 환원) */}
                {(canceled || returned) && (
                  <div className="order-refund-note">
                    {returned && o.returnReason ? `반품 사유: ${o.returnReason} · ` : ""}
                    사용 포인트 {pts(o.pointsUsed)} 환원
                  </div>
                )}

                {o.items.map((it, i) => {
                  const meta = categoryMeta(it.category);
                   const thumbUrl = it.thumbUrl ?? products.find((p) => p.id === it.productId)?.thumbUrl;
                  return (
                    <div className="order-item" key={`${it.productId}-${it.option ?? ""}-${i}`}>
                      <OrderThumb thumbUrl={thumbUrl} gradient={meta.gradient} iconKey={meta.iconKey} />
                      {/* <div className="order-item__thumb" style={{ background: meta.gradient }}>
                        <CategoryIcon name={meta.iconKey} size={28} />
                      </div> */}
                      <div className="order-item__info">
                        <div className="order-item__name">{it.name}</div>
                        <div className="order-item__meta">
                          {it.option ? `${it.option} · ` : ""}수량 {it.qty}개
                        </div>
                      </div>
                      <div className="order-item__price">{pts(it.points * it.qty)}</div>
                    </div>
                  );
                })}

                <div className="order-card__total">
                  <span>{pts(o.pointsUsed)} 사용 · 배송비 결제</span>
                  <b>{won(o.shippingFee)}</b>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
