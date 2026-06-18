"use client";

import { create } from "zustand";
import { db } from "@/firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useAuthStore } from "@/store/useAuthStore";
import { usePointStore } from "@/store/usePointStore";
import { fetchProductsSync } from "@/data/goods";
import { earnedBadgePoints } from "@/data/badge";
import type {
  GoodsProduct,
  CartItem,
  OrderItem,
  ShippingInfo,
  GoodsOrder,
  OrderStatus,
} from "@/types/goods";

function uid(): string | null {
  const u = useAuthStore.getState().user;
  return u?.userId ?? (u as { uid?: string } | null)?.uid ?? null;
}

function sameLine(a: CartItem, productId: string, option?: string) {
  return a.productId === productId && (a.option ?? "") === (option ?? "");
}

export type CreateOrderResult =
  | { ok: true; orderId: string; pointsUsed: number; shippingFee: number }
  | { ok: false; reason: "insufficient" | "error" };

interface GoodsState {
  products: GoodsProduct[];
  cart: CartItem[];
  cartLoaded: boolean;
  orders: GoodsOrder[];
  ordersLoaded: boolean;

  loadProducts: () => void;
  getProduct: (id: string) => GoodsProduct | undefined;

  loadCart: () => Promise<void>;
  addToCart: (productId: string, qty: number, option?: string) => Promise<boolean>;
  updateQty: (productId: string, option: string | undefined, qty: number) => Promise<void>;
  removeFromCart: (productId: string, option?: string) => Promise<void>;
  clearCart: () => Promise<void>;

  createOrder: (shipping: ShippingInfo, payLabel: string) => Promise<CreateOrderResult | null>;
  loadOrders: () => Promise<void>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  requestReturn: (orderId: string, reason: string) => Promise<boolean>;
}

async function persistCart(items: CartItem[]) {
  const id = uid();
  if (!id) return;
  try {
    await setDoc(doc(db, "goodsCarts", id), { items, updatedAt: Date.now() });
  } catch (e) {
    console.error("[goods] 장바구니 저장 실패:", e);
  }
}

// 주문 취소/반품 시 사용했던 포인트를 되돌려준다.
// 사용 포인트(pointsUsed) 누적값을 그만큼 줄이면 보유 포인트(적립 − 사용)가 회복된다.
async function restoreUsedPoints(amount: number) {
  if (!amount || amount <= 0) return;
  
  const userId = uid(); // 현재 로그인한 유저의 ID
  const currentProfile = useAuthStore.getState().currentProfile;
  const profileId = currentProfile?.id;
  
  if (!userId || !profileId) return;

  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    
    if (!snap.exists()) return;

    const userData = snap.data();
    const profiles = userData.profile || [];

    // 1. 프로필 배열을 순회하며 pointsUsed 업데이트
    const updatedProfiles = profiles.map((p: any) => {
      if (p.id === profileId) {
        const curUsed = Number(p.pointsUsed ?? 0);
        return { 
          ...p, 
          pointsUsed: Math.max(0, curUsed - amount) 
        };
      }
      return p;
    });

    // 2. 업데이트된 전체 배열을 Firestore에 반영
    await updateDoc(userRef, { profile: updatedProfiles });

    // 3. Zustand 상태 즉시 반영 (포인트 회복)
    usePointStore.getState().bumpUsed(-amount);
  } catch (e) {
    console.error("[goods] 포인트 환원 실패:", e);
  }
}

