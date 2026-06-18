export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  id: string;
  icon: string;
  name: string;
  items: FaqItem[];
}
