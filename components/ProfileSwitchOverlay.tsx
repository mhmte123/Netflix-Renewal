"use client";

import type { UserProfile } from "@/types/auth";

type ProfileSwitchOverlayProps = {
  phase: "enter" | "exit";
  profile: UserProfile | null;
};

export default function ProfileSwitchOverlay({
  phase,
  profile,
}: ProfileSwitchOverlayProps) {
  if (!profile) return null;

  return (
    <div
      className={`profile-switch-overlay is-${phase}`}
      aria-live="polite"
      aria-label={`${profile.nickname ?? "프로필"} 프로필로 전환 중`}
    >
      <div className="profile-switch-overlay__stage">
        <img
          className="profile-switch-overlay__loader"
          src="/images/main/loading.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="profile-switch-overlay__avatar"
          src={profile.imgUrl || "/images/profile/image/default_icons/17.png"}
          alt=""
        />
      </div>
    </div>
  );
}
