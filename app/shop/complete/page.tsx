import { Suspense } from "react";
import ShopCompleteClient from "@/components/shop/ShopCompleteClient";

export default function ShopCompletePage() {
  return (
    <Suspense fallback={null}>
      <ShopCompleteClient />
    </Suspense>
  );
}
