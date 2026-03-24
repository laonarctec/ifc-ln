import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal, flushSync } from "react-dom";

export interface TooltipContentData {
  title: string;
  shortcut?: string;
  stateText?: string | null;
  detailText?: string | null;
  disabledReason?: string | null;
}

interface TooltipProps {
  content: TooltipContentData | null;
  children: ReactNode;
  asChild?: boolean;
  hidden?: boolean;
  hideWhenDetailsOpen?: boolean;
  className?: string;
}

interface TooltipPosition {
  left: number;
  top: number;
}

function composeEventHandlers<E>(
  theirHandler: ((event: E) => void) | undefined,
  ourHandler: (event: E) => void,
) {
  return (event: E) => {
    theirHandler?.(event);
    ourHandler(event);
  };
}

function TooltipBody({
  id,
  content,
  className,
  position,
  contentRef,
}: {
  id: string;
  content: TooltipContentData;
  className?: string;
  position: TooltipPosition;
  contentRef: Ref<HTMLDivElement>;
}) {
  return (
    <div
      id={id}
      ref={contentRef}
      role="tooltip"
      className={className ?? "toolbar-tooltip"}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: "translateX(-50%)",
      }}
    >
      <div className="toolbar-tooltip-title-row">
        <strong className="toolbar-tooltip-title">{content.title}</strong>
        {content.shortcut && (
          <kbd className="toolbar-tooltip-shortcut">{content.shortcut}</kbd>
        )}
      </div>
      {content.stateText ? (
        <div className="toolbar-tooltip-meta">{content.stateText}</div>
      ) : null}
      {content.detailText ? (
        <div className="toolbar-tooltip-meta">{content.detailText}</div>
      ) : null}
      {content.disabledReason ? (
        <div className="toolbar-tooltip-disabled">{content.disabledReason}</div>
      ) : null}
    </div>
  );
}

