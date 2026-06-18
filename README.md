# Netflix Renewal — Team Project Portfolio

넷플릭스 서비스를 리뉴얼한 팀 프로젝트입니다.  
TMDB API, Firebase, AI 기능을 활용해 실제 서비스 수준의 스트리밍 플랫폼 UI/UX를 구현했습니다.

---

## 프로젝트 소개

| 항목 | 내용 |
|------|------|
| 프로젝트 유형 | 팀 프로젝트 (포트폴리오) |
| 인원 | 6명 |
| 기여도 | 60% |
| 기간 | 2025 |

기존 넷플릭스 서비스의 UX를 분석하고, 커뮤니티 기능 및 AI 추천 기능을 추가하여 더 발전된 스트리밍 플랫폼으로 리뉴얼했습니다.

---

## 주요 기능

- **콘텐츠 탐색** — TMDB API 기반 영화·TV 시리즈 검색, 카테고리 필터
- **AI 무드 추천** — Google Generative AI를 활용한 감정·무드 기반 콘텐츠 추천
- **커뮤니티 피드** — 팔로우, 좋아요, 게시글 상세 보기
- **소셜 플레이리스트** — 사용자간 플레이리스트 공유
- **쇼핑 굿즈** — 넷플릭스 굿즈 상품 페이지
- **구독 / 결제 플로우** — 요금제 선택, 결제 페이지
- **프로필 관리** — 다중 프로필, PIN 인증, 프로필 설정
- **PWA 지원** — next-pwa를 통한 모바일 앱 경험

---

## 기술 스택

### Frontend
| 기술 | 버전 |
|------|------|
| Next.js | 16.2.6 |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| SCSS / Sass | 1.x |

### 상태 관리 / 기타 라이브러리
| 기술 | 용도 |
|------|------|
| Zustand | 전역 상태 관리 |
| Swiper | 슬라이더 / 캐러셀 |
| next-pwa | PWA 지원 |

### Backend / API
| 기술 | 용도 |
|------|------|
| Firebase | 인증, Firestore DB |
| TMDB API | 영화·TV 콘텐츠 데이터 |
| OpenAI API | AI 기능 |
| Google Generative AI | 무드 기반 콘텐츠 추천 |

---

## 담당 업무

- UX/UI 설계
- 디자인 시스템 구축
- 반응형 웹 구현
- React / TypeScript 컴포넌트 개발
- Tailwind CSS 스타일링
- TMDB API, Firebase 연동

---

## 폴더 구조

```
netflix-dev/
├── app/               # Next.js App Router 페이지
├── components/        # 재사용 컴포넌트
│   ├── main/          # 메인 홈
│   ├── feed/          # 커뮤니티 피드
│   ├── shop/          # 굿즈 쇼핑
│   ├── detail/        # 콘텐츠 상세
│   ├── mypage/        # 마이페이지
│   └── ...
├── lib/               # API 유틸리티 (TMDB 등)
├── store/             # Zustand 스토어
├── hooks/             # 커스텀 훅
├── firebase/          # Firebase 설정
└── public/            # 정적 리소스
```

---

## 로컬 실행

```bash
npm install
npm run dev
```

환경변수 (`.env.local`):
```
NEXT_PUBLIC_TMDB_API_KEY=...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_OPENAI_API_KEY=...
```

---

## 배포

Vercel을 통해 배포합니다.

```bash
npm run build
```
