import { create } from "zustand";

interface SubscribeModalStore {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export const useSubscribeModalStore = create<SubscribeModalStore>((set) => ({
  isOpen: false,
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}));
