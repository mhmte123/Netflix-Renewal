"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useFollowStore } from "@/store/useFollowStore";
import {
  canProfileAccessWatchParty,
  getWatchPartyActorId,
  type PartyDoc,
  useWatchPartyStore,
} from "@/store/useWatchPartyStore";
import { showToast } from "@/store/useToastStore";
import RepBadge from "@/components/common/RepBadge";
import "./watchPartyModal.scss";

const DEFAULT_PROFILE_IMAGE = "/images/profile/image/default_icons/17.png";

interface WatchPartyModalProps {
  mode?: "create" | "invite" | "join";
  media?: {
    type: "movie" | "tv";
    mediaId: number;
    title: string;
    posterPath?: string;
    backdropPath?: string;
  };
  party?: PartyDoc | null;
  initialParty?: PartyDoc | null;
  onClose: () => void;
}

export default function WatchPartyModal({
  mode = "create",
  media,
  party,
  initialParty,
  onClose,
}: WatchPartyModalProps) {
  const router = useRouter();
  const { user, currentProfile } = useAuthStore();
  const { followingUsers, isLoadingFollowing, fetchFollowingUsers } =
    useFollowStore();
  const {
    invitedParties,
    createParty,
    updateInvitedProfiles,
    verifyPartyPassword,
    loadInvitedParties,
  } = useWatchPartyStore();
  const userId = user?.userId ?? "";
  const [partyName, setPartyName] = useState(
    media?.title ? `${media.title} 같이보기` : "",
  );
  const [inviteOnly, setInviteOnly] = useState(mode === "invite");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    mode === "invite" ? (party?.invitedProfileIds ?? []) : [],
  );
  const [existingInvitedIds, setExistingInvitedIds] = useState<string[]>(
    mode === "invite" ? (party?.invitedProfileIds ?? []) : [],
  );
  const inviteSelectionHydratedRef = useRef(
    mode !== "invite" || party?.invitedProfileIds !== undefined,
  );
  const [partyPassword, setPartyPassword] = useState("");
  const [joinError, setJoinError] = useState("");
  const [pendingParty, setPendingParty] = useState(initialParty ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void fetchFollowingUsers();
    if (userId && currentProfile) {
      void loadInvitedParties(userId, currentProfile.id);
    }
  }, [currentProfile, fetchFollowingUsers, loadInvitedParties, userId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (
      inviteSelectionHydratedRef.current ||
      mode !== "invite" ||
      !party ||
      isLoadingFollowing
    ) {
      return;
    }

    const legacyInvitedUserIds = new Set(party.invitedUserIds ?? []);
    const legacySelectedIds = followingUsers
      .filter((friend) => legacyInvitedUserIds.has(friend.userId))
      .map((friend) => getWatchPartyActorId(friend.userId, friend.profileId));
    setSelectedIds(legacySelectedIds);
    setExistingInvitedIds(legacySelectedIds);
    inviteSelectionHydratedRef.current = true;
  }, [followingUsers, isLoadingFollowing, mode, party]);

  const selectedUsers = useMemo(
    () =>
      followingUsers.filter((item) =>
        selectedIds.includes(getWatchPartyActorId(item.userId, item.profileId)),
      ),
    [followingUsers, selectedIds],
  );

  const canAccess = (target: PartyDoc) =>
    canProfileAccessWatchParty(target, userId, currentProfile?.id);

  const enterParty = (target: PartyDoc) => {
    if (!canAccess(target)) {
      setPendingParty(target);
      showToast("초대받은 사용자만 입장할 수 있는 파티예요.");
      return;
    }
    router.push(
      `/watch/${target.type}/${target.mediaId}?party=${target.partyId}`,
    );
    onClose();
  };

  const handleLookup = async () => {
    setJoinError("");

    if (!initialParty?.partyId) {
      setJoinError("파티 정보를 확인할 수 없습니다.");
      return;
    }

    if (!/^\d{4}$/.test(partyPassword)) {
      setJoinError("숫자 4자리 암호를 입력해 주세요.");
      showToast("숫자 4자리 파티 암호를 입력해 주세요.");
      return;
    }

    if (!userId || !currentProfile) {
      setJoinError("로그인한 사용자만 초대 전용 파티에 입장할 수 있습니다.");
      return;
    }

    setIsSubmitting(true);
    const admittedParty = await verifyPartyPassword(
      initialParty.partyId,
      partyPassword,
    );
    setIsSubmitting(false);

    if (!admittedParty) {
      setJoinError("암호가 올바르지 않습니다.");
      showToast("파티 암호가 틀렸습니다.");
      return;
    }

    router.push(
      `/watch/${admittedParty.type}/${admittedParty.mediaId}?party=${admittedParty.partyId}&code=${encodeURIComponent(partyPassword)}`,
    );
    onClose();
  };

  const handleCreate = async () => {
    if (!media || !currentProfile || !userId) {
      showToast("로그인 후 프로필을 선택해 주세요.");
      return;
    }
    if (!partyName.trim()) {
      showToast("파티 이름을 입력해 주세요.");
      return;
    }
    if (inviteOnly && selectedIds.length === 0) {
      showToast("초대할 팀원을 한 명 이상 선택해 주세요.");
      return;
    }
    if (inviteOnly && !/^\d{4}$/.test(partyPassword)) {
      showToast("숫자 4자리 파티 암호를 입력해 주세요.");
      return;
    }
    setIsSubmitting(true);
    const partyId = await createParty({
      ...media,
      partyName: partyName.trim(),
      invitedProfileIds: inviteOnly ? selectedIds : [],
      partyPassword: inviteOnly ? partyPassword : undefined,
      host: {
        userId,
        nickname: currentProfile.nickname,
        profileId: currentProfile.id,
        imgUrl: currentProfile.imgUrl,
        badge: currentProfile.badges?.equippedBadges,
      },
    });
    setIsSubmitting(false);
    if (!partyId) {
      showToast("파티를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    router.push(`/watch/${media.type}/${media.mediaId}?party=${partyId}`);
    onClose();
  };

  const handleInvite = async () => {
    if (!party?.partyId) return;
    setIsSubmitting(true);
    if (!currentProfile) {
      setIsSubmitting(false);
      return;
    }
    const succeeded = await updateInvitedProfiles(party.partyId, selectedIds, {
      userId,
      profileId: currentProfile.id,
      nickname: currentProfile.nickname,
      imgUrl: currentProfile.imgUrl,
      badge: currentProfile.badges?.equippedBadges,
    });
    setIsSubmitting(false);
    showToast(
      succeeded
        ? selectedIds.length > 0
          ? `${selectedIds.length}명의 초대 상태를 저장했어요.`
          : "초대된 팀원을 모두 해제했어요."
        : "초대 상태를 저장하지 못했어요.",
    );
    if (succeeded) onClose();
  };

  return (
    <div
      className={`watch-party-modal watch-party-modal--${mode}`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="watch-party-modal__backdrop"
        onClick={onClose}
        aria-label="모달 닫기"
      />
      <section
        className={`watch-party-modal__panel watch-party-modal__panel--${mode}`}
      >
        <button
          type="button"
          className="watch-party-modal__close"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="닫기"
        >
          ×
        </button>

        <div className="watch-party-modal__scroll">
          <div className="watch-party-modal__header">
            <span>NETFLIX PARTY</span>
            <h2>
              {mode === "invite"
                ? "파티에 초대하기"
                : mode === "join"
                  ? "파티 암호를 입력하세요"
                  : "같이보기 파티 만들기"}
            </h2>
            <p>
              {mode === "invite"
                ? "함께 볼 팀원을 추가로 초대할 수 있어요."
                : mode === "join"
                  ? "초대받지 않은 프로필은 숫자 4자리 암호가 필요해요."
                  : "파티 이름과 입장 방식을 정하고 바로 같이 시청해 보세요."}
            </p>
          </div>

          {mode === "create" && (
            <>
              <label className="watch-party-modal__field">
                <span>
                  파티 이름 <b>{partyName.length}/24</b>
                </span>
                <input
                  value={partyName}
                  maxLength={24}
                  onChange={(event) => setPartyName(event.target.value)}
                  placeholder="파티 이름을 입력해 주세요"
                />
              </label>

              <div className="watch-party-modal__access">
                <button
                  type="button"
                  className={!inviteOnly ? "is-active" : ""}
                  onClick={() => setInviteOnly(false)}
                >
                  <strong>누구나 입장</strong>
                  <span>Connect에서 바로 참여할 수 있어요.</span>
                </button>
                <button
                  type="button"
                  className={inviteOnly ? "is-active" : ""}
                  onClick={() => setInviteOnly(true)}
                >
                  <strong>초대 전용</strong>
                  <span>초대원은 바로, 다른 사용자는 암호로 입장해요.</span>
                </button>
              </div>
            </>
          )}

          {(mode === "invite" || inviteOnly) && (
            <div className="watch-party-modal__friends">
              <div className="watch-party-modal__section-title">
                <div>
                  <strong>초대할 사람</strong>
                  <span>내가 팔로잉하는 사용자</span>
                </div>
                <b>{selectedIds.length}명 선택</b>
              </div>
              {isLoadingFollowing ? (
                <p className="watch-party-modal__empty">
                  팔로잉 목록을 불러오는 중...
                </p>
              ) : followingUsers.length === 0 ? (
                <p className="watch-party-modal__empty">
                  초대할 수 있는 팔로잉이 아직 없어요.
                </p>
              ) : (
                <ul>
                  {followingUsers.map((friend) => {
                    const actorId = getWatchPartyActorId(
                      friend.userId,
                      friend.profileId,
                    );
                    const selected = selectedIds.includes(actorId);
                    const alreadyInvited = existingInvitedIds.includes(actorId);
                    return (
                      <li key={actorId}>
                        <button
                          type="button"
                          className={[
                            selected ? "is-selected" : "",
                            alreadyInvited ? "is-invited" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={alreadyInvited}
                          aria-label={
                            alreadyInvited
                              ? `${friend.nickname}, 이미 초대된 팀원`
                              : undefined
                          }
                          onClick={() =>
                            setSelectedIds((current) =>
                              selected
                                ? current.filter((id) => id !== actorId)
                                : [...current, actorId],
                            )
                          }
                        >
                          <Image
                            src={friend.imgUrl || DEFAULT_PROFILE_IMAGE}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                          />
                          <span>
                            <strong>{friend.nickname}</strong>
                            <RepBadge badge={friend.badge} size="sm" />
                          </span>
                          <i>
                            {alreadyInvited ? "초대됨" : selected ? "✓" : "+"}
                          </i>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {selectedUsers.length > 0 && (
                <p className="watch-party-modal__selection">
                  {selectedUsers.map((item) => item.nickname).join(", ")} 님을
                  초대합니다.
                </p>
              )}
            </div>
          )}

          {mode === "create" && inviteOnly && (
            <label className="watch-party-modal__field">
              <span>
                파티 암호
                <b>{partyPassword.length}/4</b>
              </span>
              <input
                value={partyPassword}
                inputMode="numeric"
                maxLength={4}
                onChange={(event) =>
                  setPartyPassword(event.target.value.replace(/\D/g, ""))
                }
                placeholder="숫자 4자리"
                autoComplete="off"
              />
            </label>
          )}

          {mode === "join" && (
            <div className="watch-party-modal__join">
              <div className="watch-party-modal__section-title">
                <div>
                  <strong>파티 암호</strong>
                  <span>파티 생성자가 설정한 숫자 4자리를 입력해 주세요.</span>
                </div>
              </div>
              <div>
                <input
                  value={partyPassword}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) => {
                    setPartyPassword(event.target.value.replace(/\D/g, ""));
                    if (joinError) setJoinError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleLookup();
                  }}
                  placeholder="숫자 4자리 암호"
                  autoComplete="off"
                  aria-invalid={joinError ? "true" : undefined}
                />
              </div>
              {joinError && (
                <p className="watch-party-modal__join-error" role="alert">
                  {joinError}
                </p>
              )}
              {pendingParty && !canAccess(pendingParty) && (
                <div className="watch-party-modal__locked-preview">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <div>
                    <strong>초대 전용 파티입니다</strong>
                    <p>
                      {pendingParty.partyName || pendingParty.title} ·{" "}
                      {pendingParty.hostNickname}님의 파티 · 암호 필요
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "create" && invitedParties.length > 0 && (
            <div className="watch-party-modal__invited">
              <div className="watch-party-modal__section-title">
                <div>
                  <strong>초대받은 파티</strong>
                  <span>최근 6시간 안에 초대받은 파티예요.</span>
                </div>
              </div>
              <ul>
                {invitedParties.map((target) => (
                  <li key={target.partyId}>
                    <button type="button" onClick={() => enterParty(target)}>
                      <span>
                        <b>{target.partyName || target.title}</b>
                        <small>
                          {target.hostNickname} · {target.title}
                        </small>
                      </span>
                      <em>입장</em>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="watch-party-modal__footer">
          {mode === "invite" ? (
            <button
              type="button"
              onClick={handleInvite}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "저장 중..."
                : `초대 상태 저장${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
            </button>
          ) : mode === "join" ? (
            <button
              type="button"
              onClick={handleLookup}
              disabled={isSubmitting}
            >
              {isSubmitting ? "확인 중..." : "확인"}
            </button>
          ) : (
            <>
              <button type="button" className="is-secondary" onClick={onClose}>
                취소
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting}
              >
                {isSubmitting ? "파티 만드는 중..." : "파티 만들기"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
