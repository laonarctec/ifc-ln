import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Box,
  Building2,
  Camera,
  Compass,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  Focus,
  FolderOpen,
  Home,
  Info,
  Keyboard,
  Layers,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Workflow,
} from "lucide-react";
import { useWebIfc } from "@/hooks/useWebIfc";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import { useViewportGeometry } from "@/services/viewportGeometryStore";
import { useViewerStore } from "@/stores";
import { addToast } from "@/components/ui/Toast";
import { captureViewportScreenshot } from "@/utils/screenshot";
import {
  exportElementPropertiesCSV,
  exportSpatialTreeCSV,
  exportSpatialTreeJSON,
} from "@/utils/exportUtils";
import type { IfcSpatialNode, PropertySectionKind } from "@/types/worker-messages";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ThemeSwitch } from "./ThemeSwitch";
import { collectStoreys } from "./hierarchy/treeDataBuilder";
import {
  ENGINE_STATE_LABEL,
  TYPE_VISIBILITY_CONFIGS,
  VIEW_PRESET_CONFIGS,
  EngineStatusChip,
  ToolbarActionButtons,
  ToolbarMenu,
  type ToolbarActionConfig,
  type ToolbarMenuConfig,
  type TypeVisibilityKey,
} from "./mainToolbarPrimitives";

const PROPERTY_EXPORT_SECTIONS: PropertySectionKind[] = [
  "attributes",
  "propertySets",
  "quantitySets",
  "typeProperties",
  "materials",
  "documents",
  "classifications",
  "metadata",
  "relations",
  "inverseRelations",
];

