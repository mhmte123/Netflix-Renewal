import { type User } from "firebase/auth";

export interface Profile {
  id: number;
  name: string | null;
  imgUrl: string | null;
}

export interface UserInfo extends User {
  profiles?: Profile[] | null;
}

export type FamilyMember = "엄마" | "아빠" | "아들" | "딸";

export interface AuthState {
  user: UserDocument | null;
  currentProfile: UserProfile | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  onInitAuth: () => (() => void) | void;
  onLogin: (user: UserDocument) => void;
  onKakaoLogin: () => Promise<{ isNewUser: boolean } | false>;
  onNaverLogin: () => Promise<{ isNewUser: boolean } | false>;
  onLogout: () => Promise<void>;
  onSetProfile: (profile: UserProfile | null) => void;
  onAddProfile: (profile: Omit<UserProfile, "id">) => Promise<void>;
  onUpdateProfile: (profile: UserProfile) => Promise<void>;
  onDeleteProfile: (profileId: string | number) => Promise<void>;
  toggleCommunity: () => Promise<void>;
  updateUserLike: (reviewId: string, videoId: string) => Promise<void>;
  updateUserLikeFeeds: (feedId: string) => Promise<void>;
  updateUserCommentFeed: (feedId: string, commentId: string) => Promise<void>;
  updateUserReportFeed: (feedId: string) => Promise<void>;
  equipBadge: (badgeId: string) => Promise<void>;
}

export interface UserProfile {
  id: number;
  nickname: string;
  imgUrl: string;
  viewAge: string;
  settings?: ProfileSettings;
  // 영상관련 (기본 필드 형태)
  movies: MovieList;

  // 커뮤니티관련
  community: CommunityList;

  // 메뉴 및 뱃지
  headerMenus: string[];    // 헤더 표시 메뉴 ID 목록
  badges: BadgeList;

  alarm: AlarmInfo[]; //위시리스트에 있는거 빼고 알림 설정한거 영상 리스트
  isCommunity: boolean;
}

export type MaturityRating = "전체관람가" | "12+" | "15+" | "19+";

export interface SubtitleSettings {
  size: "small" | "medium" | "large";
  font: "block" | "gothic" | "serif" | "round";
  shadow: "none" | "drop" | "outline";
  shadowColor: "black" | "white";
  background: "none" | "black" | "white";
  window: "none" | "black" | "white";
}

export interface PlaybackSettings {
  autoplayNext: boolean;
  autoplayPreview: boolean;
}

export interface ProfileSettings {
  maturityRating: MaturityRating;
  verifiedAdult: boolean;
  subtitles: SubtitleSettings;
  playback: PlaybackSettings;
  hiddenWatchingVideos: string[];
  favoriteGenres: string[]; // 선호 장르 slug 목록
  excludedGenres: string[]; // 제외 장르 slug 목록
  favoriteMoods: string[]; // 선호 무드 slug 목록
  excludedMoods: string[]; // 제외 무드 slug 목록
  favoriteTitles?: string[]; // 온보딩 관심 작품 ("movie:123" | "tv:456")
}

export interface AlarmInfo {
  category: string; // 알람 카테고리 피드인지 리뷰인지 공개예정인지 새에피소드인지..
  content: string; //알림 내용
  title: string // 알림 타이틀
  link: string // 알림 링크
}

export interface UserGenreStats {
  [genreName: string]: number;
}

export interface PlayList {
  playlistVideos: string[]; // 플레이리스트 영상 ID 목록
  customPlaylists: string[]; // 커스텀 플레이리스트 ID 목록 - 필요없음
}

export interface MovieList {
  watchingVideos: string[];
  histMovies?: string[];
  wishlist: string[];
  playlist: PlayList;
  genreStats: UserGenreStats;
  countryStats: UserGenreStats;
}

export interface BadgeInfo {
  id: string; //뱃지 아이디
  progress: number; //진행도
  isComplete: boolean; //획득유무
}

export interface BadgeList {
  earnedBadges: BadgeInfo[];   // 획득 뱃지 ID 목록
  equippedBadges: string;  // 장착 뱃지 ID 하나만
}

export interface CommunityList {
  followers: string[];   // 팔로워 유저 ID 목록
  following: string[]; // 팔로잉 유저 ID 목록
  reviews: string[]; //리뷰 ID 목록 내 리뷰 말고 좋아요한거 싫어요 한거 신고한거
  likedfeeds: string[];
  commentfeeds: string[];
  reportfeeds: string[];
  //commentfeeds: FeedActivity[]; // 내가 작성한 피드가 아니라 다른 피드에 남긴 댓글/좋아요 활동
}

export interface FeedActivity {
  feedId: string;
  type: "comment" | "like" | "report";
  commentId?: string;
  reason?: string;
  createdAt: string;
}

export interface PayInfo {
  pay: string;   //결제방법
  bank: string;  //은행아니면 통신사
  num: string; //카드번호, 계좌번호, 핸드폰번호
  payDate: string; //카드 유효기간이랑 cvc 같이 저장 -로 연결
  nextDate: string; //다음 결제일
  lastPlanType?: string; //해지 전 마지막 플랜 (basic/standard/premium)
}

export interface UserDocument {
  userId: string; // 문서 ID로 사용됨
  // 기본정보
  email: string;
  provider?: 'email' | 'google' | 'kakao' | 'naver';
  planType: string;
  payment: PayInfo;
  profile: UserProfile[];
  points?: number; // (미사용) 과거 적립 잔액 필드
  pointsUsed?: number; // 굿즈샵에서 교환에 사용한 누적 포인트 (적립은 뱃지에서 산출)
}