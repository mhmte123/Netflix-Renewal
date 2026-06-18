"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth, db } from "@/firebase/firebase";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { useConfirmModal } from "@/components/common/ConfirmModal";
import type { PayInfo, UserProfile } from "@/types/auth";
import { useAuthStore } from "@/store/useAuthStore";
import "../scss/settings.scss";

const MAX_PROFILES = 6;
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
  {
    title: "오렌지 이즈 더 뉴 블랙",
    icons: iconPaths("orange_is_the_new_black", 10),
  },
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

// 로그인 제공자 라벨
const PROVIDER_LABELS: Record<string, string> = {
  google: "구글 계정",
  kakao: "카카오 계정",
  naver: "네이버 계정",
};

type TabKey = "account" | "membership" | "profile";

const TABS: { key: TabKey; label: string }[] = [
  { key: "account", label: "계정 정보" },
  { key: "membership", label: "멤버십 / 결제" },
  { key: "profile", label: "프로필 관리" },
];

// ==========================================
// Sub-components
// ==========================================
function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="acset-row">
      <div>
        <div className="acset-row-label">{label}</div>
        {desc && <div className="acset-row-desc">{desc}</div>}
      </div>
      <div className="acset-row-action">{children}</div>
    </div>
  );
}

// ==========================================
// Main Content Component
// ==========================================
function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, modal: confirmModal } = useConfirmModal();
  const initialTab = searchParams.get("tab");

  const [active, setActive] = useState<TabKey>(
    TABS.some((tab) => tab.key === initialTab)
      ? (initialTab as TabKey)
      : "account",
  );

  const { user, onAddProfile, onLogout } = useAuthStore();

  // Firestore에서 플랜/결제 정보 불러오기
  const [planType, setPlanType] = useState<string>("");
  const [payInfo, setPayInfo] = useState<PayInfo | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);

  useEffect(() => {
    if (active !== "membership") return; // membership 탭일 때만 실행

    const uid = user?.userId ?? auth.currentUser?.uid;
    if (!uid) return;

    let isMounted = true;

    const loadMembership = async () => {
      setMembershipLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (!isMounted || !snap.exists()) return;

        const data = snap.data();
        setPlanType(data.planType ?? "");
        setPayInfo(data.payment ?? null);
      } finally {
        if (isMounted) {
          setMembershipLoading(false);
        }
      }
    };

    void loadMembership();

    return () => {
      isMounted = false;
    };
  }, [user?.userId, active]); // active 추가

  // 플랜 이름 변환
  const planLabel = (() => {
    if (planType === "basic") return "베이직";
    if (planType === "standard") return "스탠다드";
    if (planType === "premium") return "프리미엄";
    return planType || "없음";
  })();

  // 결제 수단 텍스트
  const payLabel = (() => {
    if (!payInfo?.pay) return "등록된 결제 수단 없음";
    if (payInfo.pay === "card") return `카드 ****-${payInfo.num}`;
    if (payInfo.pay === "kakao") return "카카오페이";
    if (payInfo.pay === "naver") return "네이버페이";
    if (payInfo.pay === "transfer") return `계좌이체 (${payInfo.bank})`;
    if (payInfo.pay === "phone") return `휴대폰 결제 (${payInfo.bank})`;
    return "결제 수단";
  })();

  // 💥 BUG FIX: profiles에는 배열 자체를 대입하고 fallback은 빈 배열로 처리합니다.
  const profileList = user?.profile ?? [];
  const profileCount = profileList.length;

  const [deleteError, setDeleteError] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isProfileAddOpen, setIsProfileAddOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [draftProfileName, setDraftProfileName] = useState("새 프로필");
  const [draftProfileAvatar, setDraftProfileAvatar] = useState(
    AVATAR_OPTIONS[0],
  );
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const activeTab = TABS.find((tab) => tab.key === active);

  const openProfileAdd = () => {
    // 💥 BUG FIX: profiles.length 대신 올바른 카운트 변수(profileCount) 사용
    const fallbackAvatar = AVATAR_OPTIONS[profileCount % AVATAR_OPTIONS.length];
    setDraftProfileName("새 프로필");
    setDraftProfileAvatar(fallbackAvatar);
    setIsAvatarPickerOpen(false);
    setIsProfileAddOpen(true);
  };

  const closeProfileAdd = () => {
    setIsProfileAddOpen(false);
    setDraftProfileName("새 프로필");
    setDraftProfileAvatar(AVATAR_OPTIONS[0]);
    setIsAvatarPickerOpen(false);
  };

  useEffect(() => {
    if (!isProfileAddOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isProfileAddOpen]);

  const handleAddProfile = () => {
    if (profileCount >= MAX_PROFILES) return;

    onAddProfile({
      nickname: draftProfileName.trim() || "새 프로필",
      imgUrl: draftProfileAvatar,
      viewAge: "",
      movies: {
        watchingVideos: [], // 시청 중인 영상 ID 목록
        wishlist: [], // 찜한 영상 ID 목록
        playlist: {
          playlistVideos: [], // 플레이리스트 영상 ID 목록
          customPlaylists: [], // 커스텀 플레이리스트 ID 목록
        },
        genreStats: {}, // 장르별 시청 횟수 통계
        countryStats: {},
      },
      community: {
        followers: [], // 나를 팔로우하는 유저 ID 목록
        following: [], // 내가 팔로우하는 유저 ID 목록
        reviews: [], // 좋아요/싫어요/신고한 리뷰 ID 목록
        // 다른 피드에 남긴 댓글/좋아요 활동 기록
        likedfeeds: [],
        commentfeeds: [],
        reportfeeds: []
      },
      headerMenus: [], // 헤더에 표시할 메뉴 ID 목록
      badges: {
        earnedBadges: [], // 획득한 뱃지 목록
        equippedBadges: "", // 현재 장착 중인 뱃지 ID
      },
      alarm: [], // 알림 설정한 영상 ID 목록
      isCommunity: true,
    });
    closeProfileAdd();
  };

  const openPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setPasswordError("");
    setPasswordSuccess("");
    setIsPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      setPasswordError("모든 항목을 입력해 주세요.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("새 비밀번호가 현재 비밀번호와 같습니다.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      setPasswordError("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      setPasswordSuccess("비밀번호가 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" &&
          err !== null &&
          "code" in err &&
          typeof err.code === "string"
          ? err.code
          : "";

      if (errorCode === "auth/wrong-password" || errorCode === "auth/invalid-credential") {
        setPasswordError("현재 비밀번호가 올바르지 않습니다.");
      } else if (errorCode === "auth/too-many-requests") {
        setPasswordError("너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } else if (errorCode === "auth/weak-password") {
        setPasswordError("비밀번호가 너무 약합니다. 다른 비밀번호를 사용해 주세요.");
      } else if (errorCode === "auth/requires-recent-login") {
        setPasswordError("보안을 위해 다시 로그인한 뒤 시도해 주세요.");
      } else {
        setPasswordError("비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid ?? user?.userId; // 👈 카카오/네이버 uid도 포함
    if (!uid) {
      setDeleteError("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }

    const confirmed = await confirm({
      title: "회원 탈퇴",
      message: "회원 탈퇴 시 계정과 저장된 프로필 정보가 삭제됩니다. 계속할까요?",
      confirmLabel: "탈퇴",
    });
    if (!confirmed) return;

    setIsDeletingAccount(true);
    setDeleteError("");

    try {
      // Firestore 문서 삭제
      await deleteDoc(doc(db, "users", uid));

      // Firebase Auth 유저면 Auth도 삭제
      if (currentUser) {
        await deleteUser(currentUser);
      }

      // 로컬 스토리지 정리 + 로그아웃
      window.localStorage.removeItem("netflix-auth-storage");
      await onLogout();
      router.replace("/login");

    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" &&
          err !== null &&
          "code" in err &&
          typeof err.code === "string"
          ? err.code
          : "";

      if (errorCode === "auth/requires-recent-login") {
        setDeleteError(
          "보안을 위해 다시 로그인한 뒤 회원 탈퇴를 진행해 주세요.",
        );
      } else {
        setDeleteError("회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="acset-page">
      {confirmModal}
      <div className="acset-container">
        <div className="acset-top">
          <h1 className="acset-title">설정</h1>
          <p className="acset-subtitle">계정과 프로필 환경을 관리합니다.</p>
        </div>

        <div className="acset-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`acset-tab${active === tab.key ? " is-active" : ""}`}
              onClick={() => setActive(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="acset-panel">
          <div className="acset-panel-head">
            <h2>{activeTab?.label}</h2>
          </div>

          <div className="acset-panel-body">
            {active === "account" && (
              <>
                <Row label="이메일" desc="로그인에 사용하는 이메일">
                  <span className="acset-row-value">
                    {user?.email ?? "user@example.com"}
                    {user?.provider && PROVIDER_LABELS[user.provider] && (
                      <span className="acset-badge">
                        {PROVIDER_LABELS[user.provider]}
                      </span>
                    )}
                  </span>
                </Row>
                {(user?.provider ?? "email") === "email" && (
                  <Row
                    label="비밀번호"
                    desc="계정 보안을 위해 주기적으로 변경하세요."
                  >
                    <button
                      type="button"
                      className="acset-btn"
                      onClick={openPasswordModal}
                    >
                      비밀번호 변경
                    </button>
                  </Row>
                )}
                <Row label="회원 탈퇴" desc="계정과 프로필 정보가 삭제됩니다.">
                  <button
                    type="button"
                    className="acset-btn danger"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? "처리 중" : "회원 탈퇴"}
                  </button>
                </Row>
                {deleteError && <p className="acset-error">{deleteError}</p>}
              </>
            )}

            {active === "membership" && (
              <>
                {membershipLoading ? (
                  <p className="acset-row-desc" style={{ padding: "20px 0" }}>
                    불러오는 중...
                  </p>
                ) : planType ? (
                  // 구독 중일 때
                  <>
                    <div className="acset-plan-box">
                      <div>
                        <div className="acset-plan-name">{planLabel}</div>
                        <div className="acset-plan-price">
                          다음 결제일 {payInfo?.nextDate ?? "-"}
                        </div>
                      </div>
                      <div className="acset-plan-actions">
                        <Link href="/plan" className="acset-btn">플랜 변경</Link>
                        <Link href="/cancel" className="acset-btn danger">해지</Link>
                      </div>
                    </div>
                    <Row label="결제 수단" desc={payLabel}>
                      <Link href="/payment" className="acset-btn">관리</Link>
                    </Row>
                  </>
                ) : payInfo?.nextDate ? (
                  // 해지했지만 아직 만료 전일 때
                  <div style={{ padding: "32px 0", textAlign: "center" }}>
                    <p style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
                      해지 예약됨
                    </p>
                    <p className="acset-row-desc" style={{ marginBottom: "24px" }}>
                      {payInfo.nextDate}에 멤버십이 만료돼요. 그 전까지는
                      {payInfo.lastPlanType ? ` ${(() => {
                        if (payInfo.lastPlanType === "basic") return "베이직";
                        if (payInfo.lastPlanType === "standard") return "스탠다드";
                        if (payInfo.lastPlanType === "premium") return "프리미엄";
                        return "";
                      })()} 플랜을` : ""} 자유롭게 이용하세요.
                    </p>
                    <Link href="/plan" className="acset-btn red">
                      다시 구독하기
                    </Link>
                  </div>
                ) : (
                  // 구독 중이 아닐 때
                  <div style={{ padding: "32px 0", textAlign: "center" }}>
                    <p style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
                      현재 구독 중인 플랜이 없어요
                    </p>
                    <p className="acset-row-desc" style={{ marginBottom: "24px" }}>
                      지금 구독하고 12,000편 이상의 콘텐츠를 무제한으로 즐겨보세요.
                    </p>
                    <Link href="/plan" className="acset-btn red">
                      구독하기
                    </Link>
                  </div>
                )}
              </>
            )}

            {active === "profile" && (
              <div className="acset-profile-grid">
                {profileList.map((profile: UserProfile) => (
                  <Link
                    key={profile.id}
                    href={`/profiles/settings?profileId=${profile.id}`}
                    className="acset-profile-card"
                  >
                    <div className="acset-profile-avatar">
                      <img
                        src={
                          profile.imgUrl ??
                          "/images/profile/image/default_icons/17.png"
                        }
                        alt={profile.nickname ?? "프로필"}
                      />
                    </div>
                    <span className="acset-profile-name">
                      {profile.nickname ?? "프로필"}
                    </span>
                  </Link>
                ))}
                {profileCount < MAX_PROFILES && (
                  <button
                    type="button"
                    className="acset-profile-card"
                    onClick={openProfileAdd}
                  >
                    <div
                      className="acset-profile-avatar acset-profile-add"
                      aria-hidden="true"
                    >
                      +
                    </div>
                    <span className="acset-profile-name">프로필 추가</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isProfileAddOpen && (
        <div
          className="acset-profile-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="프로필 추가"
          onClick={closeProfileAdd}
        >
          <div
            className="acset-profile-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="acset-profile-modal-head">
              <h2>프로필 추가</h2>
              <button type="button" onClick={closeProfileAdd} aria-label="닫기">
                ×
              </button>
            </div>

            {isAvatarPickerOpen ? (
              <div className="acset-profile-picker">
                <button
                  type="button"
                  className="acset-profile-picker-back"
                  onClick={() => setIsAvatarPickerOpen(false)}
                >
                  <span aria-hidden="true" />
                  돌아가기
                </button>
                <h3>프로필 사진 선택</h3>
                <div className="acset-profile-picker-current">
                  <span>{draftProfileName || "새 프로필"} 님</span>
                  <img src={draftProfileAvatar} alt="선택한 아바타 미리보기" />
                </div>

                {PROFILE_ICON_SECTIONS.map((section) => (
                  <section
                    key={section.title}
                    className="acset-profile-picker-section"
                  >
                    <h4>{section.title}</h4>
                    <div className="acset-profile-picker-grid">
                      {section.icons.map((iconSrc) => (
                        <button
                          key={iconSrc}
                          type="button"
                          className={
                            draftProfileAvatar === iconSrc ? "is-selected" : ""
                          }
                          onClick={() => {
                            setDraftProfileAvatar(iconSrc);
                            setIsAvatarPickerOpen(false);
                          }}
                          aria-label={`${section.title} ${iconSrc.split("/").pop()}번 이미지 선택`}
                        >
                          <img src={iconSrc} alt="" />
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="acset-profile-modal-body">
                <img
                  className="acset-profile-modal-avatar"
                  src={draftProfileAvatar}
                  alt="현재 선택된 아바타"
                />
                <label className="acset-profile-field">
                  <span>프로필 이름</span>
                  <input
                    value={draftProfileName}
                    maxLength={12}
                    onChange={(event) =>
                      setDraftProfileName(event.target.value)
                    }
                  />
                </label>

                <div className="acset-profile-avatar-options-head">
                  <span>프로필 사진</span>
                  <button
                    type="button"
                    onClick={() => setIsAvatarPickerOpen(true)}
                  >
                    더 많은 프로필 보러가기
                  </button>
                </div>

                <div
                  className="acset-profile-avatar-options"
                  aria-label="프로필 이미지 선택"
                >
                  {AVATAR_OPTIONS.map((avatar, idx) => (
                    <button
                      key={avatar}
                      type="button"
                      className={
                        draftProfileAvatar === avatar ? "is-selected" : ""
                      }
                      onClick={() => setDraftProfileAvatar(avatar)}
                      aria-label={`기본 아바타 옵션 ${idx + 1}`}
                    >
                      <img src={avatar} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="acset-profile-modal-footer">
              <button type="button" onClick={closeProfileAdd}>
                취소
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={handleAddProfile}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div
          className="acset-profile-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="비밀번호 변경"
        >
          <div
            className="acset-profile-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="acset-profile-modal-head">
              <h2>비밀번호 변경</h2>
              <button type="button" onClick={closePasswordModal} aria-label="닫기">
                ×
              </button>
            </div>

            <div className="acset-profile-modal-body">
              <label className="acset-profile-field">
                <span>현재 비밀번호</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className="acset-profile-field">
                <span>새 비밀번호</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="8자 이상 입력"
                />
              </label>
              <label className="acset-profile-field">
                <span>새 비밀번호 확인</span>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(event) => setNewPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              {passwordError && <p className="acset-error">{passwordError}</p>}
              {passwordSuccess && (
                <p className="acset-row-desc" style={{ color: "#2ecc71" }}>
                  {passwordSuccess}
                </p>
              )}
            </div>

            <div className="acset-profile-modal-footer">
              <button type="button" onClick={closePasswordModal}>
                닫기
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={handleChangePassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? "변경 중..." : "변경하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}