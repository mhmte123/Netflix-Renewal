"use client";
import "./scss/categoryList.scss";

export default function ThemeRowSkeleton() {
  return (
    <section className="category-section skeleton-section">
      <div className="section-title-outer">
        <div className="skeleton-title-bar" />
      </div>
      <div className="swiper-outer">
        <div className="skeleton-cards">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      </div>
    </section>
  );
}
