import { useEffect, type MutableRefObject } from "react";

export function useToolbarMenuAutoClose(
  toolbarRef: MutableRefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;

      const openDetails = toolbar.querySelectorAll("details[open]");
      for (const details of openDetails) {
        if (!details.contains(event.target as Node)) {
          details.removeAttribute("open");
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [toolbarRef]);
}
