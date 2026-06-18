"use client";
import React, { useState } from "react";
import "../scss/friends.scss";
import RepBadge from "@/components/common/RepBadge";

type TabType = "following" | "followers";

interface User {
  name: string;
  watched: number;
  lastActivity: string;
  badge: string; // 대표 칭호(장착 뱃지) ID
}

const followingList: User[] = [
  { name: "친구A", watched: 234, lastActivity: "1시간 전", badge: "genre_drama" },
  { name: "친구B", watched: 189, lastActivity: "3시간 전", badge: "binge_master" },
  { name: "친구C", watched: 312, lastActivity: "어제", badge: "7days_attendance" },
  { name: "친구D", watched: 156, lastActivity: "2일 전", badge: "first_streaming" },
  { name: "친구E", watched: 98, lastActivity: "1주 전", badge: "genre_drama" },
  { name: "친구F", watched: 421, lastActivity: "1주 전", badge: "binge_master" },
];

const followersList: User[] = [
  { name: "팔로워1", watched: 145, lastActivity: "2시간 전", badge: "first_streaming" },
  { name: "팔로워2", watched: 67, lastActivity: "5시간 전", badge: "genre_drama" },
  { name: "팔로워3", watched: 234, lastActivity: "어제", badge: "7days_attendance" },
];

export default function FollowPage() {
  const [tab, setTab] = useState<TabType>("following");
  const [sort, setSort] = useState("activity");

  const list = tab === "following" ? followingList : followersList;

  return (
    <div className="friends-page follow-variant">
      <div className="inner">
        <div className="page-head">
          <h1>팔로우</h1>
          <p>
            팔로잉 {followingList.length}명 · 팔로워 {followersList.length}명
          </p>
        </div>

        {/* 탭 */}
        <div className="tab-bar">
          <button
            className={tab === "following" ? "tab active" : "tab"}
            onClick={() => setTab("following")}
          >
            팔로잉 <span className="num">{followingList.length}</span>
          </button>
          <button
            className={tab === "followers" ? "tab active" : "tab"}
            onClick={() => setTab("followers")}
          >
            팔로워 <span className="num">{followersList.length}</span>
          </button>
        </div>

        {/* 정렬 옵션 */}
        <div className="sort-row">
          <div className="sort-chips">
            <button
              className={sort === "all" ? "sort-chip active" : "sort-chip"}
              onClick={() => setSort("all")}
            >
              전체
            </button>
            <button
              className={sort === "activity" ? "sort-chip active" : "sort-chip"}
              onClick={() => setSort("activity")}
            >
              최근 활동
            </button>
            <button
              className={sort === "affinity" ? "sort-chip active" : "sort-chip"}
              onClick={() => setSort("affinity")}
            >
              취향 유사도
            </button>
          </div>
          <span className="sort-label">{sort === "activity" ? "최근 활동순" : "기본"} ∨</span>
        </div>

        {/* 단순 목록 */}
        <ul className="follow-list">
          {list.map((user) => (
            <li key={user.name} className="follow-item">
              <div className="avatar"></div>
              <div className="info">
                <h3>{user.name}</h3>
                <RepBadge badge={user.badge} size="sm" />
                <p>
                  시청 {user.watched}편 · 활동 {user.lastActivity}
                </p>
              </div>
              <button className="follow-btn">{tab === "following" ? "팔로잉" : "맞팔로우"}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
