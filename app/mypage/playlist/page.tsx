"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { showToast } from "@/store/useToastStore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { customMenus } from "@/data/mainMenu";
import { usePlayListStore } from "@/store/usePlayListStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { DEFAULT_PROFILE_SETTINGS, useAuthStore } from "@/store/useAuthStore";
import type { PlayListItem } from "@/types/playList";
import "../../scss/mediaList.scss";
import { useMovieStore } from "@/store/useMovieStore";
import BackButton from "@/components/common/BackButton";
import { Movie, TV } from "@/types/movie";
import { WishItem } from "@/types/wishlist";
import { convertToMedia } from "../wishlist/page";
import { PlaylistDocument } from "@/types/playList";
import Image from "next/image";
import MobileFilterAccordion from "@/components/mypage/MobileFilterAccordion";
import PlaylistCreateModal from "@/components/playlist/PlaylistCreateModal";

type ActivityTab = "watching" | "history" | "wishlist" | "reviews" | "playlists";
type FilterType = "all" | "movie" | "tv" | "animation";
type WishFilterType = "all" | "movie" | "drama" | "animation";
type WishSortType = "recent" | "title" | "rating";
// type playlistSortType = "recent" | "title" | "rating";

const SELECTABLE_PAGE_SIZE = 10;
const PLAYLIST_MOOD_TAGS = customMenus.filter((menu) => menu.path.startsWith("/mood/"));
const getMoodIcon = (tag: string) => PLAYLIST_MOOD_TAGS.find((mood) => mood.title === tag)?.imgUrl;

const tabs: { id: ActivityTab; label: string }[] = [
  { id: "watching", label: "시청중" },
  { id: "history", label: "시청기록" },
  // { id: "wishlist", label: "위시리스트" },
  { id: "playlists", label: "위시리스트" },
];

// URL ?tab= 값이 유효한 탭인지 확인
const isActivityTab = (value: string | null): value is ActivityTab =>
  value === "watching" || value === "history" || value === "wishlist" ||
  value === "reviews" || value === "playlists";

const wishTabs: { key: WishFilterType; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "movie", label: "영화" },
  { key: "drama", label: "시리즈" },
  { key: "animation", label: "애니메이션" },
];

const wishSortOptions: { key: WishSortType; label: string }[] = [
  { key: "recent", label: "최근 찜한 순" },
  { key: "title", label: "제목순" },
  { key: "rating", label: "평점순" },
];

// const playlistSortOptions: { key: playlistSortType; label: string }[] = [
//   { key: "recent", label: "최근 시청 순" },
//   { key: "title", label: "제목순" },
//   { key: "rating", label: "평점순" },
// ];

const getItemKey = (item: Pick<PlayListItem, "id" | "mediaType">) => `${item.mediaType}-${item.id}`;

const getPosterUrl = (path?: string, size: "w500" | "w780" | "w1280" | "original" = "w500") => (
  path ? `https://image.tmdb.org/t/p/${size}${path}` : ""
);

const getBackdropUrl = (item: PlayListItem): string => {
  const imagePath = item.backdrop_path || item.poster_path;
  
  // 이미지 경로가 아예 없는 경우(null 또는 빈 문자열)를 위한 기본 이미지 처리
  return imagePath ? getPosterUrl(imagePath) : "/default-backdrop.jpg"; 
};

const getProgress = (item: PlayListItem) => 35 + (item.id % 50);

const formatDate = (value: string) => new Date(value).toLocaleDateString("ko-KR");

export default function PlaylistPage() {
  return (
    <Suspense fallback={null}>
      <ActivityContent />
    </Suspense>
  );
}

