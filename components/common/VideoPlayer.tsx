"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useAuthStore } from "@/store/useAuthStore";
import type { SubtitleSettings } from "@/types/auth";
import "./videoPlayer.scss";

/** 커스텀 자막 큐 */
interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
  }
}

export interface PlayerEpisode {
  id: number;
  number: number;
  name: string;
  stillUrl?: string | null;
  runtime?: number | null;
  progress?: number; // 0~100
}

interface VideoPlayerProps {
  videoKey: string;
  title?: string;
  onClose: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** 회차 목록 (시리즈일 때만 전달) */
  episodes?: PlayerEpisode[];
  activeEpisodeId?: number | null;
  onSelectEpisode?: (id: number) => void;
  /** 이어보기 시작 지점 (0~100 %) */
  startPct?: number;
  /** 페이지 내 임베드 모드 (전체화면 고정 대신 부모 컨테이너를 채움) */
  embedded?: boolean;
  /** 같이보기: 이 사용자가 직접 재생/정지/탐색했을 때 호출 (호스트가 즉시 브로드캐스트) */
  onLocalControl?: (state: { positionPct: number; isPlaying: boolean }) => void;
  /** 같이보기: 호스트가 보낸 재생 상태. ts가 바뀌면 그 위치/상태로 즉시 따라감 (참여자용) */
  remoteControl?: { positionPct: number; isPlaying: boolean; ts: number } | null;
  isMute?: boolean;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({
  videoKey,
  title,
  onClose,
  onTimeUpdate,
  episodes,
  activeEpisodeId,
  onSelectEpisode,
  startPct,
  embedded = false,
  onLocalControl,
  remoteControl,
  isMute
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerId = useRef(`vp-${Math.random().toString(36).slice(2)}`);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const isDraggingProgress = useRef(false);
  // 이어보기: 최초 1회만 시작 지점으로 이동
  const startPctRef = useRef(startPct ?? 0);
  const didInitialSeek = useRef(false);
  const resetHideTimerRef = useRef<() => void>(() => {});
  const seekToRef = useRef<(pct: number) => void>(() => {});
  onTimeUpdateRef.current = onTimeUpdate;

  // 같이보기 동기화용
  const applyingRemoteRef = useRef(false);
  const lastRemoteTsRef = useRef(0);
  const onLocalControlRef = useRef(onLocalControl);
  onLocalControlRef.current = onLocalControl;
  const playingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ccOn, setCcOn] = useState(true); // 유튜브 자막 (cc_load_policy 기본 켜짐)

  // ── 커스텀 자막 (서버 프록시로 받아와 직접 렌더링 → 완전한 스타일 커스텀) ──
  const cuesRef = useRef<SubtitleCue[]>([]);
  const cueIdxRef = useRef(0);
  const [customSubs, setCustomSubs] = useState(false);
  const [cueText, setCueText] = useState("");

  useEffect(() => {
    let ignore = false;
    cuesRef.current = [];
    cueIdxRef.current = 0;
    setCustomSubs(false);
    setCueText("");
    setShowSubSettings(false);

    fetch(`/api/subtitles?v=${encodeURIComponent(videoKey)}&lang=ko`)
      .then((r) => r.json())
      .then((d) => {
        // 진단용 로그: source=watch/innertube/cache/none, cues=자막 줄 수
        console.info(
          `[자막] video=${videoKey} source=${d.source ?? "?"} cues=${d.cues?.length ?? 0}`,
        );
        if (ignore || !d.cues?.length) return;
        cuesRef.current = d.cues;
        setCustomSubs(true);
        // 이중 표시 방지: 유튜브 자체 자막 숨김
        try {
          playerRef.current?.unloadModule?.("captions");
          playerRef.current?.unloadModule?.("cc");
        } catch {
          /* 무시 */
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [videoKey]);

  // 프로필 자막 커스텀 설정
  const subtitleSettings = useAuthStore(
    (s) => s.currentProfile?.settings?.subtitles,
  );
  const currentProfile = useAuthStore((s) => s.currentProfile);
  const onUpdateProfile = useAuthStore((s) => s.onUpdateProfile);

  // 플레이어 내 자막 설정 패널
  const [showSubSettings, setShowSubSettings] = useState(false);
  const showSubSettingsRef = useRef(showSubSettings);
  showSubSettingsRef.current = showSubSettings;
  const [liveSubs, setLiveSubs] = useState<SubtitleSettings | null>(null);

  /** 적용 우선순위: 패널에서 방금 바꾼 값 > 프로필 저장값 > 기본값 */
  const effectiveSubs: SubtitleSettings = useMemo(
    () => ({
      size: "medium",
      font: "gothic",
      shadow: "drop",
      shadowColor: "black",
      background: "none",
      window: "none",
      ...(subtitleSettings ?? {}),
      ...(liveSubs ?? {}),
    }),
    [subtitleSettings, liveSubs],
  );

  const subtitleSettingsRef = useRef(effectiveSubs);
  subtitleSettingsRef.current = effectiveSubs;

  /** 패널에서 변경 → 즉시 미리보기 + 프로필에 저장 (설정 페이지와 동기화) */
  const updateSubSetting = (patch: Partial<SubtitleSettings>) => {
    const next = { ...effectiveSubs, ...patch };
    setLiveSubs(next);
    subtitleSettingsRef.current = next;
    // 폴백(유튜브 자막) 모드에선 크기만 적용 가능
    if (!customSubs && patch.size) setTimeout(applyYtFontSize, 50);
    if (currentProfile?.settings) {
      void onUpdateProfile?.({
        ...currentProfile,
        settings: { ...currentProfile.settings, subtitles: next },
      });
    }
  };

  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [feedback, setFeedback] = useState<"play" | "pause" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [episodesClosing, setEpisodesClosing] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  playingRef.current = playing;
  const episodesCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showEpisodesRef = useRef(showEpisodes);
  showEpisodesRef.current = showEpisodes;

  // 회차 패널 닫기 (슬라이드아웃 애니메이션 후 언마운트)
  const closeEpisodes = useCallback(() => {
    setEpisodesClosing(true);
    if (episodesCloseTimer.current) clearTimeout(episodesCloseTimer.current);
    episodesCloseTimer.current = setTimeout(() => {
      setShowEpisodes(false);
      setEpisodesClosing(false);
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      if (episodesCloseTimer.current) clearTimeout(episodesCloseTimer.current);
    };
  }, []);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      // 회차/자막설정 패널이 열려있는 동안엔 컨트롤을 숨기지 않음
      if (!showEpisodesRef.current && !showSubSettingsRef.current)
        setShowControls(false);
    }, 3000);
  }, []);
  resetHideTimerRef.current = resetHideTimer;

  useEffect(() => {
    let cancelled = false;
    let apiPoll: ReturnType<typeof setInterval> | null = null;

    // 진행바 갱신 틱: onReady 이벤트와 무관하게 플레이어 메서드가 준비되면 동작
    const startTick = () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        const p = playerRef.current;
        if (!p || typeof p.getCurrentTime !== 'function') return;
        const ct = p.getCurrentTime();
        const d = p.getDuration();
        // 이어보기: 길이를 알게 된 시점에 한 번만 시작 지점으로 이동
        if (!didInitialSeek.current && d > 0) {
          didInitialSeek.current = true;
          const pct = startPctRef.current;
          if (pct > 1 && pct < 95) {
            p.seekTo?.((pct / 100) * d, true);
            setCurrentTime((pct / 100) * d);
            return;
          }
        }
        setCurrentTime(ct);
        if (d > 0) {
          setDuration(d);
          onTimeUpdateRef.current?.(ct, d);
        }

        // 커스텀 자막: 현재 시각에 해당하는 큐 찾기
        const cues = cuesRef.current;
        if (cues.length) {
          let i = cueIdxRef.current;
          // 뒤로 시킹한 경우 인덱스 리셋
          if (i >= cues.length || (i > 0 && ct < cues[i - 1].start)) i = 0;
          while (i < cues.length && cues[i].end < ct) i += 1;
          cueIdxRef.current = i;
          const cue = cues[i];
          const text = cue && cue.start <= ct && ct <= cue.end ? cue.text : "";
          setCueText((prev) => (prev === text ? prev : text));
        }
      }, 250);
    };

    const createPlayer = () => {
      if (cancelled) return;
      if (!document.getElementById(playerId.current)) return;
      playerRef.current = new window.YT.Player(playerId.current, {
        videoId: videoKey,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          playsinline: 1,
          // 폴백용 유튜브 내장 자막 (로컬 커스텀 자막이 있으면 unload 됨)
          cc_load_policy: 1,
          cc_lang_pref: "ko",
          mute: isMute ? 1 : 0
        },
        events: {
          onReady: (e: any) => {
            playerRef.current = e.target;
            e.target.setVolume(80);
            e.target.playVideo();
            // 커스텀(로컬) 자막이 있으면 유튜브 자막 숨김, 없으면 폴백으로 유지 + 크기 적용
            const syncCaptions = () => {
              try {
                if (cuesRef.current.length) {
                  playerRef.current?.unloadModule?.("captions");
                  playerRef.current?.unloadModule?.("cc");
                } else {
                  applyYtFontSize();
                }
              } catch {
                /* 무시 */
              }
            };
            setTimeout(syncCaptions, 900);
            setTimeout(syncCaptions, 2500);
          },
          onStateChange: (e: any) => {
            setPlaying(e.data === window.YT.PlayerState.PLAYING);
          },
        },
      });
      // 최초 로드 시 onReady가 유실되어도 진행바가 동작하도록 즉시 틱 시작
      startTick();
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
      // 전역 콜백 체이닝 대신 API 준비를 폴링 (이중 마운트/콜백 유실에 안전)
      apiPoll = setInterval(() => {
        if (window.YT?.Player) {
          if (apiPoll) clearInterval(apiPoll);
          apiPoll = null;
          createPlayer();
        }
      }, 100);
    }

