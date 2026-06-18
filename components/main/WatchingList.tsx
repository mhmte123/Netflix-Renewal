"use client";
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlayListStore } from '@/store/usePlayListStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import './scss/watchingList.scss';
import SectionTitle from '../common/SectionTitle';

type MenuState = { key: string; top: number; right: number } | null;

export default function WatchingList() {
    const { playList, onLoadPlayList, onRemovePlayList } = usePlayListStore();
    const currentProfile = useAuthStore((s) => s.currentProfile);
    const userId = useAuthStore((s) => s.user?.userId);
    const router = useRouter();
    const [menuState, setMenuState] = useState<MenuState>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentProfile && userId) {
            onLoadPlayList();
        }
    }, [currentProfile?.id, userId]);

    useEffect(() => {
        if (!menuState) return;
        const close = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuState(null);
        };
        const onScroll = () => setMenuState(null);
        document.addEventListener('mousedown', close);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [menuState]);

    const handleMoreClick = (e: React.MouseEvent<HTMLButtonElement>, key: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (menuState?.key === key) {
            setMenuState(null);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuState({ key, top: rect.bottom + 4, right: window.innerWidth - rect.right });
    };

    if (!playList || playList.length === 0) return null;

    const openItem = menuState ? playList.find((i) => `${i.mediaType}-${i.id}` === menuState.key) : null;

    return (
        <section className="watching-section">
            <div className="section-title-outer">
                <SectionTitle title="시청중" href="/mypage/playlist" />
            </div>

            <div className="watching-swiper-wrap">
                <Swiper
                    modules={[Navigation]}
                    navigation
                    slidesPerView={2.5}
                    spaceBetween={10}
                    slidesPerGroup={2}
                    breakpoints={{
                        601: { slidesPerView: 4, spaceBetween: 12, slidesPerGroup: 4 },
                        1025: { slidesPerView: 6, spaceBetween: 12, slidesPerGroup: 6 },
                    }}
                    className="watching-swiper"
                >
                    {playList.map((item) => {
                        const key = `${item.mediaType}-${item.id}`;
                        return (
                            <SwiperSlide key={key}>
                                <div className="watching-card-wrap">
                                    <Link href={`/watch/${item.mediaType}/${item.id}`} className="watching-card">
                                        <div className="watching-thumb">
                                            <img
                                                src={item.backdrop_path
                                                    ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
                                                    : `https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                                alt={item.title}
                                            />
                                            <div className="watching-play-overlay">
                                                <div className="watching-play-btn">▶</div>
                                            </div>
                                            <div className="progress-bar">
                                                <span
                                                    className="progress-fill"
                                                    style={{ width: `${item.progress ?? 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="watching-title-row">
                                        <h3 className="watching-title">
                                            {item.title}
                                            {item.mediaType === 'tv' && item.lastEpisodeNumber ? (
                                                <span className="watching-episode">
                                                    {item.lastEpisodeNumber}화
                                                </span>
                                            ) : null}
                                        </h3>
                                        <button
                                            type="button"
                                            className={`watching-more-btn${menuState?.key === key ? ' active' : ''}`}
                                            aria-label="더보기"
                                            onClick={(e) => handleMoreClick(e, key)}
                                        >
                                            <img src="/images/detail/review/dot-vertical-filled.svg" alt="" width={16} height={16} />
                                        </button>
                                    </div>
                                </div>
                            </SwiperSlide>
                        );
                    })}
                </Swiper>
            </div>

            {menuState && openItem && (
                <div
                    ref={menuRef}
                    className="watching-menu"
                    style={{ top: menuState.top, right: menuState.right }}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setMenuState(null);
                            router.push(`/detail/${openItem.mediaType}/${openItem.id}`);
                        }}
                    >
                        상세 정보 보기
                    </button>
                    <button
                        type="button"
                        className="watching-menu__delete"
                        onClick={() => {
                            setMenuState(null);
                            onRemovePlayList(openItem.id);
                        }}
                    >
                        시청중인 콘텐츠 삭제하기
                    </button>
                </div>
            )}
        </section>
    );
}
