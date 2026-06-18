"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, normalizeProfileSettings } from "@/store/useAuthStore";
import { useMovieStore } from "@/store/useMovieStore";
import { GENRE_SLUG_META } from "@/data/excludedGenres";
import "./scss/onboarding.scss";
import AppIcon, { type AppIconName } from "@/components/common/AppIcon";

const MOODS: { slug: string; label: string; icon: AppIconName }[] = [
  { slug: "chill", label: "잔잔한", icon: "mood-chill" },
  { slug: "dark", label: "어두운", icon: "mood-dark" },
  { slug: "emotional", label: "감성적인", icon: "mood-emotional" },
  { slug: "exciting", label: "신나는", icon: "mood-exciting" },
  { slug: "funny", label: "유쾌한", icon: "mood-funny" },
  { slug: "romantic", label: "낭만적인", icon: "mood-romantic" },
  { slug: "scary", label: "무서운", icon: "mood-scary" },
  { slug: "thoughtful", label: "심오한", icon: "mood-thoughtful" },
];

const GENRES = Object.entries(GENRE_SLUG_META).map(([slug, m]) => ({
  slug,
  title: m.title,
}));

const STEPS = ["장르", "무드", "관심 작품"];
const posterUrl = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/w342${path}` : "";

export default function OnboardingClient() {
  const router = useRouter();
  const currentProfile = useAuthStore((s) => s.currentProfile);
  const onUpdateProfile = useAuthStore((s) => s.onUpdateProfile);
  const { popMovies, tvs, onFetchPopular, onFetchTvs } = useMovieStore();

  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 로그인/프로필 없으면 진입 차단 (persist 복원 대기 후 판단)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useAuthStore.getState().currentProfile) router.replace("/login");
    }, 400);
    return () => clearTimeout(t);
  }, [router]);

  // 기존 설정 프리필
  useEffect(() => {
    const s = currentProfile?.settings;
    if (!s) return;
    setGenres(s.favoriteGenres ?? []);
    setMoods(s.favoriteMoods ?? []);
    setTitles(s.favoriteTitles ?? []);
  }, [currentProfile?.id]);

  // 관심 작품용 인기작 로드
  useEffect(() => {
    onFetchPopular();
    onFetchTvs();
  }, [onFetchPopular, onFetchTvs]);

  const works = useMemo(() => {
    const m = (popMovies ?? []).slice(0, 12).map((x: any) => ({
      key: `movie:${x.id}`,
      title: x.title ?? x.name ?? "",
      poster: x.poster_path as string | null,
    }));
    const t = (tvs ?? []).slice(0, 12).map((x: any) => ({
      key: `tv:${x.id}`,
      title: x.name ?? x.title ?? "",
      poster: x.poster_path as string | null,
    }));
    return [...m, ...t].filter((w) => w.poster);
  }, [popMovies, tvs]);

  const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

  const markDone = () => {
    try {
      if (currentProfile) localStorage.setItem(`onboarded:${currentProfile.id}`, "1");
    } catch {}
  };

  const persist = async (save: boolean) => {
    if (saving) return;
    markDone();
    if (save && currentProfile) {
      setSaving(true);
      try {
        await onUpdateProfile({
          ...currentProfile,
          settings: {
            // settings 가 undefined 여도 필수 필드를 기본값으로 채워 완전한 ProfileSettings 보장
            ...normalizeProfileSettings(currentProfile.settings),
            favoriteGenres: genres,
            favoriteMoods: moods,
            favoriteTitles: titles,
          },
        });
      } finally {
        setSaving(false);
      }
    }
    router.replace("/connect");
  };

  const isLast = step === STEPS.length - 1;
  const canNext =
    step === 0 ? genres.length > 0 : step === 1 ? moods.length > 0 : true;

  return (
    <div className="onboarding-page">
      <div className="onboarding-shell">
        <div className="onboarding-head">
          <div className="onboarding-brand">NETFLIX</div>
          <button className="onboarding-skip" onClick={() => persist(false)}>
            건너뛰기
          </button>
        </div>

        <div className="onboarding-progress">
          {STEPS.map((label, i) => (
            <div key={label} className={`onboarding-progress__dot${i <= step ? " active" : ""}`}>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {step === 0 && (
          <section className="onboarding-step">
            <h1 className="onboarding-title">어떤 장르를 좋아하세요?</h1>
            <p className="onboarding-sub">선택한 취향으로 커넥트가 작품과 비슷한 취향의 친구를 추천해요. (1개 이상)</p>
            <div className="onboarding-chips">
              {GENRES.map((g) => (
                <button
                  key={g.slug}
                  className={`onboarding-chip${genres.includes(g.slug) ? " active" : ""}`}
                  onClick={() => toggle(genres, setGenres, g.slug)}
                >
                  {g.title}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="onboarding-step">
            <h1 className="onboarding-title">어떤 무드가 끌리나요?</h1>
            <p className="onboarding-sub">분위기로도 취향을 잡아드려요. (1개 이상)</p>
            <div className="onboarding-moods">
              {MOODS.map((m) => (
                <button
                  key={m.slug}
                  className={`onboarding-mood${moods.includes(m.slug) ? " active" : ""}`}
                  onClick={() => toggle(moods, setMoods, m.slug)}
                >
                  <span className="onboarding-mood__icon">
                    <AppIcon name={m.icon} size={30} />
                  </span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding-step">
            <h1 className="onboarding-title">관심 가는 작품을 골라주세요</h1>
            <p className="onboarding-sub">없으면 건너뛰어도 괜찮아요. (선택)</p>
            {works.length === 0 ? (
              <div className="onboarding-loading">작품을 불러오는 중…</div>
            ) : (
              <div className="onboarding-posters">
                {works.map((w) => (
                  <button
                    key={w.key}
                    className={`onboarding-poster${titles.includes(w.key) ? " active" : ""}`}
                    onClick={() => toggle(titles, setTitles, w.key)}
                    title={w.title}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={posterUrl(w.poster)} alt={w.title} loading="lazy" />
                    {titles.includes(w.key) && <span className="onboarding-poster__check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="onboarding-foot">
          {step > 0 ? (
            <button className="onboarding-btn ghost" onClick={() => setStep((s) => s - 1)}>
              이전
            </button>
          ) : (
            <span />
          )}
          {!isLast ? (
            <button
              className="onboarding-btn primary"
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
            >
              다음
            </button>
          ) : (
            <button
              className="onboarding-btn primary"
              onClick={() => persist(true)}
              disabled={saving}
            >
              {saving ? "저장 중…" : "시작하기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
