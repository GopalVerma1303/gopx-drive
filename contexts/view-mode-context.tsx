import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ViewMode = "list" | "grid";

type ViewModeKey =
  | "home"
  | "notes"
  | "files"
  | "folders"
  | "attachments";

type ViewModeState = Record<ViewModeKey, ViewMode>;

interface ViewModeContextValue {
  modes: ViewModeState;
  isLoaded: boolean;
  getViewMode: (key: ViewModeKey) => ViewMode;
  toggleViewMode: (key: ViewModeKey) => void;
  setViewMode: (key: ViewModeKey, mode: ViewMode) => void;
}

const DEFAULT_MODES: ViewModeState = {
  home: "list",
  notes: "list",
  files: "list",
  folders: "list",
  attachments: "list",
};

const STORAGE_KEY = "@view_modes";

const ViewModeContext = createContext<ViewModeContextValue | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [modes, setModes] = useState<ViewModeState>(DEFAULT_MODES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<ViewModeState>;
          setModes((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(parsed).filter(
                ([key, value]) =>
                  (["home", "notes", "files", "folders", "attachments"] as ViewModeKey[]).includes(
                    key as ViewModeKey,
                  ) && (value === "list" || value === "grid"),
              ),
            ),
          }));
        }
      } catch (error) {
        console.error("Failed to load view modes:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
      } catch (error) {
        console.error("Failed to save view modes:", error);
      }
    };
    save();
  }, [modes, isLoaded]);

  const getViewMode = (key: ViewModeKey): ViewMode => modes[key] ?? DEFAULT_MODES[key];

  const setViewMode = (key: ViewModeKey, mode: ViewMode) => {
    setModes((prev) => {
      if (prev[key] === mode) return prev;
      return { ...prev, [key]: mode };
    });
  };

  const toggleViewMode = (key: ViewModeKey) => {
    setModes((prev) => {
      const current = prev[key] ?? DEFAULT_MODES[key];
      const next = current === "grid" ? "list" : "grid";
      if (next === current) return prev;
      return { ...prev, [key]: next };
    });
  };

  return (
    <ViewModeContext.Provider
      value={{
        modes,
        isLoaded,
        getViewMode,
        toggleViewMode,
        setViewMode,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return ctx;
}

