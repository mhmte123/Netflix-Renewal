"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./confirmModal.scss";

type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = Required<Pick<ConfirmOptions, "confirmLabel" | "cancelLabel">> &
  Omit<ConfirmOptions, "confirmLabel" | "cancelLabel">;

const DEFAULT_CONFIRM_STATE: ConfirmState = {
  title: "확인",
  message: "",
  confirmLabel: "확인",
  cancelLabel: "취소",
  destructive: true,
};

export function useConfirmModal() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const nextOptions =
      typeof options === "string" ? { message: options } : options;

    setState({
      ...DEFAULT_CONFIRM_STATE,
      ...nextOptions,
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
    };
  }, []);

  const modal = state ? (
    <ConfirmModal
      {...state}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;

  return { confirm, modal };
}

type ConfirmModalProps = ConfirmState & {
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <button
        className="confirm-modal__backdrop"
        type="button"
        aria-label="확인 모달 닫기"
        onClick={onCancel}
      />
      <div className="confirm-modal__panel">
        <div className="confirm-modal__mark" aria-hidden="true">
          !
        </div>
        <h2 id="confirm-modal-title">{title}</h2>
        <div className="confirm-modal__message">{message}</div>
        <div className="confirm-modal__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-modal__button confirm-modal__button--secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-modal__button confirm-modal__button--primary${
              destructive ? " is-destructive" : ""
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
