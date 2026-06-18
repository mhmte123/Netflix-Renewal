"use client";

import React, { useState, useEffect, useMemo } from "react";
import AppIcon from "@/components/common/AppIcon";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlayListStore } from "@/store/usePlayListStore";
import { useMovieStore } from "@/store/useMovieStore";
import "../scss/mypage.scss";
import { BADGE_LIST } from "@/data/badge";
import { useCommunityEnabled } from "@/data/maturityFilter";
import { useCommunityStore } from "@/store/useCommunityStore";
import PointChip from "@/components/shop/PointChip";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { filters } from "../category/page";
import { PlayListItem } from "@/types/playList";
import RepBadge from "@/components/common/RepBadge";
import { useWatchPartyStore } from "@/store/useWatchPartyStore";
import { FreeMode } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/free-mode";

const TMDB_IMG = "https://image.tmdb.org/t/p";

function getRelativePartyTime(createdAt: number) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - createdAt) / 60000),
  );
  if (elapsedMinutes < 1) return "방금 전";
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전`;
  return `${Math.floor(elapsedMinutes / 60)}시간 전`;
}

const GENRE_COLORS: { [key: string]: string } = {
  // DS: 강조색은 빨강 계열만 사용 (장르별 임의 색상 금지)
  SF: "#6366f1", // 인디고
  액션: "#3b82f6", // 블루
  스릴러: "#ef4444", // 레드
  판타지: "#a855f7", // 퍼플
  드라마: "#10b981", // 그린
  공포: "#b94010", // 그린
  미스터리: "#10b93a", // 그린
  전쟁: "#e5f50b", // 그린
  코미디: "#f59e0b", // 앰버
  로맨스: "#ec4899", // 핑크
  애니메이션: "#ec487f", // 핑크
  다큐멘터리: "#64748b", // 슬레이트
  기타: "#94a3b8", // 기본 회색
};

// 사용 시 함수 형태로 호출
const getGenreColor = (genreName: string) => {
  return GENRE_COLORS[genreName] || GENRE_COLORS["기타"];
};

export default function MyPage() {
  const router = useRouter();
  const { user, currentProfile, onLogout, toggleCommunity } = useAuthStore();
  const { playHist, onLoadPlayList } = usePlayListStore();
  const {
    popMovies,
    tvs,
    onFetchPopular,
    onFetchTvs,
    mediaDetails,
    onFetchMediaDetail,
    fetchMediaDetail,
  } = useMovieStore();

  const userId = user?.userId;
  const { reviews, fetchUserReviews } = useCommunityStore();
  const { invitedParties, subscribeInvitedParties, unsubscribeInvitedParties } =
    useWatchPartyStore();
  const [historyItems, setHistoryItems] = useState<PlayListItem[]>([]);

  const handleLogout = async () => {
    await onLogout();
    router.replace("/login");
  };

  useEffect(() => {
    onLoadPlayList();
    if (popMovies.length === 0) onFetchPopular();
    if (tvs.length === 0) onFetchTvs();
  }, []);

  // 1. 리뷰 로드 호출
  useEffect(() => {
    if (userId) fetchUserReviews();
  }, [userId, fetchUserReviews]);

  useEffect(() => {
    const loadHistory = async () => {
      const items = await getDetailedHistory(playHist);
      setHistoryItems(items);
    };
    loadHistory();
  }, [playHist]);
  // console.log(historyItems, playHist);

  // 2. 영화 상세 정보 보완
  const [enrichedReviews, setEnrichedReviews] = useState<any[]>([]);

  useEffect(() => {
    const updateEnriched = async () => {
      const data = await Promise.all(
        reviews.map(async (review) => {
          const [type, id] = review.videoId.split("-");
          // onFetchMediaDetail 호출하여 데이터 획득
          const detail = await fetchMediaDetail(id, type as "movie" | "tv");
          return {
            ...review,
            mediaInfo: detail,
          };
        }),
      );
      setEnrichedReviews(data);
    };

    if (reviews.length > 0) {
      updateEnriched();
    }
  }, [reviews]);

  // 스토어의 isCommunity + 관람등급(12세 이하 자동 숨김) 기준으로 UI 판단
  const isCommunityEnabled = useCommunityEnabled();
  const hideCommunity = !isCommunityEnabled;

  const activeProfile = useMemo(() => {
    return currentProfile ?? user?.profile?.[0] ?? null;
  }, [currentProfile, user]);

  useEffect(() => {
    if (!userId || activeProfile?.id == null) {
      unsubscribeInvitedParties();
      return;
    }

    subscribeInvitedParties(userId, activeProfile.id);
    return () => unsubscribeInvitedParties();
  }, [
    activeProfile?.id,
    subscribeInvitedParties,
    unsubscribeInvitedParties,
    userId,
  ]);

  const menuIcons = useMemo(() => {
    return {
      playlist: "/images/header/menu/playlist.svg",
      genre: "/images/header/menu/genre-filter.svg",
      custom: "/images/header/menu/custom.svg",
      alarm: "/images/header/alarm.svg",
      friends: "/images/icon/icon-friends.svg",
      review: "/images/icon/icon-community.svg",
      contact: "/images/icon/icon-mail.svg",
      badge: "/images/icon/icon-badge.svg",
    };
  }, []);

  const quickMenuItems = useMemo(() => {
    const allItems = [
      {
        href: "/mypage/playlist",
        icon: menuIcons.playlist,
        title: "콘텐츠 관리",
        desc: "내가 찜·시청하고 기록한 모든 작품",
        isCommunity: false,
      },
      {
        href: "/mypage/community",
        icon: menuIcons.review,
        title: "커뮤니티 관리",
        desc: "내가 쓴 리뷰/피드",
        isCommunity: true,
      },
      {
        href: "/menu/custom",
        icon: menuIcons.custom,
        title: "메뉴 커스텀",
        desc: "나만의 메뉴 커스텀",
        isCommunity: false,
      },
      {
        href: "/alarm",
        icon: menuIcons.alarm,
        title: "알림",
        desc: "새로운 활동",
        isCommunity: false,
      },
      {
        href: "/friends",
        icon: menuIcons.friends,
        title: "팔로워 • 팔로잉",
        desc: "팔로워 및 팔로잉 관리",
        isCommunity: true,
      },
      {
        href: "/mypage/genre",
        icon: menuIcons.genre,
        title: "장르 관리",
        desc: "선호/제외 장르 선택",
        isCommunity: false,
      },
      {
        href: "/contact?tab=history",
        icon: menuIcons.contact,
        title: "문의 관리",
        desc: "내가 쓴 문의",
        isCommunity: false,
      },
      {
        href: "/goods",
        icon: menuIcons.badge,
        title: "뱃지 관리",
        desc: "대표 칭호 및 장착 설정",
        isCommunity: false,
      },
    ];

    // hideCommunity가 true(숨김)일 때 isCommunity: true인 항목 필터링
    return hideCommunity
      ? allItems.filter((item) => !item.isCommunity)
      : allItems;
  }, [hideCommunity, menuIcons]); // 의존성 배열에 hideCommunity 유지

  // const filteredActivities = useMemo(() => {
  //   const alarms = activeProfile?.alarm || [];

  //   return alarms
  //     .filter((alarm) => alarm.category === 'review' || alarm.category === 'feed')
  //     .slice(0, 5); // 최근 활동 5개만 표시
  // }, [activeProfile]);

  const filteredActivities = useMemo(() => {
    // 샘플 데이터를 상수로 정의하고 사용
    const sampleNotifs = [
      {
        id: 2,
        type: "reaction",
        title: "리뷰에 반응이 도착했어요",
        description: "외 3명이 회원님의 리뷰에 좋아요를 눌렀어요",
        thumb: popMovies[0]?.poster_path,
        time: "1시간 전",
        unread: true,
      },
      {
        id: 3,
        type: "friend",
        title: "팔로잉 유저의 새 활동",
        description: `팔로잉 유저가 ${popMovies[1]?.title}에 ★★★★★ 평가를 남겼어요`,
        mediaId: popMovies[1]?.id,
        mediaType: "movie",
        thumb: popMovies[1]?.poster_path,
        time: "2시간 전",
        unread: true,
      },
      {
        id: 6,
        type: "friend",
        title: "새 팔로워",
        description: "회원님을 팔로우하기 시작했어요",
        time: "2일 전",
        unread: false,
      },
      {
        id: 7,
        type: "reaction",
        title: "댓글 알림",
        description: "회원님의 리뷰에 댓글을 남겼어요",
        thumb: popMovies[2]?.poster_path,
        time: "3일 전",
        unread: false,
      },
    ];

    return sampleNotifs.slice(0, 3); // 상위 5개만 반환
  }, [tvs, popMovies]);

  const profileData = useMemo(() => {
    if (!activeProfile) {
      return {
        equippedBadgeName: null,
        stats: { follower: 0, following: 0, review: 0, badge: 0, watched: 0 },
      };
    }

    // 장착된 대표 칭호/뱃지 찾기
    const matchedBadge = BADGE_LIST.find(
      (b) => b.id === activeProfile.badges?.equippedBadges,
    );

    return {
      equippedBadgeName: matchedBadge ? matchedBadge.name : null,
      stats: {
        follower: activeProfile.community?.followers?.length || 0,
        following: activeProfile.community?.following?.length || 0,
        review: activeProfile.community?.reviews?.length || 0,
        badge:
          activeProfile.badges?.earnedBadges?.filter((b) => b.isComplete)
            .length || 0,
        watched:
          activeProfile.movies?.watchingVideos?.length || playHist.length || 0, // 실제 담긴 목록 카운트 바인딩
      },
    };
  }, [activeProfile, playHist]);

  // 💡 [수정] 가짜 데이터 대신 실제 활성화된 프로필의 획득 뱃지 동기화
  const displayBadgesSummary = useMemo(() => {
    if (!activeProfile || !activeProfile.badges) return [];

    const { earnedBadges, equippedBadges } = activeProfile.badges;
    const completedUserBadges =
      earnedBadges?.filter((b: any) => b.isComplete) || [];

    const mapped = completedUserBadges.map((userBadge: any) => {
      const master = BADGE_LIST.find((m) => m.id === userBadge.id);
      return {
        id: userBadge.id,
        name: master ? master.name : "알 수 없는 뱃지",
        title: master ? master.title : "",
        imgUrl: master ? master.imgUrl : "/images/badge/default.png",
        isEquipped: equippedBadges === userBadge.id,
      };
    });

    return mapped
      .sort((a, b) => (b.isEquipped ? 1 : 0) - (a.isEquipped ? 1 : 0))
      .slice(0, 5);
  }, [activeProfile]);

  const getDetailedHistory = async (
    histKeys: string[],
  ): Promise<PlayListItem[]> => {
    const detailPromises = histKeys.map(async (key) => {
      const [mediaType, id] = key.split("-");
      const data = await fetchMediaDetail(id, mediaType as "movie" | "tv");

      if (!data) return null;

      return {
        id: Number(id),
        title: data.title || data.name || "제목 없음",
        poster_path: data.poster_path ?? "",
        mediaType: mediaType as "movie" | "tv",
        playTime: "",
        progress: 100,
        episodeProgress: {},
      };
    });

    const results = await Promise.all(detailPromises);

    return results.filter((item): item is PlayListItem => item !== null);
  };

  const ID_MAP = useMemo(() => {
    const genreToTargets: Record<
      string,
      { label: string; type: "genre" | "mood" }[]
    > = {};
    const moodToInfo: Record<string, { label: string; id: string }> = {};

    // 1. 장르 처리
    filters.genre.forEach((g) => {
      const ids = [
        ...(g.query?.with_genres?.split(",") || []),
        ...(g.tvQuery?.with_genres?.split(",") || []),
      ];
      ids.forEach((id) => {
        const cleanId = id.trim();
        if (!genreToTargets[cleanId]) genreToTargets[cleanId] = [];
        genreToTargets[cleanId].push({ label: g.label, type: "genre" });
      });
    });

    // 2. 무드 처리
    filters.mood.forEach((m) => {
      moodToInfo[m.id] = { label: m.label, id: m.id }; // 무드 ID와 레이블 저장

      const ids = [
        ...(m.query?.with_genres?.split(",") || []),
        ...(m.tvQuery?.with_genres?.split(",") || []),
      ];
      ids.forEach((id) => {
        const cleanId = id.trim();
        if (!genreToTargets[cleanId]) genreToTargets[cleanId] = [];
        genreToTargets[cleanId].push({ label: m.label, type: "mood" });
      });
    });

    return { genreToTargets, moodToInfo };
  }, []);

  // const genreMoodStats = useMemo(() => {
  //   const stats = activeProfile?.movies?.genreStats || {}; // 통합된 stats 객체
  //   const totalCount = Object.values(stats).reduce((a, b) => a + b, 0);

  //   if (totalCount === 0) return { isEmpty: true };

  //   // 1. 장르 처리: filters.genre에 ID가 존재하는지 확인
  //   const genres = Object.entries(stats)
  //     .filter(([id]) => filters.genre.some(g => g.query.with_genres?.includes(id)))
  //     .map(([id, count]) => {
  //       const gInfo = filters.genre.find(g => g.query.with_genres?.includes(id));
  //       return {
  //         name: gInfo?.label || "기타",
  //         count,
  //         percentage: Math.round((count / totalCount) * 100),
  //         color: GENRE_COLORS[gInfo?.label || "기타"] // 필요시 별도 컬러 함수 사용
  //       };
  //     })
  //     .sort((a, b) => b.count - a.count);

  //   // 2. 무드 처리: filters.mood에 ID가 존재하는지 확인
  //   const moods = Object.entries(stats)
  //     .filter(([id]) => filters.mood.some(m => m.id === id))
  //     .map(([id, count]) => {
  //       const mInfo = filters.mood.find(m => m.id === id);
  //       return {
  //         tag: mInfo?.label || "일반",
  //         count,
  //         type: "neutral",
  //         img: `/images/header/menu/mood-${id}.svg`
  //       };
  //     })
  //     .sort((a, b) => b.count - a.count);

  //   return {
  //     isEmpty: false,
  //     genres,
  //     moods,
  //     topGenre: genres[0] || { name: "없음" },
  //     topMood: moods[0] || { tag: "없음" }
  //   };
  // }, [activeProfile]);

  // Firestore에서 플랜/결제 정보 불러오기

  const genreMoodStats = useMemo(() => {
    const stats = activeProfile?.movies?.genreStats || {};
    const totalCount = Object.values(stats).reduce((a, b) => a + b, 0);

    if (totalCount === 0) return { isEmpty: true };

    const genreResults: Record<string, number> = {};
    const moodResults: Record<string, { count: number; id: string }> = {};

    Object.entries(stats).forEach(([id, count]) => {
      // 1. 무드 ID 직접 매핑
      if (ID_MAP.moodToInfo[id]) {
        const { label, id: moodId } = ID_MAP.moodToInfo[id];
        if (!moodResults[label]) moodResults[label] = { count: 0, id: moodId };
        moodResults[label].count += count;
      }

      // 2. 장르 ID를 통한 매핑
      const targets = ID_MAP.genreToTargets[id] || [];
      targets.forEach((t) => {
        if (t.type === "genre") {
          genreResults[t.label] = (genreResults[t.label] || 0) + count;
        } else if (t.type === "mood") {
          // 장르 ID를 통해 무드 레이블을 찾고, 그에 해당하는 ID도 찾음
          const moodInfo = filters.mood.find((m) => m.label === t.label);
          if (moodInfo) {
            if (!moodResults[t.label])
              moodResults[t.label] = { count: 0, id: moodInfo.id };
            moodResults[t.label].count += count;
          }
        }
      });
    });

    // 배열 변환 로직
    const genres = Object.entries(genreResults)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalCount) * 100),
        color: GENRE_COLORS[name] || "#ccc",
      }))
      .sort((a, b) => b.count - a.count);

    // 배열 변환 (이제 mood 객체 안에 id가 포함되어 있음)
    const moods = Object.entries(moodResults)
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        id: data.id, // 추가됨
        img: `/images/header/menu/mood-${data.id}.svg`, // 여기에서 id 사용
      }))
      .sort((a, b) => b.count - a.count);

    return {
      isEmpty: false, // 이 부분을 추가했습니다
      genres,
      moods,
      topGenre: genres[0] || { name: "없음" },
      topMood: moods[0] || { tag: "없음" },
    };
  }, [activeProfile, ID_MAP]);

  const [planType, setPlanType] = useState<string>("");
  const [nextDate, setNextDate] = useState<string>("");
  const [lastPlanType, setLastPlanType] = useState<string>("");

  useEffect(() => {
    const uid = user?.userId ?? auth.currentUser?.uid;
    if (!uid) return; // 로그인 안 된 경우 early return

    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) return; // 문서 없으면 early return
      const data = snap.data();
      setPlanType(data.planType ?? ""); // 플랜 종류 (basic/standard/premium)
      setNextDate(data.payment?.nextDate ?? ""); // 다음 결제일
      setLastPlanType(data.payment?.lastPlanType ?? ""); // 해지 전 마지막 플랜
    });
  }, [user?.userId]); // user가 바뀔 때마다 재실행

  // planType 영문 → 한글 변환
  const planTypeLabel = (type: string) => {
    if (type === "basic") return "베이직";
    if (type === "standard") return "스탠다드";
    if (type === "premium") return "프리미엄";
    return "";
  };

  const planLabel = planTypeLabel(planType) || null; // planType 없으면 뱃지 자체를 숨김

  const iconMap: any = {
    episode: "episode",
    friend: "friend",
    upcoming: "upcoming",
    reaction: "reaction",
  };

  return (
    <div className="mypage">
      <div className="inner">
        {/* 상단 모드 컨트롤러 바 */}
        <div className="mypage-mode-controller">
          <p>
            <AppIcon name="clapper" size={16} /> 피드/리뷰 기능을 숨길 수
            있습니다.
          </p>
          <button
            className={`toggle-mode-btn ${hideCommunity ? "active" : ""}`}
            onClick={toggleCommunity} // 스토어 액션 직접 연결
          >
            <span>
              {hideCommunity ? (
                <>
                  <AppIcon name="lock" size={15} /> 커뮤니티 숨김 모드
                </>
              ) : (
                <>
                  <AppIcon name="unlock" size={15} /> 커뮤니티 표시 모드
                </>
              )}
            </span>
            <div className="switch-track">
              <div className="switch-thumb"></div>
            </div>
          </button>
        </div>

        {/* 프로필 요약 */}
        <div className="profile-summary">
          <div className="profile-avatar">
            <img
              src={
                activeProfile?.imgUrl ||
                "/images/profile/image/default_icons/17.png"
              }
              alt={activeProfile?.nickname || "프로필"}
            />
          </div>

          <div className="profile-info">
            <div
              className="name-wrapper"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <h2>{activeProfile?.nickname || "사용자"}</h2>
              <RepBadge
                badge={profileData.equippedBadgeName}
                size="md"
                className="pl-creator-badge"
              />
              {/* {profileData.equippedBadgeName && (
                <span className="user-equipped-badge-tag">
                  {profileData.equippedBadgeName}
                </span>
              )} */}
            </div>
            <p className="email">{user?.email || "guest@example.com"}</p>
            <div className="profile-chips">
              {/* 플랜 정보 뱃지 — planLabel 없으면 렌더링 안 함 */}
              {planLabel ? (
                // 구독 중일 때
                <span className="plan-badge">
                  ★ {planLabel}
                  {nextDate ? ` · 다음 결제 ${nextDate}` : ""}
                </span>
              ) : nextDate ? (
                // 해지했지만 아직 만료 전일 때
                <span className="plan-badge plan-badge-expiring">
                  {planTypeLabel(lastPlanType) && `${planTypeLabel(lastPlanType)} · `}
                  {nextDate} 만료
                </span>
              ) : (
                // 구독 중이 아닐 때
                <Link href="/plan" className="plan-badge plan-badge-empty">
                  구독하고 무제한으로 즐기세요 →
                </Link>
              )}
              <PointChip className="mypage-point-chip" />
            </div>
          </div>

          <div className="profile-stats">
            {!hideCommunity && (
              <>
                <div className="stat">
                  <div className="value">{profileData.stats.follower}</div>
                  <div className="label">팔로워</div>
                </div>
                <div className="stat">
                  <div className="value">{profileData.stats.following}</div>
                  <div className="label">팔로잉</div>
                </div>
                <div className="stat">
                  <div className="value">{profileData.stats.review}</div>
                  <div className="label">작성 리뷰</div>
                </div>
              </>
            )}
            <div className="stat">
              <div className="value">{profileData.stats.badge}</div>
              <div className="label">획득 뱃지</div>
            </div>
            <div className="stat">
              <div className="value">{profileData.stats.watched}</div>
              <div className="label">시청 완료</div>
            </div>
          </div>
        </div>

        {/* 빠른 메뉴 구조 */}
        <div className="quick-menu">
          {quickMenuItems.map((item, idx) => (
            <Link href={item.href} className="quick-card" key={idx}>
              <div
                className={`icon ${item.href === "/alarm" ? "alarm-icon" : ""}`}
              >
                {item.icon.endsWith(".svg") || item.icon.endsWith(".png") ? (
                  <Image src={item.icon} alt="" width={24} height={24} />
                ) : (
                  <span>
                    <AppIcon name="gear" size={18} />
                  </span>
                )}
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              {/* {item.hasDot && <span className="dot"></span>} */}
            </Link>
          ))}
        </div>

        {invitedParties.length > 0 && (
          <section
            className="section-block watch-party-invitations"
            aria-labelledby="watch-party-invitations-title"
          >
            <div className="section-h">
              <div>
                <h2 id="watch-party-invitations-title">초대받은 같이보기</h2>
                <p className="watch-party-invitations__subtitle">
                  초대받은 파티에 바로 참여해 보세요.
                </p>
              </div>
              <div className="watch-party-invitations__actions">
                <span className="watch-party-invitations__count">
                  {invitedParties.length}개
                </span>
                <Link href="/alarm?tab=party" className="more">
                  전체보기 →
                </Link>
              </div>
            </div>

            <Swiper
              className="watch-party-invitations__list"
              freeMode
              modules={[FreeMode]}
              slidesPerView="auto"
              spaceBetween={12}
              observer
              observeParents
            >
              {invitedParties.map((party) => {
                const thumbnail = party.backdropPath || party.posterPath;

                return (
                  <SwiperSlide
                    className="watch-party-invitations__slide"
                    key={party.partyId}
                  >
                    <Link
                      href={`/watch/${party.type}/${party.mediaId}?party=${party.partyId}`}
                      className="watch-party-invitation"
                    >
                      <div
                        className="watch-party-invitation__thumb"
                        style={
                          thumbnail
                            ? {
                              backgroundImage: `url(${TMDB_IMG}/w500${thumbnail})`,
                            }
                            : undefined
                        }
                      >
                        <span>초대 도착</span>
                      </div>
                      <div className="watch-party-invitation__body">
                        <span className="watch-party-invitation__host">
                          {party.hostNickname}님의 같이보기
                        </span>
                        <strong>{party.partyName || party.title}</strong>
                        <p>{party.title}</p>
                        <time
                          dateTime={new Date(party.createdAt).toISOString()}
                        >
                          {getRelativePartyTime(party.createdAt)}
                        </time>
                      </div>
                      <span
                        className="watch-party-invitation__enter"
                        aria-hidden="true"
                      >
                        참여하기 →
                      </span>
                    </Link>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </section>
        )}

        {/* 최근 시청 */}
        <section className="section-block">
          <div className="section-h">
            <h2>최근 시청</h2>
            <Link href="/mypage/playlist" className="more">
              전체보기 →
            </Link>
          </div>
          {historyItems.length > 0 ? (
            <div className="poster-row">
              {historyItems.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  href={`/detail/${item.mediaType || "movie"}/${item.id}`}
                  className="poster-item"
                >
                  <div className="poster-img">
                    {item.poster_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                        alt={item.title}
                      />
                    )}
                  </div>
                  <p>{item.title}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-block">아직 시청한 작품이 없어요</div>
          )}
        </section>

        {/* 취향 분석 */}
        <section className="section-block preference-analysis-section">
          <div className="section-h">
            <h2>시청 취향 분석</h2>
            <span className="pref-subtitle">
              {activeProfile?.nickname || "사용자"}님의 시청 기록 분석
              결과입니다.
            </span>
          </div>

          <div className="analysis-grid">
            {genreMoodStats.isEmpty ? (
              <div className="empty-analysis-card">
                <img src="/images/header/search.svg" alt="데이터 없음" />
                <h3>아직 분석할 데이터가 부족해요</h3>
                <p>영상을 시청하고 나만의 취향을 확인해보세요!</p>
                <Link href="/" className="go-browse-btn">
                  영상 탐색하러 가기
                </Link>
              </div>
            ) : (
              <>
                <div className="analysis-card genre-card-box">
                  <h3>선호 장르 TOP 3</h3>
                  <div className="genre-chart-container">
                    <table className="genre-stat-table">
                      <thead>
                        <tr>
                          <th>순위</th>
                          <th>장르명</th>
                          <th>비율 및 그래프</th>
                          <th>시청 편수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {genreMoodStats.genres?.slice(0, 3).map((g, index) => (
                          <tr key={index}>
                            <td className="rank-num">{index + 1}</td>
                            <td className="genre-name">{g.name}</td>
                            <td className="graph-td">
                              <div className="progress-bar-wrapper">
                                <div
                                  className="progress-bar-fill"
                                  style={{
                                    width: `${g.percentage}%`,
                                    backgroundColor: g.color,
                                  }}
                                ></div>
                                <span className="percent-text">
                                  {g.percentage}%
                                </span>
                              </div>
                            </td>
                            <td className="count-text">{g.count}편</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="analysis-card mood-card-box">
                  <h3>선호하는 무드</h3>
                  <p className="mood-desc">
                    주로 이런 감성의 작품들을 즐겨 보셨어요.
                  </p>
                  <div className="mood-tag-cloud">
                    {genreMoodStats.moods?.slice(0, 6).map((m, index) => (
                      <span key={index} className={`mood-tag-item `}>
                        <img src={m.img} alt={m.tag} />
                        {m.tag}
                      </span>
                    ))}
                  </div>

                  <div className="mood-summary-box">
                    {(genreMoodStats.topGenre?.name !== "없음" ||
                      genreMoodStats.topMood?.tag !== "없음") && (
                        <div>
                          <AppIcon name="bulb" size={15} />
                          <div>
                            주로
                            {genreMoodStats.topGenre?.name !== "없음" && (
                              <>
                                {" "}
                                <strong>
                                  {genreMoodStats.topGenre?.name}
                                </strong>{" "}
                                장르
                              </>
                            )}
                            {/* 두 데이터가 모두 유효할 때만 '와'를 삽입 */}
                            {genreMoodStats.topGenre?.name !== "없음" &&
                              genreMoodStats.topMood?.tag !== "없음" &&
                              "와 "}
                            {genreMoodStats.topMood?.tag !== "없음" && (
                              <>
                                {" "}
                                <strong>
                                  {genreMoodStats.topMood?.tag}
                                </strong>{" "}
                                분위기
                              </>
                            )}
                            의 컨텐츠에 깊은 몰입감을 느끼시는 편이네요!
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* 2단 섹션: 커뮤니티 활성화 상태일 때만 출력 */}
        {!hideCommunity && (
          <div className="two-col-section">
            <section className="section-block">
              <div className="section-h">
                <h2>팔로워 활동</h2>
                <span className="more">
                  <Link href="/alarm?tab=friend">더보기</Link>
                </span>
              </div>

              {filteredActivities.length > 0 ? (
                <div className="activity-list">
                  {filteredActivities.map((item, index) => (
                    <div key={item.id || index} className="activity-item">
                      <div className="friend-avatar">
                        <AppIcon name={iconMap[item.type]} size={15} />
                        {/* <img src={iconMap[item.type]} alt="아이콘" /> */}
                        {/* 친구 활동 알림인 경우 기본 프로필 이미지 등을 표시 */}
                        {/* <div className="avatar-placeholder" /> */}
                      </div>

                      <div className="activity-body">
                        <p>
                          {/* sampleNotifs 구조에 맞춰 필드 출력 */}
                          <strong>{item.title}</strong>
                        </p>
                        <p className="content-preview">{item.description}</p>
                        <span className="time">{item.time}</span>
                      </div>

                      <div className="activity-thumb">
                        {/* thumb가 있는 경우에만 이미지 표시 */}
                        {item.thumb && (
                          <img
                            src={`https://image.tmdb.org/t/p/w200${item.thumb}`}
                            alt="썸네일"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-block">최근 팔로워 활동이 없습니다.</div>
              )}
            </section>

            <section className="section-block">
              <div className="section-h">
                <h2>나의 최근 리뷰</h2>
                <span className="more">
                  <Link href="/mypage/community">더보기</Link>
                </span>
              </div>

              {reviews.length > 0 && enrichedReviews.length === 0 ? (
                <div className="review-list review-list-skeleton">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="review-item review-item-skeleton"
                    >
                      <div className="review-thumb review-skeleton__thumb" />
                      <div className="review-body">
                        <div className="review-head">
                          <div className="review-skeleton__line review-skeleton__line--title" />
                          <div className="review-skeleton__line review-skeleton__line--score" />
                        </div>
                        <div className="review-skeleton__line" />
                        <div className="review-skeleton__line review-skeleton__line--short" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : reviews.length > 0 ? (
                <div className="review-list">
                  {enrichedReviews.slice(0, 3).map((review) => {
                    const movie = review.mediaInfo;
                    return (
                      <div key={review.reviewId} className="review-item">
                        <div className="review-thumb">
                          <img
                            src={
                              movie
                                ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
                                : "https://image.tmdb.org/t/p/w200/evoEi8SBSvllEveM3V6nCJ6vKj8.jpg"
                            }
                            alt={movie?.title || movie?.name || "영화 포스터"}
                          />
                        </div>
                        <div className="review-body">
                          <div className="review-head">
                            <h3>
                              {movie?.title || movie?.name || "제목 없음"}
                            </h3>
                            <span className="stars">
                              <AppIcon name="like" size={14} />{" "}
                              {review.likesCount}
                            </span>
                          </div>
                          <p className="text">
                            {review.isSpoiler && (
                              <span className="spoiler-badge">[스포일러]</span>
                            )}
                            {review.content}
                          </p>
                          <div className="meta">
                            <span>
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                            {/* <span>신고 {review.reportsCount}회</span> */}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-block">작성하신 리뷰가 없습니다.</div>
              )}
            </section>
          </div>
        )}

        {/* 뱃지 */}
        <section className="section-block">
          <div className="section-h">
            <h2>획득한 뱃지</h2>
            <span className="more">
              <Link href="/goods">전체 {profileData.stats.badge}개 →</Link>
            </span>
          </div>

          <div className="badge-grid summary-mode">
            {displayBadgesSummary.length > 0 ? (
              displayBadgesSummary.map((b) => (
                <div
                  key={b.id}
                  className={`badge-card ${b.isEquipped ? "equipped-highlight" : ""}`}
                  title={b.title}
                >
                  <div className="badge-icon">
                    <img
                      src={b.imgUrl}
                      alt={b.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                    {b.isEquipped && (
                      <span className="equipped-badge-tag">장착됨</span>
                    )}
                  </div>
                  <h4>{b.name}</h4>
                  <p>{b.title}</p>
                </div>
              ))
            ) : (
              <div
                className="empty-badge-block"
                style={{
                  gridColumn: "1 / -1",
                  padding: "20px 0",
                  color: "#666",
                }}
              >
                아직 획득한 뱃지가 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* 로그아웃 */}
        {user && (
          <div className="logout-row">
            <button onClick={handleLogout}>로그아웃</button>
          </div>
        )}
      </div>
    </div>
  );
}