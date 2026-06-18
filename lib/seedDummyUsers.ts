import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { dummyPlaylists } from "@/data/dummyPlaylist";
import { BADGE_LIST } from "@/data/badge";

// 더미 플레이리스트의 badge 값은 '뱃지 이름'(취향 공유러 등)이므로 ID로 변환해 심는다.
const BADGE_NAME_TO_ID = new Map(BADGE_LIST.map((b) => [b.name, b.id]));

// 더미 플레이리스트의 제작자(dummy-*)들을 실제 Firestore 유저로 심는다.
// - users/{userId}      : 친구 "전체" 목록·검색에 잡히도록 profile[0] 포함 문서 생성
// - playlists/{userId}  : 해당 더미의 커스텀 플레이리스트 1개 저장
// 멱등(merge): 여러 번 실행해도 같은 문서를 덮어쓴다.
export async function seedDummyUsers(): Promise<{ ok: number; failed: number; errors: string[] }> {
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < dummyPlaylists.length; i++) {
    const d = dummyPlaylists[i];
    const profileId = 1000 + i; // 안정적인 프로필 ID
    const avatar = d.posters[0] ?? `/images/profile/image/default_icons/${(i % 23) + 1}.png`;

    // 더미의 badge 이름 → 뱃지 ID (대표 칭호). 매칭 실패 시 첫 스트리밍으로 폴백.
    const equippedBadgeId = BADGE_NAME_TO_ID.get(d.badge) ?? "first_streaming";

    const profile = {
      id: profileId,
      nickname: d.nickname,
      imgUrl: avatar,
      viewAge: "19",
      movies: {
        watchingVideos: [],
        wishlist: [],
        playlist: { playlistVideos: d.videoIds, customPlaylists: [] },
        genreStats: {},
        countryStats: {},
      },
      community: {
        followers: [],
        following: [],
        reviews: [],
        likedfeeds: [],
        commentfeeds: [],
        reportfeeds: [],
      },
      headerMenus: [],
      badges: {
        earnedBadges: [
          { id: "first_streaming", progress: 1, isComplete: true },
          ...(equippedBadgeId !== "first_streaming"
            ? [{ id: equippedBadgeId, progress: 1, isComplete: true }]
            : []),
        ],
        equippedBadges: equippedBadgeId,
      },
      alarm: [],
      isCommunity: true,
    };

    try {
      await setDoc(
        doc(db, "users", d.userId),
        { userId: d.userId, isDummy: true, profile: [profile], createdAt: now },
        { merge: true },
      );
      await setDoc(
        doc(db, "playlists", d.userId),
        {
          playlists: [
            {
              listId: d.listId,
              name: d.name,
              content: d.content,
              videoIds: d.videoIds,
              isShare: d.isShare,
              tags: d.tags,
              likesCount: 0,
              likedBy: [],
              createdAt: now,
              profileId,
            },
          ],
        },
        { merge: true },
      );
      ok++;
    } catch (e) {
      failed++;
      errors.push(`${d.userId}: ${(e as Error)?.message ?? "unknown"}`);
    }
  }

  return { ok, failed, errors };
}
