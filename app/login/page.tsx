"use client";

import { auth, googleProvider } from "@/firebase/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import { Movie } from "@/types/movie";
import { signInWithEmailAndPassword, signInWithPopup, getAdditionalUserInfo } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import "../scss/login.scss";

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const IMG_BASE = "https://image.tmdb.org/t/p/w780";

const ROW_COUNT = 8;
const ITEMS_PER_ROW = 14;

// ─── 로그인 배경에 깔 포스터 (직접 고른 작품) ──────────────────────────────────
// 여기에 넣은 TMDB 영화 id 들의 포스터만 배경 그리드에 사용된다.
// 부족하면 그리드가 자동으로 반복해서 채우므로 15~20개면 충분하다.
//
// ── id 찾는 법 ──────────────────────────────────────────────
// 작품 상세 주소가 /detail/movie/12345 라면 끝의 숫자 12345 가 그 작품의 id 다.
// (배경은 영화 포스터만 사용하므로 movie id 만 넣는다.)
const CURATED_MOVIE_IDS: number[] = [
  27205,   // 인셉션
  157336,  // 인터스텔라
  155,     // 다크 나이트
  19995,   // 아바타
  299536,  // 어벤져스: 인피니티 워
  24428,   // 어벤져스
  603,     // 매트릭스
  120,     // 반지의 제왕: 반지 원정대
  122,     // 반지의 제왕: 왕의 귀환
  76341,   // 매드 맥스: 분노의 도로
  680,     // 펄프 픽션
  278,     // 쇼생크 탈출
  238,     // 대부
  13,      // 포레스트 검프
  597,     // 타이타닉
  1726,    // 아이언맨
  286217,  // 마션
  49026,   // 다크 나이트 라이즈
  11,      // 스타워즈: 새로운 희망
  769,     // 좋은 친구들
  246655, //엑스맨
  1226863, // 슈퍼마리오
  687163, //프로젝트 헤일메리
  671, //해리포터 마법사의 돌
  803796, //kpop데몬헌터스
  120, //반지의 제왕
  129, //센과치히로
  808,//슈렉
  1011985, //쿵푸팬더
  585, //몬스터주식회사
  62177, //메리다
  109445, //겨울왕국
  402431, //위키드
  411, //나니아연대기
  82702,//드래곤길들이기
  8392, //이웃집 토토로
  1084244, //토이스토리
  1543993, //순례자
  1327819, //호퍼스
  1022789, //인사이드아웃
  372058, //너의이름은
  693134, //듄
  991494, //스폰지밥
  269149, //주토피아
  77338, //인터쳐블
  519182, //슈퍼배드4
  10625,  //민걸
  255709, //소원
];

// ─── 아이콘 ────────────────────────────────────────────────────────────────────

const EyeOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

// ─── 포스터 그리드 컴포넌트 ────────────────────────────────────────────────────

