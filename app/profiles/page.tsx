"use client";

import React, { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProfilePinGate, { getProfilePin } from "@/components/ProfilePinGate";
import ProfileSwitchOverlay from "@/components/ProfileSwitchOverlay";
import { useAuthStore } from "@/store/useAuthStore";
import type { UserProfile } from "@/types/auth"; // 👈 UserProfile 타입으로 유지
import "../scss/profileSelect.scss";

const AVATAR_OPTIONS = [
  "/images/profile/image/default_icons/17.png",
  "/images/profile/image/default_icons/18.png",
  "/images/profile/image/default_icons/19.png",
  "/images/profile/image/default_icons/20.png",
  "/images/profile/image/default_icons/21.png",
  "/images/profile/image/default_icons/22.png",
];

const iconPaths = (folder: string, count: number, extension = "png") =>
  Array.from(
    { length: count },
    (_, index) => `/images/profile/image/${folder}/${index + 1}.${extension}`,
  );

const PROFILE_ICON_SECTIONS = [
  { title: "대표 아이콘", icons: iconPaths("default_icons", 23) },
  { title: "데몬과 헌터스", icons: iconPaths("demons_and_hunters", 6, "jpg") },
  { title: "앨리스 인 보더랜드", icons: iconPaths("alice_in_borderland", 12) },
  { title: "아케인", icons: iconPaths("arcane", 12) },
  { title: "뷰티 인 블랙", icons: iconPaths("beauty_in_black", 12) },
  { title: "블랙 미러", icons: iconPaths("black_mirror", 8) },
  { title: "보스 베이비", icons: iconPaths("boss_baby", 11) },
  { title: "브리저튼", icons: iconPaths("bridgerton", 16) },
  { title: "다크", icons: iconPaths("dark", 11) },
  { title: "엘리트", icons: iconPaths("elite", 16) },
  { title: "개비의 매직 하우스", icons: iconPaths("gabbys_dollhouse", 10) },
  { title: "케이팝 데몬 헌터스", icons: iconPaths("kpop_demon_hunters", 11) },
  { title: "라바 아일랜드", icons: iconPaths("larva_island", 9) },
  { title: "로스트 인 스페이스", icons: iconPaths("lost_in_space", 9) },
  { title: "러브, 데스 + 로봇", icons: iconPaths("love_death_robots", 6) },
  { title: "루시퍼", icons: iconPaths("lucifer", 8) },
  { title: "종이의 집", icons: iconPaths("money_heist", 10) },
  { title: "마이 멜로디 & 쿠로미", icons: iconPaths("my_melody_kuromi", 16) },
  { title: "원피스", icons: iconPaths("one_piece", 18) },
  { title: "오렌지 이즈 더 뉴 블랙", icons: iconPaths("orange_is_the_new_black", 10) },
  { title: "피키 블라인더스", icons: iconPaths("peaky_blinders", 6) },
  { title: "레트로 애니메이션", icons: iconPaths("retro_animation", 8) },
  { title: "소닉 프라임", icons: iconPaths("sonic_prime", 21) },
  { title: "오징어 게임", icons: iconPaths("squid_game", 20) },
  { title: "기묘한 이야기", icons: iconPaths("stranger_things", 21) },
  { title: "더 크라운", icons: iconPaths("the_crown", 14) },
  { title: "웬즈데이", icons: iconPaths("wednesday", 13) },
  { title: "웬즈데이 방", icons: iconPaths("wednesday_room", 11) },
  { title: "위쳐", icons: iconPaths("witcher", 8) },
  { title: "WWE RAW", icons: iconPaths("wwe_raw", 8) },
];

function ProfileSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, onSetProfile, onAddProfile, onUpdateProfile, onDeleteProfile } = useAuthStore();
  
  const profiles = useMemo(
    () => user?.profile || [],
    [user?.profile]
  );
  
  const manageMode = searchParams.get("manage") === "1";
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState(AVATAR_OPTIONS[0]);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [switchingProfile, setSwitchingProfile] = useState<UserProfile | null>(null);
  const [switchOverlayPhase, setSwitchOverlayPhase] = useState<"enter" | "exit">("enter");

  const openEditor = (profile?: UserProfile) => {
    const fallbackAvatar = AVATAR_OPTIONS[profiles.length % AVATAR_OPTIONS.length];
    
    // 오타 수정 및 정확한 기본 객체 구조 세팅
    setEditingProfile(profile ?? { id: 0, nickname: "새 프로필", imgUrl: fallbackAvatar } as UserProfile);
    setDraftName(profile?.nickname || "새 프로필");
    setDraftAvatar(profile?.imgUrl ?? fallbackAvatar);
    setIsAvatarPickerOpen(false);
  };

  const closeEditor = () => {
    setEditingProfile(null);
    setDraftName("");
    setDraftAvatar(AVATAR_OPTIONS[0]);
    setIsAvatarPickerOpen(false);
  };

  const isDefaultProfile = (profile: UserProfile | null) =>
    Boolean(profile && profiles[0]?.id === profile.id);

  const runProfileSwitch = async (profile: UserProfile) => {
    setSwitchOverlayPhase("enter");
    setSwitchingProfile(profile);
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    onSetProfile(profile);
    const s = profile.settings;
    let done = false;
    try {
      done = typeof window !== "undefined" && !!localStorage.getItem(`onboarded:${profile.id}`);
    } catch {}
    const noTaste = !s?.favoriteGenres?.length && !s?.favoriteMoods?.length;
    const dest = noTaste && !done ? "/onboarding" : "/";
    // 오버레이 페이드아웃 후 이동
    setSwitchOverlayPhase("exit");
    await new Promise((resolve) => window.setTimeout(resolve, 720));
    router.replace(dest);
  };

  const handleSelect = (profile: UserProfile) => {
    if (manageMode) {
      openEditor(profile);
      return;
    }

    if (getProfilePin(profile.id)) {
      setPendingProfile(profile);
      return;
    }

    void runProfileSwitch(profile);
  };

  const confirmPendingProfile = () => {
    if (!pendingProfile) return;
    const selectedProfile = pendingProfile;
    setPendingProfile(null);
    void runProfileSwitch(selectedProfile);
  };

  const handleSave = () => {
    if (!editingProfile) return;

    const nextProfile = {
      ...editingProfile,
      nickname: draftName.trim() || "프로필",
      imgUrl: draftAvatar,
    };

    if (editingProfile.id === 0) {
      onAddProfile(nextProfile);
    } else {
      onUpdateProfile(nextProfile);
    }
    closeEditor();
  };

  const handleDelete = () => {
    if (!editingProfile || editingProfile.id === 0 || isDefaultProfile(editingProfile)) return;
    onDeleteProfile(editingProfile.id);
    closeEditor();
  };

  return (
    <section className="profile-select" aria-label="프로필 선택">
      <div className="profile-select-inner">
        <h1 className="ps-title">
          {manageMode ? "프로필 관리" : "넷플릭스를 시청할 프로필을 선택하세요."}
        </h1>

        <ul className="ps-grid">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                className={`ps-item${manageMode ? " is-edit" : ""}`}
                onClick={() => handleSelect(profile as UserProfile)}
              >
                <div className="ps-avatar">
                  <img
                    src={profile.imgUrl || "/images/profile/image/default_icons/17.png"}
                    alt={profile.nickname || "프로필"}
                  />
                  {manageMode && <span className="ps-edit-icon" aria-hidden="true">✎</span>}
                </div>
                <span className="ps-name">{profile.nickname}</span>
              </button>
            </li>
          ))}

          {profiles.length < 5 && (
            <li>
              <button type="button" className="ps-item" onClick={() => openEditor()}>
                <div className="ps-avatar ps-avatar-add" aria-hidden="true">+</div>
                <span className="ps-name">프로필 추가</span>
              </button>
            </li>
          )}
        </ul>

        <button
          type="button"
          className={`ps-manage${manageMode ? " is-active" : ""}`}
          onClick={() => router.replace(manageMode ? "/profiles" : "/profiles?manage=1")}
        >
          {manageMode ? "완료" : "프로필 관리"}
        </button>
      </div>

      {editingProfile && (
        <div className="profile-editor-backdrop" role="dialog" aria-modal="true" aria-label="프로필 편집">
          <div className="profile-editor">
            <div className="profile-editor-head">
              <h2>{editingProfile.id === 0 ? "프로필 추가" : "프로필 편집"}</h2>
              <button type="button" className="profile-editor-close" onClick={closeEditor} aria-label="닫기">
                ×
              </button>
            </div>

            {isAvatarPickerOpen ? (
              <div className="profile-editor-picker">
                <button
                  type="button"
                  className="profile-editor-picker-back"
                  onClick={() => setIsAvatarPickerOpen(false)}
                >
                  <span aria-hidden="true" />
                  돌아가기
                </button>
                <h3>프로필 사진 선택</h3>
                <div className="profile-editor-picker-current">
                  <span>{draftName || "프로필"} 님</span>
                  <img src={draftAvatar} alt="" />
                </div>

                {PROFILE_ICON_SECTIONS.map((section) => (
                  <section key={section.title} className="profile-editor-picker-section">
                    <h4>{section.title}</h4>
                    <div className="profile-editor-picker-grid">
                      {section.icons.map((iconSrc) => (
                        <button
                          key={iconSrc}
                          type="button"
                          className={draftAvatar === iconSrc ? "is-selected" : ""}
                          onClick={() => {
                            setDraftAvatar(iconSrc);
                            setIsAvatarPickerOpen(false);
                          }}
                          aria-label={`${section.title} 프로필 사진 선택`}
                        >
                          <img src={iconSrc} alt="" />
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="profile-editor-body">
                <img className="profile-editor-avatar" src={draftAvatar} alt="" />
                <label className="profile-editor-field">
                  <span>프로필 이름</span>
                  <input
                    value={draftName}
                    maxLength={12}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </label>

                <div className="profile-avatar-options-head">
                  <span>프로필 사진</span>
                  <button type="button" onClick={() => setIsAvatarPickerOpen(true)}>
                    더 많은 프로필 보러가기
                  </button>
                </div>

                <div className="profile-avatar-options" aria-label="아바타 선택">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      className={draftAvatar === avatar ? "is-selected" : ""}
                      onClick={() => setDraftAvatar(avatar)}
                      aria-label="아바타 선택"
                    >
                      <img src={avatar} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="profile-editor-actions">
              {editingProfile.id !== 0 && profiles.length > 1 && !isDefaultProfile(editingProfile) && (
                <button type="button" className="profile-editor-delete" onClick={handleDelete}>
                  삭제
                </button>
              )}
              <button type="button" onClick={closeEditor}>취소</button>
              <button type="button" className="is-primary" onClick={handleSave}>저장</button>
            </div>
          </div>
        </div>
      )}

      {pendingProfile && (
        <ProfilePinGate
          key={pendingProfile.id}
          profile={pendingProfile}
          description={`${pendingProfile.nickname ?? "프로필"} 프로필을 선택하려면 PIN을 입력해 주세요.`}
          onCancel={() => setPendingProfile(null)}
          onSuccess={confirmPendingProfile}
        />
      )}
      <ProfileSwitchOverlay phase={switchOverlayPhase} profile={switchingProfile} />
    </section>
  );
}

export default function ProfileSelectPage() {
  return (
    <Suspense fallback={null}>
      <ProfileSelectContent />
    </Suspense>
  );
}
