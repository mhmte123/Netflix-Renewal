import { create } from "zustand";

export interface ToastItem {
  id: number;
  message: string;
  icon?: string;
  // 클릭 지점(버튼) 기준으로 띄울 때의 화면 좌표. 없으면 상단 중앙에 표시.
  anchor?: { x: number; y: number };
  hiding?: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  show: (
    message: string,
    opts?: { icon?: string; anchor?: { x: number; y: number }; duration?: number },
  ) => void;
  remove: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, opts = {}) => {
    const id = ++seq;
    const duration = opts.duration ?? 2200;
    set((s) => ({
      toasts: [...s.toasts, { id, message, icon: opts.icon, anchor: opts.anchor }],
    }));
    // 사라지기 직전 페이드아웃
    setTimeout(() => {
      set((s) => ({
        toasts: s.toasts.map((t) => (t.id === id ? { ...t, hiding: true } : t)),
      }));
    }, Math.max(0, duration - 250));
    setTimeout(() => get().remove(id), duration);
  },
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// 컴포넌트/스토어 어디서든 호출 가능한 단축 함수 (훅 규칙에 얽매이지 않음)
export function showToast(
  message: string,
  opts?: { icon?: string; anchor?: { x: number; y: number }; duration?: number },
) {
  useToastStore.getState().show(message, opts);
}
