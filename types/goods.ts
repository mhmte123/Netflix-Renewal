// 굿즈샵(포인트 교환) 도메인 타입
// 굿즈값은 포인트로 교환(차감), 배송비만 실제 결제

export type GoodsCategory = "apparel" | "figure" | "poster" | "stationery" | "lifestyle";

export type GoodsBadge = "NEW" | "BEST" | "LIMITED" | null;

// 주문 배송 단계: 주문완료 → 배송중 → 배송완료, 또는 주문취소
export type OrderStatus = "ordered" | "shipping" | "delivered" | "canceled" | "returned";

export interface GoodsProduct {
  id: string;
  name: string;
  category: GoodsCategory;
  points: number; // 교환에 필요한 포인트
  shippingFee: number; // 배송비 (실제 결제 금액, KRW)
  themeTitle?: string; // 컬렉션/라인 라벨
  badge?: GoodsBadge;
  thumbUrl?: string; // 카드용 대표 썸네일 (없으면 카테고리 placeholder)
  detailImages?: string[]; // 상세 갤러리 (없으면 thumbUrl, 그것도 없으면 placeholder)
  relatedTitle?: string; // 연관 작품명 (상세 표시용)
  relatedType?: "movie" | "tv"; // 연관 작품 타입 (/detail/{type}/{id})
  relatedId?: number; // 연관 작품 TMDB id
  optionLabel?: string; // "사이즈" | "색상" 등
  options?: string[]; // 선택 옵션 목록 (없으면 단일 상품)
  description: string;
  stock: number;
}

export interface CartItem {
  productId: string;
  qty: number;
  option?: string;
}

// 주문 시점 스냅샷
export interface OrderItem {
  productId: string;
  name: string;
  points: number; // 개당 필요 포인트
  qty: number;
  option?: string;
  category: GoodsCategory;
  shippingFee: number; // 개당(라인당) 배송비
  thumbUrl?: string;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  zipcode: string;
  address: string;
  addressDetail: string;
  memo?: string;
}

export interface GoodsOrder {
  orderId: string;
  uid: string;
  items: OrderItem[];
  pointsUsed: number; // 교환에 사용한 포인트 합계
  shippingFee: number; // 실제 결제한 배송비 합계
  shipping: ShippingInfo;
  payLabel: string; // 배송비 결제 수단
  payStatus: string; // "결제완료" 등
  orderStatus?: OrderStatus; // 배송 단계 (없으면 createdAt 기준으로 추정)
  canceledAt?: number; // 주문취소 시각 (취소 흐름 단계 진행 기준)
  returnedAt?: number; // 반품·환불 신청 시각 (반품 흐름 단계 진행 기준)
  returnReason?: string; // 반품 사유 (단순변심 제외)
  createdAt: number;
}