export const useGoodsStore = create<GoodsState>((set, get) => ({
  products: [],
  cart: [],
  cartLoaded: false,
  orders: [],
  ordersLoaded: false,

  loadProducts: () => {
    if (get().products.length) return;
    set({ products: fetchProductsSync() });
  },

  getProduct: (id) => get().products.find((p) => p.id === id),

  loadCart: async () => {
    const id = uid();
    if (!id) {
      set({ cart: [], cartLoaded: true });
      return;
    }
    try {
      const snap = await getDoc(doc(db, "goodsCarts", id));
      const items = snap.exists() ? ((snap.data().items as CartItem[]) ?? []) : [];
      set({ cart: items, cartLoaded: true });
    } catch (e) {
      console.error("[goods] 장바구니 불러오기 실패:", e);
      set({ cart: [], cartLoaded: true });
    }
  },

  addToCart: async (productId, qty, option) => {
    if (!uid()) return false; // 로그인 필요
    const cart = [...get().cart];
    const idx = cart.findIndex((c) => sameLine(c, productId, option));
    if (idx >= 0) cart[idx] = { ...cart[idx], qty: cart[idx].qty + qty };
    else {
      // 옵션이 없는 상품은 option 필드를 아예 넣지 않는다.
      // (Firestore는 undefined 필드 값을 허용하지 않아 setDoc이 실패함)
      const line: CartItem = option ? { productId, qty, option } : { productId, qty };
      cart.push(line);
    }
    set({ cart });
    await persistCart(cart);
    return true;
  },

  updateQty: async (productId, option, qty) => {
    if (qty < 1) return;
    const cart = get().cart.map((c) =>
      sameLine(c, productId, option) ? { ...c, qty } : c,
    );
    set({ cart });
    await persistCart(cart);
  },

  removeFromCart: async (productId, option) => {
    const cart = get().cart.filter((c) => !sameLine(c, productId, option));
    set({ cart });
    await persistCart(cart);
  },

  clearCart: async () => {
    set({ cart: [] });
    await persistCart([]);
  },

  createOrder: async (shipping, payLabel) => {
    const userId = uid();
    const currentProfile = useAuthStore.getState().currentProfile;
    const profileId = currentProfile?.id;
    
    if (!userId || !profileId) return null;
    
    const { cart, products } = get();
    if (cart.length === 0) return null;

    // ... items 생성 및 포인트 계산 로직은 동일 ...
    const items: OrderItem[] = cart.map((c) => {
      const p = products.find((pp) => pp.id === c.productId);
      const item: OrderItem = {
        productId: c.productId,
        name: p?.name ?? "상품",
        points: p?.points ?? 0,
        qty: c.qty,
        category: p?.category ?? "lifestyle",
        shippingFee: p?.shippingFee ?? 0,
      };
      if (p?.thumbUrl) item.thumbUrl = p.thumbUrl;
      if (c.option) item.option = c.option;
      return item;
    });

    const pointsUsed = items.reduce((s, it) => s + it.points * it.qty, 0);
    const shippingFee = items.reduce((s, it) => s + it.shippingFee, 0);

    try {
      const userRef = doc(db, "users", userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return { ok: false, reason: "error" };

      const userData = snap.data();
      const profiles = userData.profile || [];
      
      // 현재 프로필 찾기
      const targetProfile = profiles.find((p: any) => p.id === profileId);
      if (!targetProfile) return { ok: false, reason: "error" };

      const curUsed = Number(targetProfile.pointsUsed ?? 0);

      // 포인트 검증 로직
      const earned = earnedBadgePoints(currentProfile?.badges?.earnedBadges);
      const available = earned - curUsed;
      if (pointsUsed > available) return { ok: false, reason: "insufficient" };

      // 1. 주문 생성
      const ref = await addDoc(collection(db, "goodsOrders"), {
        uid: userId,
        profileId: profileId, // 주문에 프로필 정보 포함 권장
        items,
        pointsUsed,
        shippingFee,
        shipping,
        payLabel,
        payStatus: "결제완료",
        orderStatus: "ordered" as OrderStatus,
        createdAt: Date.now(),
      });

      // 2. 프로필 배열 업데이트 (불변성 유지)
      const updatedProfiles = profiles.map((p: any) =>
        p.id === profileId 
          ? { ...p, pointsUsed: curUsed + pointsUsed } 
          : p
      );

      // 3. Firestore 반영
      await updateDoc(userRef, { profile: updatedProfiles });
      
      usePointStore.getState().bumpUsed(pointsUsed);
      await get().clearCart();

      return { ok: true, orderId: ref.id, pointsUsed, shippingFee };
    } catch (e) {
      console.error("[goods] 주문 생성 실패:", e);
      return { ok: false, reason: "error" };
    }
  },

  loadOrders: async () => {
    const id = uid();
    if (!id) {
      set({ orders: [], ordersLoaded: true });
      return;
    }
    try {
      const snap = await getDocs(query(collection(db, "goodsOrders"), where("uid", "==", id)));
      const list = snap.docs
        .map((d) => ({ orderId: d.id, ...(d.data() as Omit<GoodsOrder, "orderId">) }))
        .sort((a, b) => b.createdAt - a.createdAt);
      set({ orders: list, ordersLoaded: true });
    } catch (e) {
      console.error("[goods] 주문내역 불러오기 실패:", e);
      set({ orders: [], ordersLoaded: true });
    }
  },

  cancelOrder: async (orderId) => {
    try {
      // 이미 취소/반품된 주문이면 중복 환원 방지
      const order = get().orders.find((o) => o.orderId === orderId);
      const alreadyClosed =
        order?.orderStatus === "canceled" || order?.orderStatus === "returned";

      const canceledAt = Date.now();
      await updateDoc(doc(db, "goodsOrders", orderId), {
        orderStatus: "canceled" as OrderStatus,
        canceledAt,
      });
      // 사용한 포인트 환원
      if (order && !alreadyClosed) await restoreUsedPoints(order.pointsUsed);
      // 로컬 상태도 즉시 반영
      set((s) => ({
        orders: s.orders.map((o) =>
          o.orderId === orderId
            ? { ...o, orderStatus: "canceled" as OrderStatus, canceledAt }
            : o,
        ),
      }));
      return true;
    } catch (e) {
      console.error("[goods] 주문 취소 실패:", e);
      return false;
    }
  },

  requestReturn: async (orderId, reason) => {
    try {
      // 이미 취소/반품된 주문이면 중복 환원 방지
      const order = get().orders.find((o) => o.orderId === orderId);
      const alreadyClosed =
        order?.orderStatus === "canceled" || order?.orderStatus === "returned";

      const returnedAt = Date.now();
      await updateDoc(doc(db, "goodsOrders", orderId), {
        orderStatus: "returned" as OrderStatus,
        returnedAt,
        returnReason: reason,
      });
      // 사용한 포인트 환원
      if (order && !alreadyClosed) await restoreUsedPoints(order.pointsUsed);
      // 로컬 상태도 즉시 반영
      set((s) => ({
        orders: s.orders.map((o) =>
          o.orderId === orderId
            ? { ...o, orderStatus: "returned" as OrderStatus, returnedAt, returnReason: reason }
            : o,
        ),
      }));
      return true;
    } catch (e) {
      console.error("[goods] 반품·환불 신청 실패:", e);
      return false;
    }
  },
}));