"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import {
  canProfileAccessWatchParty,
  type PartyDoc,
  useWatchPartyStore,
} from "@/store/useWatchPartyStore";
import SectionTitle from "@/components/common/SectionTitle";
import RepBadge from "@/components/common/RepBadge";
import WatchPartyModal from "@/components/watch/WatchPartyModal";
import { useAuthStore } from "@/store/useAuthStore";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";
import "swiper/css";
import "swiper/css/navigation";
import "./scss/connectWatchParties.scss";

const TMDB_IMG = "https://image.tmdb.org/t/p";
const DEFAULT_PROFILE_IMAGE = "/images/profile/image/default_icons/17.png";
const CARD_GAP = 18;

export default function ConnectWatchParties() {
  const router = useRouter();
  const { user, currentProfile } = useAuthStore();
  const swiperShellRef = useRef<HTMLDivElement>(null);
  const swiperRef = useRef<SwiperType | null>(null);
  const [lockedParty, setLockedParty] = useState<PartyDoc | null>(null);
  const [canSlide, setCanSlide] = useState(false);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const { openParties, subscribeOpenParties, unsubscribeOpenParties } =
    useWatchPartyStore();
  const openSubscribeModal = useSubscribeModalStore(
    (state) => state.openModal,
  );

  useEffect(() => {
    subscribeOpenParties();
    return () => unsubscribeOpenParties();
  }, [subscribeOpenParties, unsubscribeOpenParties]);

  const updateNavigation = useCallback((swiper: SwiperType) => {
    // 1. swiper 객체와 slides 존재 여부 먼저 확인
    if (!swiper || !swiper.slides) return;

    // 2. slides가 undefined일 경우를 대비해 빈 배열로 fallback 처리
    const slides = Array.from(swiper.slides ?? []);

    const slidesWidth = slides.reduce(
      (total, slide, index) =>
        total + slide.getBoundingClientRect().width + (index > 0 ? CARD_GAP : 0),
      0,
    );

    const viewportWidth = swiper.el?.getBoundingClientRect().width ?? 0;
    const hasOverflow = slidesWidth > viewportWidth + 1;

    setCanSlide(hasOverflow);
    setIsBeginning(swiper.isBeginning);
    setIsEnd(!hasOverflow || swiper.isEnd);
  }, []);

  useEffect(() => {
    const shell = swiperShellRef.current;
    if (!shell) return;

    const observer = new ResizeObserver(() => {
      const swiper = swiperRef.current;
      if (!swiper) return;

      swiper.update();
      updateNavigation(swiper);
    });

    observer.observe(shell);
    return () => observer.disconnect();
  }, [openParties.length, updateNavigation]);

  if (openParties.length === 0) return null;

  const enterParty = (
    type: "movie" | "tv",
    mediaId: number,
    partyId: string,
  ) => {
    router.push(`/watch/${type}/${mediaId}?party=${partyId}`);
  };

  const handlePartyEntry = (party: (typeof openParties)[number]) => {
    if (!user) {
      openSubscribeModal();
      return;
    }

    const userId = user?.userId ?? "";
    const canEnter = canProfileAccessWatchParty(
      party,
      userId,
      currentProfile?.id,
    );
    if (!canEnter) {
      setLockedParty(party);
      return;
    }
    enterParty(party.type, party.mediaId, party.partyId);
  };

  return (
    <>
      <section
        className="connect-section connect-watch-parties"
        aria-label="지금 열린 같이보기 파티"
      >
        <div className="connect-section__inner connect-watch-parties__inner">
          <SectionTitle title="지금 열린 같이보기 파티" showMore={false} />

          <div className="cwp-swiper-shell" ref={swiperShellRef}>
            <Swiper
              className="cwp-list"
              watchOverflow
              observer
              observeParents
              allowTouchMove
              simulateTouch
              grabCursor={canSlide}
              touchStartPreventDefault={false}
              slidesPerView={"auto"}
              slidesPerGroup={1}
              spaceBetween={CARD_GAP}
              onSwiper={(swiper) => {
                swiperRef.current = swiper;
                requestAnimationFrame(() => updateNavigation(swiper));
              }}
              onSlideChange={updateNavigation}
              onActiveIndexChange={updateNavigation}
              onTransitionEnd={updateNavigation}
              onTouchEnd={updateNavigation}
              onResize={updateNavigation}
              onSlidesUpdated={updateNavigation}
            >
              {openParties.map((party) => {
                const thumbnail = party.backdropPath
                  ? `${TMDB_IMG}/w780${party.backdropPath}`
                  : party.posterPath
                    ? `${TMDB_IMG}/w500${party.posterPath}`
                    : "";
                const participantCount = party.participants?.length ?? 1;

                return (
                  <SwiperSlide className="cwp-slide" key={party.partyId}>
                    <article
                      className="cwp-card"
                      role="button"
                      tabIndex={0}
                      aria-label={`${party.title}, ${party.hostNickname}님의 같이보기 파티 입장`}
                      onClick={() => handlePartyEntry(party)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handlePartyEntry(party);
                        }
                      }}
                    >
                      <div
                        className="cwp-thumb"
                        style={
                          thumbnail
                            ? { backgroundImage: `url(${thumbnail})` }
                            : undefined
                        }
                      >
                        <div className="cwp-thumb__shade" />
                        <span className="cwp-status">
                          <span className="cwp-status__dot" />
                          같이 보는 중
                        </span>
                        {party.accessMode === "invite" && (
                          <span
                            className="cwp-lock"
                            aria-label="초대 전용 파티"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <rect
                                x="5"
                                y="10"
                                width="14"
                                height="10"
                                rx="2"
                              />
                              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                            </svg>
                            초대 전용
                          </span>
                        )}
                        <span className="cwp-enter" aria-hidden="true">
                          입장하기 <span>→</span>
                        </span>
                      </div>

                      <div className="cwp-body">
                        <span className="cwp-kicker">
                          {party.type === "tv"
                            ? "SERIES WATCH PARTY"
                            : "MOVIE WATCH PARTY"}
                        </span>
                        <h3 className="cwp-title">
                          {party.partyName || party.title}
                        </h3>
                        <p
                          className="cwp-media-title"
                          aria-hidden={
                            !party.partyName ||
                            party.partyName === party.title
                          }
                        >
                          {party.partyName &&
                          party.partyName !== party.title
                            ? party.title
                            : "\u00A0"}
                        </p>

                        <div className="cwp-meta">
                          <div className="cwp-host-block">
                            <span className="cwp-host__label">HOST</span>
                            <div className="cwp-host">
                              <Image
                                className="cwp-host__avatar"
                                src={party.hostImgUrl || DEFAULT_PROFILE_IMAGE}
                                alt=""
                                width={34}
                                height={34}
                                unoptimized
                              />
                              <strong>{party.hostNickname}</strong>
                              <RepBadge badge={party.hostBadge} size="sm" />
                            </div>
                          </div>

                          <div className="cwp-participants">
                            <span
                              className="cwp-participants__avatars"
                              aria-hidden="true"
                            >
                              <i />
                              <i />
                              <i />
                            </span>
                            <span>
                              <strong>{participantCount}</strong>명 참여 중
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </div>
        </div>
        {canSlide && (
          <>
            <button
              type="button"
              className="swiper-button-prev cwp-edge-nav cwp-edge-nav--prev"
              onClick={() => swiperRef.current?.slidePrev()}
              disabled={isBeginning}
              aria-label="이전 파티 보기"
            >
              <svg
                className="swiper-navigation-icon"
                width="11"
                height="20"
                viewBox="0 0 11 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.38296 20.0762C0.111788 19.805 0.111788 19.3654 0.38296 19.0942L9.19758 10.2796L0.38296 1.46497C0.111788 1.19379 0.111788 0.754138 0.38296 0.482966C0.654131 0.211794 1.09379 0.211794 1.36496 0.482966L10.4341 9.55214C10.8359 9.9539 10.8359 10.6053 10.4341 11.007L1.36496 20.0762C1.09379 20.3474 0.654131 20.3474 0.38296 20.0762Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button
              type="button"
              className="swiper-button-next cwp-edge-nav cwp-edge-nav--next"
              onClick={() => swiperRef.current?.slideNext()}
              disabled={isEnd}
              aria-label="다음 파티 보기"
            >
              <svg
                className="swiper-navigation-icon"
                width="11"
                height="20"
                viewBox="0 0 11 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.38296 20.0762C0.111788 19.805 0.111788 19.3654 0.38296 19.0942L9.19758 10.2796L0.38296 1.46497C0.111788 1.19379 0.111788 0.754138 0.38296 0.482966C0.654131 0.211794 1.09379 0.211794 1.36496 0.482966L10.4341 9.55214C10.8359 9.9539 10.8359 10.6053 10.4341 11.007L1.36496 20.0762C1.09379 20.3474 0.654131 20.3474 0.38296 20.0762Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </>
        )}
      </section>
      {lockedParty && (
        <WatchPartyModal
          mode="join"
          initialParty={lockedParty}
          onClose={() => setLockedParty(null)}
        />
      )}
    </>
  );
}