export function MainToolbar() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const leftPanelCollapsed = useViewerStore((state) => state.leftPanelCollapsed);
  const rightPanelCollapsed = useViewerStore((state) => state.rightPanelCollapsed);
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const viewportProjectionMode = useViewerStore((state) => state.viewportProjectionMode);
  const hoverTooltipsEnabled = useViewerStore((state) => state.hoverTooltipsEnabled);
  const edgesVisible = useViewerStore((state) => state.edgesVisible);
  const typeVisibility = useViewerStore((state) => state.typeVisibility);
  const toggleLeftPanel = useViewerStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useViewerStore((state) => state.toggleRightPanel);
  const toggleViewportProjectionMode = useViewerStore((state) => state.toggleViewportProjectionMode);
  const toggleHoverTooltips = useViewerStore((state) => state.toggleHoverTooltips);
  const toggleEdgesVisible = useViewerStore((state) => state.toggleEdgesVisible);
  const toggleTypeVisibility = useViewerStore((state) => state.toggleTypeVisibility);
  const isolateEntities = useViewerStore((state) => state.isolateEntities);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const clearSelection = useViewerStore((state) => state.clearSelection);
  const runViewportCommand = useViewerStore((state) => state.runViewportCommand);
  const setActiveStoreyFilter = useViewerStore((state) => state.setActiveStoreyFilter);
  const {
    loadFile,
    resetSession,
    loading,
    initEngine,
    engineState,
    engineMessage,
    currentFileName,
    currentModelId,
    spatialTree,
  } = useWebIfc();
  const { manifest } = useViewportGeometry();
  const toolbarRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entityIds = useMemo(
    () => [...new Set(manifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? [])],
    [manifest],
  );
  const storeys = useMemo(() => collectStoreys(spatialTree), [spatialTree]);
  const typeGeometryExists = useMemo<Record<TypeVisibilityKey, boolean>>(() => {
    const result = { spaces: false, openings: false, site: false };
    for (const node of spatialTree) {
      checkTypeGeometry(node, result);
      if (result.spaces && result.openings && result.site) {
        break;
      }
    }
    return result;
  }, [spatialTree]);

  const hasRenderableGeometry = entityIds.length > 0;
  const hasSelection = selectedEntityIds.length > 0;
  const hasSpatialTree = spatialTree.length > 0;
  const geometryDisabledReason = "로드된 지오메트리가 없습니다";
  const selectionDisabledReason = "선택된 객체가 없습니다";
  const spatialTreeDisabledReason = "공간 트리 데이터가 없습니다";
  const modelDisabledReason = "로드된 모델이 없습니다";

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
  }, []);

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await loadFile(file);
      addToast("success", `${file.name} 로딩 완료`);
    } catch (error) {
      console.error(error);
      addToast("error", `파일 로딩 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleHideSelection = useCallback(() => {
    if (!hasSelection) return;
    for (const id of selectedEntityIds) {
      hideEntity(id);
    }
    clearSelection();
  }, [clearSelection, hasSelection, hideEntity, selectedEntityIds]);

  const handleScreenshot = useCallback(() => {
    const viewport = document.querySelector(".viewer-viewport__canvas");
    if (!viewport) {
      addToast("error", "캡처할 뷰포트가 없습니다");
      return;
    }

    const result = captureViewportScreenshot(viewport as HTMLElement);
    if (result) {
      addToast("success", "스크린샷이 저장되었습니다");
      return;
    }

    addToast("error", "캡처할 뷰포트가 없습니다");
  }, []);

  const handleExportJSON = useCallback(() => {
    if (!hasSpatialTree) return;
    exportSpatialTreeJSON(spatialTree, `${currentFileName ?? "model"}-spatial.json`);
    addToast("success", "JSON 파일이 저장되었습니다");
  }, [currentFileName, hasSpatialTree, spatialTree]);

  const handleExportSpatialCSV = useCallback(() => {
    if (!hasSpatialTree) return;
    exportSpatialTreeCSV(spatialTree, `${currentFileName ?? "model"}-spatial.csv`);
    addToast("success", "공간 트리 CSV 파일이 저장되었습니다");
  }, [currentFileName, hasSpatialTree, spatialTree]);

  const handleExportPropertiesCSV = useCallback(async () => {
    if (currentModelId === null || selectedEntityId === null) {
      return;
    }

    try {
      const result = await ifcWorkerClient.getPropertiesSections(
        currentModelId,
        selectedEntityId,
        PROPERTY_EXPORT_SECTIONS,
      );
      exportElementPropertiesCSV(
        result.properties,
        `${currentFileName ?? "model"}-entity-${selectedEntityId}-properties.csv`,
      );
      addToast("success", "선택 객체 속성 CSV 파일이 저장되었습니다");
    } catch (error) {
      console.error(error);
      addToast("error", `속성 CSV 내보내기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }, [currentFileName, currentModelId, selectedEntityId]);

  const panelActions: ToolbarActionConfig[] = [
    {
      id: "toggle-left-panel",
      icon: leftPanelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />,
      label: "계층 패널",
      onClick: toggleLeftPanel,
      tooltip: {
        title: leftPanelCollapsed ? "계층 패널 열기" : "계층 패널 닫기",
        stateText: `현재: ${leftPanelCollapsed ? "숨김" : "표시 중"}`,
      },
    },
    {
      id: "toggle-right-panel",
      icon: rightPanelCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />,
      label: "속성 패널",
      onClick: toggleRightPanel,
      tooltip: {
        title: rightPanelCollapsed ? "속성 패널 열기" : "속성 패널 닫기",
        stateText: `현재: ${rightPanelCollapsed ? "숨김" : "표시 중"}`,
      },
    },
  ];

  const fileActions: ToolbarActionConfig[] = [
    {
      id: "init-engine",
      icon: <Workflow size={16} />,
      label: "엔진 초기화",
      onClick: () => {
        void initEngine();
      },
      disabled: engineState === "initializing" || engineState === "ready",
      tooltip: {
        title: "엔진 초기화",
        stateText: `현재: ${ENGINE_STATE_LABEL[engineState]}`,
        detailText: engineMessage,
        disabledReason:
          engineState === "ready"
            ? "엔진이 이미 준비되었습니다"
            : engineState === "initializing"
              ? "엔진을 초기화하는 중입니다"
              : null,
      },
    },
    {
      id: "open-ifc",
      icon: <FolderOpen size={16} />,
      label: "IFC 파일 열기",
      onClick: handleOpenFile,
      variant: "primary",
      disabled: loading || engineState !== "ready",
      tooltip: {
        title: "IFC 파일 열기",
        detailText: loading ? "새 파일을 열기 전에 현재 작업이 끝나야 합니다" : null,
        disabledReason:
          engineState !== "ready"
            ? "엔진 초기화 후 사용할 수 있습니다"
            : loading
              ? "모델을 로딩 중입니다"
              : null,
      },
    },
    {
      id: "reset-session",
      icon: <RefreshCcw size={16} />,
      label: "세션 초기화",
      onClick: () => {
        void resetSession();
      },
      tooltip: {
        title: "현재 세션 초기화",
        detailText: "로드된 모델, 선택, 필터, 캐시 상태를 초기화합니다",
      },
    },
  ];

  const visibilityActions: ToolbarActionConfig[] = [
    {
      id: "hide-selection",
      icon: <EyeOff size={16} />,
      label: "선택 객체 숨기기",
      onClick: handleHideSelection,
      disabled: !hasRenderableGeometry || !hasSelection,
      tooltip: {
        title: "선택 객체 숨기기",
        shortcut: "H",
        disabledReason: !hasRenderableGeometry
          ? geometryDisabledReason
          : !hasSelection
            ? selectionDisabledReason
            : null,
      },
    },
    {
      id: "show-all",
      icon: <Eye size={16} />,
      label: "전체 다시 보기",
      onClick: resetHiddenEntities,
      disabled: !hasRenderableGeometry,
      tooltip: {
        title: "전체 다시 보기",
        shortcut: "S",
        disabledReason: !hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
    {
      id: "isolate-selection",
      icon: <Layers size={16} />,
      label: "선택 객체만 보기",
      onClick: () => {
        if (hasSelection) {
          isolateEntities(selectedEntityIds, entityIds);
        }
      },
      disabled: !hasRenderableGeometry || !hasSelection,
      tooltip: {
        title: "선택 객체만 보기",
        shortcut: "I",
        disabledReason: !hasRenderableGeometry
          ? geometryDisabledReason
          : !hasSelection
            ? selectionDisabledReason
            : null,
      },
    },
  ];

  const cameraActions: ToolbarActionConfig[] = [
    {
      id: "fit-selected",
      icon: <Focus size={16} />,
      label: "선택 객체 맞춤",
      onClick: () => runViewportCommand("fit-selected"),
      disabled: !hasRenderableGeometry || !hasSelection,
      tooltip: {
        title: "선택 객체에 맞춰 보기",
        shortcut: "F",
        disabledReason: !hasRenderableGeometry
          ? geometryDisabledReason
          : !hasSelection
            ? selectionDisabledReason
            : null,
      },
    },
    {
      id: "fit-all",
      icon: <Maximize2 size={16} />,
      label: "전체 맞춤",
      onClick: () => runViewportCommand("fit-all"),
      disabled: !hasRenderableGeometry,
      tooltip: {
        title: "전체 모델에 맞춰 보기",
        shortcut: "Z",
        disabledReason: !hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
    {
      id: "home-view",
      icon: <Home size={16} />,
      label: "홈 뷰",
      onClick: () => runViewportCommand("home"),
      disabled: !hasRenderableGeometry,
      tooltip: {
        title: "홈 뷰로 이동",
        shortcut: "0",
        disabledReason: !hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
    {
      id: "projection-mode",
      icon: <Box size={16} />,
      label: "투영 전환",
      onClick: toggleViewportProjectionMode,
      variant: "toggle",
      active: viewportProjectionMode === "orthographic",
      disabled: !hasRenderableGeometry,
      tooltip: {
        title:
          viewportProjectionMode === "perspective"
            ? "직교 투영으로 전환"
            : "원근 투영으로 전환",
        stateText: `현재: ${viewportProjectionMode === "perspective" ? "원근 투영" : "직교 투영"}`,
        disabledReason: !hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
    {
      id: "hover-tooltips",
      icon: <Info size={16} />,
      label: "호버 툴팁",
      onClick: toggleHoverTooltips,
      variant: "toggle",
      active: hoverTooltipsEnabled,
      tooltip: {
        title: hoverTooltipsEnabled ? "호버 툴팁 끄기" : "호버 툴팁 켜기",
        stateText: `현재: ${hoverTooltipsEnabled ? "켜짐" : "꺼짐"}`,
      },
    },
    {
      id: "edge-visibility",
      icon: <Workflow size={16} />,
      label: "에지 표시",
      onClick: toggleEdgesVisible,
      variant: "toggle",
      active: edgesVisible,
      disabled: !hasRenderableGeometry,
      tooltip: {
        title: edgesVisible ? "에지 표시 끄기" : "에지 표시 켜기",
        stateText: `현재: ${edgesVisible ? "켜짐" : "꺼짐"}`,
        disabledReason: !hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
  ];

  const utilityActions: ToolbarActionConfig[] = [
    {
      id: "keyboard-shortcuts",
      icon: <Keyboard size={16} />,
      label: "키보드 단축키",
      onClick: () => setShortcutsOpen(true),
      tooltip: {
        title: "키보드 단축키 보기",
        shortcut: "?",
        detailText: "지원되는 단축키 목록을 확인합니다",
      },
    },
  ];

  const viewMenu: ToolbarMenuConfig = {
    id: "view-presets",
    icon: <Compass size={16} />,
    label: "View",
    tooltip: {
      title: "뷰 프리셋 열기",
      detailText: "자주 쓰는 카메라 방향을 빠르게 선택합니다",
    },
    items: VIEW_PRESET_CONFIGS.map((preset) => ({
      kind: "action",
      id: preset.id,
      label: preset.label,
      shortcut: preset.shortcut,
      onSelect: () => runViewportCommand(preset.command),
      disabled: !hasRenderableGeometry,
      closeOnSelect: true,
      tooltip: {
        title: preset.title,
        shortcut: preset.shortcut,
        disabledReason: !hasRenderableGeometry ? geometryDisabledReason : null,
      },
    })),
  };

  const floorplanMenu: ToolbarMenuConfig | null =
    storeys.length > 0
      ? {
          id: "floorplan",
          icon: <Building2 size={16} />,
          label: "",
          tooltip: {
            title: "층별 빠른 보기",
            detailText: "층 범위를 선택해 빠르게 탐색합니다",
          },
          items: storeys.map((storey) => {
            const elevationLabel =
              storey.elevation !== null
                ? `${storey.elevation >= 0 ? "+" : ""}${storey.elevation.toFixed(1)}m`
                : undefined;

            return {
              kind: "action" as const,
              id: `storey-${storey.expressID}`,
              label: storey.name,
              icon: <Building2 size={14} />,
              shortcut: elevationLabel,
              onSelect: () => setActiveStoreyFilter(storey.expressID),
              closeOnSelect: true,
              tooltip: {
                title: `${storey.name} 보기`,
                detailText: elevationLabel
                  ? `표고: ${elevationLabel}`
                  : "선택한 층으로 빠르게 필터링합니다",
              },
            };
          }),
        }
      : null;

  const classVisibilityItems = TYPE_VISIBILITY_CONFIGS.filter(
    ({ key }) => typeGeometryExists[key],
  ).map((config) => ({
    kind: "check" as const,
    id: `type-visibility-${config.key}`,
    label: config.label,
    checked: typeVisibility[config.key],
    color: config.color,
    onSelect: () => toggleTypeVisibility(config.key),
    tooltip: {
      title: typeVisibility[config.key] ? config.enabledTitle : config.disabledTitle,
      stateText: `현재: ${typeVisibility[config.key] ? "표시 중" : "숨김"}`,
    },
  }));

  const classVisibilityMenu: ToolbarMenuConfig | null =
    classVisibilityItems.length > 0
      ? {
          id: "class-visibility",
          icon: <Layers size={16} />,
          label: "",
          tooltip: {
            title: "클래스별 표시 설정",
            detailText: "공간, 개구부, Site 표시 여부를 전환합니다",
          },
          items: classVisibilityItems,
        }
      : null;

  const exportMenu: ToolbarMenuConfig = {
    id: "export",
    icon: <Download size={16} />,
    label: "",
    tooltip: {
      title: "내보내기 메뉴 열기",
      detailText: "스크린샷, 속성 CSV, 공간 트리 JSON/CSV를 저장합니다",
    },
    items: [
      {
        kind: "action",
        id: "export-screenshot",
        label: "Screenshot",
        icon: <Camera size={14} />,
        onSelect: handleScreenshot,
        disabled: !hasRenderableGeometry,
        closeOnSelect: true,
        tooltip: {
          title: "스크린샷 저장",
          disabledReason: !hasRenderableGeometry ? geometryDisabledReason : null,
        },
      },
      {
        kind: "action",
        id: "export-properties-csv",
        label: "Properties CSV",
        icon: <FileText size={14} />,
        onSelect: () => {
          void handleExportPropertiesCSV();
        },
        disabled: currentModelId === null || selectedEntityId === null,
        closeOnSelect: true,
        tooltip: {
          title: "선택 객체 속성 CSV 저장",
          disabledReason:
            currentModelId === null
              ? modelDisabledReason
              : selectedEntityId === null
                ? selectionDisabledReason
                : null,
        },
      },
      { kind: "divider", id: "export-divider" },
      {
        kind: "action",
        id: "export-json",
        label: "Export JSON",
        icon: <FileJson size={14} />,
        onSelect: handleExportJSON,
        disabled: !hasSpatialTree,
        closeOnSelect: true,
        tooltip: {
          title: "공간 트리 JSON 저장",
          disabledReason: !hasSpatialTree ? spatialTreeDisabledReason : null,
        },
      },
      {
        kind: "action",
        id: "export-csv",
        label: "Export CSV",
        icon: <FileText size={14} />,
        onSelect: handleExportSpatialCSV,
        disabled: !hasSpatialTree,
        closeOnSelect: true,
        tooltip: {
          title: "공간 트리 CSV 저장",
          disabledReason: !hasSpatialTree ? spatialTreeDisabledReason : null,
        },
      },
    ],
  };

  const engineStatusTooltip = {
    title: `엔진 상태: ${ENGINE_STATE_LABEL[engineState]}`,
    stateText: `현재: ${ENGINE_STATE_LABEL[engineState]}`,
    detailText: engineMessage,
  };

  return (
    <header ref={toolbarRef} className="toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,.ifcz"
        className="viewer-hidden-input"
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />

      <div className="flex items-center gap-3 shrink-0 min-w-0">
        <div className="grid min-w-0 gap-0.5">
          <strong className="text-[0.95rem] text-slate-900 leading-[1.15] overflow-hidden text-ellipsis whitespace-nowrap dark:text-slate-100">
            IFC Viewer
          </strong>
          <small className="text-slate-500 text-[0.68rem] leading-[1.1] overflow-hidden text-ellipsis whitespace-nowrap dark:text-slate-400">
            {currentFileName ?? "No model loaded"}
          </small>
        </div>
      </div>

      <div className="flex items-center flex-wrap justify-center flex-1 gap-3 overflow-visible">
        <div className="toolbar-group">
          <ToolbarActionButtons actions={panelActions} />
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarActionButtons actions={fileActions} />
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarActionButtons actions={visibilityActions} />
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarActionButtons actions={cameraActions} />
          <ToolbarMenu menu={viewMenu} />
          {floorplanMenu ? <ToolbarMenu menu={floorplanMenu} /> : null}
          {classVisibilityMenu ? <ToolbarMenu menu={classVisibilityMenu} /> : null}
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarMenu menu={exportMenu} />
          <ToolbarActionButtons actions={utilityActions} />
          <ThemeSwitch />
        </div>

        <div className="inline-flex items-center gap-2.5">
          <EngineStatusChip engineState={engineState} tooltip={engineStatusTooltip} />
        </div>
      </div>

      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </header>
  );
}

function checkTypeGeometry(
  node: IfcSpatialNode,
  result: { spaces: boolean; openings: boolean; site: boolean },
) {
  const typeName = node.type?.toUpperCase();
  if (typeName === "IFCSPACE") result.spaces = true;
  if (typeName === "IFCSITE") result.site = true;

  node.elements?.forEach((element) => {
    const elementType = element.ifcType?.toUpperCase();
    if (elementType === "IFCSPACE") result.spaces = true;
    if (elementType === "IFCOPENINGELEMENT") result.openings = true;
    if (elementType === "IFCSITE") result.site = true;
  });

  for (const child of node.children) {
    if (result.spaces && result.openings && result.site) return;
    checkTypeGeometry(child, result);
  }
}
