import { mainMenu } from "@/types/mainMenu";

export const mainMenus: mainMenu[] = [
  {
    title: "홈",
    imgUrl: "/images/header/menu/home.svg",
    path: "/",
  },
  {
    title: "큐레이션",
    imgUrl: "/images/header/menu/genre-filter.svg",
    path: "/category",
  },
  // {
  //   title: "플레이리스트",
  //   imgUrl: "/images/header/menu/playlist.svg",
  //   path: "/mypage/playlist?tab=playlists",
  // },
  {
    title: "위시리스트",
    imgUrl: "/images/header/menu/wishlist.svg",
    path: "/mypage/playlist?tab=playlists",
  },
  {
    title: "시청이력",
    imgUrl: "/images/header/menu/playhist.svg",
    path: "/mypage/playlist?tab=history"
  },
  {
    title: "영화",
    imgUrl: "/images/header/menu/movie.svg",
    path: "/category?type=movie",
  },
  {
    title: "시리즈",
    imgUrl: "/images/header/menu/tv.svg",
    path: "/category?type=tv",
  },
  {
    title: "애니메이션",
    imgUrl: "/images/header/menu/animation.svg",
    path: "/category?type=animation",
  },
  {
    title: "굿즈샵",
    imgUrl: "/images/header/menu/shop.svg",
    path: "/shop"
  },
  {
    title: "피드",
    imgUrl: "/images/header/menu/feed.svg",
    path: "/feed",
  },
  // {
  //     title: "커스텀",
  //     imgUrl: "/images/header/menu/custom.svg",
  //     path: "/menu/custom"
  // }
];

export const customMenus: mainMenu[] = [
  {
    title: "액션",
    imgUrl: "/images/header/menu/genre-action.svg",
    path: "/genre/action",
  },
  {
    title: "애니메이션",
    imgUrl: "/images/header/menu/genre-animation.svg",
    path: "/genre/animation",
  },
  {
    title: "코미디",
    imgUrl: "/images/header/menu/genre-comedy.svg",
    path: "/genre/comedy",
  },
  {
    title: "다큐멘터리",
    imgUrl: "/images/header/menu/genre-documentary.svg",
    path: "/genre/documentary",
  },
  {
    title: "드라마",
    imgUrl: "/images/header/menu/genre-drama.svg",
    path: "/genre/drama",
  },
  {
    title: "판타지",
    imgUrl: "/images/header/menu/genre-fantasy.svg",
    path: "/genre/fantasy",
  },
  {
    title: "공포",
    imgUrl: "/images/header/menu/genre-horror.svg",
    path: "/genre/horror",
  },
  {
    title: "미스터리",
    imgUrl: "/images/header/menu/genre-mystery.svg",
    path: "/genre/mystery",
  },
  {
    title: "로맨스",
    imgUrl: "/images/header/menu/genre-romance.svg",
    path: "/genre/romance",
  },
  {
    title: "SF",
    imgUrl: "/images/header/menu/genre-scifi.svg",
    path: "/genre/scifi",
  },
  {
    title: "스릴러",
    imgUrl: "/images/header/menu/genre-thriller.svg",
    path: "/genre/thriller",
  },
  {
    title: "전쟁",
    imgUrl: "/images/header/menu/genre-war.svg",
    path: "/genre/war",
  },

  // 🍿 무드 (Mood) 영역
  {
    title: "잔잔한",
    imgUrl: "/images/header/menu/mood-chill.svg",
    path: "/mood/chill",
  },
  {
    title: "어두운",
    imgUrl: "/images/header/menu/mood-dark.svg",
    path: "/mood/dark",
  },
  {
    title: "감성적인",
    imgUrl: "/images/header/menu/mood-emotional.svg",
    path: "/mood/emotional",
  },
  {
    title: "신나는",
    imgUrl: "/images/header/menu/mood-exciting.svg",
    path: "/mood/exciting",
  },
  {
    title: "유쾌한",
    imgUrl: "/images/header/menu/mood-funny.svg",
    path: "/mood/funny",
  },
  {
    title: "낭만적인",
    imgUrl: "/images/header/menu/mood-romantic.svg",
    path: "/mood/romantic",
  },
  {
    title: "무서운",
    imgUrl: "/images/header/menu/mood-scary.svg",
    path: "/mood/scary",
  },
  {
    title: "심오한",
    imgUrl: "/images/header/menu/mood-thoughtful.svg",
    path: "/mood/thoughtful",
  },
];
