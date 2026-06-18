"use client";

import Link from "next/link";
import { useAvailablePoints } from "@/store/usePointStore";
import { pts } from "@/data/goods";
import "./scss/shop.scss";

export default function PointChip({ className }: { className?: string }) {
  const { available } = useAvailablePoints();
  return (
    <Link href="/shop" className={`point-entry-chip${className ? ` ${className}` : ""}`}>
      <span className="point-entry-chip__label">보유 포인트</span>
      <b>{pts(available)}</b>
      <span className="point-entry-chip__go">굿즈샵 →</span>
    </Link>
  );
}
