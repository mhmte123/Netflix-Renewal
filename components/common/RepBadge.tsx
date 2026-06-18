import { BADGE_LIST } from "@/data/badge";
import "./scss/repBadge.scss";

// 대표 칭호(장착 뱃지) 칩 — 아이콘 + 이름.
// equippedBadges 는 '뱃지 ID'(genre_drama 등)로 저장되지만,
// 일부 더미 데이터는 '뱃지 이름'(드라마 컬렉터 등)을 그대로 담고 있어
// id / 이름 어느 쪽이 들어와도 동일하게 해석되도록 둘 다 매핑한다.
const BY_ID = new Map(BADGE_LIST.map((b) => [b.id, b]));
const BY_NAME = new Map(BADGE_LIST.map((b) => [b.name, b]));

interface RepBadgeProps {
  /** 장착 뱃지 ID 또는 이름 */
  badge?: string | null;
  /** 칩 크기 */
  size?: "sm" | "md";
  className?: string;
}

export default function RepBadge({ badge, size = "md", className = "" }: RepBadgeProps) {
  if (!badge) return null;
  const found = BY_ID.get(badge) ?? BY_NAME.get(badge);
  if (!found) return null;

  return (
    <span
      className={`rep-badge rep-badge--${size}${className ? ` ${className}` : ""}`}
      title={found.title}
      aria-label={`대표 칭호: ${found.name}`}
    >
      <img className="rep-badge__icon" src={found.imgUrl} alt="" />
      <span className="rep-badge__name">{found.name}</span>
    </span>
  );
}
