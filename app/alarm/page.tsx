"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMovieStore } from "@/store/useMovieStore";
import "../scss/alarm.scss";
import BackButton from "@/components/common/BackButton";
import AppIcon from "@/components/common/AppIcon";
import { useAuthStore } from "@/store/useAuthStore";
import { useWatchPartyStore } from "@/store/useWatchPartyStore";

type NotifType = "episode" | "friend" | "upcoming" | "reaction" | "party";
type FilterType = "all" | NotifType;

interface Notif {
  id: number | string;
  type: NotifType;
  title: string;
  description: string;
  mediaId?: number;
  mediaType?: "movie" | "tv";
  partyId?: string;
  thumb?: string | null;
  time: string;
  unread: boolean;
  cta?: string;
}

function getRelativeTime(createdAt: number) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - createdAt) / 60000),
  );
  if (elapsedMinutes < 1) return "방금 전";
  if (elapsedMinutes < 60) return `${elapsedMinutes}분 전`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${elapsedHours}시간 전`;
}

// 🌟 URL 파라미터를 읽고 제어하는 핵심 알림 컴포넌트
function AlarmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, currentProfile } = useAuthStore();
  const {
    upcomings,
    popMovies,
    tvs,
    onFetchUpcoming,
    onFetchPopular,
    onFetchTvs,
  } = useMovieStore();
  const { invitedParties, subscribeInvitedParties, unsubscribeInvitedParties } =
    useWatchPartyStore();

  // 기본 필터 State
  const [filter, setFilter] = useState<FilterType>("all");
  const [excludedGenres, setExcludedGenres] = useState<string[]>([
    "공포",
    "좀비",
    "고어",
  ]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [readPartyIds, setReadPartyIds] = useState<string[]>([]);

  // 🌟 [추가] URL Param (?tab=...) 변화 감지 및 탭 동기화
  useEffect(() => {
    const tabParam = searchParams.get("tab") as FilterType;
    const validTabs: FilterType[] = [
      "all",
      "episode",
      "friend",
      "upcoming",
      "reaction",
      "party",
    ];

    if (tabParam && validTabs.includes(tabParam)) {
      setFilter(tabParam);
    } else {
      setFilter("all");
    }
  }, [searchParams]);

  // 🌟 [추가] 탭 클릭 시 URL의 Query String도 매끄럽게 교체해주는 핸들러
  const handleTabChange = (targetTab: FilterType) => {
    if (targetTab === "all") {
      router.replace("/alarm"); // 탭 전환은 뒤로가기 히스토리에 쌓지 않음
    } else {
      router.replace(`/alarm?tab=${targetTab}`);
    }
  };

  useEffect(() => {
    if (upcomings.length === 0) onFetchUpcoming();
    if (popMovies.length === 0) onFetchPopular();
    if (tvs.length === 0) onFetchTvs();
  }, []);

  useEffect(() => {
    const userId = user?.userId;
    const profileId = currentProfile?.id ?? user?.profile?.[0]?.id;
    if (!userId || profileId == null) {
      unsubscribeInvitedParties();
      return;
    }

    subscribeInvitedParties(userId, profileId);
    return () => unsubscribeInvitedParties();
  }, [
    currentProfile?.id,
    subscribeInvitedParties,
    unsubscribeInvitedParties,
    user,
  ]);

  useEffect(() => {
    if (upcomings.length === 0 || popMovies.length === 0 || tvs.length === 0)
      return;

    const sampleNotifs: Notif[] = [
      {
        id: 1,
        type: "episode",
        title: `${tvs[0]?.name || "시리즈"} 신규 에피소드`,
        description: `찜한 작품의 새로운 에피소드가 공개되었어요`,
        mediaId: tvs[0]?.id,
        mediaType: "tv",
        thumb: tvs[0]?.poster_path,
        time: "10분 전",
        unread: true,
        cta: "바로 보기",
      },
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
        title: "친구의 새 활동",
        description: `친구가 ${popMovies[1]?.title}에 ★★★★★ 평가를 남겼어요`,
        mediaId: popMovies[1]?.id,
        mediaType: "movie",
        thumb: popMovies[1]?.poster_path,
        time: "2시간 전",
        unread: true,
      },
      {
        id: 4,
        type: "upcoming",
        title: "기대작 공개 예정",
        description: `${upcomings[0]?.title} D-3, ${upcomings[0]?.release_date} 공개`,
        mediaId: upcomings[0]?.id,
        mediaType: "movie",
        thumb: upcomings[0]?.poster_path,
        time: "5시간 전",
        unread: false,
        cta: "알림 설정",
      },
      {
        id: 5,
        type: "episode",
        title: `${tvs[1]?.name} 새 회차`,
        description: "찜한 작품의 신규 회차가 공개되었어요",
        mediaId: tvs[1]?.id,
        mediaType: "tv",
        thumb: tvs[1]?.poster_path,
        time: "어제",
        unread: false,
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
    setNotifs(sampleNotifs);
  }, [upcomings, popMovies, tvs]);

  const handleRemoveGenre = (g: string) => {
    setExcludedGenres(excludedGenres.filter((x) => x !== g));
  };

  const partyNotifs: Notif[] = invitedParties.map((party) => ({
    id: `party-${party.partyId}`,
    type: "party",
    title: `${party.hostNickname}님이 같이보기에 초대했어요`,
    description: `${party.partyName || party.title} · ${party.title}`,
    mediaId: party.mediaId,
    mediaType: party.type,
    partyId: party.partyId,
    thumb: party.backdropPath || party.posterPath,
    time: getRelativeTime(party.createdAt),
    unread: !readPartyIds.includes(party.partyId),
    cta: "참여하기",
  }));
  const allNotifs = [...partyNotifs, ...notifs];

  const handleReadAll = () => {
    setNotifs(notifs.map((n) => ({ ...n, unread: false })));
    setReadPartyIds(invitedParties.map((party) => party.partyId));
  };

  const filtered =
    filter === "all" ? allNotifs : allNotifs.filter((n) => n.type === filter);
  const unreadCount = allNotifs.filter((n) => n.unread).length;

  const counts = {
    episode: allNotifs.filter((n) => n.type === "episode").length,
    friend: allNotifs.filter((n) => n.type === "friend").length,
    upcoming: allNotifs.filter((n) => n.type === "upcoming").length,
    reaction: allNotifs.filter((n) => n.type === "reaction").length,
    party: partyNotifs.length,
  };

  const todayNotifs = filtered.slice(0, 4);
  const earlierNotifs = filtered.slice(4);

  return (
    <div className="alarm-page">
      <div className="inner">
        <BackButton fallback="/mypage" />
        <div className="page-head">
          <h1>알림</h1>
          <p>새로운 활동과 업데이트를 확인하세요</p>
        </div>

        {/* 탭 메뉴 - 클릭 시 handleTabChange 구동 */}
        <div className="notif-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => handleTabChange("all")}
          >
            전체{" "}
            {allNotifs.length > 0 && (
              <span className="badge">{allNotifs.length}</span>
            )}
          </button>
          <button
            className={filter === "party" ? "active" : ""}
            onClick={() => handleTabChange("party")}
          >
            초대받은 같이보기{" "}
            {counts.party > 0 && <span className="badge">{counts.party}</span>}
          </button>
          <button
            className={filter === "episode" ? "active" : ""}
            onClick={() => handleTabChange("episode")}
          >
            새 에피소드{" "}
            {counts.episode > 0 && (
              <span className="badge">{counts.episode}</span>
            )}
          </button>
          <button
            className={filter === "friend" ? "active" : ""}
            onClick={() => handleTabChange("friend")}
          >
            팔로워 활동{" "}
            {counts.friend > 0 && (
              <span className="badge">{counts.friend}</span>
            )}
          </button>
          <button
            className={filter === "upcoming" ? "active" : ""}
            onClick={() => handleTabChange("upcoming")}
          >
            공개 예정{" "}
            {counts.upcoming > 0 && (
              <span className="badge">{counts.upcoming}</span>
            )}
          </button>
          <button
            className={filter === "reaction" ? "active" : ""}
            onClick={() => handleTabChange("reaction")}
          >
            리뷰 반응{" "}
            {counts.reaction > 0 && (
              <span className="badge">{counts.reaction}</span>
            )}
          </button>
        </div>

        {/* 알림 받지 않을 장르 */}
        {/* <div className="excluded-section">
          <div className="ex-head">
            <h3>알림 받지 않을 장르</h3>
            <Link href="/mypage/genre" className="ex-link">＋ 추가</Link>
          </div>
          <p className="ex-desc">선택한 장르의 새 에피소드·공개 예정 알림이 표시되지 않습니다</p>
          <div className="ex-chips">
            {excludedGenres.map((g) => (
              <span key={g} className="ex-chip">
                <span>{g}</span>
                <button onClick={() => handleRemoveGenre(g)}>제거</button>
              </span>
            ))}
          </div>
        </div> */}

        {/* 액션 바 */}
        <div className="action-row">
          <span>읽지 않은 알림 {unreadCount}개</span>
          <button onClick={handleReadAll}>모두 읽음 처리</button>
        </div>

        {/* 오늘 */}
        {todayNotifs.length > 0 && (
          <>
            <div className="date-divider">오늘</div>
            <ul className="notif-list">
              {todayNotifs.map((n) => (
                <NotifItem key={n.id} notif={n} />
              ))}
            </ul>
          </>
        )}

        {/* 지난 7일 */}
        {earlierNotifs.length > 0 && (
          <>
            <div className="date-divider">지난 7일</div>
            <ul className="notif-list">
              {earlierNotifs.map((n) => (
                <NotifItem key={n.id} notif={n} />
              ))}
            </ul>
          </>
        )}

        {filtered.length === 0 && <div className="empty">알림이 없습니다</div>}
      </div>
    </div>
  );
}

function NotifItem({ notif }: { notif: Notif }) {
  const iconMap: any = {
    episode: "episode",
    friend: "friend",
    upcoming: "upcoming",
    reaction: "reaction",
    party: "popcorn",
  };

  const content = (
    <>
      <div className={`notif-icon ${notif.type}`}>
        <AppIcon name={iconMap[notif.type]} size={15} />
      </div>
      {notif.thumb && (
        <div className="notif-thumb">
          <img src={`https://image.tmdb.org/t/p/w200${notif.thumb}`} alt="" />
        </div>
      )}
      <div className="notif-body">
        <div className="text">
          <strong>{notif.title}</strong>
          <br />
          <span>{notif.description}</span>
        </div>
        <span className="time">{notif.time}</span>
      </div>
      {notif.cta && <button className="notif-cta">{notif.cta}</button>}
    </>
  );

  if (notif.partyId && notif.mediaId && notif.mediaType) {
    return (
      <li className={`notif-item ${notif.unread ? "unread" : ""}`}>
        <Link
          href={`/watch/${notif.mediaType}/${notif.mediaId}?party=${notif.partyId}`}
          className="notif-link"
        >
          {content}
        </Link>
      </li>
    );
  }

  if (notif.mediaId && notif.mediaType) {
    return (
      <li className={`notif-item ${notif.unread ? "unread" : ""}`}>
        <Link
          href={`/detail/${notif.mediaType}/${notif.mediaId}`}
          className="notif-link"
        >
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className={`notif-item ${notif.unread ? "unread" : ""}`}>{content}</li>
  );
}

// 🌟 [Next.js 필수 규격] 클라이언트 사이드 서치파람 추적을 위한 Suspense 래핑 내보내기
export default function AlarmPage() {
  return (
    <Suspense fallback={<div className="empty">알림 로딩 중...</div>}>
      <AlarmContent />
    </Suspense>
  );
}
