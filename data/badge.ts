export interface Badge {
  id: string;
  imgUrl: string;
  name: string;
  title: string;
  content: string;
  total: number;
}

export const BADGE_LIST: Badge[] = [
  // 1. 입문자 계열
  {
    id: "first_streaming",
    imgUrl: "/images/badge/first_streaming.png",
    name: "첫 스트리밍",
    title: "위대한 첫걸음, 시청 시작!",
    content: "첫 번째 콘텐츠 시청을 완료한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },

  // 2. 헤비유저 계열
  {
    id: "binge_master",
    imgUrl: "/images/badge/binge_master.png",
    name: "정주행 마스터",
    title: "시즌 완주 마스터",
    content: "작품의 한 시즌을 끊김 없이 완전히 완주한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  // {
  //   id: "monthly_top_viewer",
  //   imgUrl: "/images/badge/monthly_top_viewer.png",
  //   name: "이번 달 최다 시청",
  //   title: "명예의 전당 등극",
  //   content: "이번 달 서비스 내에서 가장 많은 콘텐츠를 시청한 상위 회원에게 주어지는 뱃지입니다.",
  //   total: 1
  // },

  // 3. 꾸준함 계열
  {
    id: "7days_attendance",
    imgUrl: "/images/badge/7days_attendance.png",
    name: "7일 연속 시청",
    title: "일주일 연속 출석 완료",
    content: "일주일 동안 매일 빼놓지 않고 연속으로 콘텐츠를 시청한 회원에게 주어지는 뱃지입니다.",
    total: 7
  },

  // 5. 장르 특화형 (12대 장르)
  {
    id: "genre_action",
    imgUrl: "/images/badge/genre_action.png",
    name: "액션 마스터",
    title: "타격감 넘치는 액션파",
    content: "액션 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_animation",
    imgUrl: "/images/badge/genre_animation.png",
    name: "애니 덕후",
    title: "2D 감성 저격 덕후",
    content: "애니메이션 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_comedy",
    imgUrl: "/images/badge/genre_comedy.png",
    name: "코미디 요정",
    title: "웃음 폭탄 마니아",
    content: "코미디 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_documentary",
    imgUrl: "/images/badge/genre_documentary.png",
    name: "다큐 탐험대",
    title: "진실을 찾는 탐험가",
    content: "다큐멘터리 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_drama",
    imgUrl: "/images/badge/genre_drama.png",
    name: "드라마 컬렉터",
    title: "인생 희로애락 컬렉터",
    content: "드라마 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_fantasy",
    imgUrl: "/images/badge/genre_fantasy.png",
    name: "판타지 원정대",
    title: "마법 같은 세계관 속으로",
    content: "판타지 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_horror",
    imgUrl: "/images/badge/genre_horror.png",
    name: "공포 내성 MAX",
    title: "공포 따윈 무섭지 않아",
    content: "공포 장르의 콘텐츠를 여러 편 시청하여 뛰어난 내성을 증명한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_mystery",
    imgUrl: "/images/badge/genre_mystery.png",
    name: "미스터리 추리반",
    title: "수수께끼를 쫓는 촉",
    content: "미스터리 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_romance",
    imgUrl: "/images/badge/genre_romance.png",
    name: "로코 장인",
    title: "핑크빛 설렘에 퐁당",
    content: "로맨스 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_scifi",
    imgUrl: "/images/badge/genre_sf.png",
    name: "SF 탐험가",
    title: "우주와 미래를 탐험 중",
    content: "SF 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_thriller",
    imgUrl: "/images/badge/genre_thriller.png",
    name: "스릴러 헌터",
    title: "짜릿한 긴장감 추격자",
    content: "스릴러 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "genre_war",
    imgUrl: "/images/badge/genre_war.png",
    name: "전쟁 시뮬레이터",
    title: "거대한 전장 속으로",
    content: "전쟁 장르의 콘텐츠를 집중적으로 시청한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },

  // 6. 국가/문화 취향형
  {
    id: "culture_k_drama",
    imgUrl: "/images/badge/culture_k_drama.png",
    name: "K-드라마 러버",
    title: "마성의 K-드라마 올인",
    content: "한국 콘텐츠를 주로 시청하는 한국 콘텐츠 매니아에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "culture_uk_drama",
    imgUrl: "/images/badge/culture_uk_drama.png",
    name: "영드 수집가",
    title: "클래식 영국 감성 메니아",
    content: "영국 콘텐츠를 주로 시청하며 특유의 감성을 사랑하는 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "culture_jp_drama",
    imgUrl: "/images/badge/culture_jp_drama.png",
    name: "일드 감성파",
    title: "잔잔한 일본 감성파",
    content: "일본 콘텐츠를 즐겨 보며 잔잔한 여운을 추구하는 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "culture_cn_drama",
    imgUrl: "/images/badge/culture_cn_drama.png",
    name: "중드 마라맛",
    title: "중독적인 마라맛 중드",
    content: "중국 콘텐츠를 다수 시청하며 마성의 매력에 빠진 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "culture_global",
    imgUrl: "/images/badge/culture_global.png",
    name: "글로벌 시청자",
    title: "방구석 세계 여행가",
    content: "다양한 국가의 해외 콘텐츠를 넘나들며 넓게 탐색하는 회원에게 주어지는 뱃지입니다.",
    total: 1
  },

  // 8. 친구 기능 연동
  {
    id: "social_taste_sharer", //첫 공개 플리
    imgUrl: "/images/badge/social_taste_sharer.png",
    name: "취향 공유러",
    title: "내 취향을 너에게 보낸다",
    content: "나만의 특별한 플레이리스트를 처음으로 커뮤니티에 공개한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "social_reviewer", //첫 리뷰
    imgUrl: "/images/badge/social_reviewer.png",
    name: "리뷰 남기는 사람",
    title: "길잡이가 되는 한 줄 평",
    content: "콘텐츠에 대한 첫 번째 소중한 리뷰를 등록한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "social_anti_spoiler",
    imgUrl: "/images/badge/social_anti_spoiler.png",
    name: "스포 금지단",
    title: "쉿! 스포일러 절대 방지",
    content: "스포일러 방지 체크를 활성화하여 건강한 리뷰 매너를 보여준 회원에게 주어지는 뱃지입니다.",
    total: 1
  },

  // 11. 큐레이션형
  {
    id: "social_playlist_creator", //첫 플리 제작
    imgUrl: "/images/badge/social_playlist_creator.png",
    name: "플레이리스트 제작자",
    title: "내 안목으로 채운 전시장",
    content: "자신만의 안목으로 첫 번째 영상 플레이리스트를 제작한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },

  // 12. 영향력 / 커넥트형
  {
    id: "social_first_follower",
    imgUrl: "/images/badge/social_first_follower.png",
    name: "첫 팔로워",
    title: "소중한 첫 인연의 시작",
    content: "커뮤니티에서 다른 유저를 처음으로 팔로우한 회원에게 주어지는 뱃지입니다.",
    total: 1
  },
  {
    id: "social_taste_sympathizer", //팔로워 많아지면
    imgUrl: "/images/badge/social_taste_sympathizer.png",
    name: "취향 공유자",
    title: "내 안목에 공감하는 이들",
    content: "팔로워 수가 일정 기준을 달성한 회원에게 주어지는 뱃지입니다.",
    total: 10
  },
  {
    id: "social_connect_star", //플리 좋아요 많으면
    imgUrl: "/images/badge/social_connect_star.png",
    name: "커넥트 스타",
    title: "취향을 잇는 커뮤니티",
    content: "제작한 플레이리스트에 많은 '좋아요'를 얻은 회원에게 주어지는 뱃지입니다.",
    total: 10
  },
  {
    id: "social_review_master", //리뷰 좋아요 많으면
    imgUrl: "/images/badge/social_review_master.png",
    name: "한줄평 장인",
    title: "무릎을 탁 치는 리뷰어",
    content: "작성한 리뷰에 많은 '좋아요'를 획득한 회원에게 주어지는 뱃지입니다.",
    total: 10
  }
];

type BadgeMap = { [key: string]: string };

// 2. 변환 로직
export const BADGE_MAP: BadgeMap = BADGE_LIST.reduce((acc, badge) => {
  acc[badge.id] = badge.name;
  return acc;
}, {} as BadgeMap);
// ── 뱃지 → 포인트 (등급 차등) ──────────────────────
// 등급은 목표치(total)로 자동 산출: 전설 500P · 희귀 300P · 일반 100P
export function badgeGrade(total: number): { label: string; points: number } {
  if (total >= 10) return { label: "전설", points: 500 };
  if (total >= 5) return { label: "희귀", points: 300 };
  return { label: "일반", points: 100 };
}

export function badgePoints(badgeId: string): number {
  const b = BADGE_LIST.find((x) => x.id === badgeId);
  return badgeGrade(b?.total ?? 1).points;
}

// 획득(isComplete) 뱃지들의 포인트 합산 = 적립 포인트 총량
export function earnedBadgePoints(
  earnedBadges?: { id: string; isComplete?: boolean }[] | null,
): number {
  if (!earnedBadges?.length) return 0;
  return earnedBadges
    .filter((b) => b.isComplete)
    .reduce((sum, b) => sum + badgePoints(b.id), 0);
}
