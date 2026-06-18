import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * 비회원이거나 planType이 없고, 해지 후 만료일도 지났으면 unsubscribed로 판단합니다.
 *
 * isUnsubscribed: true  → 구독 차단 대상
 * isLoggedIn:     true  → 로그인은 되어 있지만 미구독
 */

// "YYYY.MM.DD" 형식의 만료일이 아직 지나지 않았는지 확인
const isBeforeExpiry = (nextDate: string): boolean => {
  if (!nextDate) return false;

  const parts = nextDate.split(".").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [year, month, day] = parts;
  const expiry = new Date(year, month - 1, day);
  expiry.setHours(23, 59, 59, 999);

  return expiry.getTime() >= Date.now();
};

export function useSubscriptionGuard() {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const [planType, setPlanType] = useState<string | null>(null);
  const [nextDate, setNextDate] = useState<string>("");

  useEffect(() => {
    if (!user?.userId) {
      setPlanType(null);
      setNextDate("");
      return;
    }
    getDoc(doc(db, "users", user.userId)).then((snap) => {
      if (!snap.exists()) return;
      setPlanType(snap.data().planType ?? "");
      setNextDate(snap.data().payment?.nextDate ?? "");
    });
  }, [user?.userId, pathname]);

  const isLoggedIn = Boolean(user);
  // 구독 중이거나, 해지했지만 아직 만료 전이면 구독 중으로 취급
  const hasSubscription = user
    ? Boolean(planType) || isBeforeExpiry(nextDate)
    : false;
  const isUnsubscribed = !hasSubscription;

  return { isLoggedIn, hasSubscription, isUnsubscribed };
}