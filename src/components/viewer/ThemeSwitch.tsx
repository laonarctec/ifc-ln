import { Moon, Sun } from "lucide-react";
import { useViewerStore } from "@/stores";
import { ToolbarButton } from "./ToolbarButton";

export function ThemeSwitch() {
  const theme = useViewerStore((state) => state.theme);
  const toggleTheme = useViewerStore((state) => state.toggleTheme);

  return (
    <ToolbarButton
      icon={theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      label="테마 전환"
      ariaLabel={theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}
      tooltip={{
        title: theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환",
        stateText: `현재: ${theme === "light" ? "라이트 모드" : "다크 모드"}`,
      }}
      onClick={toggleTheme}
    />
  );
}
