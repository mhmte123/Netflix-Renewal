"use client";

import type { ReactNode } from "react";

// 사이트 톤 듀오톤 라인 아이콘 세트 (윈도우 기본 이모지 대체).
// 색은 단일 `color` 값으로 제어(라인 stroke + 은은한 면 fill 모두 currentColor).
export type AppIconName = "like" | "comment" | "share" | "film" | "clapper" | "lock" | "unlock" | "gear" | "bulb" | "eye" | "masks" | "popcorn" | "target" | "globe" | "bell" | "clip" | "mood-chill" | "mood-exciting" | "mood-emotional" | "mood-scary" | "mood-funny" | "mood-thoughtful" | "mood-romantic" | "mood-dark" | "sparkle" | "faq-account" | "faq-payment" | "faq-plan" | "faq-watch" | "faq-device" | "faq-link" | "chevron" | "episode" | "friend" | "upcoming" | "reaction";

const COLORS: Record<AppIconName, string> = {
  "like": "#e50914",
  "comment": "#3b9bff",
  "share": "#22c4b8",
  "film": "#f5a524",
  "clapper": "#f5a524",
  "lock": "#9aa0a6",
  "unlock": "#34d399",
  "gear": "#9aa0a6",
  "bulb": "#fbbf24",
  "eye": "#3b9bff",
  "masks": "#a78bfa",
  "popcorn": "#f5a524",
  "target": "#e50914",
  "globe": "#3b9bff",
  "bell": "#fbbf24",
  "clip": "#9aa0a6",
  "mood-chill": "#60a5fa",
  "mood-exciting": "#f97316",
  "mood-emotional": "#ec4899",
  "mood-scary": "#7c3aed",
  "mood-funny": "#eab308",
  "mood-thoughtful": "#a78bfa",
  "mood-romantic": "#f472b6",
  "mood-dark": "#64748b",
  "sparkle": "#fbbf24",
  "faq-account": "#60a5fa",
  "faq-payment": "#34d399",
  "faq-plan": "#fbbf24",
  "faq-watch": "#e50914",
  "faq-device": "#22c4b8",
  "faq-link": "#a78bfa",
  "chevron": "#9aa0a6",
  "episode": "#f5a524",
  "friend": "#34d399",
  "upcoming": "#60a5fa",
  "reaction": "#e50914",
};

