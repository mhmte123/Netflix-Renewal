import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAcDdSm4C5IoAv_8bwJ5bKj_7XsDs4K_Ok",
  authDomain: "netflix-dev-e99f4.firebaseapp.com",
  projectId: "netflix-dev-e99f4",
  storageBucket: "netflix-dev-e99f4.firebasestorage.app",
  messagingSenderId: "1090533548326",
  appId: "1:1090533548326:web:67925f8635086a398461e7",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// TMDB IDs
// 한국 영화: 기생충(496243) 부산행(396535) 신과함께(461693) 범죄도시(556574) 헤어질결심(841782)
//           반도(630566) 사냥의시간(716560) 밀정(390043) 다음소희(874214) 브로커(803203) 올드보이(6217)
// 일본 애니: 스즈메(916224) 너의이름은(372058) 센과치히로(129) 하울(4935) 이웃집토토로(8392)
//           귀멸극장판(635302) 버블(907390) 늑대아이(93271) 목소리의형태(378064) 날씨의아이(591274)
// 일본 애니 시리즈: 귀멸TV(85937) 진격의거인(1429) 원피스(37854) 스파이패밀리(126308) 체인소맨(120089)
// 미국 영화: 인터스텔라(157336) 다크나이트(155) 펄프픽션(680) 파이트클럽(550) 쇼생크(278)
//           인셉션(27205) 조커(475557) 어벤져스(24428) 매트릭스(603) 포레스트검프(13)
// 미국 시리즈: 기묘한이야기(66732) 브레이킹배드(1396) 왕좌의게임(1399) 블랙미러(42009) 아케인(94954)
//            오징어게임(93405) 더글로리(208827) 킹덤(95403)