    resetHideTimer();

    return () => {
      cancelled = true;
      if (apiPoll) clearInterval(apiPoll);
      try { playerRef.current?.destroy?.(); } catch { }
      if (tickRef.current) clearInterval(tickRef.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [videoKey, resetHideTimer]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (isTyping) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === " " || e.key === "k") { e.preventDefault(); doTogglePlay(); }
      if (e.key === "ArrowLeft") seek(-10);
      if (e.key === "ArrowRight") seek(10);
      if (e.key === "m") doToggleMute();
      if (e.key === "f") doToggleFullscreen();
      resetHideTimer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, playing, muted, isFullscreen, currentTime, duration]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // 같이보기: 호스트가 보낸 재생 상태를 즉시 따라감 (참여자)
  useEffect(() => {
    if (!remoteControl) return;
    if (remoteControl.ts === lastRemoteTsRef.current) return;
    lastRemoteTsRef.current = remoteControl.ts;
    const p = playerRef.current;
    if (!p || typeof p.getDuration !== "function") return;
    applyingRemoteRef.current = true;
    const d = p.getDuration() || 0;
    if (d > 0) {
      const target = (remoteControl.positionPct / 100) * d;
      const cur = p.getCurrentTime?.() ?? 0;
      // 1.5초 이상 어긋날 때만 위치 보정 (불필요한 끊김 방지)
      if (Math.abs(target - cur) > 1.5) {
        p.seekTo?.(target, true);
        setCurrentTime(target);
      }
    }
    if (remoteControl.isPlaying) p.playVideo?.();
    else p.pauseVideo?.();
    const tid = setTimeout(() => { applyingRemoteRef.current = false; }, 800);
    return () => clearTimeout(tid);
  }, [remoteControl?.ts]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerFeedback = (type: "play" | "pause") => {
    setFeedback(type);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 600);
  };

