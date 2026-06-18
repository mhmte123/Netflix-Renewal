"use client";

import { useEffect, useState } from "react";
import { customMenus } from "@/data/mainMenu";
import { usePlayListStore } from "@/store/usePlayListStore";
import { showToast } from "@/store/useToastStore";
import styles from "./PlaylistCreateModal.module.scss";

const PLAYLIST_MOOD_TAGS = customMenus.filter((menu) =>
  menu.path.startsWith("/mood/"),
);

export interface PlaylistCreatePreview {
  id: string | number;
  posterPath?: string | null;
  title?: string;
}

interface PlaylistCreateModalProps {
  open: boolean;
  videoIds: string[];
  previewItems?: PlaylistCreatePreview[];
  onClose: () => void;
  onCreated?: () => void;
}

const getPosterUrl = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/w500${path}` : "";

export default function PlaylistCreateModal({
  open,
  videoIds,
  previewItems = [],
  onClose,
  onCreated,
}: PlaylistCreateModalProps) {
  const createMyCustomPlaylist = usePlayListStore(
    (state) => state.createMyCustomPlaylist,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMoodTags, setSelectedMoodTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose, open]);

  if (!open) return null;

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSelectedMoodTags([]);
    setIsPublic(false);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const toggleMoodTag = (tag: string) => {
    setSelectedMoodTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const playlistTitle = title.trim();

    if (!playlistTitle || videoIds.length === 0) {
      showToast("제목과 최소 하나 이상의 영상을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createMyCustomPlaylist({
        name: playlistTitle,
        content: description.trim(),
        videoIds,
        isShare: isPublic,
        tags: selectedMoodTags,
      });
      resetForm();
      onClose();
      onCreated?.();
      showToast("플레이리스트가 생성되었습니다.");
    } catch (error) {
      console.error("플레이리스트 생성 실패:", error);
      showToast("플레이리스트 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-create-title"
      >
        <form onSubmit={handleSubmit}>
          <div className={styles.header}>
            <div>
              <div className={styles.titleArea}>
                <img src="/images/playlist/playlist-icon.svg" alt="" />
                <h3 id="playlist-create-title">플레이리스트 만들기</h3>
              </div>
              <p>{videoIds.length}개 작품으로 새 플레이리스트를 만들어요</p>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={closeModal}
              aria-label="만들기 창 닫기"
            >
              ×
            </button>
          </div>

          {previewItems.length > 0 && (
            <div className={styles.previewStrip} aria-label="선택된 콘텐츠">
              {previewItems.slice(0, 6).map((item) => {
                const posterUrl = getPosterUrl(item.posterPath);
                return (
                  <span key={item.id}>
                    {posterUrl && <img src={posterUrl} alt={item.title ?? ""} />}
                  </span>
                );
              })}
              {videoIds.length > 6 && <em>+{videoIds.length - 6}</em>}
            </div>
          )}

          <div className={styles.fieldStack}>
            <label>
              <span>제목</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="플레이리스트 이름"
                autoFocus
              />
            </label>
            <label>
              <span>설명</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="플레이리스트 설명"
              />
            </label>
          </div>

          <div className={styles.section}>
            <strong>무드 태그</strong>
            <div className={styles.moodTags}>
              {PLAYLIST_MOOD_TAGS.map((mood) => (
                <button
                  type="button"
                  key={mood.path}
                  className={
                    selectedMoodTags.includes(mood.title) ? styles.active : ""
                  }
                  onClick={() => toggleMoodTag(mood.title)}
                >
                  <img src={mood.imgUrl} alt="" />
                  {mood.title}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <strong>커뮤니티 공개 여부</strong>
            <button
              type="button"
              className={`${styles.visibilityButton} ${
                isPublic ? styles.active : ""
              }`}
              onClick={() => setIsPublic((current) => !current)}
              aria-pressed={isPublic}
            >
              커뮤니티 공개
            </button>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={closeModal}>
              취소
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={!title.trim() || videoIds.length === 0 || isSubmitting}
            >
              {isSubmitting ? "만드는 중..." : "만들기"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