const testUsers = [
  {
    userId: "test-user-001",
    email: "cinephile@test.com",
    profile: [{
      id: 1, nickname: "씨네필",
      imgUrl: "/images/profile/image/dark/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["841782", "550", "6217", "496243", "680"],
        wishlist: ["874214"],
        playlist: { playlistVideos: ["841782", "550", "6217", "496243", "680", "874214", "803203"], customPlaylists: [] },
        genreStats: { "드라마": 12, "스릴러": 8 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_drama", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_drama", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-002",
    email: "filmcat@test.com",
    profile: [{
      id: 1, nickname: "필름고양이",
      imgUrl: "/images/profile/image/arcane/1.png",
      viewAge: "15", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["8392", "803203", "4935", "372058", "916224"],
        wishlist: ["93271"],
        playlist: { playlistVideos: ["8392", "803203", "4935", "372058", "916224", "93271", "378064"], customPlaylists: [] },
        genreStats: { "드라마": 20, "로맨스": 15 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_thriller", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_thriller", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-003",
    email: "movieterrace@test.com",
    profile: [{
      id: 1, nickname: "무비테라스",
      imgUrl: "/images/profile/image/stranger_things/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["129", "916224", "635302", "85937", "1429"],
        wishlist: ["126308"],
        playlist: { playlistVideos: ["129", "916224", "635302", "85937", "1429", "126308", "120089"], customPlaylists: [] },
        genreStats: { "애니": 30, "판타지": 10 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_animation", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_animation", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-004",
    email: "midnightscreen@test.com",
    profile: [{
      id: 1, nickname: "심야상영",
      imgUrl: "/images/profile/image/peaky_blinders/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["475557", "155", "550", "603", "680"],
        wishlist: ["1396"],
        playlist: { playlistVideos: ["475557", "155", "550", "603", "680", "1396", "42009"], customPlaylists: [] },
        genreStats: { "공포": 18, "스릴러": 22 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "culture_k_drama", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "culture_k_drama", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-005",
    email: "dawntwo@test.com",
    profile: [{
      id: 1, nickname: "새벽두시",
      imgUrl: "/images/profile/image/wednesday/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["496243", "874214", "841782", "803203", "396535"],
        wishlist: ["716560"],
        playlist: { playlistVideos: ["496243", "874214", "841782", "803203", "396535", "716560"], customPlaylists: [] },
        genreStats: { "독립영화": 9, "드라마": 14 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_action", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_action", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-006",
    email: "hepburn@test.com",
    profile: [{
      id: 1, nickname: "햅번공주",
      imgUrl: "/images/profile/image/alice_in_borderland/1.png",
      viewAge: "15", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["496243", "396535", "556574", "461693", "630566"],
        wishlist: ["93405"],
        playlist: { playlistVideos: ["496243", "396535", "556574", "461693", "630566", "93405", "208827"], customPlaylists: [] },
        genreStats: { "한국드라마": 25, "액션": 10 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "binge_master", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "binge_master", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-007",
    email: "movielog@test.com",
    profile: [{
      id: 1, nickname: "무비로그",
      imgUrl: "/images/profile/image/squid_game/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["24428", "155", "27205", "603", "475557"],
        wishlist: ["49026"],
        playlist: { playlistVideos: ["24428", "155", "27205", "603", "475557", "49026", "37724"], customPlaylists: [] },
        genreStats: { "액션": 35, "SF": 12 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_sf", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_sf", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-008",
    email: "scifiroom@test.com",
    profile: [{
      id: 1, nickname: "SF방",
      imgUrl: "/images/profile/image/money_heist/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["157336", "603", "27205", "49047", "118340"],
        wishlist: ["1399"],
        playlist: { playlistVideos: ["157336", "603", "27205", "49047", "118340", "1399", "66732"], customPlaylists: [] },
        genreStats: { "SF": 40, "스릴러": 8 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_romance", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_romance", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-009",
    email: "postercollector@test.com",
    profile: [{
      id: 1, nickname: "포스터수집가",
      imgUrl: "/images/profile/image/lucifer/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["841782", "496243", "390043", "874214", "803203"],
        wishlist: ["6217"],
        playlist: { playlistVideos: ["841782", "496243", "390043", "874214", "803203", "6217", "716560"], customPlaylists: [] },
        genreStats: { "한국영화": 30, "드라마": 20 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "culture_jp_drama", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "culture_jp_drama", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-010",
    email: "animefan@test.com",
    profile: [{
      id: 1, nickname: "극장선택",
      imgUrl: "/images/profile/image/witcher/1.png",
      viewAge: "15", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["916224", "372058", "907390", "378064", "591274"],
        wishlist: ["85937"],
        playlist: { playlistVideos: ["916224", "372058", "907390", "378064", "591274", "85937", "1429"], customPlaylists: [] },
        genreStats: { "일본애니": 45, "판타지": 10 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_mystery", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_mystery", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-011",
    email: "filmnote@test.com",
    profile: [{
      id: 1, nickname: "필름노트",
      imgUrl: "/images/profile/image/one_piece/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["278", "389", "13", "680", "550"],
        wishlist: ["15"],
        playlist: { playlistVideos: ["278", "389", "13", "680", "550", "15", "27205"], customPlaylists: [] },
        genreStats: { "클래식": 28, "드라마": 18 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "social_reviewer", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "social_reviewer", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-012",
    email: "nightcrawler@test.com",
    profile: [{
      id: 1, nickname: "나이트크롤러",
      imgUrl: "/images/profile/image/black_mirror/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["6217", "390043", "874214", "716560", "556574"],
        wishlist: ["42009"],
        playlist: { playlistVideos: ["6217", "390043", "874214", "716560", "556574", "42009", "1396"], customPlaylists: [] },
        genreStats: { "범죄": 32, "스릴러": 20 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_fantasy", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_fantasy", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-013",
    email: "moodmovie@test.com",
    profile: [{
      id: 1, nickname: "무드무비",
      imgUrl: "/images/profile/image/bridgerton/1.png",
      viewAge: "12", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["8392", "4935", "803203", "916224", "93271"],
        wishlist: ["372058"],
        playlist: { playlistVideos: ["8392", "4935", "803203", "916224", "93271", "372058", "591274"], customPlaylists: [] },
        genreStats: { "힐링": 22, "애니": 18 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "7days_attendance", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "7days_attendance", progress: 7, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-014",
    email: "cinepick@test.com",
    profile: [{
      id: 1, nickname: "씨네픽",
      imgUrl: "/images/profile/image/orange_is_the_new_black/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["496243", "841782", "372058", "916224", "390043"],
        wishlist: ["94954"],
        playlist: { playlistVideos: ["496243", "841782", "372058", "916224", "390043", "94954", "66732"], customPlaylists: [] },
        genreStats: { "한국영화": 18, "일본애니": 15 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "social_taste_sharer", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "social_taste_sharer", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
  {
    userId: "test-user-015",
    email: "filmexplorer@test.com",
    profile: [{
      id: 1, nickname: "필름탐험가",
      imgUrl: "/images/profile/image/love_death_robots/1.png",
      viewAge: "19", headerMenus: [], isCommunity: true,
      movies: {
        watchingVideos: ["157336", "635302", "396535", "475557", "550"],
        wishlist: ["126308"],
        playlist: { playlistVideos: ["157336", "635302", "396535", "475557", "550", "126308", "120089"], customPlaylists: [] },
        genreStats: { "액션": 20, "SF": 15, "애니": 12 }, moodStats: {},
      },
      community: { followers: [], following: [], reviews: [], feeds: [] },
      badges: { equippedBadges: "genre_documentary", earnedBadges: [{ id: "first_streaming", progress: 1, isComplete: true }, { id: "genre_documentary", progress: 1, isComplete: true }] }, alarm: [],
    }],
  },
];

async function seed() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("사용법: node scripts/seedUsers.mjs <이메일> <비밀번호>");
    process.exit(1);
  }

  console.log(`🔐 ${email} 로 로그인 중...`);
  await signInWithEmailAndPassword(auth, email, password);
  console.log("✅ 로그인 성공\n");

  for (const user of testUsers) {
    await setDoc(doc(db, "users", user.userId), user);
    console.log(`✅ ${user.profile[0].nickname} (${user.userId})`);
  }
  console.log(`\n🎉 테스트 유저 ${testUsers.length}명 추가 완료!`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