  const broadcastLocal = (isPlaying: boolean) => {
    if (applyingRemoteRef.current) return;
    const fn = onLocalControlRef.current;
    if (!fn) return;
    const p = playerRef.current;
    const d = p?.getDuration?.() ?? duration;
    const ct = p?.getCurrentTime?.() ?? currentTime;
    const pct = d > 0 ? (ct / d) * 100 : 0;
    fn({ positionPct: pct, isPlaying });
  };

  const doTogglePlay = () => {
    if (!playerRef.current) return;
    if (playing) { playerRef.current.pauseVideo?.(); triggerFeedback("pause"); broadcastLocal(false); }
    else { playerRef.current.playVideo?.(); triggerFeedback("play"); broadcastLocal(true); }
  };

  /** 커스텀 자막 오버레이 스타일 (자막 설정 100% 반영) */
  const subtitleStyle = useMemo(() => {
    const s = effectiveSubs;
    const size = s.size;
    const font = s.font;
    const shadow = s.shadow;
    const shadowColor =
      s.shadowColor === "white"
        ? "rgba(255,255,255,0.9)"
        : "rgba(0,0,0,0.9)";
    const background = s.background;
    const subWindow = s.window;

    const fontSize = {
      small: "clamp(14px, 1.7vw, 19px)",
      medium: "clamp(17px, 2.2vw, 25px)",
      large: "clamp(21px, 3vw, 33px)",
    }[size];

    const fontFamily = {
      block: "'Arial Black', 'AppleSDGothicNeo-Heavy', var(--font-netflix), sans-serif",
      gothic: "var(--font-netflix), 'Apple SD Gothic Neo', sans-serif",
      serif: "'Noto Serif KR', 'Nanum Myeongjo', serif",
      round: "'Arial Rounded MT Bold', 'BM JUA', var(--font-netflix), sans-serif",
    }[font];

    const textShadow =
      shadow === "drop"
        ? `2px 2px 5px ${shadowColor}`
        : shadow === "outline"
          ? `-1.5px 0 ${shadowColor}, 0 1.5px ${shadowColor}, 1.5px 0 ${shadowColor}, 0 -1.5px ${shadowColor}`
          : "none";

    const text: CSSProperties = {
      fontSize,
      fontFamily,
      textShadow,
      fontWeight: font === "block" ? 900 : 600,
      color: background === "white" ? "#000" : "#fff",
      background:
        background === "none"
          ? "transparent"
          : background === "black"
            ? "rgba(8,8,8,0.78)"
            : "rgba(255,255,255,0.88)",
    };

    const window_: CSSProperties = {
      "--subtitle-window-bg":
        subWindow === "none"
          ? "transparent"
          : subWindow === "black"
            ? "rgba(8,8,8,0.55)"
            : "rgba(255,255,255,0.45)",
    } as CSSProperties;

    return { text, window: window_ };
  }, [effectiveSubs]);