export function Tooltip({
  content,
  children,
  asChild = false,
  hidden = false,
  hideWhenDetailsOpen = false,
  className,
}: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const suppressOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [insideOpenDetails, setInsideOpenDetails] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ left: 0, top: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = contentRef.current;
    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 10;
    const preferredTop = triggerRect.bottom + 10;
    const fallbackTop = Math.max(padding, triggerRect.top - tooltipRect.height - 10);
    const top =
      preferredTop + tooltipRect.height <= window.innerHeight - padding
        ? preferredTop
        : fallbackTop;
    const anchorCenter = triggerRect.left + triggerRect.width / 2;
    const halfWidth = tooltipRect.width / 2;
    const left = Math.min(
      window.innerWidth - padding - halfWidth,
      Math.max(padding + halfWidth, anchorCenter),
    );

    setPosition({ left, top });
  }, []);

  const closeTooltip = useCallback(() => {
    setOpen(false);
  }, []);

  const dismissTooltip = useCallback(() => {
    suppressOpenRef.current = true;
    flushSync(() => {
      setOpen(false);
    });
  }, []);

  const openTooltip = useCallback(() => {
    if (
      !content ||
      hidden ||
      suppressOpenRef.current ||
      (hideWhenDetailsOpen && insideOpenDetails)
    ) {
      return;
    }
    setOpen(true);
  }, [content, hidden, hideWhenDetailsOpen, insideOpenDetails]);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || !hideWhenDetailsOpen) {
      setInsideOpenDetails(false);
      return;
    }

    const details = trigger.closest("details");
    if (!details) {
      setInsideOpenDetails(false);
      return;
    }

    const syncOpenState = () => {
      const next = details.open;
      setInsideOpenDetails(next);
      if (next) closeTooltip();
    };

    syncOpenState();
    const observer = new MutationObserver(syncOpenState);
    observer.observe(details, { attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, [children, closeTooltip, hideWhenDetailsOpen]);

  useEffect(() => {
    if (!open) return;

    const handleWindowChange = () => updatePosition();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTooltip();
    };
    const handleWindowBlur = () => closeTooltip();
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        closeTooltip();
      }
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [closeTooltip, open, updatePosition]);

  useLayoutEffect(() => {
    if (!open || hidden || (hideWhenDetailsOpen && insideOpenDetails)) return;
    updatePosition();
  }, [hidden, hideWhenDetailsOpen, insideOpenDetails, open, updatePosition]);

  useEffect(() => {
    if (hidden || (hideWhenDetailsOpen && insideOpenDetails)) {
      closeTooltip();
    }
  }, [closeTooltip, hidden, hideWhenDetailsOpen, insideOpenDetails]);

  if (!content) {
    return <>{children}</>;
  }

  const handleMouseEnter = useCallback(() => {
    if (suppressOpenRef.current) {
      suppressOpenRef.current = false;
    }
    openTooltip();
  }, [openTooltip]);

  const triggerProps: HTMLAttributes<HTMLElement> & { ref: Ref<HTMLElement> } = {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
    },
    onMouseEnter: handleMouseEnter,
    onMouseLeave: closeTooltip,
    onPointerDownCapture: dismissTooltip,
    onClick: dismissTooltip,
    onFocusCapture: openTooltip,
    onBlurCapture: (event) => {
      const nextTarget = (event as FocusEvent<HTMLElement>).relatedTarget as Node | null;
      if (nextTarget && triggerRef.current?.contains(nextTarget)) return;
      if (nextTarget) {
        suppressOpenRef.current = false;
      }
      closeTooltip();
    },
    "aria-describedby": open ? tooltipId : undefined,
  };

  const shouldRenderTooltip =
    open && !hidden && (!hideWhenDetailsOpen || !insideOpenDetails);

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{
      ref?: Ref<HTMLElement>;
      onMouseEnter?: (event: ReactMouseEvent<HTMLElement>) => void;
      onMouseLeave?: (event: ReactMouseEvent<HTMLElement>) => void;
      onPointerDownCapture?: (event: ReactPointerEvent<HTMLElement>) => void;
      onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
      onFocusCapture?: (event: FocusEvent<HTMLElement>) => void;
      onBlurCapture?: (event: FocusEvent<HTMLElement>) => void;
      "aria-describedby"?: string;
    }>;

    return (
      <>
        {cloneElement(child, {
          ref: triggerProps.ref,
          onMouseEnter: composeEventHandlers(child.props.onMouseEnter, triggerProps.onMouseEnter!),
          onMouseLeave: composeEventHandlers(child.props.onMouseLeave, triggerProps.onMouseLeave!),
          onPointerDownCapture: composeEventHandlers(
            child.props.onPointerDownCapture,
            triggerProps.onPointerDownCapture!,
          ),
          onClick: composeEventHandlers(child.props.onClick, triggerProps.onClick!),
          onFocusCapture: composeEventHandlers(child.props.onFocusCapture, triggerProps.onFocusCapture!),
          onBlurCapture: composeEventHandlers(child.props.onBlurCapture, triggerProps.onBlurCapture!),
          "aria-describedby": triggerProps["aria-describedby"],
        })}
        {shouldRenderTooltip
          ? createPortal(
              <TooltipBody
                id={tooltipId}
                content={content}
                className={className}
                position={position}
                contentRef={contentRef}
              />,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <>
      <span
        ref={triggerProps.ref as Ref<HTMLSpanElement>}
        className="tooltip-anchor"
        onMouseEnter={triggerProps.onMouseEnter}
        onMouseLeave={triggerProps.onMouseLeave}
        onPointerDownCapture={triggerProps.onPointerDownCapture}
        onClick={triggerProps.onClick}
        onFocusCapture={triggerProps.onFocusCapture}
        onBlurCapture={triggerProps.onBlurCapture}
        aria-describedby={triggerProps["aria-describedby"]}
      >
        {Children.only(children)}
      </span>
      {shouldRenderTooltip
        ? createPortal(
            <TooltipBody
              id={tooltipId}
              content={content}
              className={className}
              position={position}
              contentRef={contentRef}
            />,
            document.body,
          )
        : null}
    </>
  );
}
