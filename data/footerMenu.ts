export type FooterMenuItem = {
  label: string;
  href: string;
};

export type FooterMenuGroup = {
  label: string;
  items: FooterMenuItem[];
};

export const FOOTER_MENU_GROUPS: FooterMenuGroup[] = [
  {
    label: "고객 지원",
    items: [
      { label: "고객 센터", href: "/contact?tab=faq" },
      { label: "문의하기", href: "/contact?tab=inquiry" },
      { label: "화면 해설", href: "/info/audio-guide" },
    ],
  },
  {
    label: "회사",
    items: [
      { label: "회사 정보", href: "/info/company" },
      { label: "투자 정보(IR)", href: "/info/ir" },
      { label: "미디어 센터", href: "/info/media-center" },
    ],
  },
  {
    label: "정책",
    items: [
      { label: "이용 약관", href: "/info/terms" },
      { label: "개인정보", href: "/info/privacy" },
      { label: "법적 고지", href: "/info/legal" },
      { label: "쿠키 설정", href: "/info/cookies" },
    ],
  },
];