  /** 유튜브 내장 자막 크기 적용 (폴백 모드에서 유일하게 지원되는 커스텀) */
  const applyYtFontSize = useCallback(() => {
    const sizeMap = { small: -1, medium: 0, large: 2 } as const;
    try {
      playerRef.current?.setOption?.(
        "captions",
        "fontSize",
        sizeMap[subtitleSettingsRef.current?.size ?? "medium"],
      );
    } catch {
      /* 무시 */
    }
  }, []);

  /** 자막 켜기/끄기 (커스텀 자막 = 오버레이 토글 / 폴백 = 유튜브 자막 토글) */
  const doToggleCaptions = () => {
    if (customSubs) {
      setCcOn((v) => !v);
      return;
    }
    const p = playerRef.current;
    if (!p) return;
    try {
      if (ccOn) {
        p.unloadModule?.("captions");
        p.unloadModule?.("cc");
      } else {
        p.loadModule?.("captions");
        p.loadModule?.("cc");
        setTimeout(applyYtFontSize, 300);
      }
    } catch {
      /* 무시 */
    }
    setCcOn((v) => !v);
  };

  const doToggleMute = () => {
    if (muted) {
      setMuted(false);
      playerRef.current?.unMute();
      playerRef.current?.setVolume(volume || 50);
    } else {
      setMuted(true);
      playerRef.current?.mute();
    }
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    setMuted(v === 0);
    if (v > 0) playerRef.current?.unMute();
    playerRef.current?.setVolume(v);
  };

  const seek = (secs: number) => {
    const p = playerRef.current;
    if (!p) return;
    const cur = p.getCurrentTime?.() ?? currentTime;
    const dur = p.getDuration?.() ?? duration;
    if (!dur) return;
    const t = Math.max(0, Math.min(dur, cur + secs));
    p.seekTo?.(t, true);
    setCurrentTime(t);
    broadcastLocal(playingRef.current);
  };

  const seekTo = (pct: number) => {
    const p = playerRef.current;
    if (!p) return;
    const dur = p.getDuration?.() ?? duration;
    if (!dur) return;
    const t = (pct / 100) * dur;
    p.seekTo?.(t, true);
    setCurrentTime(t);
    broadcastLocal(playingRef.current);
  };
  seekToRef.current = seekTo;

