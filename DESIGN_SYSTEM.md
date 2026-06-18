# NETFLIX Design System
> Netflix Renewal 프로젝트 공식 디자인 기준서  
> 버전 1.0 · 2026년 · 방구석모드 기준

---

## 목차
1. [컬러 시스템](#1-컬러-시스템)
2. [타이포그래피](#2-타이포그래피)
3. [간격 & 레이아웃](#3-간격--레이아웃)
4. [컴포넌트](#4-컴포넌트)
   - 4-8. [스와이퍼 네비게이션 버튼](#4-8-스와이퍼-네비게이션-버튼-swiper-navigation)
5. [이미지 & 미디어](#5-이미지--미디어)
6. [인터랙션 & 애니메이션](#6-인터랙션--애니메이션)
7. [사용 금지 패턴](#7-사용-금지-패턴)

---

## 1. 컬러 시스템

### 기본 원칙
- 배경은 반드시 **3단계 계층** 중 하나를 사용한다
- 강조색은 **빨간색 계열**만 사용한다 (임의의 다른 색 강조 금지)
- 텍스트는 **4단계 계층** 중 하나를 사용한다

### 배경 컬러 (Background)

| 이름 | 변수 | HEX | 용도 |
|------|------|-----|------|
| BG Primary | `--bg-color` | `#141414` | 페이지 전체 배경 |
| BG Secondary | `--bg2` | `#1a1a1a` | 섹션·패널 배경 |
| BG Card | `--bg3` | `#222222` | 카드·입력창·태그 배경 |
| BG Sidebar | *(고정)* | `#0d0d0d` | 좌측 사이드바 전용 |

> ⚠️ `#000000` 순수 검정을 배경으로 직접 사용하지 않는다. 반드시 위 4가지 중 선택한다.

### 강조 컬러 (Accent)

| 이름 | 변수 | HEX | 용도 |
|------|------|-----|------|
| Red | `--red` | `#E50914` | 주요 CTA 버튼, 활성 상태, 포인트 |
| Red Dark | `--red-dark` | `#B00710` | 버튼 hover·pressed 상태 |
| Red Dim | *(인라인)* | `#8B0000` | N 심볼 측면 음영 전용 |
| Gold | *(인라인)* | `#F5C518` | 별점(★) 전용, 다른 용도 사용 금지 |
| Orange Badge | *(인라인)* | `#F5A623` | "NEW" 뱃지 전용 |

> ⚠️ 파란색·초록색·보라색 등 계열 강조색 사용 금지. 커넥트모드 기능 구현 전까지 빨간색만 사용한다.

### 텍스트 컬러 (Text)

| 이름 | 변수 | HEX | 용도 |
|------|------|-----|------|
| Text Primary | `--white` | `#FFFFFF` | 제목, 주요 정보 |
| Text Secondary | `--gray1` | `#999999` | 보조 정보, 메타데이터, placeholder |
| Text Disabled | `--gray2` | `#555555` | 비활성 상태, 구분선 |
| Text Overlay | *(인라인)* | `rgba(255,255,255,0.72)` | 히어로 설명 텍스트 |

### 오버레이 & 보더

| 용도 | 값 |
|------|-----|
| 카드 호버 오버레이 | `rgba(0,0,0,0.88)` |
| 히어로 좌측 그라디언트 | `rgba(10,12,18,0.95) → transparent` |
| 히어로 하단 그라디언트 | `rgba(10,12,18,0.85) → transparent` |
| 기본 보더 | `rgba(255,255,255,0.08)` |
| 버튼 ghost 보더 | `rgba(255,255,255,0.28)` |
| 구분선 | `#2a2a2a` |

---

## 2. 타이포그래피

### 폰트 패밀리

| 폰트 | 용도 | 로드 방법 |
|------|------|-----------|
| **Netflix Sans** | 모든 UI 텍스트, 제목, 본문, 한국어 콘텐츠 전체 | 로컬 폰트 파일 |

> ⚠️ Google Fonts(Bebas Neue, Noto Sans KR) 사용 금지. 모든 텍스트는 Netflix Sans 단일 폰트로 통일한다.

### 타입 스케일

| 레벨 | 크기 | 굵기 | 용도 |
|------|------|------|------|
| **Hero Title** | 40px | 900 | 상세페이지 히어로 h1 |
| **Section Title** | 18px | 700 | 섹션 h2, 에피소드 제목, 카드 hover 제목 |
| **Body / Button / Tab** | 16px | 400–700 | 본문, 탭 텍스트, Primary/Secondary 버튼 |
| **Cast Name** | 15px | 700 | 출연진 이름 |
| **Info** | 14px | 400–500 | 에피소드 메타, 연도·런타임, 감독 이름, 보조 설명 |
| **Badge / Character** | 13px | 400–700 | 캐스트 캐릭터명, 정렬 버튼 텍스트 |
| **Label** | 12px | 500–700 | 미디어 타입 뱃지, 연령 등급, pill 버튼(찜·리스트) |
| **Genre Tag** | 11px | 400 | 장르 태그 |
| **Tab Count** | 10px | 400 | 탭 카운트 숫자 |

### 핵심 폰트 사이즈 기준

| 용도 | 크기 |
|------|------|
| 기본 (Body) | **16px** |
| 버튼 | **16px** |
| 정보 (Info) | **14px** |
| 섹션 타이틀 | **18px** |
| 뱃지 / 라벨 | **12px** |

### 사용 규칙

```
✅ 히어로 타이틀    → Netflix Sans 40px 900
✅ 섹션 제목        → Netflix Sans 18px Bold
✅ 본문 / 버튼      → Netflix Sans 16px 400–700
✅ 보조 정보        → Netflix Sans 14px Regular #888–#999
✅ 뱃지 / 라벨      → Netflix Sans 12px Medium–Bold

❌ 정의된 타입 스케일 외 임의의 font-size 사용 금지
❌ 버튼·섹션 타이틀에 각각 16px·18px 미만 사용 금지
❌ Regular(400) 이하로 뱃지·버튼 텍스트 사용 금지
```

### line-height 기준

| 용도 | line-height |
|------|-------------|
| 대형 디스플레이 | 1.05 |
| 제목류 | 1.2 |
| 본문 | 1.72 |
| UI 레이블 | 1.0 (single line) |

---

## 3. 간격 & 레이아웃

### 기본 그리드

| 항목 | 값 |
|------|-----|
| 사이드바 너비 | 80px (fixed) |
| GNB 높이 | 56px (fixed) |
| 페이지 좌우 패딩 | 40px |
| 섹션 간 세로 간격 | 40px |
| 카드 그리드 gap | 8px |
| 캐스트 그리드 gap | 12px |
| Spotlight 그리드 gap | 10px |

### 스페이싱 단위 (8px 기반)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `space-1` | 4px | 아이콘-텍스트 간격 |
| `space-2` | 8px | 카드 gap, 버튼 아이콘 간격 |
| `space-3` | 12px | 캐스트 gap |
| `space-4` | 16px | 컴포넌트 내부 패딩 |
| `space-5` | 20px | 중간 간격 |
| `space-6` | 24px | 컴포넌트 간 여백 |
| `space-8` | 32px | 섹션 내부 여백 |
| `space-10` | 40px | 페이지 패딩, 섹션 간격 |

### 레이아웃 구조

```
┌──────────────────────────────────────────────────┐
│ GNB (position: fixed, height: 56px, z-index: 190)│
├──────────┬───────────────────────────────────────┤
│          │  Hero Section (100vh, full-bleed)      │
│          ├───────────────────────────────────────┤
│ Sidebar  │  .home-content                         │
│  80px    │    padding: 0 40px 80px                │
│ (fixed)  │    각 섹션 margin-bottom: 40px          │
│          │                                        │
└──────────┴───────────────────────────────────────┘
```

### 컨텐츠 그리드 규칙

| 섹션 | 컬럼 수 | 카드 비율 |
|------|---------|---------|
| Spotlight | 3 | 16:9 (height: 158px) |
| 포스터 그리드 (기본) | 8 | 2:3 |
| 이어보기 | 5 | 16:9 |
| 인기 배우 (Cast) | 8 | 1:1 (원형) |
| Featured 배너 썸네일 | 4 | 2:3 (width: 88px) |

---

## 4. 컴포넌트

### 4-1. 버튼 (Button)

#### Primary — 재생 버튼
```
배경:           #E50914
텍스트:         #FFFFFF, 16px, Bold 700
height:         46px
패딩:           0 22px
border-radius:  4px
아이콘:         ▶ gap 8px
hover:          background #B00710 + transform scale(1.02)
```

#### Secondary — ghost 버튼
```
배경:           rgba(255,255,255,0.10)
보더:           1px solid rgba(255,255,255,0.25)
텍스트:         #FFFFFF, 16px, Bold 700
height:         46px
패딩:           0 18px
border-radius:  4px
hover:          background rgba(255,255,255,0.2)
```

#### Icon 버튼 — 찜·공유
```
크기:           40×40px 원형
찜:             background rgba(229,9,20,0.10), border 1px solid #e50914, color #e50914, fontSize 18
공유:           background rgba(255,255,255,0.06), border 1px solid rgba(255,255,255,0.20), color #888, fontSize 16
```

#### Pill 버튼 — 찜·리스트·알림 (평가 섹션 내)
```
border-radius:  100px
패딩:           8px 14px
텍스트:         12px
찜:             background rgba(229,9,20,0.12), border #e50914, color #e50914
기타:           background transparent, border #3a3a48, color #888
```

#### Small — Spotlight 내부
```
Play:  #E50914 배경, 12px Bold, padding 4px 12px, border-radius 3px
More:  rgba(255,255,255,0.14) + border rgba(255,255,255,0.25), 동일 크기
```

> ⚠️ 버튼 색상은 임의로 변경하지 않는다. Primary는 반드시 `#E50914`, ghost는 반드시 반투명 흰색 보더.

---

### 4-2. 카드 (Card)

#### 포스터 카드 (2:3)
```
border-radius:  5px
background:     #222 (이미지 로드 전 fallback)
aspect-ratio:   2 / 3

hover:
  transform:    scale(1.05)
  z-index:      2
  box-shadow:   0 10px 28px rgba(0,0,0,0.65)

인포 오버레이 (hover):
  background:   linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent)
  padding:      22px 8px 7px
  제목:         10px Bold White
  메타:         9px #999
  opacity:      0 → 1
```

#### 16:9 카드 — 이어보기
```
border-radius:  5px
aspect-ratio:   16 / 9

hover: scale(1.03) + box-shadow 0 8px 24px rgba(0,0,0,0.6)

재생 아이콘 (hover):
  38×38px 원형, rgba(0,0,0,0.6), border 2px rgba(255,255,255,0.4)
  opacity: 0 → 1

진행 바:
  height: 3px, background rgba(255,255,255,0.18)
  fill: #E50914, border-radius: 2px
```

#### Spotlight 카드
```
border-radius:  6px
height:         158px

hover: scale(1.02) + box-shadow 0 8px 28px rgba(0,0,0,0.6)

오버레이: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.12) 55%, transparent)
```

---

### 4-3. 뱃지 (Badge)

| 종류 | 배경 | 텍스트 | 패딩 | radius | 용도 |
|------|------|--------|------|--------|------|
| NEW | `#F5A623` | `#000` 12px Bold | 3px 9px | 3px | 히어로 신작 |
| N FILM 등 | transparent | `#E50914` 12px Bold | — | — | Spotlight |
| 미디어 타입 | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.50)` 12px Medium | 3px 8px | 4px | 상세페이지 히어로 |
| 연령 등급 | transparent | `#aaa` 12px Bold | 2px 8px | 3px | 히어로 메타 (border #555) |
| 시청이력 | `rgba(0,0,0,0.72)` | `#999` 12px | 2px 7px | 2px | 명작 섹션 |
| 장르 태그 | transparent | `#999` 11px | 2px 10px | 100px | 히어로 메타 (border #555) |
| 랭킹 번호 | transparent (stroke only) | Netflix Sans 52px, stroke 1.5px rgba(255,255,255,0.55) | — | — | 인기 순위 |

---

### 4-4. 섹션 헤더

```
레이아웃:      flex, justify-content: space-between, align-items: flex-end
margin-bottom: 14px

섹션 타이틀:   18px Bold 700 #fff
섹션 서브:     14px Regular #999, margin-top: 2px
"전체보기 ›":  14px #999 → hover #fff
```

---

### 4-5. 사이드바 아이콘

```
너비: 80px, 배경: #0d0d0d, border-right: 1px solid #1e1e1e
아이템 높이: 54px min, flex column center, gap: 4px

기본: stroke #999 / 레이블 9px #999
hover: 배경 rgba(255,255,255,0.05), stroke·레이블 #fff
active: 배경 rgba(255,255,255,0.06)
        + 좌측 인디케이터 3px×22px #E50914
        + stroke·레이블 #fff
```

---

### 4-6. GNB

```
height: 56px, fixed top 0, z-index: 190
기본 배경: linear-gradient(to bottom, rgba(10,10,10,0.95), transparent)
스크롤 후: rgba(10,10,10,0.98) + backdrop-blur(8px)

모드 탭: 배경 rgba(255,255,255,0.07), border rgba(255,255,255,0.1), radius 5px
         활성: rgba(255,255,255,0.12) + 텍스트 #fff
         비활성: 텍스트 #999

검색바: 배경 rgba(255,255,255,0.08), border rgba(255,255,255,0.12), radius 4px
        너비: 190px → focus 230px

프로필 아바타: 33px 원형, gradient(#E50914→#ff6b35), border 2px rgba(255,255,255,0.15)
```

---

### 4-7. 상세페이지 (Detail) 전용

> 이 섹션의 값은 `Detail.tsx` 기준으로 확정된 기준치입니다.

#### 히어로 영역
```
배경 이미지 opacity:  0.45
좌측 그라디언트:      rgba(20,20,20,0.7) → rgba(20,20,20,0.4) → transparent (90deg)
하단 그라디언트:      rgba(20,20,20,0.2) → #141414 (to top, 0–30%)
히어로 높이:          600px (spacer)
포스터:               180×260px, border-radius 8px, border 1.5px rgba(255,255,255,0.12)
타이틀 (h1):          40px, fontWeight 900, letterSpacing -0.8, color #fff
```

#### 탭 네비게이션
```
height:               48px
border-bottom:        1px solid rgba(255,255,255,0.10)
탭 폰트:              16px
활성 탭:              fontWeight 700, color #fff, border-bottom 2px solid #e50914
비활성 탭:            fontWeight 400, color #888
탭 카운트:            10px, color #555
```

#### 에피소드 카드
```
썸네일:               180×110px, border-radius 6px, background #2a2a35
재생 아이콘 (활성):   36×36px 원형, rgba(0,0,0,0.6)
진행 바 (활성):       height 3px, width 65%, color #e50914
제목:                 18px Bold
메타 (런타임·날짜):   14px, color #666
설명:                 14px, color #999, WebkitLineClamp 3
구분선:               border-bottom 1px solid rgba(255,255,255,0.07)
```

#### 출연진 카드
```
프로필 이미지:        52×52px, border-radius 8px, border 1px rgba(255,255,255,0.10)
이름:                 15px Bold #fff
캐릭터명:             13px, color #666
그리드:               4열, border-right / border-bottom 1px rgba(255,255,255,0.07)
```

#### 섹션 공통 패딩
```
섹션 시작 padding-top:  56px (첫 섹션 제외)
좌우 padding:           40px
섹션 간 gap:            12–16px
```

---

### 4-8. 스와이퍼 네비게이션 버튼 (Swiper Navigation)

> 모든 스와이퍼 섹션의 이전/다음 버튼 기본 스타일. 임의로 변경하지 않는다.

```
배경:              none
보더:              none
색상:              #ffffff
z-index:           10

기본 상태:         opacity 0 (숨김)
섹션 hover 시:     opacity 1 (등장)  ← transition: opacity 0.2s ease
버튼 hover 시:     opacity 0.7
비활성(disabled):  opacity 0 + pointer-events: none

화살표 크기:       font-size 20px
화살표 굵기:       font-weight 900
```

#### SCSS 패턴
```scss
.swiper-button-prev,
.swiper-button-next {
  background: none;
  border: none;
  color: $w-color;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s ease;

  &::after {
    font-size: 20px;
    font-weight: 900;
  }

  &.swiper-button-disabled {
    opacity: 0 !important;
    pointer-events: none;
  }
}

// 섹션 hover 시 버튼 등장
.{section-class}:hover {
  .swiper-button-prev,
  .swiper-button-next {
    opacity: 1;

    &:hover { opacity: 0.7; }
  }
}
```

> ⚠️ 버튼이 항상 보이도록 `opacity: 1` 고정 설정 금지. 반드시 섹션 hover에 연동한다.

---

## 5. 이미지 & 미디어

### TMDB 이미지 사이즈 기준

| 용도 | TMDB 사이즈 |
|------|------------|
| 히어로 배경 (backdrop) | `w1280` |
| Spotlight backdrop | `w780` |
| 포스터 (2:3) | `w342` |
| Featured 배너 썸네일 | `w342` |
| 배우 프로필 | `w185` |

### 규칙
- `next/image fill` 사용 시 부모에 `position: relative` + `height` 또는 `aspect-ratio` 필수
- 이미지 null 시 fallback: `background: #222`
- 히어로 배경만 `priority` 적용, 나머지는 `loading="lazy"`

---

## 6. 인터랙션 & 애니메이션

### 트랜지션 기준

| 용도 | 속성 | duration |
|------|------|----------|
| 카드 hover | transform, box-shadow | 0.2s ease |
| 버튼 hover | background, transform | 0.15s |
| GNB 배경 | background | 0.3s |
| 오버레이 | opacity | 0.2s |
| 사이드바 색상 | stroke, color | 0.15s |
| 히어로 도트 | width, background | 0.2s |

### hover scale 기준

| 컴포넌트 | 값 |
|----------|-----|
| 포스터 카드 | `scale(1.05)` |
| 이어보기 카드 | `scale(1.03)` |
| Spotlight 카드 | `scale(1.02)` |
| 배우 아바타 | `translateY(-3px)` |
| 히어로 포스터 | `scale(1.07) translateY(-10px)` |
| Featured 썸네일 | `scale(1.06)` |

### 히어로 슬라이더
- 자동 전환: **6초**
- 도트 클릭 시 즉시 이동 + 타이머 리셋

---

## 7. 사용 금지 패턴

### 컬러
```
❌ #000000 순수 검정을 직접 배경으로 사용
❌ 빨간색 외 강조색 사용 (파랑, 초록, 보라 등)
❌ 투명도 없이 흰색 보더 사용 (항상 rgba 사용)
```

### 타이포그래피
```
❌ Netflix Sans 외 다른 폰트(Bebas Neue, Noto Sans KR 등) 사용
❌ 정의된 타입 스케일 외 임의의 font-size 사용
❌ font-weight: 300(Light) UI 텍스트에 사용
❌ 버튼 텍스트를 16px 미만으로 사용
❌ 섹션 타이틀을 18px 미만으로 사용
❌ 뱃지·라벨 텍스트를 12px 미만으로 사용 (탭 카운트 10px 제외)
```

### 레이아웃
```
❌ 카드 그리드 gap을 8px 이외로 설정
❌ 섹션 margin-bottom을 40px 이외로 설정
❌ 좌우 패딩을 40px 이외로 설정
```

### 컴포넌트
```
❌ 버튼 border-radius를 4px 이외로 사용
❌ 카드 hover 시 border 추가 (shadow만 허용)
❌ 진행 바 색상을 빨간색 이외로 사용
```

---

## CSS 변수 정의 (globals.css 기준)

```css
:root {
  --bg-color:        #141414;
  --bg2:             #1a1a1a;
  --bg3:             #222222;
  --red:             #E50914;
  --red-dark:        #B00710;
  --white:           #ffffff;
  --gray1:           #999999;
  --gray2:           #555555;
  --gray3:           #2a2a2a;
  --header-height:   56px;
  --main-menu-width: 80px;
}
```

---

## PR 전 체크리스트

- [ ] 새로 사용한 색상이 팔레트 내에 있는가?
- [ ] 폰트 크기가 타입 스케일 표에 있는 값인가?
- [ ] 간격이 8px 단위인가?
- [ ] 버튼은 Primary / Secondary / Small 중 하나인가?
- [ ] 카드 hover에 transform + box-shadow가 적용되었는가?
- [ ] 이미지 fallback(`background: #222`) 처리가 되어 있는가?
- [ ] `next/image fill` 사용 시 부모에 `position: relative` + `height` 또는 `aspect-ratio`가 있는가?

---

*본 문서는 디자인·개발 팀 공통 기준입니다. 수정이 필요한 경우 팀장 확인 후 반영합니다.*
