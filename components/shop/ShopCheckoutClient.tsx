"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useGoodsStore } from "@/store/useGoodsStore";
import { useAvailablePoints } from "@/store/usePointStore";
import { pts, won } from "@/data/goods";
import { showToast } from "@/store/useToastStore";
import type { PayInfo } from "@/types/auth";
import type { ShippingInfo as Ship } from "@/types/goods";
import StepPayment from "@/app/signin/components/StepPayment";
import ShopTopBar from "./ShopTopBar";
import AddressSearch from "./AddressSearch";
import ShopIcon from "./ShopIcon";
import "@/app/signin/signin.scss";
import "./scss/shop.scss";

export default function ShopCheckoutClient() {
  const router = useRouter();
  const { currentProfile } = useAuthStore();
  const { products, cart, cartLoaded, loadProducts, loadCart, createOrder } = useGoodsStore();
  const { available } = useAvailablePoints();

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Ship>({
    name: "",
    phone: "",
    zipcode: "",
    address: "",
    addressDetail: "",
    memo: "",
  });

  useEffect(() => {
    loadProducts();
    if (!cartLoaded) loadCart();
  }, [loadProducts, loadCart, cartLoaded]);

  useEffect(() => {
    if (currentProfile?.nickname)
      setForm((f) => (f.name ? f : { ...f, name: currentProfile.nickname }));
  }, [currentProfile?.nickname]);

  const lines = useMemo(
    () =>
      cart
        .map((c) => ({ item: c, product: products.find((p) => p.id === c.productId) }))
        .filter((l) => l.product),
    [cart, products],
  );
  const pointsTotal = lines.reduce((s, l) => s + l.product!.points * l.item.qty, 0);
  const shippingTotal = lines.reduce((s, l) => s + l.product!.shippingFee, 0);
  const remaining = available - pointsTotal;
  const enough = remaining >= 0;

  const set = (k: keyof Ship) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // 주소 검색(다음 우편번호) 결과를 우편번호·기본주소에 자동 입력
  const applyAddress = ({ zipcode, address }: { zipcode: string; address: string }) =>
    setForm((f) => ({ ...f, zipcode, address }));

  // StepPayment(가입 결제 UI)에서 결제수단을 고르고 "결제하고 교환"을 누르면 호출됨.
  // 구독 결제수단을 덮어쓰지 않고, 선택한 결제수단 라벨로 굿즈 주문만 생성한다.
  const handleShopPay = async (_payInfo: PayInfo, payLabel: string) => {
    if (busy) return;
    if (lines.length === 0) {
      showToast("교환할 상품이 없어요");
      return;
    }
    if (!enough) {
      showToast("보유 포인트가 부족해요");
      return;
    }
    if (!form.name.trim() || !form.phone.trim() || !form.zipcode.trim() || !form.address.trim()) {
      showToast("배송 정보를 모두 입력해 주세요");
      return;
    }
    setBusy(true);
    const res = await createOrder(form, payLabel);
    setBusy(false);
    if (!res || !res.ok) {
      showToast(res && res.reason === "insufficient" ? "보유 포인트가 부족해요" : "교환에 실패했어요");
      return;
    }
    router.push(`/shop/complete?order=${res.orderId}&used=${res.pointsUsed}&ship=${res.shippingFee}`);
  };

  if (!cartLoaded) {
    return (
      <div className="shop-page">
        <div className="shop-shell">
          <ShopTopBar title="교환/결제" />
          <div className="shop-loading">불러오는 중…</div>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="shop-page">
        <div className="shop-shell">
          <ShopTopBar title="교환/결제" />
          <div className="shop-empty">
            <div className="shop-empty__emoji"><ShopIcon name="cart" size={48} /></div>
            <div className="shop-empty__msg">교환할 상품이 없어요.</div>
            <button className="shop-btn shop-btn--primary" onClick={() => router.push("/shop")}>
              굿즈 보러 가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-page">
      <div className="shop-shell">
        <ShopTopBar title="교환/결제" />

        <div className="shop-layout">
          <div>
            {/* 배송지 */}
            <section className="checkout-section">
              <h3 className="checkout-section__title">배송지</h3>
              <div className="checkout-field">
                <label>받는 분</label>
                <input value={form.name} onChange={set("name")} placeholder="이름" />
              </div>
              <div className="checkout-field">
                <label>연락처</label>
                <input value={form.phone} onChange={set("phone")} placeholder="010-0000-0000" />
              </div>
              <div className="checkout-field">
                <label>우편번호</label>
                <div className="checkout-zip">
                  <input
                    value={form.zipcode}
                    readOnly
                    placeholder="주소 검색을 눌러주세요"
                  />
                  <AddressSearch className="checkout-zip__btn" onSelect={applyAddress} />
                </div>
              </div>
              <div className="checkout-field">
                <label>주소</label>
                <input value={form.address} readOnly placeholder="기본 주소 (자동 입력)" />
              </div>
              <div className="checkout-field">
                <label>상세주소</label>
                <input value={form.addressDetail} onChange={set("addressDetail")} placeholder="상세 주소 (선택)" />
              </div>
              <div className="checkout-field">
                <label>배송 메모</label>
                <textarea rows={2} value={form.memo} onChange={set("memo")} placeholder="요청사항 (선택)" />
              </div>
            </section>

            {/* 포인트 차감 */}
            <section className="checkout-section">
              <h3 className="checkout-section__title">포인트 차감</h3>
              <div className="shop-sum-row">
                <span>보유 포인트</span>
                <span>{pts(available)}</span>
              </div>
              <div className="shop-sum-row" style={{ color: "#ffcf3f" }}>
                <span>사용 포인트 (굿즈 교환)</span>
                <span>-{pts(pointsTotal)}</span>
              </div>
              <div className="shop-sum-row">
                <span>교환 후 잔액</span>
                <span className={enough ? "" : "point-short"}>{pts(Math.max(0, remaining))}</span>
              </div>
            </section>

            {/* 교환 상품 */}
            <section className="checkout-section">
              <h3 className="checkout-section__title">교환 상품 ({lines.length})</h3>
              {lines.map(({ item, product }) => (
                <div className="shop-sum-row" key={`${item.productId}-${item.option ?? ""}`}>
                  <span>
                    {product!.name}
                    {item.option ? ` · ${item.option}` : ""} × {item.qty}
                  </span>
                  <span>{pts(product!.points * item.qty)}</span>
                </div>
              ))}
            </section>

            {/* 배송비 결제 수단 — 가입 결제 UI(StepPayment) 재사용 */}
            <section className="checkout-section">
              <h3 className="checkout-section__title">배송비 결제 수단</h3>
              {enough ? (
                <StepPayment
                  hideTitle
                  hidePlanSummary
                  hideAmountBox
                  hideAgree
                  noticeText="굿즈값은 포인트로 충당되고, 실제 결제는 배송비만 진행돼요. (1회성 결제)"
                  currentPayInfo={null}
                  submitLabel={busy ? "처리 중…" : `배송비 ${won(shippingTotal)} 결제하고 교환`}
                  amountLabel="배송비"
                  plan={{
                    name: "배송비",
                    billing: "monthly",
                    monthlyPrice: shippingTotal,
                    annualTotal: shippingTotal,
                    annualDiscount: 0,
                  }}
                  onBack={() => router.push("/shop/cart")}
                  onComplete={() => {}}
                  onPaySubmit={handleShopPay}
                />
              ) : (
                <div className="checkout-pay">
                  <span className="checkout-pay__icon"><ShopIcon name="warning" size={18} /></span>
                  <span>보유 포인트가 부족해 교환할 수 없어요.</span>
                </div>
              )}
            </section>
          </div>

          <aside className="shop-summary">
            <h3 className="shop-summary__title">결제 요약</h3>
            <div className="shop-sum-row">
              <span>굿즈 (포인트 교환)</span>
              <span>{pts(pointsTotal)}</span>
            </div>
            <div className="shop-sum-row">
              <span>배송비</span>
              <span>{won(shippingTotal)}</span>
            </div>
            <div className="shop-sum-total">
              <span>실제 결제금액</span>
              <b>{won(shippingTotal)}</b>
            </div>
            <p className="point-hint" style={{ marginTop: 12 }}>
              결제 수단을 선택하고 결제하면 교환이 완료돼요.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
