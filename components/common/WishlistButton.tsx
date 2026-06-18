"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { auth } from "@/firebase/firebase";
import { getItemKey, getMediaType, usePlayListStore } from "@/store/usePlayListStore";
import { showToast } from "@/store/useToastStore";
import "./wishlistButton.scss";
import { useSubscribeModalStore } from "@/store/useSubscribeModalStore";

// 위시리스트가 한 페이지 세션에서 한 번만 로드되도록 하는 가드
let wishlistLoadedOnce = false;

type MediaType = "movie" | "tv";

interface WishlistButtonProps {
  // TMDB 형태의 미디어 객체 (id, title|name, poster_path, vote_average, genre_ids 등)
  item: any;
  // 일부 데이터는 TV인데 title 필드에 이름이 들어있어 자동 판별이 틀어짐.
  // 정확한 타입을 알면 넘겨주면 그 값으로 저장됨(상세페이지 키와 일치).
  mediaType?: MediaType;
  className?: string;
  // 클릭 가능한 카드 내부에 있을 때 카드 클릭으로 전파되는 것 방지
  stopPropagation?: boolean;
}

// 명시 타입이 주어지면 getMediaType(=title 유무로 판별)이 그 타입을 반환하도록
// item 을 정규화해서, 저장 키(type-id)가 상세페이지와 항상 일치하게 만든다.
function normalizeForType(item: any, mediaType?: MediaType) {
  if (!mediaType) return item;
  if (mediaType === "movie") {
    return { ...item, title: item.title ?? item.name ?? "" };
  }
  // tv: getMediaType 은 'title' 키가 없을 때만 'tv' 를 반환
  const { title, ...rest } = item;
  return { ...rest, name: item.name ?? item.title ?? "" };
}

// 상세페이지의 하트(위시리스트) 버튼과 동일한 스토어·동작을 쓰는 공통 컴포넌트
export default function WishlistButton({
  item,
  mediaType,
  className,
  stopPropagation,
}: WishlistButtonProps) {
  const { onAddMyList, onRemoveMyList, onLoadMyList, myList } =
    usePlayListStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const openModal = useSubscribeModalStore((state) => state.openModal);

  // 홈 등에서는 위시리스트를 따로 로드하지 않으므로, 최초 1회 로드해 하트 상태를 맞춤
  useEffect(() => {
    if (!wishlistLoadedOnce) {
      wishlistLoadedOnce = true;
      onLoadMyList();
    }
  }, [onLoadMyList]);

  const effectiveType: MediaType = mediaType ?? getMediaType(item);
  const key = getItemKey({ id: item.id, mediaType: effectiveType });
  const wished = myList.includes(key);

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    e.preventDefault();

    // 버튼 위치를 await 전에 미리 확보 (이후 currentTarget 이 null 이 될 수 있음)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    // 로그인 전이면 찜 대신 로그인 페이지로 이동
    const uid = user?.userId ?? auth.currentUser?.uid ?? null;
    if (!uid) {
      openModal();
      // router.push("/login");
      return;
    }

    const normalized = normalizeForType(item, mediaType);
    if (wished) {
      await onRemoveMyList(item.id, effectiveType);
      showToast("위시리스트에서 삭제되었습니다.", {
        icon: "/images/header/menu/wishlist.svg",
        anchor: { x: rect.left + rect.width / 2, y: rect.top },
      });
    } else {
      await onAddMyList(normalized);
      showToast("위시리스트에 추가되었습니다.", {
        icon: "/images/header/menu/wishlist.svg",
        anchor: { x: rect.left + rect.width / 2, y: rect.top },
      });
    }
  };

  return (
    <button
      type="button"
      className={`wishlist-heart-btn ${wished ? "is-wished" : ""} ${className ?? ""}`}
      onClick={handleClick}
      aria-pressed={wished}
      aria-label="위시리스트에 추가"
      title="위시리스트"
    >
      <svg
        className="wishlist-icon"
        width="20"
        height="20"
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
  );
}
