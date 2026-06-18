"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useMovieStore } from "@/store/useMovieStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { usePlayListStore } from "@/store/usePlayListStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  getWatchPartyActorId,
  isWatchPartyHost,
  useWatchPartyStore,
} from "@/store/useWatchPartyStore";
import { useCommunityEnabled } from "@/data/maturityFilter";
import { showToast } from "@/store/useToastStore";
import VideoPlayer, {
  type PlayerEpisode,
} from "@/components/common/VideoPlayer";
import RepBadge from "@/components/common/RepBadge";
import WatchPartyModal from "@/components/watch/WatchPartyModal";
import { useConfirmModal } from "../common/ConfirmModal";

const TMDB_IMG = "https://image.tmdb.org/t/p";
function imageUrl(path?: string | null, size = "w342") {
  return path ? `${TMDB_IMG}/${size}${path}` : "";
}
function getTitle(item?: any) {
  return item?.title || item?.name || "작품";
}

interface WatchClientProps {
  type: "movie" | "tv";
  mediaId: number;
}

interface PartySelectableMedia {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
}

const getToday = () => new Date().toISOString().slice(0, 10);

export default function WatchClient({ type, mediaId }: WatchClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partyIdParam = searchParams.get("party");
  const partyPasswordParam = searchParams.get("code");
  // 상세 페이지에서 특정 시즌/회차로 진입할 때 사용
  const seasonParam = Number(searchParams.get("season")) || 1;
  const epParam = searchParams.get("ep");
  const isTv = type === "tv";
  const itemKey = `${type}-${mediaId}`;

  const {
    mediaDetails,
    onFetchMediaDetail,
    popVideos,
    tvVideos,
    onFetchVideo,
    onFetchTvVideos,
    episodes,
    onFetchEpisodes,
    recommended,
    onFetchRecommended,
    certifications,
    onFetchCertification,
  } = useMovieStore();
  const { isWished, onAddWish, onRemoveWish, onLoadWishlist } =
    useWishlistStore();
  const { onAddPlayList, onUpdateProgress, onRemoveMyList, onAddMyList, onLoadMyList, myList } = usePlayListStore();
  const { user, currentProfile } = useAuthStore();
  const canUseConnect = useCommunityEnabled();
  const {
    party,
    messages,
    subscribe,
    join,
    sendMessage,
    updatePlayback,
    updatePlaybackNow,
    deleteParty,
    leave,
  } = useWatchPartyStore();

  const userId = user?.userId || (user as any)?.uid || "guest";
  const nickname = currentProfile?.nickname || "나";
  const myBadge = currentProfile?.badges?.equippedBadges || "";
  const profileId = currentProfile?.id;
  const actorId = getWatchPartyActorId(userId, profileId);

  const requestedEpisode = Number(epParam);
  const initialEpisodeIndex =
    Number.isFinite(requestedEpisode) && requestedEpisode > 0
      ? requestedEpisode - 1
      : 0;
  const [epIndex, setEpIndex] = useState(initialEpisodeIndex);
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isSendingChatRef = useRef(false);
  const lastProgressRef = useRef(-1);
  // 이 작품을 시청 기록에 1회만 추가하기 위한 가드
  const recordedRef = useRef(false);

  const [isChatOpen, setIsChatOpen] = useState(() => !!partyIdParam);
  const [isPlayerHovered, setIsPlayerHovered] = useState(false);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [selectedPartyMedia, setSelectedPartyMedia] =
    useState<PartySelectableMedia | null>(null);

  // 에피소드 팝업창 열림/닫힘 상태 관리
  const [isEpPopupOpen, setIsEpPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const episodeToggleRef = useRef<HTMLButtonElement>(null);

  const { confirm, modal: confirmModal } = useConfirmModal();

  useEffect(() => {
    onLoadMyList();
  }, [onLoadMyList]);

  // 외부 클릭 시 에피소드 팝업 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        !episodeToggleRef.current?.contains(event.target as Node)
      ) {
        setIsEpPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mediaId) return;
    // 작품이 바뀌면 기록/진행률 가드 초기화
    recordedRef.current = false;
    lastProgressRef.current = -1;
    onFetchMediaDetail(mediaId, type);
    onFetchCertification(mediaId, type);
    if (isTv) {
      onFetchTvVideos(mediaId);
      onFetchEpisodes(mediaId, seasonParam);
    } else {
      onFetchVideo(mediaId);
    }
  }, [
    mediaId,
    type,
    isTv,
    seasonParam,
    onFetchMediaDetail,
    onFetchTvVideos,
    onFetchVideo,
    onFetchEpisodes,
    onFetchCertification
  ]);

  // 반응형: 뷰포트 폭에 따라 인라인 레이아웃 분기
  const [vw, setVw] = useState(1920);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = vw <= 600;

  // 상세에서 ?ep= 로 진입하면 해당 회차를 선택
  useEffect(() => {
    if (recommended.length === 0) onFetchRecommended();
  }, [recommended.length, onFetchRecommended]);

  useEffect(() => {
    if (!partyIdParam) return;
    subscribe(partyIdParam);
    return () => leave();
  }, [partyIdParam, subscribe, leave]);

  const mediaItem: any = mediaDetails[itemKey];
  const title = getTitle(mediaItem);
  const genreName = mediaItem?.genres?.[0]?.name ?? "";
  const year = (
    isTv ? mediaItem?.first_air_date : mediaItem?.release_date
  )?.split?.("-")?.[0];

  const videos: any[] | undefined = isTv
    ? mediaItem
      ? tvVideos[mediaItem.id]
      : undefined
    : mediaItem
      ? popVideos[mediaItem.id]
      : undefined;
  const trailer =
    videos?.find((v) => v.type === "Trailer" || v.type === "Teaser") ??
    videos?.[0];
  const trailerKey: string | null = trailer?.key ?? null;

  const epList: any[] = isTv ? episodes : [];
  const currentEp = epList[epIndex] ?? epList[0] ?? null;
  const playerEpisodes: PlayerEpisode[] = epList.map((ep, i) => ({
    id: ep.id,
    number: ep.episode_number ?? i + 1,
    name: ep.name,
    stillUrl: imageUrl(ep.still_path, "w300"),
    runtime: ep.runtime ?? null,
    progress: 0,
  }));

  const related = (recommended as any[])
    .filter((r) => r.id !== mediaId)
    .slice(0, 6);
  const wished = myList.includes(String(itemKey));;

  const isPartyMode = !!partyIdParam;
  const canStartSelectedParty =
    !isPartyMode && canUseConnect && selectedPartyMedia !== null;
  const isHost =
    !!party && isWatchPartyHost(party, userId, profileId);

  const [showAdultModal, setShowAdultModal] = useState(false);
  const rawCert = certifications[itemKey] ?? "";
  const ageBadge = ((): "ALL" | "12+" | "15+" | "19+" => {
    if (rawCert === "12") return "12+";
    if (rawCert === "15") return "15+";
    if (rawCert === "19" || rawCert === "Restricted Screening") return "19+";
    return "ALL";
  })();
  const isAdultContent = ageBadge === "19+" || mediaItem?.adult === true;
  const canAccessAdultContent =
    currentProfile?.settings?.maturityRating === "19+" &&
    currentProfile?.settings?.verifiedAdult === true;
  const isAdultBlocked = isAdultContent && !canAccessAdultContent;

  useEffect(() => {
    if (!isAdultBlocked) {
      setShowAdultModal(false);
      return;
    }
    setShowAdultModal(true);
  }, [isAdultBlocked]);

  useEffect(() => {
    if (partyIdParam && party && !isHost) {
      void join(
        partyIdParam,
        {
          userId,
          profileId,
          nickname,
          badge: myBadge,
        },
        partyPasswordParam,
      ).then(
        (canEnter) => {
          if (!canEnter) {
            showToast("초대받은 사용자만 입장할 수 있는 파티예요.");
            router.replace(`/detail/${type}/${mediaId}`);
          }
        },
      );
    }
  }, [
    partyIdParam,
    partyPasswordParam,
    party,
    isHost,
    join,
    userId,
    profileId,
    nickname,
    myBadge,
    router,
    type,
    mediaId,
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const goDetail = () => router.push(`/detail/${type}/${mediaId}`);

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace(`/detail/${type}/${mediaId}`);
    }
  };

  const handleWish = async () => {
    if (!mediaItem) return;
    if (!user) {
      showToast("위시리스트는 로그인 후 이용할 수 있어요.");
      return;
    }
    if (!currentProfile) {
      showToast("프로필을 먼저 선택해 주세요.");
      return;
    }

    const wishlistItem = isTv
      ? { ...mediaItem, name: mediaItem.name || title }
      : { ...mediaItem, title: mediaItem.title || title };

    if (wished) {
      await onRemoveMyList(mediaId, type);
      showToast("위시리스트에서 삭제되었습니다.", {
        icon: "/images/header/menu/wishlist.svg",
      });
    } else {
      await onAddMyList(wishlistItem);
      showToast("위시리스트에 추가되었습니다.", {
        icon: "/images/header/menu/wishlist.svg",
      });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/detail/${type}/${mediaId}`,
      );
      showToast("링크가 복사되었어요");
    } catch {
      showToast("링크 복사에 실패했어요");
    }
  };

  const handleLeaveParty = () => {
    leave();
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace(`/detail/${type}/${mediaId}`);
    }
  };

  const handleDeleteParty = async () => {
    if (!partyIdParam || !currentProfile) return;

    const confirmed = await confirm({
      title: "파티 종료",
      message: "파티를 종료하면 커넥트에서 바로 사라지고 다시 입장할 수 없습니다. 종료할까요?",
      confirmLabel: "종료",
    });
    // if (!confirmed) return;
    // const confirmed = window.confirm(
    //   "파티를 종료하면 커넥트에서 바로 사라지고 다시 입장할 수 없습니다. 종료할까요?",
    // );
    if (!confirmed) return;

    const deleted = await deleteParty(partyIdParam, {
      userId,
      profileId,
      nickname,
      badge: myBadge,
    });
    if (!deleted) {
      showToast("파티를 종료하지 못했습니다.");
      return;
    }

    showToast("파티가 종료되었습니다.");
    router.replace("/connect");
  };

  const handleSendChat = async () => {
    const text = chatText.trim();
    if (!text || isSendingChatRef.current) return;

    isSendingChatRef.current = true;
    setChatText("");
    try {
      await sendMessage(text, {
        userId,
        profileId,
        nickname,
        badge: myBadge,
      });
    } finally {
      isSendingChatRef.current = false;
    }
  };

  const handleTimeUpdate = (ct: number, dur: number) => {
    if (dur <= 0) return;
    const progress = Math.round((ct / dur) * 100);
    if (progress > 0 && progress !== lastProgressRef.current) {
      lastProgressRef.current = progress;
      const epNum = type === "tv" ? (currentEp?.episode_number ?? undefined) : undefined;
      // 최초 재생 시 1회: 시청 기록(watchingVideos + histMovies + 장르·국가 통계 + 뱃지)에 추가
      if (!recordedRef.current && mediaItem && user && currentProfile) {
        recordedRef.current = true;
        (async () => {
          await onAddPlayList(mediaItem);
          await onUpdateProgress(mediaId, type, progress, epNum);
        })();
      } else {
        onUpdateProgress(mediaId, type, progress, epNum);
      }
    }
    if (isPartyMode) {
      updatePlayback({ positionPct: progress, isPlaying: true, userId });
    }
  };

  const startPct =
    isPartyMode && party && !isHost ? party.positionPct : undefined;

  const epLabel = currentEp
    ? `${currentEp.episode_number ?? epIndex + 1}화${currentEp.name ? ` 「${currentEp.name}」` : ""}`
    : "";

  const btn = (extra?: any) => ({
    background: "transparent",
    border: "1px solid #333",
    color: "#eee",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
    // --- 내부 아이콘 정중앙 정렬 ---
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...extra,
  });

  return (
    <>
    {confirmModal}
    <div
      className="watch-client"
      style={{
        height: "100dvh",
        maxHeight: "100dvh",
        background: "#0a0a0a",
        color: "#fff",
        padding:
          "max(18px, env(safe-area-inset-top)) clamp(10px, 2vw, 28px) max(10px, env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // 화면 전체 스크롤바 생성 절대 방지
        boxSizing: "border-box",
      }}
    >
      {isPartyModalOpen && (
        <WatchPartyModal
          mode={isPartyMode ? "invite" : "create"}
          media={{
            type: selectedPartyMedia?.media_type ?? type,
            mediaId: selectedPartyMedia?.id ?? mediaId,
            title:
              selectedPartyMedia?.title ||
              selectedPartyMedia?.name ||
              title,
            posterPath:
              selectedPartyMedia?.poster_path ?? mediaItem?.poster_path,
            backdropPath:
              selectedPartyMedia?.backdrop_path ?? mediaItem?.backdrop_path,
          }}
          party={party}
          onClose={() => setIsPartyModalOpen(false)}
        />
      )}
      {/* 상단 바 */}
      <div
        className="watch-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        {isPartyMode ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isHost && (
              <button
                type="button"
                onClick={handleLeaveParty}
                style={btn({ background: "rgba(255,255,255,0.06)" })}
              >
                ← 파티 나가기
              </button>
            )}
            <button
              type="button"
              onClick={isHost ? handleDeleteParty : handleLeaveParty}
              style={btn({
                background: isHost
                  ? "rgba(229,9,20,0.12)"
                  : "rgba(255,255,255,0.06)",
                border: isHost
                  ? "1px solid rgba(229,9,20,0.42)"
                  : "1px solid #333",
                color: isHost ? "#ff7c83" : "#eee",
              })}
            >
              {isHost ? "파티 종료하기" : "← 파티 나가기"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            style={btn({ background: "rgba(255,255,255,0.06)" })}
          >
            ← 뒤로
          </button>
        )}

        <span
          className="watch-topbar__title"
          style={{ color: "#888", fontSize: 13, textAlign: "center" }}
        >
          {party?.partyName || title}
          {isTv && currentEp
            ? ` · ${currentEp.episode_number ?? epIndex + 1}화`
            : ""}
          {isPartyMode && party
            ? ` · 👥 ${party.participants?.length ?? 1}명 참여 중`
            : ""}
        </span>

        {isPartyMode ? (
          <span style={{ width: 120 }} aria-hidden="true" />
        ) : canUseConnect ? (
          <button
            type="button"
            disabled={!canStartSelectedParty}
            onClick={() => setIsPartyModalOpen(true)}
            style={btn({
              background: canStartSelectedParty
                ? "rgba(229,9,20,0.14)"
                : "rgba(255,255,255,0.04)",
              border: canStartSelectedParty
                ? "1px solid rgba(229,9,20,0.5)"
                : "1px solid rgba(255,255,255,0.1)",
              color: canStartSelectedParty ? "#ff6b73" : "#666",
              fontWeight: 600,
              cursor: canStartSelectedParty ? "pointer" : "not-allowed",
            })}
            title={
              canStartSelectedParty
                ? `${selectedPartyMedia.title || selectedPartyMedia.name} 같이보기 만들기`
                : "오른쪽 추천 작품에서 같이 볼 콘텐츠를 선택해 주세요."
            }
          >
            같이 보기 시작
          </button>
        ) : (
          <span style={{ width: 120 }} />
        )}
      </div>

      {/* 본문 레이아웃 */}
      <div
        className="watch-body"
        style={{
          display: "flex",
          gap: 0,
          alignItems: "stretch",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* 플레이어 + 하단 정보 영역 */}
        <div
          className="watch-player-column"
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
          onMouseEnter={() => setIsPlayerHovered(true)}
          onMouseLeave={() => setIsPlayerHovered(false)}
        >
          {/* 플레이어 외부 감싸는 컨테이너 */}
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              background: "#000",
              borderRadius: 8,
              overflow: "visible", // 에피소드 팝업이 노출될 수 있도록 visible 유지
              border: "1px solid #1c1c1c",
              flex: 1, // 남은 상하 공간을 유연하게 채우도록 설정 (고정 크기 오버플로우 방지)
              minHeight: 0, // 유연한 축소를 위해 minHeight 초기화
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {trailerKey ? (
                <VideoPlayer
                  embedded
                  key={`${trailerKey}-${currentEp?.id ?? "0"}`}
                  videoKey={trailerKey}
                  title={title}
                  onClose={goDetail}
                  onTimeUpdate={handleTimeUpdate}
                  episodes={isTv ? playerEpisodes : undefined}
                  activeEpisodeId={currentEp?.id ?? null}
                  onSelectEpisode={(id) => {
                    const idx = epList.findIndex((e) => e.id === id);
                    if (idx >= 0) setEpIndex(idx);
                  }}
                  startPct={startPct}
                  onLocalControl={
                    isPartyMode
                      ? (state) => updatePlaybackNow({ ...state, userId })
                      : undefined
                  }
                  remoteControl={
                    isPartyMode &&
                    party &&
                    party.playbackUpdatedBy !== userId
                      ? {
                          positionPct: party.positionPct,
                          isPlaying: party.isPlaying,
                          ts: party.updatedAt,
                        }
                      : null
                  }
                  isMute={isAdultBlocked}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    color: "#888",
                  }}
                >
                  <span style={{ fontSize: 14 }}>
                    {mediaItem ? "재생할 영상이 없어요." : "불러오는 중…"}
                  </span>
                  {mediaItem && (
                    <button
                      type="button"
                      onClick={goDetail}
                      style={btn({ background: "rgba(255,255,255,0.08)" })}
                    >
                      상세페이지로 가기
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 에피소드 리스트 팝업 레이어 (오른쪽 아래 정렬) */}
            {isTv && isEpPopupOpen && (
              <div
                id="watch-episode-list"
                ref={popupRef}
                style={{
                  position: "absolute",
                  right: 16,
                  bottom: 16,
                  width: 320,
                  maxHeight: 280,
                  background: "rgba(20, 20, 20, 0.95)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #2a2a2a",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#aaa",
                  }}
                >
                  에피소드 목록
                </div>
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {epList.map((ep, idx) => {
                    const isSelected = idx === epIndex;
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => {
                          setEpIndex(idx);
                          setIsEpPopupOpen(false);
                        }}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          padding: 6,
                          background: isSelected
                            ? "rgba(255,255,255,0.08)"
                            : "transparent",
                          border: isSelected
                            ? "1px solid rgba(255,255,255,0.15)"
                            : "1px solid transparent",
                          borderRadius: 6,
                          textAlign: "left",
                          cursor: "pointer",
                          color: isSelected ? "#fff" : "#ccc",
                          transition: "background 0.2s",
                        }}
                      >
                        <div
                          style={{
                            width: 60,
                            height: 34,
                            borderRadius: 4,
                            background: ep.still_path
                              ? `url(${imageUrl(ep.still_path, "w300")}) center/cover`
                              : "#222",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                          <div
                            style={{
                              fontWeight: isSelected ? 700 : 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ep.episode_number ?? idx + 1}화. {ep.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 제목 + 콘텐츠 세부 메타 정보 (하단 고정) */}
          <div
            className="watch-info-bar"
            style={{
              flexShrink: 0,
              minHeight: 58,
              marginTop: 8,
              padding: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <div
                className="watch-info-bar__thumbnail"
                aria-hidden="true"
                style={{
                  width: 76,
                  height: 43,
                  flexShrink: 0,
                  borderRadius: 4,
                  background: mediaItem?.backdrop_path
                    ? `#171717 url(${imageUrl(mediaItem.backdrop_path, "w300")}) center/cover`
                    : "#171717",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: 13, color: "#9a9a9a", marginTop: 4 }}>
                  {[genreName, year, isTv ? epLabel : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {isTv && epList.length > 0 && (
                <button
                  ref={episodeToggleRef}
                  type="button"
                  aria-expanded={isEpPopupOpen}
                  aria-controls="watch-episode-list"
                  onClick={() => setIsEpPopupOpen((isOpen) => !isOpen)}
                  style={btn({
                    background: isEpPopupOpen
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(255,255,255,0.06)",
                    borderColor: isEpPopupOpen ? "#777" : "#444",
                    color: "#fff",
                    fontWeight: 700,
                  })}
                >
                  에피소드 보기
                </button>
              )}
              {/* 위시리스트 버튼 */}
              <button
                type="button"
                onClick={handleWish}
                aria-label={
                  wished ? "위시리스트에서 삭제" : "위시리스트에 추가"
                }
                aria-pressed={wished}
                title={wished ? "위시리스트에서 삭제" : "위시리스트에 추가"}
                style={btn(
                  // 공통 크기 및 패딩 스타일
                  {
                    padding: 8,
                    width: 38,
                    height: 38,
                    boxSizing: "border-box", // 패딩이 크기에 영향을 주지 않도록 추가
                  },
                )}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 30 30"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ flexShrink: 0 }} // 아이콘 크기 고정
                >
                  <path
                    fill={wished ? "currentColor" : "none"}
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M5.60549 7.60371C6.63378 6.61891 8.02827 6.06567 9.48229 6.06567C10.9363 6.06567 12.3308 6.61891 13.3591 7.60371L14.9657 9.14157L16.5724 7.60371C17.0782 7.10199 17.6833 6.70179 18.3523 6.42648C19.0213 6.15117 19.7408 6.00625 20.4689 6.0002C21.197 5.99414 21.9191 6.12705 22.593 6.39117C23.2669 6.65531 23.8791 7.04537 24.3939 7.5386C24.9088 8.03183 25.316 8.61835 25.5917 9.26394C25.8674 9.90953 26.0062 10.6013 25.9998 11.2988C25.9935 11.9963 25.8423 12.6855 25.5548 13.3265C25.2674 13.9674 24.8497 14.547 24.326 15.0316L14.9657 24L5.60549 15.0316C4.5775 14.0465 4 12.7106 4 11.3177C4 9.92473 4.5775 8.58882 5.60549 7.60371Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* 공유 버튼 */}
              <button
                type="button"
                onClick={handleShare}
                title="공유하기"
                aria-label="공유하기"
                style={btn({
                  // --- 공유 버튼에도 동일한 크기 및 패딩 적용 ---
                  padding: 8,
                  width: 38,
                  height: 38,
                  boxSizing: "border-box", // 패딩이 크기에 영향을 주지 않도록 추가
                  // ------------------------------------------
                })}
              >
                <Image
                  src={"/images/header/menu/share.svg"}
                  alt=""
                  width={20}
                  height={20}
                  unoptimized
                  style={{
                    width: 20,
                    height: 20,
                    // borderRadius, objectFit은 아이콘 자체 스타일이므로 유지
                    borderRadius: 8,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              </button>
            </div>
          </div>
        </div>

        <button
          className="watch-chat-toggle"
          data-panel-open={isChatOpen}
          data-panel-kind={isPartyMode ? "chat" : "recommendations"}
          type="button"
          aria-label={
            isPartyMode
              ? isChatOpen
                ? "채팅창 닫기"
                : "채팅창 열기"
              : isChatOpen
                ? "추천 작품 닫기"
                : "추천 작품 열기"
          }
          onClick={() => setIsChatOpen((isOpen) => !isOpen)}
          style={{
            alignSelf: "center",
            flexShrink: 0,
            background: "rgba(12,12,12,0.92)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRight: "none",
            color: "#fff",
            borderRadius: "8px 0px 0px 8px",
            width: 36,
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 300,
            cursor: "pointer",
            zIndex: 50,
            opacity: isPlayerHovered || !isChatOpen ? 1 : 0.55,
            boxShadow: "-8px 0 22px rgba(0,0,0,0.4)",
            transition:
              "opacity 0.2s ease, background 0.2s, border-color 0.2s",
          }}
        >
          {isChatOpen ? "›" : "‹"}
        </button>

        {/* 우측 패널 (채팅창 너비를 320px -> 380px로 변경) */}
        <aside
          className="watch-chat-panel"
          data-open={isChatOpen}
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {isPartyMode ? (
            <div
              style={{
                border: "1px solid #1f1f1f",
                borderRadius: 10,
                background: "rgba(255,255,255,0.015)",
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <div
                style={{
                  padding: "12px 14px 14px",
                  borderBottom: "1px solid #1f1f1f",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "block",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span>실시간 채팅</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#888" }}>
                      {party?.participants?.length ?? 1}명 참여 중
                    </span>
                    {isHost && party?.accessMode === "invite" && (
                      <button
                        type="button"
                        onClick={() => setIsPartyModalOpen(true)}
                        style={btn({
                          padding: "5px 8px",
                          borderColor: "rgba(229,9,20,0.45)",
                          color: "#ff7c83",
                          fontSize: 11,
                        })}
                      >
                        초대하기
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className="watch-party-host"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 12,
                    padding: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    background:
                      "linear-gradient(135deg, rgba(229,9,20,0.12), rgba(255,255,255,0.035))",
                  }}
                >
                  <Image
                    src={
                      party?.hostImgUrl ||
                      "/images/profile/image/default_icons/17.png"
                    }
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        color: "#8f8f8f",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                      }}
                    >
                      PARTY HOST
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 13,
                        fontWeight: 800,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {party?.hostNickname || "파티 호스트"}
                    </div>
                  </div>
                  <RepBadge
                    badge={party?.hostBadge}
                    size="sm"
                  />
                </div>
              </div>

              {/* 스크롤 영역 */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  className="watch-party-started"
                  style={{
                    alignSelf: "stretch",
                    padding: "12px 14px",
                    border: "1px solid rgba(229,9,20,0.2)",
                    borderRadius: 10,
                    background:
                      "linear-gradient(135deg, rgba(229,9,20,0.13), rgba(255,255,255,0.025))",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      color: "#ff7c83",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    파티가 시작되었습니다
                  </div>
                  <div style={{ color: "#777", fontSize: 11, marginTop: 4 }}>
                    함께 재생하며 자유롭게 이야기를 나눠보세요.
                  </div>
                </div>
                {messages.map((m) => {
                  const mine =
                    (m.actorId ??
                      getWatchPartyActorId(m.userId, m.profileId)) === actorId;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: mine ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9a9a9a",
                          marginBottom: 3,
                          textAlign: mine ? "right" : "left",
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          justifyContent: mine ? "flex-end" : "flex-start",
                        }}
                      >
                        <span>{mine ? "나" : m.nickname}</span>
                        {m.badge ? (
                          <RepBadge badge={m.badge} size="sm" />
                        ) : null}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          padding: "7px 10px",
                          borderRadius: 10,
                          background: mine
                            ? "rgba(229,9,20,0.16)"
                            : "rgba(255,255,255,0.06)",
                          color: "#eee",
                          wordBreak: "break-word",
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* 하단 입력 폼 고정 */}
              <div
                style={{
                  padding: 10,
                  borderTop: "1px solid #1f1f1f",
                  display: "flex",
                  gap: 8,
                  flexShrink: 0,
                  pointerEvents: "auto",
                  userSelect: "text",
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (
                      e.key === "Enter" &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  onKeyUp={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="메시지 입력…"
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid #2a2a2a",
                    borderRadius: 8,
                    color: "#fff",
                    padding: "8px 10px",
                    fontSize: 13,
                    outline: "none",
                    pointerEvents: "auto",
                    userSelect: "text",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSendChat}
                  style={btn({
                    background: "rgba(229,9,20,0.16)",
                    border: "1px solid rgba(229,9,20,0.5)",
                    color: "#ff6b73",
                    fontWeight: 600,
                  })}
                >
                  전송
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #1f1f1f",
                borderRadius: 10,
                padding: 12,
                background: "rgba(255,255,255,0.015)",
                height: "100%",
                overflowY: "auto",
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>추천 작품</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {related.length === 0 && (
                  <div
                    style={{ color: "#777", fontSize: 13, padding: "8px 0" }}
                  >
                    추천 작품을 불러오는 중…
                  </div>
                )}
                {related.map((item) => (
                  <button
                    key={`${item.media_type}-${item.id}`}
                    type="button"
                    aria-pressed={
                      selectedPartyMedia?.id === item.id &&
                      selectedPartyMedia?.media_type === item.media_type
                    }
                    onClick={() => setSelectedPartyMedia(item)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      textAlign: "left",
                      background:
                        selectedPartyMedia?.id === item.id &&
                        selectedPartyMedia?.media_type === item.media_type
                          ? "rgba(229,9,20,0.1)"
                          : "transparent",
                      border:
                        selectedPartyMedia?.id === item.id &&
                        selectedPartyMedia?.media_type === item.media_type
                          ? "1px solid rgba(229,9,20,0.75)"
                          : "1px solid #222",
                      borderRadius: 10,
                      padding: 0,
                      cursor: "pointer",
                      color: "#eee",
                      overflow: "hidden",
                      boxShadow:
                        selectedPartyMedia?.id === item.id &&
                        selectedPartyMedia?.media_type === item.media_type
                          ? "0 0 0 1px rgba(229,9,20,0.18)"
                          : "none",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        position: "relative",
                        width: "100%",
                        aspectRatio: "16 / 9",
                        background: imageUrl(
                          item.backdrop_path || item.poster_path,
                        )
                          ? `#111 url(${imageUrl(item.backdrop_path || item.poster_path)}) center/cover`
                          : "#1a1a1a",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                        background: "rgba(0,0,0,0.65)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderRadius: 5,
                        padding: "3px 8px",
                        backdropFilter: "blur(4px)",
                      }}>
                        {item.media_type === "tv" ? "시리즈" : "영화"}
                      </span>
                    </span>
                    <span style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontSize: 17,
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                          >
                            {item.title || item.name}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#ccc",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.22)",
                            borderRadius: 3,
                            padding: "1px 5px",
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                          }}>
                            {item.adult ? "청불" : "15+"}
                          </span>
                        </span>
                        <span style={{ color: "#888", fontSize: 22, flexShrink: 0, lineHeight: 1 }}>
                          {selectedPartyMedia?.id === item.id &&
                          selectedPartyMedia?.media_type === item.media_type
                            ? "✓"
                            : "›"}
                        </span>
                      </span>
                      {selectedPartyMedia?.id === item.id &&
                        selectedPartyMedia?.media_type === item.media_type && (
                          <span
                            style={{
                              color: "#ff737b",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            같이보기 작품으로 선택됨
                          </span>
                        )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
      {showAdultModal && isAdultBlocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="adult-verification-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400000,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(100%, 420px)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 8,
              background: "#141414",
              padding: isMobile ? 22 : 28,
              color: "#fff",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
            }}
          >
            <h2
              id="adult-verification-title"
              style={{
                margin: "0 0 10px",
                fontSize: isMobile ? 22 : 26,
                lineHeight: 1.2,
              }}
            >
              성인 인증이 필요합니다
            </h2>
            <p
              style={{
                margin: "0 0 22px",
                color: "rgba(255,255,255,0.72)",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              이 콘텐츠는 만 19세 이상만 시청할 수 있습니다. 생년월일
              확인 후 현재 프로필에서 19세 콘텐츠를 볼 수 있습니다.
            </p>
            <label
              htmlFor="adult-birth-date"
              style={{
                display: "none",
                marginBottom: 8,
                color: "rgba(255,255,255,0.86)",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              생년월일
            </label>
            <input
              id="adult-birth-date"
              type="date"
              value=""
              max={getToday()}
              readOnly
              required
              style={{
                display: "none",
                width: "100%",
                height: 46,
                boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,0.28)",
                borderRadius: 4,
                background: "#0f0f0f",
                color: "#fff",
                padding: "0 12px",
                fontSize: 15,
                colorScheme: "dark",
              }}
            />
            {false && (
              <p
                role="alert"
                style={{
                  margin: "10px 0 0",
                  color: "#ff7b7b",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {""}
              </p>
            )}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 24,
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  router.push(
                    currentProfile
                      ? `/profiles/settings?profileId=${currentProfile.id}`
                      : "/profiles",
                  )
                }
                style={{
                  flex: 1,
                  height: 44,
                  border: "none",
                  borderRadius: 4,
                  background: "#e50914",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                인증하고 보기
              </button>
              <button
                type="button"
                onClick={() => router.replace("/")}
                style={{
                  flex: 1,
                  height: 44,
                  border: "1px solid rgba(255,255,255,0.28)",
                  borderRadius: 4,
                  background: "transparent",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