const PATHS: Record<AppIconName, ReactNode> = {
  "like": (<><path d="M14 4.5 13 10h5.8a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.4 21H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.5a2 2 0 0 0 1.8-1.1L12 3a2.3 2.3 0 0 1 2 1.5Z" fill="currentColor" fillOpacity="0.18"/><path d="M7 10v11"/></>),
  "comment": (<><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" fill="currentColor" fillOpacity="0.18"/></>),
  "share": (<><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>),
  "film": (<><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.14"/><path d="M7 3v18M17 3v18M3 8h4M3 12h18M3 16h4M17 8h4M17 16h4"/></>),
  "clapper": (<><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity="0.16"/><path d="M20.2 6 3 11l-.9-2.4a2 2 0 0 1 1.3-2.5l13.4-4a2 2 0 0 1 2.5 1.3Z"/><path d="m6.2 5.3 3 4M12.4 3.4l3 4"/></>),
  "lock": (<><rect x="4" y="10" width="16" height="11" rx="2" fill="currentColor" fillOpacity="0.16"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>),
  "unlock": (<><rect x="4" y="10" width="16" height="11" rx="2" fill="currentColor" fillOpacity="0.16"/><path d="M8 10V7a4 4 0 0 1 7.9-1"/></>),
  "gear": (<><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" fill="currentColor" fillOpacity="0.14"/><circle cx="12" cy="12" r="3"/></>),
  "bulb": (<><path d="M15.1 14c.2-1 .8-1.8 1.5-2.5A6 6 0 1 0 7.4 11.5c.7.7 1.3 1.5 1.5 2.5" fill="currentColor" fillOpacity="0.16"/><path d="M9 18h6"/><path d="M10 22h4"/></>),
  "eye": (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" fill="currentColor" fillOpacity="0.14"/><circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.28"/></>),
  "masks": (<><path d="M3 7c0-1 .6-1.5 1.6-1.5H11c1 0 1.6.5 1.6 1.5 0 4-2 7.5-4.8 7.5S3 11 3 7Z" fill="currentColor" fillOpacity="0.16"/><path d="M11.5 6.2c.7-.5 1.6-.7 2.9-.7H20c1 0 1.6.5 1.6 1.5 0 4-2 7.5-4.8 7.5-1.4 0-2.4-.8-3.2-2" fill="currentColor" fillOpacity="0.10"/><path d="M6 9h.01M9.6 9h.01M6.4 12c.7.6 2 .6 2.7 0"/></>),
  "popcorn": (<><path d="M7 11h10l-1 9a1 1 0 0 1-1 .9H9a1 1 0 0 1-1-.9Z" fill="currentColor" fillOpacity="0.16"/><path d="M10 11v9M14 11v9"/><path d="M7 11a2.2 2.2 0 0 1-1.4-3.9A2.4 2.4 0 0 1 8.3 4 2.6 2.6 0 0 1 13 3.4 2.6 2.6 0 0 1 17.6 5a2.3 2.3 0 0 1 .8 6Z" fill="currentColor" fillOpacity="0.12"/></>),
  "target": (<><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.10"/><circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.16"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></>),
  "globe": (<><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.12"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/></>),
  "bell": (<><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9Z" fill="currentColor" fillOpacity="0.16"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></>),
  "clip": (<><path d="M21.4 11 12 20.4a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.5 3.5 0 0 1 4.9 4.9l-8.5 8.5a1.5 1.5 0 0 1-2.1-2.1l7.8-7.8"/></>),
  "mood-chill": (<><path d="M3 8c2 0 2 1.6 4 1.6S9 8 11 8s2 1.6 4 1.6S17 8 19 8"/><path d="M3 14c2 0 2 1.6 4 1.6s2-1.6 4-1.6 2 1.6 4 1.6 2-1.6 4-1.6"/></>),
  "mood-exciting": (<><path d="M13 2 4 13h7l-1 9 9-12h-7z" fill="currentColor" fillOpacity="0.2"/></>),
  "mood-emotional": (<><path d="M12 22a7 7 0 0 0 7-7c0-3-3-6.5-7-12-4 5.5-7 9-7 12a7 7 0 0 0 7 7Z" fill="currentColor" fillOpacity="0.18"/></>),
  "mood-scary": (<><path d="M12 2a8 8 0 0 0-8 8v10l2.7-1.8L9 20l3-2 3 2 2.3-1.8L20 20V10a8 8 0 0 0-8-8Z" fill="currentColor" fillOpacity="0.16"/><path d="M9 10h.01M15 10h.01"/></>),
  "mood-funny": (<><circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.16"/><path d="M8 14s1.5 2.2 4 2.2 4-2.2 4-2.2"/><path d="M9 9.5h.01M15 9.5h.01"/></>),
  "mood-thoughtful": (<><path d="M5 9a4 4 0 0 1 4-4h6a4 4 0 0 1 0 8h-5l-4 3v-3a4 4 0 0 1-1-4Z" fill="currentColor" fillOpacity="0.16"/><path d="M5 19h.01M3 22h.01"/></>),
  "mood-romantic": (<><path d="M12 21s-7-4.6-9.5-9A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9Z" fill="currentColor" fillOpacity="0.2"/></>),
  "mood-dark": (<><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" fillOpacity="0.18"/></>),
  "sparkle": (<><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" fill="currentColor" fillOpacity="0.2"/><path d="M18.5 15l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="currentColor" fillOpacity="0.2"/></>),
  "faq-account": (<><circle cx="12" cy="8" r="4" fill="currentColor" fillOpacity="0.16"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></>),
  "faq-payment": (<><rect x="2" y="5" width="20" height="14" rx="2" fill="currentColor" fillOpacity="0.14"/><path d="M2 10h20M6 15h4"/></>),
  "faq-plan": (<><path d="M21 8 12 3 3 8l9 5 9-5Z" fill="currentColor" fillOpacity="0.16"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></>),
  "faq-watch": (<><rect x="3" y="7" width="18" height="13" rx="2" fill="currentColor" fillOpacity="0.14"/><path d="m8 3 4 4 4-4"/></>),
  "faq-device": (<><rect x="6" y="3" width="12" height="18" rx="2" fill="currentColor" fillOpacity="0.14"/><path d="M11 18h2"/></>),
  "faq-link": (<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>),
  "chevron": (<><path d="m6 9 6 6 6-6"/></>),
  "episode": (<><path d="m6 4 14 8-14 8z" fill="currentColor" fillOpacity="0.2"/><path d="M6 4v16l14-8z"/></>),
  "friend": (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  "upcoming": (<><rect x="3" y="4" width="18" height="18" rx="2" fill="currentColor" fillOpacity="0.14"/><path d="M16 2v4M8 2v4M3 10h18"/></>),
  "reaction": (<><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" fillOpacity="0.2"/></>),
};

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

export default function AppIcon({ name, size = 20, color, className, strokeWidth = 1.8 }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: color ?? COLORS[name] }}
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