function ActivityContent() {
  const {
    playList,
    playHist,
    myList,
    customPlaylists, 
    onLoadPlayList,
    onLoadMyList,
    onRemovePlayList,
    onRemoveMyList,
    onRemovePlayHist,
    fetchMyCustomPlaylists,
    updateCustomPlaylist,
    deleteCustomPlaylist
  } = usePlayListStore();
  const { wishlist, onLoadWishlist, onRemoveWish } = useWishlistStore();
  const { user, currentProfile, onUpdateProfile } = useAuthStore();
  const { fetchMediaDetail } = useMovieStore();
  const searchParams = useSearchParams();
  const hideMode = searchParams.get("mode") === "hide";
  const embedMode = searchParams.get("embed") === "1";

  const [activeTab, setActiveTab] = useState<ActivityTab>("watching");
  const [filter, setFilter] = useState<FilterType>("all");
  const [wishFilter, setWishFilter] = useState<WishFilterType>("all");
  const [wishSort, setWishSort] = useState<WishSortType>("recent");
  const [wishSortOpen, setWishSortOpen] = useState(false);
  const [playlistSort, setPlaylistSort] = useState<WishSortType>("recent");
  const [playlistSortOpen, setPlaylistSortOpen] = useState(false);
  const [wishLoading, setWishLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectionPage, setSelectionPage] = useState(1);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [modifyPlaylistId, setModifyPlaylistId] = useState<string | null>(null);
  const [modifyTitle, setModifyTitle] = useState("");
  const [modifyDescription, setModifyDescription] = useState("");
  const [modifyMoodTags, setModifyMoodTags] = useState<string[]>([]);
  const [modifyIsPublic, setModifyIsPublic] = useState(false);
  const [modifyItemKeys, setModifyItemKeys] = useState<string[]>([]);
  const [listItems, setListItems] = useState<any[]>([]);
  const [playlistDetailsCache, setPlaylistDetailsCache] = useState<Record<string, any>>({});
  const [detailedSelectedItems, setDetailedSelectedItems] = useState<PlayListItem[]>([]);

  const getDetailedHistory = async (histKeys: string[]): Promise<PlayListItem[]> => {
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
              episodeProgress: {}
          };
      });

      const results = await Promise.all(detailPromises);
      
      return results.filter((item): item is PlayListItem => item !== null);
  };

  // 헤더 메뉴에서 ?tab=wishlist / ?tab=playlists 로 들어오면 해당 탭 열기
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (isActivityTab(tabParam)) {
      const timeoutId = window.setTimeout(() => {
        setActiveTab(tabParam);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [searchParams]);

  useEffect(() => {
    onLoadPlayList();
    onLoadMyList();
    fetchMyCustomPlaylists();
  }, [onLoadPlayList, onLoadMyList, fetchMyCustomPlaylists]);
  useEffect(() => {
    if (!modifyPlaylistId && !createPlaylistOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (modifyPlaylistId) {
          setModifyPlaylistId(null);
          setModifyTitle("");
          setModifyDescription("");
          setModifyMoodTags([]);
          setModifyIsPublic(false);
          setModifyItemKeys([]);
        }
        if (createPlaylistOpen) {
          setCreatePlaylistOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modifyPlaylistId, createPlaylistOpen]);

  // 찜 목록 불러오기
  useEffect(() => {
    const load = async () => {
      setWishLoading(true);
      await onLoadWishlist();
      setWishLoading(false);
    };
    load();
  }, [onLoadWishlist, user]);

  const hiddenWatchingVideos = currentProfile?.settings?.hiddenWatchingVideos ?? [];
  useEffect(() => {
    const loadListDetails = async () => {
      const promises = myList.map(async (key) => {
        const [mediaType, id] = key.split('-');
        const data = await fetchMediaDetail(id, mediaType as 'movie' | 'tv');
        
        if (!data) return null;

        // 핵심: API 데이터에 mediaType을 강제로 결합
        return {
          ...data,
          id: Number(id),
          mediaType: mediaType as 'movie' | 'tv',
        };
      });

      const details = await Promise.all(promises);
      // 타입 가드를 적용하여 PlayListItem 타입 준수
      setListItems(details.filter((item): item is PlayListItem => item !== null));
    };

    if (myList.length > 0) {
      loadListDetails();
    } else {
      setListItems([]);
    }
  }, [myList, fetchMediaDetail]);

  useEffect(() => {
    if (customPlaylists.length === 0) return;

    const loadAllPlaylistDetails = async () => {
      // 1. 모든 플레이리스트의 videoIds를 합쳐서 중복 제거
      const allVideoIds = Array.from(
        new Set(customPlaylists.flatMap((p) => p.videoIds))
      );

      // 2. 아직 캐시에 없는 아이디만 골라내기
      const missingKeys = allVideoIds.filter((key) => !playlistDetailsCache[key]);
      if (missingKeys.length === 0) return;

      // 3. API 병렬 호출
      const promises = missingKeys.map(async (key) => {
        const [mediaType, id] = key.split('-');
        const data = await fetchMediaDetail(id, mediaType as 'movie' | 'tv');
        return { key, data: data ? { ...data, mediaType, id: Number(id) } : null };
      });

      const results = await Promise.all(promises);

      // 4. 캐시 업데이트
      setPlaylistDetailsCache((prev) => {
        const next = { ...prev };
        results.forEach((res) => {
          if (res.data) next[res.key] = res.data;
        });
        return next;
      });
    };

    loadAllPlaylistDetails();
  }, [customPlaylists]);


  const watchItems = playList;
  // const watchingItems = watchItems.slice(0, 6);
  const watchingItems = watchItems;
  // 키에서 mediaType 추출하는 헬퍼 (예: "movie-123" -> "movie")
  const getMediaTypeFromKey = (key: string) => key.split("-")[0];

  const [historyItems, setHistoryItems] = useState<PlayListItem[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
        const items = await getDetailedHistory(playHist);
        setHistoryItems(items);
    };
    loadHistory();
  }, [playHist]);

  // 1. 상태 변수 이름 통일 (historyData -> historyItems)
  const visibleHistoryItems = hideMode
    ? historyItems
    : historyItems.filter((item) => !hiddenWatchingVideos.includes(getItemKey(item)));

  // 2. 카테고리 필터링 (키를 파싱할 필요 없이 객체 속성 사용)
  const filteredHistory = filter === "all" 
    ? visibleHistoryItems 
    : visibleHistoryItems.filter((item) => item.mediaType === filter);

  // 3. 타입별 카운트 (객체 속성 사용)
  const movieCount = visibleHistoryItems.filter((item) => item.mediaType === "movie").length;
  const tvCount = visibleHistoryItems.filter((item) => item.mediaType === "tv").length;
  const animationCount = visibleHistoryItems.filter((item) => item.genre_ids?.includes(16)).length;

  // ── 찜하기 필터/정렬 ──────────────────────────────────────────────────
  const wishCount = (key: WishFilterType) => {
    if (key === "all") return wishlist.length;
    if (key === "movie") return wishlist.filter((i) => i.genre === "movie").length;
    if (key === "drama") return wishlist.filter((i) => i.genre === "drama").length;
    if (key === "animation") return wishlist.filter((i) => i.genre === "animation").length;
    return 0;
  };

  const filteredWish = wishlist.filter((item) => {
    if (wishFilter === "all") return true;
    return item.genre === wishFilter;
  });

  const sortedWish = [...filteredWish].sort((a, b) => {
    if (wishSort === "title") return a.title.localeCompare(b.title);
    if (wishSort === "rating") return b.vote_average - a.vote_average;
    return 0; // recent: 배열 순서 유지 (맨 앞이 최근)
  });

  const currentWishSortLabel = wishSortOptions.find((o) => o.key === wishSort)?.label;
  // const currentPlaylistSortLabel = playlistSortOptions.find((o) => o.key === playlistSort)?.label;

  const handleRemoveWish = async (e: React.MouseEvent, item: WishItem) => {
    e.preventDefault();

    // WishItem을 다시 Movie | TV 형태로 변형
    const mediaItem = convertToMedia(item);
    
    await onRemoveWish(mediaItem);
  };

  const selectedItems = myList.filter((item) => selectedKeys.includes(item));

  const plmovieCount = listItems.filter((item) => item.mediaType === "movie").length;
  const pltvCount = listItems.filter((item) => item.mediaType === "tv").length;
  const planimationCount = listItems.filter((item) => item.genre_ids?.includes(16)).length;

  // 1. 필터링 & 정렬 적용 (데이터 가공)
  const processedList = useMemo(() => {
    let list = [...listItems];

    // 1. 탭 필터링
    if (wishFilter !== "all") {
      // 드라마(drama) 필터 추가 적용
      list = list.filter((item) => item.mediaType === wishFilter || (wishFilter === "drama" && item.mediaType === "tv"));
    }

    // 2. 정렬 로직
    return list.sort((a, b) => {
      switch (wishSort) {
        case "title":
          return String(a.title ?? "").localeCompare(
            String(b.title ?? ""),
            "ko",
          );
        case "rating":
          return (
            Number(b.vote_average ?? 0) - Number(a.vote_average ?? 0)
          );
        case "recent":
        default:
          // 최근 찜한 순 (보통 배열 순서가 최신이므로 기본 유지)
          return 0; 
      }
    });
  }, [listItems, wishFilter, wishSort]);

  useEffect(() => {
  if (createPlaylistOpen && selectedKeys.length > 0) {
    getDetailedHistory(selectedKeys).then((data) => {
      setDetailedSelectedItems(data);
    });
  }
}, [createPlaylistOpen, selectedKeys]);

  // 2. 페이지네이션 적용 (가공된 리스트 기준)
  const totalSelectionPages = Math.max(1, Math.ceil(processedList.length / SELECTABLE_PAGE_SIZE));
  const currentSelectionPage = Math.min(selectionPage, totalSelectionPages);

  const pagedSelectionItems = useMemo(() => {
    const start = (currentSelectionPage - 1) * SELECTABLE_PAGE_SIZE;
    return processedList.slice(start, start + SELECTABLE_PAGE_SIZE);
  }, [processedList, currentSelectionPage]);
  // const totalSelectionPages = Math.max(1, Math.ceil(listItems.length / SELECTABLE_PAGE_SIZE));
  // const currentSelectionPage = Math.min(selectionPage, totalSelectionPages);
  // const pagedSelectionItems = listItems.slice(
  //   (currentSelectionPage - 1) * SELECTABLE_PAGE_SIZE,
  //   currentSelectionPage * SELECTABLE_PAGE_SIZE
  // );

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => (
      prev.includes(key)
        ? prev.filter((itemKey) => itemKey !== key)
        : [...prev, key]
    ));
  };

  const openCreatePlaylistModal = () => {
    if (selectedKeys.length === 0) return;
    setCreatePlaylistOpen(true);
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    try {
      await deleteCustomPlaylist(playlistId);

      if (modifyPlaylistId === playlistId) {
          closeModifyCard();
      }
      showToast("플레이리스트가 삭제되었습니다.");
    } catch (error) {
      console.error("플레이리스트 삭제 중 에러 발생:", error);
      showToast("플레이리스트 삭제에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const openModifyCard = (playlist: PlaylistDocument) => {
      // PlaylistDocument의 필드명으로 모두 변경
      setModifyPlaylistId(playlist.listId);       // id → listId
      setModifyTitle(playlist.name);              // title → name
      setModifyDescription(playlist.content || ""); // description → content
      setModifyMoodTags(playlist.tags || []);     // moodTags → tags
      setModifyIsPublic(Boolean(playlist.isShare)); // isPublic → isShare
      setModifyItemKeys(playlist.videoIds);       // itemKeys → videoIds
  };

  const closeModifyCard = () => {
    setModifyPlaylistId(null);
    setModifyTitle("");
    setModifyDescription("");
    setModifyMoodTags([]);
    setModifyIsPublic(false);
    setModifyItemKeys([]);
  };

  const toggleModifyMoodTag = (tag: string) => {
    setModifyMoodTags((prev) => (
      prev.includes(tag)
        ? prev.filter((item) => item !== tag)
        : [...prev, tag]
    ));
  };

  const toggleModifyItemKey = (key: string) => {
    setModifyItemKeys((prev) => (
      prev.includes(key)
        ? prev.filter((itemKey) => itemKey !== key)
        : [...prev, key]
    ));
  };

  const handleAddPlaylist = async(playlist: PlaylistDocument, newVideoIds: string[])=>{

      // 업데이트할 데이터 객체 생성
      const updatedData: Partial<PlaylistDocument> = {
          name: playlist.name,
          content: playlist.content || "",
          tags: playlist.tags || [],
          isShare: Boolean(playlist.isShare),
          videoIds: newVideoIds
      };

      // 스토어 메서드 호출
      await updateCustomPlaylist(playlist.listId, updatedData);
  }

  const handleSaveModifyPlaylist = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!modifyPlaylistId) return;

      // 업데이트할 데이터 객체 생성
      const updatedData: Partial<PlaylistDocument> = {
          name: modifyTitle.trim(),
          content: modifyDescription.trim(),
          tags: modifyMoodTags,
          isShare: modifyIsPublic,
          videoIds: modifyItemKeys
      };

    try {
      await updateCustomPlaylist(modifyPlaylistId, updatedData);
      closeModifyCard();
      showToast("플레이리스트 수정이 완료되었습니다.");
    } catch (error) {
      console.error("플레이리스트 수정 중 에러 발생:", error);
      showToast("플레이리스트 수정에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleDeleteWatchingItem = async (item: PlayListItem) => {
    try {
      await onRemovePlayList(item.id);
      showToast("삭제되었습니다.");
    } catch (error) {
      console.error("시청 중인 콘텐츠 삭제 실패:", error);
      showToast("삭제에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleDeleteHistItem = async (item: PlayListItem) => {
    await onRemovePlayHist(item.id, item.mediaType);
  };

  const handleHideHistoryItem = async (item: PlayListItem) => {
    if (!currentProfile) return;

    const itemKey = getItemKey(item);
    if (hiddenWatchingVideos.includes(itemKey)) return;

    await onUpdateProfile({
      ...currentProfile,
      settings: {
        ...currentProfile.settings,
        maturityRating: currentProfile.settings?.maturityRating ?? DEFAULT_PROFILE_SETTINGS.maturityRating,
        verifiedAdult: currentProfile.settings?.verifiedAdult ?? DEFAULT_PROFILE_SETTINGS.verifiedAdult,
        subtitles: currentProfile.settings?.subtitles ?? DEFAULT_PROFILE_SETTINGS.subtitles,
        playback: currentProfile.settings?.playback ?? DEFAULT_PROFILE_SETTINGS.playback,
        hiddenWatchingVideos: [...hiddenWatchingVideos, itemKey],
        favoriteGenres: currentProfile.settings?.favoriteGenres ?? DEFAULT_PROFILE_SETTINGS.favoriteGenres,
        excludedGenres: currentProfile.settings?.excludedGenres ?? DEFAULT_PROFILE_SETTINGS.excludedGenres,
        favoriteMoods: currentProfile.settings?.favoriteMoods ?? DEFAULT_PROFILE_SETTINGS.favoriteMoods,
        excludedMoods: currentProfile.settings?.excludedMoods ?? DEFAULT_PROFILE_SETTINGS.excludedMoods
      },
    });
  };

  const handleDeleteMyListItem = async (item: PlayListItem) => {
    await onRemoveMyList(item.id, item.mediaType);
  };

  //renderModifyCard : 제목, 설명, 무드태그, 공개여부, 추가된 컨텐츠 수정 팝업창
  const renderModifyCard = () => {
    if (!modifyPlaylistId) return null;

    // 1. 현재 수정 중인 플레이리스트 객체를 찾습니다.
    const targetPlaylist = customPlaylists.find((p) => p.listId === modifyPlaylistId);
    
    // 2. listItems 대신, 캐시에서 해당 플레이리스트의 아이템들만 가져옵니다.
    const selectedModifyItems = targetPlaylist 
      ? targetPlaylist.videoIds
          .map((key) => playlistDetailsCache[key])
          .filter(Boolean) // null/undefined 제거
      : [];

    return (
      <div
        className="modify-playlist-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeModifyCard();
          }
        }}
      >
        <section
          className="modify-playlist-modal edit-playlist-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modify-playlist-title"
        >
          <form onSubmit={handleSaveModifyPlaylist}>
            <div className="modify-playlist-head">
              <div>
                <div className="title-area">
                  <img src="/images/playlist/playlist-icon.svg" alt="." />
                  <h3 id="modify-playlist-title">플레이리스트 수정</h3>
                </div>

                <p>{selectedModifyItems.length}개 작품 선택됨</p>
              </div>
              <button
                type="button"
                className="modify-close-btn"
                onClick={closeModifyCard}
                aria-label="수정 창 닫기"
              >
                ×
              </button>
            </div>

            <div className="edit-playlist-body">
              <div className="modify-field-stack">
                <label>
                  <span>제목</span>
                  <input
                    type="text"
                    value={modifyTitle}
                    onChange={(event) => setModifyTitle(event.target.value)}
                    placeholder="플레이리스트 제목"
                  />
                </label>

                <label>
                  <span>설명</span>
                  <textarea
                    value={modifyDescription}
                    onChange={(event) => setModifyDescription(event.target.value)}
                    placeholder="플레이리스트 설명"
                  />
                </label>
              </div>

              <div className="modify-section">
                <strong>무드 태그</strong>
                <div className="modify-mood-tags">
                  {PLAYLIST_MOOD_TAGS.map((mood) => (
                    <button
                      type="button"
                      key={mood.path}
                      className={modifyMoodTags.includes(mood.title) ? "active" : ""}
                      onClick={() => toggleModifyMoodTag(mood.title)}
                    >
                      <img src={mood.imgUrl} alt="" />
                      {mood.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modify-section">
                <strong>커뮤니티 공개 여부</strong>
                <button
                  type="button"
                  className={modifyIsPublic ? "modify-visibility-toggle active" : "modify-visibility-toggle"}
                  onClick={() => setModifyIsPublic((value) => !value)}
                  aria-pressed={modifyIsPublic}
                >
                  커뮤니티 공개
                </button>
              </div>

              <div className="modify-section">
                <strong>추가된 콘텐츠</strong>
                <div className="modify-content-grid">
                  {selectedModifyItems.map((item) => {
                    const key = getItemKey(item);
                    const isSelected = modifyItemKeys.includes(key);

                    return (
                      <button
                        type="button"
                        key={key}
                        className={isSelected ? "modify-content-card selected" : "modify-content-card"}
                        onClick={() => toggleModifyItemKey(key)}
                      >
                        {item.poster_path && <img src={getPosterUrl(item.poster_path)} alt="" />}
                        <span>{isSelected ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modify-actions">
              <button
                type="button"
                className="modify-delete-btn"
                onClick={() => handleDeletePlaylist(modifyPlaylistId)}
              >
                삭제
              </button>
              <button type="button" className="modify-cancel-btn" onClick={closeModifyCard}>
                취소
              </button>
              <button
                type="submit"
                className="modify-save-btn"
                disabled={!modifyTitle.trim() || modifyItemKeys.length === 0}
              >
                저장
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  };

  const renderEmpty = (message: string) => (
    <div className="empty">
      <img src="/images/playlist/empty-contents.png" alt="." />
      <p>{message}</p>
      {/* <Link href="/" className="btn-primary">작품 둘러보기</Link> */}
    </div>
  );

  const renderWatching = () => (
    <section className="activity-section">
      <div className="section-head">
        <h2>시청 중인 콘텐츠 <strong>{watchingItems.length}</strong></h2>
      </div>

      {watchingItems.length > 0 ? (
        <div className="watching-grid">
          {watchingItems.map((item) => (
            <article className="watch-card" key={getItemKey(item)}>
              <button
                type="button"
                className="watch-delete-btn"
                onClick={() => handleDeleteWatchingItem(item)}
                aria-label={`${item.title} 시청중 콘텐츠 삭제`}
              >
                -
              </button>
              <Link href={`/detail/${item.mediaType}/${item.id}`}>
                <div className="watch-thumb">
                  {item.backdrop_path && <img src={getPosterUrl(item.backdrop_path, "w780")} alt={item.title} />}
                  <span className="progress-bar" style={{ width: `${getProgress(item)}%` }} />
                </div>
                <div className="watch-info">
                  <div>
                    <h3>{item.title}</h3>
                    <p>마지막 시청: {formatDate(item.playTime)}</p>
                  </div>
                  <span className="play-pill">▶ 이어보기</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      ) : renderEmpty("시청 중인 콘텐츠가 없어요.")}
    </section>
  );

  const renderHistory = () => (
    <section className="activity-section">
      <div className="section-head">
        <h2>{hideMode ? "시청기록 숨기기" : "시청기록"}</h2>
        {/* <div className="wish-sort">
          <button
            type="button"
            className="wish-sort-btn"
            onClick={() => setPlaylistSortOpen((v) => !v)}
          >
            {currentPlaylistSortLabel}
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={`wish-sort-arrow${playlistSortOpen ? " is-open" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          
          {playlistSortOpen && (
            <ul className="wish-sort-menu">
              {playlistSortOptions.map((opt) => (
                <li key={opt.key}>
                  <button
                    type="button"
                    className={`wish-sort-option${playlistSort === opt.key ? " is-selected" : ""}`}
                    onClick={() => {
                      setPlaylistSort(opt.key);
                      setPlaylistSortOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div> */}
      </div>

      <div className="filter-row">
        <div className="filter-chips">
          <button className={filter === "all" ? "chip active" : "chip"} onClick={() => setFilter("all")}>
            전체 {visibleHistoryItems.length}
          </button>
          <button className={filter === "movie" ? "chip active" : "chip"} onClick={() => setFilter("movie")}>
            영화 {movieCount}
          </button>
          <button className={filter === "tv" ? "chip active" : "chip"} onClick={() => setFilter("tv")}>
            시리즈 {tvCount}
          </button>
          <button className={filter === "animation" ? "chip active" : "chip"} onClick={() => setFilter("animation")}>
            애니메이션 {animationCount}
          </button>
        </div>
        <MobileFilterAccordion
          ariaLabel="시청기록 필터"
          value={filter}
          options={[
            { value: "all", label: "전체", count: visibleHistoryItems.length },
            { value: "movie", label: "영화", count: movieCount },
            { value: "tv", label: "시리즈", count: tvCount },
            {
              value: "animation",
              label: "애니메이션",
              count: animationCount,
            },
          ]}
          onChange={setFilter}
        />
      </div>

      {filteredHistory.length > 0 ? (
        <div className="history-poster-grid">
          {filteredHistory.map((item) => (
            <article className="mini-poster-card" key={getItemKey(item)}>
              <button
                type="button"
                className="mini-delete-btn"
                onClick={() => hideMode ? handleDeleteHistItem(item) : handleDeleteHistItem(item)}
                aria-label={`${item.title} ${hideMode ? "시청기록 숨기기" : "시청기록 삭제"}`}
              >
                {hideMode ? "숨기기" : "-"}
              </button>
              <Link href={`/detail/${item.mediaType}/${item.id}`} className="mini-poster">
                <div className="mini-poster__image">
                  {item.poster_path && <img src={getPosterUrl(item.poster_path)} alt={item.title} />}
                </div>
                {/* <h3>{item.title}</h3> */}
                {/* <p>{formatDate(item.playTime)}</p> */}
              </Link>
            </article>
          ))}
        </div>
      ) : renderEmpty("시청기록이 없어요.")}
    </section>
  );

  // ── 찜하기 (위시리스트 통합) ──────────────────────────────────────────
  // const renderWishlist = () => (
  //   <section className="activity-section">
  //     <div className="section-head">
  //       <h2>위시리스트</h2>
  //       <span>{wishlist.length}개</span>
  //     </div>

  //     <div className="wish-toolbar">
  //       <div className="wish-chips">
  //         {wishTabs.map((tab) => (
  //           <button
  //             type="button"
  //             key={tab.key}
  //             className={wishFilter === tab.key ? "chip active" : "chip"}
  //             onClick={() => setWishFilter(tab.key)}
  //           >
  //             {tab.label} {wishCount(tab.key)}
  //           </button>
  //         ))}
  //       </div>

  //       <div className="wish-sort">
  //         <button
  //           type="button"
  //           className="wish-sort-btn"
  //           onClick={() => setWishSortOpen((v) => !v)}
  //         >
  //           {currentWishSortLabel}
  //           <svg
  //             width="16" height="16" viewBox="0 0 24 24" fill="none"
  //             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
  //             className={`wish-sort-arrow${wishSortOpen ? " is-open" : ""}`}
  //           >
  //             <path d="M6 9l6 6 6-6" />
  //           </svg>
  //         </button>
  //         {wishSortOpen && (
  //           <ul className="wish-sort-menu">
  //             {wishSortOptions.map((opt) => (
  //               <li key={opt.key}>
  //                 <button
  //                   type="button"
  //                   className={`wish-sort-option${wishSort === opt.key ? " is-selected" : ""}`}
  //                   onClick={() => {
  //                     setWishSort(opt.key);
  //                     setWishSortOpen(false);
  //                   }}
  //                 >
  //                   {opt.label}
  //                 </button>
  //               </li>
  //             ))}
  //           </ul>
  //         )}
  //       </div>
  //     </div>

  //     {wishLoading ? (
  //       <div className="history-poster-grid">
  //         {Array.from({ length: 6 }).map((_, i) => (
  //           <article className="mini-poster-card" key={i}>
  //             <div className="mini-poster">
  //               <div className="mini-poster__image wish-skeleton" />
  //             </div>
  //           </article>
  //         ))}
  //       </div>
  //     ) : !user ? (
  //       <div className="empty">
  //         <p>로그인하고 찜한 작품을 확인하세요.</p>
  //         <Link href="/login" className="btn-primary">로그인하기</Link>
  //       </div>
  //     ) : sortedWish.length > 0 ? (
  //       <div className="history-poster-grid">
  //         {sortedWish.map((item) => (
  //           <article className="mini-poster-card" key={`${item.mediaType}-${item.id}`}>
  //             <button
  //               type="button"
  //               className="mini-delete-btn"
  //               onClick={(e) => handleRemoveWish(e, item)}
  //               aria-label={`${item.title} 찜 해제`}
  //             >
  //               삭제
  //             </button>
  //             <Link href={`/detail/${item.mediaType}/${item.id}`} className="mini-poster">
  //               <div className="mini-poster__image">
  //                 {item.poster_path && <img src={getPosterUrl(item.poster_path)} alt={item.title} />}
  //               </div>
  //               <h3>{item.title}</h3>
  //               <p>★ {item.vote_average.toFixed(1)}</p>
  //             </Link>
  //           </article>
  //         ))}
  //       </div>
  //     ) : renderEmpty("아직 찜한 작품이 없어요.")}
  //   </section>
  // );

  const renderPlaylistMosaic = (playlist: PlaylistDocument) => {
    // 1. 캐시에서 매칭되는 아이템들을 찾음
    const playlistItems = playlist.videoIds
        .map((key) => playlistDetailsCache[key])
        .filter(Boolean);

    const previewItems = playlistItems.slice(0, 4);
    const hasNewItems = selectedKeys.some((key) => !playlist.videoIds.includes(key));

    return (
      <article className="custom-playlist-card" key={playlist.listId}>
        {/* <button
          type="button"
          className="playlist-delete-btn"
          onClick={() => handleDeletePlaylist(playlist.listId)}
          aria-label={`${playlist.name} 플레이리스트 삭제`}
        >
          -
        </button> */}
        {selectedKeys.length > 0 ? (
          hasNewItems ? (
            <button type="button" className="playlist-add-btn" 
            onClick={() => {
              const combinedIds = Array.from(new Set([...playlist.videoIds, ...selectedKeys]));
              handleAddPlaylist(playlist, combinedIds);}}>
              추가하기
            </button>
          ) : (
            <span className="playlist-already-added">이미 추가됨</span>
          )
        ) : (null)}
        <Link href={`/playlist/${user?.userId}/${playlist.listId}`} className="mini-poster">
          <div className="playlist-mosaic">
            {Array.from({ length: 4 }).map((_, index) => {
              const item = previewItems[index];

              return (
                <div
                  key={item ? getItemKey(item) : `${playlist.listId}-empty-${index}`}
                  className={item ? undefined : "playlist-mosaic-empty"}
                >
                  {item && (item.poster_path || item.backdrop_path) && (
                    <img
                      src={item.poster_path ? getPosterUrl(item.poster_path) : getBackdropUrl(item)}
                      alt={typeof item === 'object' && 'title' in item ? item.title : '작품'}
                    />
                  )}
                </div>
              );
            })}
            {playlistItems.length > 4 && <span>+{playlistItems.length - 4}</span>}
          </div>

          <h3>{playlist.name}</h3>
          <p className="playlist-date">{formatDate(playlist.createdAt)}</p>
          {playlist.content && <p className="playlist-description">{playlist.content}</p>}

          {playlist.tags && playlist.tags.length > 0 && (
            <div className="playlist-tag-row">
              {playlist.tags.map((tag) => {
                const icon = getMoodIcon(tag);
                return (
                  <span key={tag}>
                    {icon && <img src={icon} alt="tag" />}
                    {tag}
                  </span>
                );
              })}
            </div>
          )}

          <div className="playlist-extra-area">
            <p>{playlistItems.length}개 작품</p>
            <span className={playlist.isShare ? "playlist-visibility public" : "playlist-visibility"}>
              {playlist.isShare ? "커뮤니티 공개" : "비공개"}
            </span>
          </div>
        </Link>
        <button
            className="playcard-more-btn"
            type="button"
            onClick={() => openModifyCard(playlist)}
            aria-label={`${playlist.name} 플레이리스트 수정`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="m12 16.495c1.242 0 2.25 1.008 2.25 2.25s-1.008 2.25-2.25 2.25-2.25-1.008-2.25-2.25 1.008-2.25 2.25-2.25zm0-6.75c1.242 0 2.25 1.008 2.25 2.25s-1.008 2.25-2.25 2.25-2.25-1.008-2.25-2.25 1.008-2.25 2.25-2.25zm0-6.75c1.242 0 2.25 1.008 2.25 2.25s-1.008 2.25-2.25 2.25-2.25-1.008-2.25-2.25 1.008-2.25 2.25-2.25z"
              />
            </svg>
          </button>
      </article>
    );
  };

  const renderSelectableHistorySkeleton = () => (
    <div className="selectable-history selectable-history-skeleton">
      {Array.from({ length: 6 }).map((_, index) => (
        <article className="select-card select-card-skeleton" key={index}>
          <div className="select-card-skeleton__poster" />
        </article>
      ))}
    </div>
  );

  const renderCustomPlaylistSkeleton = () => (
    <div className="custom-playlist-grid custom-playlist-grid-skeleton">
      {Array.from({ length: 4 }).map((_, index) => (
        <article className="custom-playlist-card custom-playlist-card-skeleton" key={index}>
          <div className="playlist-mosaic custom-playlist-card-skeleton__mosaic" />
          <div className="custom-playlist-card-skeleton__body">
            <div className="custom-playlist-card-skeleton__line custom-playlist-card-skeleton__line--title" />
            <div className="custom-playlist-card-skeleton__line" />
            <div className="custom-playlist-card-skeleton__line custom-playlist-card-skeleton__line--short" />
          </div>
        </article>
      ))}
    </div>
  );

  const renderPlaylists = () => (
    <section className="activity-section">
      {/* 헤더 및 툴바 영역 */}
      <div className="section-head playlist-content-head">
        <div className="title-list">
          <h2>위시리스트</h2>
          <span>{selectedItems.length}개 선택됨</span>
        </div>
        <button className="create-playlist-btn" onClick={openCreatePlaylistModal} disabled={selectedKeys.length === 0}>
          <div className="content">
          <img src="/images/playlist/playlist-icon.svg" alt="플레이리스트 만들기" />{selectedKeys.length === 0 ? "영상을 선택하세요" : "플레이리스트 만들기"} 
          </div>
        </button>
      </div>
      <div className="wish-toolbar">
        {/* // 필터 버튼 영역 */}
        <div className="filter-chips">
          {wishTabs.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={wishFilter === tab.key ? "chip active" : "chip"}
              onClick={() => {
                setWishFilter(tab.key);
                setSelectionPage(1); // 필터 변경 시 첫 페이지로 초기화
              }}
            >
              {tab.label} {tab.label === "전체" ? listItems.length : 
              tab.label === "영화" ? plmovieCount : tab.label === "시리즈" ? pltvCount :
              planimationCount}
            </button>
          ))}
        </div>
        <MobileFilterAccordion
          ariaLabel="위시리스트 필터"
          value={wishFilter}
          options={wishTabs.map((tab) => ({
            value: tab.key,
            label: tab.label,
            count:
              tab.key === "all"
                ? listItems.length
                : tab.key === "movie"
                  ? plmovieCount
                  : tab.key === "drama"
                    ? pltvCount
                    : planimationCount,
          }))}
          onChange={(nextFilter) => {
            setWishFilter(nextFilter);
            setSelectionPage(1);
          }}
        />
        <MobileFilterAccordion
          ariaLabel="위시리스트 정렬"
          value={wishSort}
          options={wishSortOptions.map((option) => ({
            value: option.key,
            label: option.label,
          }))}
          onChange={(nextSort) => {
            setWishSort(nextSort);
            setSelectionPage(1);
          }}
        />

        <div className="wish-sort">
          <button
            type="button"
            className="wish-sort-btn"
            onClick={() => setWishSortOpen((v) => !v)}
          >
            {currentWishSortLabel}
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={`wish-sort-arrow${wishSortOpen ? " is-open" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        
          {/* // 정렬 메뉴 영역 */}
          {wishSortOpen && (
            <ul className="wish-sort-menu">
              {wishSortOptions.map((opt) => (
                <li key={opt.key}>
                  <button
                    type="button"
                    className={`wish-sort-option${wishSort === opt.key ? " is-selected" : ""}`}
                    onClick={() => {
                      setWishSort(opt.key);
                      setWishSortOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 리스트 본문 */}
      <div className="playlist-content-layout">
        <div className="selectable-history-wrap">
          {wishLoading ? (
            renderSelectableHistorySkeleton()
          ) : processedList.length > 0 ? (
            <div className="selectable-history">
              {pagedSelectionItems.map((item) => {
                const key = getItemKey(item);
                const isSelected = selectedKeys.includes(key);
                return (
                  <article key={key} className={isSelected ? "select-card selected" : "select-card"}>
                    <button className="select-card-main" onClick={() => toggleSelected(key)}>
                      <span className="select-check">{isSelected ? "✓" : "+"}</span>
                    </button>
                    <button
                      type="button"
                      className="wish-delete-btn"
                      onClick={() => handleDeleteMyListItem(item)}
                      aria-label={`${item.title} 찜 해제`}
                    >
                      <svg
                        className="wishlist-icon"
                        width="14"
                        height="14"
                        viewBox="0 0 30 30"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M5.60549 7.60371C6.63378 6.61891 8.02827 6.06567 9.48229 6.06567C10.9363 6.06567 12.3308 6.61891 13.3591 7.60371L14.9657 9.14157L16.5724 7.60371C17.0782 7.10199 17.6833 6.70179 18.3523 6.42648C19.0213 6.15117 19.7408 6.00625 20.4689 6.0002C21.197 5.99414 21.9191 6.12705 22.593 6.39117C23.2669 6.65531 23.8791 7.04537 24.3939 7.5386C24.9088 8.03183 25.316 8.61835 25.5917 9.26394C25.8674 9.90953 26.0062 10.6013 25.9998 11.2988C25.9935 11.9963 25.8423 12.6855 25.5548 13.3265C25.2674 13.9674 24.8497 14.547 24.326 15.0316L14.9657 24L5.60549 15.0316C4.5775 14.0465 4 12.7106 4 11.3177C4 9.92473 4.5775 8.58882 5.60549 7.60371Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <Link href={`/detail/${item.mediaType}/${item.id}`} className="mini-poster">
                      {item.poster_path && <img src={getPosterUrl(item.poster_path)} alt="" />}
                    </Link>
                    {/* <strong>{item.title}</strong> */}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="playlist-selection-empty">{renderEmpty("아직 위시리스트가 없어요.")}</div>
          )}

          {/* 페이지네이션 버튼 영역 */}
          {totalSelectionPages > 1 && (
            <div className="selection-pagination">
              {/* 이전/페이지 번호/다음 버튼 로직 */}
            </div>
          )}
        </div>
      </div>

      <div className="playlist-section-divider" aria-hidden="true" />

      <div className="section-head">
        <h2>나의 플레이리스트</h2>
        <span>{customPlaylists.length}개</span>
      </div>

      {wishLoading ? (
        renderCustomPlaylistSkeleton()
      ) : customPlaylists.length > 0 ? (
        <div className="custom-playlist-grid">
          {customPlaylists.map(renderPlaylistMosaic)}
        </div>
      ) : (
        <div className="playlist-empty-state">
          <img src="/images/playlist/empty-playlist.png" alt="아직 플레이리스트가 없어요" />
          {/* <h3>아직 플레이리스트가 없어요</h3> */}
          <p>아직 플레이리스트가 없어요.</p>
          {/* <p>
            Your archive is empty.<br />
            Start your collection.
          </p> */}
        </div>
      )}
    </section>
  );

  if (embedMode) {
    return (
      <div className="media-list-page activity-page activity-embed-page">
        <style>{`
          header,
          footer,
          .login-banner {
            display: none !important;
          }

          main {
            min-height: 100vh;
          }
        `}</style>
        <div className="inner">
          {renderHistory()}
        </div>
      </div>
    );
  }

  return (
    <div className="media-list-page activity-page">
      <div className="inner">
        <BackButton fallback="/mypage" />
        <div className="activity-hero">
          <div className="page-head">
            <h1>콘텐츠 활동</h1>
            <p>내가 찜·시청하고 기록한 모든 작품</p>
          </div>

          <div className="activity-tabs" aria-label="콘텐츠 활동 탭">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "watching" && renderWatching()}
        {activeTab === "history" && renderHistory()}
        {/* {activeTab === "wishlist" && renderWishlist()} */}
        {activeTab === "playlists" && renderPlaylists()}
        <PlaylistCreateModal
          open={createPlaylistOpen}
          videoIds={selectedKeys}
          previewItems={detailedSelectedItems.map((item) => ({
            id: getItemKey(item),
            posterPath: item.poster_path,
            title: item.title,
          }))}
          onClose={() => setCreatePlaylistOpen(false)}
          onCreated={() => {
            setSelectedKeys([]);
            setSelectionPage(1);
          }}
        />
        {renderModifyCard()}
      </div>
    </div>
  );
}
