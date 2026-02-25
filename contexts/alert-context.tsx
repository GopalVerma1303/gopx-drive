"use client";

import { AlertModal } from "@/components/alert-modal";
import type { AlertModalVariant } from "@/components/alert-modal";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";

export type AlertButtonStyle = "cancel" | "destructive" | "default";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
}

export type AlertOptions =
  | [title: string]
  | [title: string, message?: string]
  | [title: string, message?: string, buttons?: AlertButton[]];

interface AlertContextValue {
  /**
   * Show an alert modal. API matches React Native's Alert.alert for easy migration:
   * - alert(title)
   * - alert(title, message)
   * - alert(title, message, buttons)
   * When no buttons are given, shows a single "OK" button.
   */
  alert: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
}

const initialState: AlertState = {
  visible: false,
  title: "",
  message: "",
  buttons: [],
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AlertState>(initialState);

  const alert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      const normalizedButtons = buttons ?? [{ text: "OK" }];
      setState({
        visible: true,
        title,
        message: message ?? "",
        buttons: normalizedButtons,
      });
    },
    []
  );

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const value: AlertContextValue = { alert };

  // Map buttons to modal: 0 → no cancel, 1 → single button (confirm only), 2+ → cancel + confirm
  const hasCancel = state.buttons.length >= 2;
  const cancelButton = hasCancel ? state.buttons[0] : null;
  const confirmButton =
    state.buttons.length >= 2 ? state.buttons[1] : state.buttons[0];
  // Only explicitly destructive actions get the destructive variant (red).
  // Everything else uses the default variant, which renders in neutral/white.
  const variant: AlertModalVariant =
    confirmButton?.style === "destructive" ? "destructive" : "default";

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertModal
        visible={state.visible}
        title={state.title}
        description={state.message || undefined}
        showCancelButton={hasCancel}
        cancelLabel={cancelButton?.text ?? "Cancel"}
        confirmLabel={confirmButton?.text ?? "OK"}
        variant={variant}
        onCancel={() => {
          cancelButton?.onPress?.();
          hide();
        }}
        onConfirm={() => {
          if (state.buttons.length >= 2) {
            confirmButton?.onPress?.();
          } else {
            confirmButton?.onPress?.();
          }
          hide();
        }}
      />
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return ctx;
}