  const getPctFromMouse = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  };

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDraggingProgress.current = true;
    resetHideTimer();
    const pct = getPctFromMouse(e.clientX);
    if (pct !== null) seekTo(pct);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingProgress.current) return;
      const pct = getPctFromMouse(e.clientX);
      if (pct !== null) seekToRef.current(pct);
      resetHideTimerRef.current();
    };
    const onUp = () => {
      isDraggingProgress.current = false;
      resetHideTimerRef.current();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doToggleFullscreen = () => {
    if (!wrapRef.current) return;
    if (!document.fullscreenElement) wrapRef.current.requestFullscreen();
    else document.exitFullscreen();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayVol = muted ? 0 : volume;

  return (
    <div
      ref={wrapRef}
      className={`vp-root${embedded ? " vp-root--embed" : ""}`}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (hideTimer.current) clearTimeout(hideTimer.current); setShowControls(false); }}
    >
      {/* YouTube 플레이어 마운트 포인트 */}
      <div id={playerId.current} className="vp-iframe" />

      {/* 클릭 영역 (play/pause toggle) */}
      <div
        className="vp-click-area"
        onClick={() => { resetHideTimer(); doTogglePlay(); }}
      />

      {/* 커스텀 자막 오버레이 (프로필 자막 설정 반영) */}
      {customSubs && ccOn && cueText && (
        <div
          className={`vp-subtitle-window${showControls ? " vp-subtitle-window--lifted" : ""}`}
          style={subtitleStyle.window}
        >
          <span className="vp-subtitle-text" style={subtitleStyle.text}>
            {cueText}
          </span>
        </div>
      )}

      {/* 재생/일시정지 피드백 아이콘 */}
      {feedback && (
        <div className={`vp-feedback vp-feedback--${feedback}`}>
          {feedback === "play" ? (
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          )}
        </div>
      )}

      {/* 컨트롤 오버레이 */}
      <div className={`vp-controls ${showControls ? "vp-controls--on" : "vp-controls--off"}`}>
        {/* 상단: 뒤로가기 + 제목 */}
        <div className="vp-top">
          {!embedded && (
            <button className="vp-back-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          {title && <span className="vp-title">{title}</span>}
        </div>

        {/* 하단: 진행바 + 버튼 */}
        <div className="vp-bottom">
          {/* 진행바 */}
          <div className="vp-progress-row">
            <span className="vp-time">{formatTime(currentTime)}</span>
            <div
              ref={trackRef}
              className="vp-track"
              onMouseDown={handleTrackMouseDown}
            >
              <div className="vp-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="vp-time">{formatTime(duration)}</span>
          </div>

          {/* 버튼 줄 */}
          <div className="vp-btn-row">
            <div className="vp-left-btns">
              {/* 재생/일시정지 */}
              <button className="vp-btn vp-btn--play" onClick={doTogglePlay} title={playing ? "일시정지 (K)" : "재생 (K)"}>
                {playing ? (
                  <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                )}
              </button>

              {/* 10초 뒤로 */}
              <button className="vp-btn vp-skip-btn" onClick={() => seek(-10)} title="10초 뒤로 (←)">
                <img src="/images/icon/iconmonstr-history-lined-1.svg" alt="10초 뒤로" className="vp-skip-icon" />
                <span className="vp-skip-num">10</span>
              </button>

              {/* 10초 앞으로 */}
              <button className="vp-btn vp-skip-btn" onClick={() => seek(10)} title="10초 앞으로 (→)">
                <img src="/images/icon/iconmonstr-future-lined-1.svg" alt="10초 앞으로" className="vp-skip-icon" />
                <span className="vp-skip-num">10</span>
              </button>

              {/* 볼륨 */}
              <div className="vp-volume-group">
                <button className="vp-btn" onClick={doToggleMute} title="음소거 (M)">
                  {displayVol === 0 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : displayVol < 50 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
                <input
                  type="range" min={0} max={100} value={displayVol}
                  className="vp-vol-range"
                  onChange={(e) => handleVolume(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="vp-right-btns">
              {/* 자막 설정 패널 토글 */}
              <button
                className={`vp-btn vp-sub-settings-btn${showSubSettings ? " active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSubSettings((v) => !v);
                  resetHideTimer();
                }}
                title="자막 설정"
                aria-expanded={showSubSettings}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {/* 자막 토글 */}
              <button
                className={`vp-btn vp-cc-btn${ccOn ? " active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  doToggleCaptions();
                  resetHideTimer();
                }}
                title={ccOn ? "자막 끄기" : "자막 켜기"}
                aria-pressed={ccOn}
              >
                <span className="vp-cc-label">CC</span>
              </button>

              {/* 회차 목록 */}
              {episodes && episodes.length > 0 && (
                <button
                  className={`vp-btn vp-episodes-btn${showEpisodes ? " active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showEpisodes) closeEpisodes();
                    else setShowEpisodes(true);
                    resetHideTimer();
                  }}
                  title="회차 목록"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="13" height="14" rx="2" />
                    <line x1="20" y1="6" x2="20" y2="18" />
                  </svg>
                </button>
              )}

              {/* 설정 (재생 속도) */}
              <div className="vp-settings-wrap">
                <button
                  className={`vp-btn${showSettings ? " active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings((s) => !s);
                    resetHideTimer();
                  }}
                  title="설정"
                >
                  <img src="/images/icon/slow-motion.png" alt="재생속도" style={{ width: 22, height: 22, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                </button>
                {showSettings && (
                  <div className="vp-settings-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="vp-settings-title">재생 속도</div>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                      <button
                        key={r}
                        className={`vp-settings-item${playbackRate === r ? " active" : ""}`}
                        onClick={() => {
                          playerRef.current?.setPlaybackRate?.(r);
                          setPlaybackRate(r);
                          setShowSettings(false);
                          resetHideTimer();
                        }}
                      >
                        <span>{r === 1 ? "정상" : `${r}x`}</span>
                        {playbackRate === r && <span className="vp-settings-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 전체화면 */}
              <button className="vp-btn" onClick={doToggleFullscreen} title="전체화면 (F)">
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 자막 설정 패널 */}
      {showSubSettings && (
        <aside className="vp-sub-panel" onClick={(e) => e.stopPropagation()}>
          <div className="vp-sub-panel__head">
            <h4>자막 설정</h4>
            <button
              className="vp-btn"
              onClick={() => setShowSubSettings(false)}
              aria-label="자막 설정 닫기"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <div className="vp-sub-panel__body">
            {/* 미리보기 */}
            <div className="vp-sub-preview" style={subtitleStyle.window}>
              <span className="vp-sub-preview__text" style={subtitleStyle.text}>
                자막 스타일 미리보기
              </span>
            </div>

            {!customSubs && (
              <p className="vp-sub-panel__notice">
                이 영상은 커스텀 자막이 없어 크기만 라이브 적용됩니다.
              </p>
            )}

            {(
              [
                ["크기", "size", [["small", "작게"], ["medium", "보통"], ["large", "크게"]]],
                ["폰트", "font", [["block", "블록"], ["gothic", "고딕"], ["serif", "명조"], ["round", "라운드"]]],
                ["그림자", "shadow", [["none", "없음"], ["drop", "드롭"], ["outline", "외곽선"]]],
                ["그림자 색", "shadowColor", [["black", "검정"], ["white", "흰색"]]],
                ["자막 배경", "background", [["none", "없음"], ["black", "검정"], ["white", "흰색"]]],
                ["윈도우", "window", [["none", "없음"], ["black", "검정"], ["white", "흰색"]]],
              ] as [string, keyof SubtitleSettings, [string, string][]][]
            ).map(([label, key, options]) => (
              <div className="vp-sub-panel__row" key={key}>
                <span className="vp-sub-panel__label">{label}</span>
                <div className="vp-sub-panel__chips">
                  {options.map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      className={`vp-sub-panel__chip${effectiveSubs[key] === value ? " active" : ""}`}
                      onClick={() =>
                        updateSubSetting({ [key]: value } as Partial<SubtitleSettings>)
                      }
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* 회차 목록 패널 */}
      {episodes && episodes.length > 0 && showEpisodes && (
        <aside
          className={`vp-episodes-panel${episodesClosing ? " vp-episodes-panel--closing" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="vp-episodes-head">
            <h4>회차</h4>
            <button
              className="vp-btn"
              onClick={(e) => {
                e.stopPropagation();
                closeEpisodes();
              }}
              aria-label="회차 목록 닫기"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>
          <div className="vp-episodes-list">
            {episodes.map((ep) => {
              const isActive = ep.id === activeEpisodeId;
              return (
                <button
                  key={ep.id}
                  className={`vp-episode-item${isActive ? " active" : ""}`}
                  onClick={() => {
                    if (!isActive) onSelectEpisode?.(ep.id);
                    closeEpisodes();
                  }}
                >
                  <div className="vp-episode-thumb">
                    {ep.stillUrl && <img src={ep.stillUrl} alt={ep.name} />}
                    {isActive && <span className="vp-episode-playing">재생 중</span>}
                    {(ep.progress ?? 0) > 0 && (
                      <span
                        className="vp-episode-progress"
                        style={{ width: `${ep.progress}%` }}
                      />
                    )}
                  </div>
                  <div className="vp-episode-info">
                    <p className="vp-episode-name">
                      {ep.number}. {ep.name}
                    </p>
                    {ep.runtime ? (
                      <p className="vp-episode-runtime">{ep.runtime}분</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
}
