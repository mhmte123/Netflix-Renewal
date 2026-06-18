import Image from "next/image";
import { BADGE_LIST } from "@/data/badge";

interface FeedAuthorBadgesProps {
  badgeIds?: string[];
}

const badgeMap = new Map(BADGE_LIST.map((badge) => [badge.id, badge]));

export default function FeedAuthorBadges({
  badgeIds = [],
}: FeedAuthorBadgesProps) {
  const badges = badgeIds
    .slice(0, 1)
    .map((badgeId) => badgeMap.get(badgeId))
    .filter((badge) => badge !== undefined);

  if (badges.length === 0) return null;

  return (
    <span className="feed-author-badges" aria-label="획득한 뱃지">
      {badges.map((badge) => (
        <span
          key={badge.id}
          className="feed-author-badge-item"
        >
          <Image
            className="feed-author-badge"
            src={badge.imgUrl}
            alt={`${badge.name} 뱃지`}
            width={18}
            height={18}
          />
          <span className="feed-author-badge-name">{badge.name}</span>
        </span>
      ))}
    </span>
  );
}