function PosterGrid() {
  const [posters, setPosters] = useState<string[]>([]);

  useEffect(() => {
    const fetchPosters = async () => {
      try {
        // 직접 고른 작품(CURATED_MOVIE_IDS) 의 포스터만 사용한다.
        // id 가 잘못됐거나 포스터가 없는 작품은 자동으로 건너뛴다.
        const results = await Promise.all(
          CURATED_MOVIE_IDS.map((id) =>
            fetch(
              `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&language=ko-KR`
            )
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        const paths = results
          .filter((m): m is Movie => Boolean(m && m.backdrop_path))
          .map((m) => m.backdrop_path as string)
          .sort(() => Math.random() - 0.5); // 그리드 안에서 위치를 섞어 자연스럽게 배치
        setPosters(paths);
      } catch (err) {
        console.error("포스터 fetch 실패", err);
      }
    };
    fetchPosters();
  }, []);

  if (posters.length === 0) {
    return (
      <div className="poster-grid">
        {Array.from({ length: ROW_COUNT }).map((_, ri) => (
          <div key={ri} className="poster-row">
            {Array.from({ length: ITEMS_PER_ROW * 2 }).map((_, ti) => (
              <div key={ti} className="poster-item poster-skeleton" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const rows: string[][] = Array.from({ length: ROW_COUNT }, (_, ri) => {
    const slice = Array.from(
      { length: ITEMS_PER_ROW },
      (_, ti) => posters[(ri * ITEMS_PER_ROW + ti) % posters.length]
    );
    return [...slice, ...slice];
  });

  return (
    <div className="poster-grid">
      {rows.map((row, ri) => (
        <div key={ri} className="poster-row">
          {row.map((path, ti) => (
            <div key={`${ri}-${ti}`} className="poster-item">
              <Image
                src={`${IMG_BASE}${path}`}
                alt=""
                fill
                sizes="(max-width: 1024px) 25vw, 15vw"
                className="poster-img"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0";
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { onLogin, onKakaoLogin, onNaverLogin } = useAuthStore();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const defaultProfiles = [
    {
      id: 1,
      nickname: "나", // 👈 name은 빼고 nickname만 선언!
      imgUrl: "/images/profile/image/default_icons/17.png"
    }
  ];

  // ── 이메일 로그인 처리 ────────────────────────────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      onLogin({
        uid: result.user.uid,
        email: result.user.email ?? "",
        profiles: defaultProfiles
      } as any);

      // 💡 메인("/")이 아닌 프로필 선택 라우트로 주소를 변경합니다!
      router.push("/profiles");
    } catch (err) {
      console.error(err);
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── 구글 로그인 처리 ─────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;

      onLogin({
        uid: result.user.uid,
        email: result.user.email ?? "",
        displayName: result.user.displayName ?? "나",
        profiles: defaultProfiles,
      } as any);

      // 신규면 플랜 선택, 기존이면 프로필 선택
      router.push(isNewUser ? "/plan" : "/profiles");
    } catch (err) {
      console.error(err);
      setError("Google 로그인에 실패했습니다.");
    }
  };

  const handleKakaoLogin = async () => {
    setError("");
    try {
      const result = await onKakaoLogin();
      if (result) {
        router.push(result.isNewUser ? "/plan" : "/profiles");
      }
    } catch (err) {
      console.error(err);
      setError("Kakao 로그인에 실패했습니다.");
    }
  };

  const handleNaverLogin = async () => {
    setError("");
    try {
      const result = await onNaverLogin();
      if (result) {
        router.push(result.isNewUser ? "/plan" : "/profiles");
      }
    } catch (err) {
      console.error(err);
      setError("Naver 로그인에 실패했습니다.");
    }
  };

  return (
    <div className="login-page">

      {/* ── 왼쪽: TMDB 포스터 그리드 ───────────────────────────────────────── */}
      <section className="login-poster" aria-hidden="true">
        <PosterGrid />
      </section>

      {/* ── 오른쪽: 로그인 패널 ─────────────────────────────────────────────── */}
      <section className="login-panel">
        <div className="login-card">
          <h2 className="login-title">다시 오신 것을<br />환영해요</h2>
          <p className="login-subtitle">계정에 로그인하고 시청을 이어가세요</p>

          {error && <div className="login-error" role="alert">{error}</div>}

          <form className="login-form" onSubmit={handleEmailLogin} noValidate>
            <div className="form-field">
              <label htmlFor="login-email" className="form-label">이메일</label>
              <input
                id="login-email"
                type="email"
                placeholder="user@example.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {/* <div className="demo-ac">
                <span>ID : delexi4121@fixscal.com</span>
              </div> */}
            </div>

            <div className="form-field">
              <label htmlFor="login-password" className="form-label">비밀번호</label>
              <div className="input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="form-input has-icon"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? <EyeOpenIcon /> : <EyeOffIcon />}
                </button>
              </div>
              {/* <div className="demo-ac">
                <span>PW : ezen123456</span>
              </div> */}
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                자동 로그인
              </label>
              <Link href="/forgot-password" className="forgot-link">비밀번호 찾기</Link>
            </div>

            <button
              type="submit"
              className={`login-btn${isLoading ? " is-loading" : ""}`}
              disabled={isLoading}
            >
              {isLoading ? "" : "로그인"}
            </button>
          </form>

          <div className="login-divider">또는</div>

          <ul className="social-list">
            <li>
              <button
                type="button"
                className="social-btn social-google"
                onClick={handleGoogleLogin}
              >
                <span className="social-icon-wrap">
                  <Image src="/images/social/google_login.svg" alt="Google" width={24} height={24} />
                </span>
                <span className="social-label">Google로 로그인</span>
              </button>
            </li>
            <li>
              <button type="button" className="social-btn social-naver"
                onClick={handleNaverLogin}>
                <span className="social-icon-wrap">
                  <Image src="/images/social/naver_login.svg" alt="Naver" width={24} height={24} />
                </span>
                <span className="social-label">네이버로 로그인</span>
              </button>
            </li>
            <li>
              <button type="button" className="social-btn social-kakao"
                onClick={handleKakaoLogin}>
                <span className="social-icon-wrap">
                  <Image src="/images/social/kakao_login.svg" alt="Kakao" width={24} height={24} />
                </span>
                <span className="social-label">카카오로 로그인</span>
              </button>
            </li>
          </ul>

          <p className="login-signup">
            아직 회원이 아니신가요?
            <Link href="/signin">회원가입</Link>
          </p>
        </div>
      </section>
    </div>
  );
}