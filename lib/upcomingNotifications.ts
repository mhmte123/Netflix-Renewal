import type { AlarmInfo } from "@/types/auth";
import type { UpcomingItem } from "@/lib/upcoming";

type UpcomingNotificationTarget = Pick<UpcomingItem, "id" | "media_type" | "title" | "release_date"> & {
  poster_path?: string | null;
};

export const getUpcomingDetailLink = (type: "movie" | "tv", id: number) =>
  `/detail/${type}/${id}?upcoming=1`;

export const isUpcomingNotificationSet = (
  alarms: AlarmInfo[] | undefined,
  type: "movie" | "tv",
  id: number,
) => {
  const link = getUpcomingDetailLink(type, id);
  return (alarms ?? []).some((alarm) => alarm.category === "upcoming" && alarm.link === link);
};

export const removeUpcomingAlarm = (
  alarms: AlarmInfo[] | undefined,
  type: "movie" | "tv",
  id: number,
) => {
  const link = getUpcomingDetailLink(type, id);
  return (alarms ?? []).filter((alarm) => !(alarm.category === "upcoming" && alarm.link === link));
};

export const createUpcomingAlarm = (item: UpcomingNotificationTarget): AlarmInfo => ({
  category: "upcoming",
  title: item.title,
  content: item.release_date ? `${item.release_date} 공개 예정` : "공개 예정",
  link: getUpcomingDetailLink(item.media_type, item.id),
});
