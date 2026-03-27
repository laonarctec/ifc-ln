import { useEffect } from "react";

export function useThemeSync(theme: "light" | "dark") {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
}
