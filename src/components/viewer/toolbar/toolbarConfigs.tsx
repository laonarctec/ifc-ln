import {
  Box,
  Building2,
  Camera,
  Code2,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  Focus,
  FolderOpen,
  Grid3x3,
  Home,
  Info,
  Keyboard,
  LayoutGrid,
  Layers,
  Maximize2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCcw,
  Ruler,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  SquareDashed,
  Table2,
  Workflow,
} from "lucide-react";
import type { IfcSpatialNode } from "@/types/worker-messages";
import type { ViewportCommandType, RightPanelMode, BottomPanelMode } from "@/stores/slices/uiSlice";
import {
  ENGINE_STATE_LABEL,
  TYPE_VISIBILITY_CONFIGS,
  VIEW_PRESET_CONFIGS,
  type ToolbarActionConfig,
  type ToolbarMenuConfig,
  type TypeVisibilityKey,
} from "../mainToolbarPrimitives";
import type { StoreyInfo } from "../hierarchy/treeEntityUtils";

export interface ToolbarState {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  hasLoadedModel: boolean;
  viewportProjectionMode: "perspective" | "orthographic";
  hoverTooltipsEnabled: boolean;
  edgesVisible: boolean;
  typeVisibility: Record<TypeVisibilityKey, boolean>;
  interactionMode: string;
  measurement: { mode: string; distance: number | null };
  clippingMode: string;
  clippingPlaneCount: number;
  hasSelectedClippingPlane: boolean;
  selectedClippingPlaneLocked: boolean;
  engineState: "idle" | "initializing" | "ready" | "error";
  engineMessage: string | null;
  loading: boolean;
  hasRenderableGeometry: boolean;
  hasSelection: boolean;
  hasSpatialTree: boolean;
  selectedEntityId: number | null;
  selectedEntityIds: number[];
  currentModelId: number | null;
  currentFileName: string | null;
  trackedChanges: { modelId: number }[];
  typeGeometryExists: Record<TypeVisibilityKey, boolean>;
  storeys: StoreyInfo[];
  rightPanelMode: RightPanelMode;
  bottomPanelMode: BottomPanelMode;
}

export interface ToolbarHandlers {
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleViewportProjectionMode: () => void;
  toggleHoverTooltips: () => void;
  toggleEdgesVisible: () => void;
  toggleTypeVisibility: (key: TypeVisibilityKey) => void;
  toggleMeasurementMode: () => void;
  clearMeasurement: () => void;
  startCreateClippingPlane: () => void;
  flipSelectedClippingPlane: () => void;
  deleteSelectedClippingPlane: () => void;
  clearClippingPlanes: () => void;
  handleExportIfcb: () => Promise<void>;
  initEngineST: () => void;
  initEngineMT: () => void;
  isolateEntities: (ids: number[], allIds: number[], modelId: number | null) => void;
  hideEntity: (id: number, modelId: number | null) => void;
  resetHiddenEntities: () => void;
  clearSelection: () => void;
  runViewportCommand: (type: ViewportCommandType) => void;
  setActiveStoreyFilter: (expressId: number) => void;
  initEngine: () => Promise<void>;
  handleOpenFile: () => void;
  handleAddModel: () => void;
  resetSession: () => Promise<void>;
  setShortcutsOpen: (open: boolean) => void;
  handleScreenshot: () => void;
  handleExportJSON: () => void;
  handleExportSpatialCSV: () => void;
  handleExportPropertiesCSV: () => Promise<void>;
  handleExportActiveIfc: () => Promise<void>;
  handleExportChangedModels: () => Promise<void>;
  toggleRightPanelMode: (mode: RightPanelMode) => void;
  toggleBottomPanelMode: (mode: BottomPanelMode) => void;
}

const geometryDisabledReason = "로드된 지오메트리가 없습니다";
const selectionDisabledReason = "선택된 객체가 없습니다";
const spatialTreeDisabledReason = "공간 트리 데이터가 없습니다";
const modelDisabledReason = "로드된 모델이 없습니다";
const measureDisabledReason = "로드된 모델이 있어야 측정 도구를 사용할 수 있습니다";

export function buildPanelActions(s: ToolbarState, h: ToolbarHandlers): ToolbarActionConfig[] {
  return [
    {
      id: "toggle-left-panel",
      icon: s.leftPanelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />,
      label: "계층 패널",
      onClick: h.toggleLeftPanel,
      tooltip: {
        title: s.leftPanelCollapsed ? "계층 패널 열기" : "계층 패널 닫기",
        stateText: `현재: ${s.leftPanelCollapsed ? "숨김" : "표시 중"}`,
      },
    },
    {
      id: "toggle-right-panel",
      icon: s.rightPanelCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />,
      label: "속성 패널",
      onClick: h.toggleRightPanel,
      tooltip: {
        title: s.rightPanelCollapsed ? "속성 패널 열기" : "속성 패널 닫기",
        stateText: `현재: ${s.rightPanelCollapsed ? "숨김" : "표시 중"}`,
      },
    },
  ];
}

export function buildEngineMenu(s: ToolbarState, h: ToolbarHandlers): ToolbarMenuConfig {
  const isReady = s.engineState === "ready";
  const isBusy = s.engineState === "initializing";

  return {
    id: "engine-init",
    icon: <Workflow size={16} />,
    label: "",
    tooltip: {
      title: "엔진 초기화",
      stateText: `현재: ${ENGINE_STATE_LABEL[s.engineState]}`,
      detailText: s.engineMessage,
    },
    items: [
      {
        kind: "action",
        id: "init-single",
        label: "Single-Thread 초기화",
        onSelect: h.initEngineST,
        disabled: isBusy || isReady,
        closeOnSelect: true,
        tooltip: {
          title: "Single-Thread 모드로 엔진 초기화",
          detailText: "안정적인 기본 모드. 모든 환경에서 동작합니다.",
          disabledReason: isReady ? "엔진이 이미 준비되었습니다" : isBusy ? "초기화 중입니다" : null,
        },
      },
      {
        kind: "action",
        id: "init-multi",
        label: "Multi-Thread 초기화 (실험적)",
        onSelect: h.initEngineMT,
        disabled: isBusy || isReady,
        closeOnSelect: true,
        tooltip: {
          title: "Multi-Thread 모드로 엔진 초기화",
          detailText: "IFC 파싱이 빨라지지만 COOP/COEP 헤더가 필요합니다. 실패 시 자동으로 Single-Thread로 전환됩니다.",
          disabledReason: isReady ? "엔진이 이미 준비되었습니다" : isBusy ? "초기화 중입니다" : null,
        },
      },
    ],
  };
}

export function buildFileActions(s: ToolbarState, h: ToolbarHandlers): ToolbarActionConfig[] {
  return [
    {
      id: "open-ifc",
      icon: <FolderOpen size={16} />,
      label: "새 파일 열기",
      onClick: h.handleOpenFile,
      variant: "primary",
      disabled: s.loading || s.engineState !== "ready",
      tooltip: {
        title: "새 파일 열기",
        detailText: s.loading
          ? "새 파일을 열기 전에 현재 작업이 끝나야 합니다"
          : "현재 세션을 초기화하고 새 파일로 다시 시작합니다",
        disabledReason:
          s.engineState !== "ready"
            ? "엔진 초기화 후 사용할 수 있습니다"
            : s.loading
              ? "모델을 로딩 중입니다"
              : null,
      },
    },
    {
      id: "add-model",
      icon: <Plus size={16} />,
      label: "모델 추가",
      onClick: h.handleAddModel,
      disabled: !s.hasLoadedModel || s.loading || s.engineState !== "ready",
      tooltip: {
        title: "모델 추가",
        detailText: s.loading
          ? "모델을 추가하기 전에 현재 작업이 끝나야 합니다"
          : "현재 세션을 유지한 채 모델을 추가합니다",
        disabledReason:
          s.engineState !== "ready"
            ? "엔진 초기화 후 사용할 수 있습니다"
            : s.loading
              ? "모델을 로딩 중입니다"
              : !s.hasLoadedModel
                ? modelDisabledReason
                : null,
      },
    },
    {
      id: "reset-session",
      icon: <RefreshCcw size={16} />,
      label: "세션 초기화",
      onClick: () => { void h.resetSession(); },
      tooltip: {
        title: "현재 세션 초기화",
        detailText: "로드된 모델, 선택, 필터, 캐시 상태를 초기화합니다",
      },
    },
  ];
}

export function buildVisibilityActions(s: ToolbarState, h: ToolbarHandlers, entityIds: number[]): ToolbarActionConfig[] {
  return [
    {
      id: "hide-selection",
      icon: <EyeOff size={16} />,
      label: "선택 객체 숨기기",
      onClick: () => {
        if (!s.hasSelection) return;
        for (const id of s.selectedEntityIds) {
          h.hideEntity(id, s.currentModelId);
        }
        h.clearSelection();
      },
      disabled: !s.hasRenderableGeometry || !s.hasSelection,
      tooltip: {
        title: "선택 객체 숨기기",
        shortcut: "H",
        disabledReason: !s.hasRenderableGeometry
          ? geometryDisabledReason
          : !s.hasSelection
            ? selectionDisabledReason
            : null,
      },
    },
    {
      id: "show-all",
      icon: <Eye size={16} />,
      label: "전체 다시 보기",
      onClick: h.resetHiddenEntities,
      disabled: !s.hasRenderableGeometry,
      tooltip: {
        title: "전체 다시 보기",
        shortcut: "S",
        disabledReason: !s.hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
    {
      id: "isolate-selection",
      icon: <Layers size={16} />,
      label: "선택 객체만 보기",
      onClick: () => {
        if (s.hasSelection) {
          h.isolateEntities(s.selectedEntityIds, entityIds, s.currentModelId);
        }
      },
      disabled: !s.hasRenderableGeometry || !s.hasSelection,
      tooltip: {
        title: "선택 객체만 보기",
        shortcut: "I",
        disabledReason: !s.hasRenderableGeometry
          ? geometryDisabledReason
          : !s.hasSelection
            ? selectionDisabledReason
            : null,
      },
    },
  ];
}

export function buildCameraActions(s: ToolbarState, h: ToolbarHandlers): ToolbarActionConfig[] {
  return [
    {
      id: "fit-selected",
      icon: <Focus size={16} />,
      label: "선택 객체 맞춤",
      onClick: () => h.runViewportCommand("fit-selected"),
      disabled: !s.hasRenderableGeometry || !s.hasSelection,
      tooltip: {
        title: "선택 객체에 맞춰 보기",
        shortcut: "F",
        disabledReason: !s.hasRenderableGeometry
          ? geometryDisabledReason
          : !s.hasSelection
            ? selectionDisabledReason
            : null,
      },
    },
    {
      id: "fit-all",
      icon: <Maximize2 size={16} />,
      label: "전체 맞춤",
      onClick: () => h.runViewportCommand("fit-all"),
      disabled: !s.hasRenderableGeometry,
      tooltip: {
        title: "전체 모델에 맞춰 보기",
        shortcut: "Z",
        disabledReason: !s.hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
    {
      id: "home-view",
      icon: <Home size={16} />,
      label: "홈 뷰",
      onClick: () => h.runViewportCommand("home"),
      disabled: !s.hasRenderableGeometry,
      tooltip: {
        title: "홈 뷰로 이동",
        shortcut: "0",
        disabledReason: !s.hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
    {
      id: "projection-mode",
      icon: <Box size={16} />,
      label: "투영 전환",
      onClick: h.toggleViewportProjectionMode,
      variant: "toggle",
      active: s.viewportProjectionMode === "orthographic",
      disabled: !s.hasRenderableGeometry,
      tooltip: {
        title:
          s.viewportProjectionMode === "perspective"
            ? "직교 투영으로 전환"
            : "원근 투영으로 전환",
        stateText: `현재: ${s.viewportProjectionMode === "perspective" ? "원근 투영" : "직교 투영"}`,
        disabledReason: !s.hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
    {
      id: "hover-tooltips",
      icon: <Info size={16} />,
      label: "호버 툴팁",
      onClick: h.toggleHoverTooltips,
      variant: "toggle",
      active: s.hoverTooltipsEnabled,
      tooltip: {
        title: s.hoverTooltipsEnabled ? "호버 툴팁 끄기" : "호버 툴팁 켜기",
        stateText: `현재: ${s.hoverTooltipsEnabled ? "켜짐" : "꺼짐"}`,
      },
    },
    {
      id: "edge-visibility",
      icon: <SquareDashed size={16} />,
      label: "에지 표시",
      onClick: h.toggleEdgesVisible,
      variant: "toggle",
      active: s.edgesVisible,
      disabled: !s.hasRenderableGeometry,
      tooltip: {
        title: s.edgesVisible ? "에지 표시 끄기" : "에지 표시 켜기",
        stateText: `현재: ${s.edgesVisible ? "켜짐" : "꺼짐"}`,
        disabledReason: !s.hasRenderableGeometry ? geometryDisabledReason : null,
      },
    },
  ];
}

export function buildPanelsMenu(s: ToolbarState, h: ToolbarHandlers): ToolbarMenuConfig {
  return {
    id: "panels",
    icon: <LayoutGrid size={16} />,
    label: "",
    tooltip: {
      title: "패널 전환",
      detailText: "BCF, IDS, Lens 등 패널을 열고 닫습니다",
    },
    items: [
      {
        kind: "action",
        id: "panel-bcf",
        label: `BCF${s.rightPanelMode === "bcf" ? " ✓" : ""}`,
        onSelect: () => h.toggleRightPanelMode("bcf"),
      },
      {
        kind: "action",
        id: "panel-ids",
        label: `IDS${s.rightPanelMode === "ids" ? " ✓" : ""}`,
        onSelect: () => h.toggleRightPanelMode("ids"),
      },
      {
        kind: "action",
        id: "panel-lens",
        label: `Lens${s.rightPanelMode === "lens" ? " ✓" : ""}`,
        onSelect: () => h.toggleRightPanelMode("lens"),
      },
      { kind: "divider", id: "sep-panels" },
      {
        kind: "action",
        id: "panel-list",
        label: `Lists${s.bottomPanelMode === "list" ? " ✓" : ""}`,
        onSelect: () => h.toggleBottomPanelMode("list"),
      },
      {
        kind: "action",
        id: "panel-script",
        label: `Script${s.bottomPanelMode === "script" ? " ✓" : ""}`,
        onSelect: () => h.toggleBottomPanelMode("script"),
      },
    ],
  };
}

export function buildUtilityActions(h: ToolbarHandlers): ToolbarActionConfig[] {
  return [
    {
      id: "keyboard-shortcuts",
      icon: <Keyboard size={16} />,
      label: "키보드 단축키",
      onClick: () => h.setShortcutsOpen(true),
      tooltip: {
        title: "키보드 단축키 보기",
        shortcut: "?",
        detailText: "지원되는 단축키 목록을 확인합니다",
      },
    },
  ];
}

export function buildViewMenu(s: ToolbarState, h: ToolbarHandlers): ToolbarMenuConfig {
  return {
    id: "view-presets",
    icon: <Grid3x3 size={16} />,
    label: "",
    tooltip: {
      title: "뷰 프리셋 열기",
      detailText: "자주 쓰는 카메라 방향을 빠르게 선택합니다",
    },
    items: VIEW_PRESET_CONFIGS.map((preset) => ({
      kind: "action",
      id: preset.id,
      label: preset.label,
      shortcut: preset.shortcut,
      onSelect: () => h.runViewportCommand(preset.command),
      disabled: !s.hasRenderableGeometry,
      closeOnSelect: true,
      tooltip: {
        title: preset.title,
        shortcut: preset.shortcut,
        disabledReason: !s.hasRenderableGeometry ? geometryDisabledReason : null,
      },
    })),
  };
}

export function buildFloorplanMenu(s: ToolbarState, h: ToolbarHandlers): ToolbarMenuConfig | null {
  if (s.storeys.length === 0) return null;

  return {
    id: "floorplan",
    icon: <Building2 size={16} />,
    label: "",
    tooltip: {
      title: "층별 빠른 보기",
      detailText: "층 범위를 선택해 빠르게 탐색합니다",
    },
    items: s.storeys.map((storey) => {
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
        onSelect: () => h.setActiveStoreyFilter(storey.expressID),
        closeOnSelect: true,
        tooltip: {
          title: `${storey.name} 보기`,
          detailText: elevationLabel
            ? `표고: ${elevationLabel}`
            : "선택한 층으로 빠르게 필터링합니다",
        },
      };
    }),
  };
}

export function buildClassVisibilityMenu(s: ToolbarState, h: ToolbarHandlers): ToolbarMenuConfig | null {
  const items = TYPE_VISIBILITY_CONFIGS.filter(
    ({ key }) => s.typeGeometryExists[key],
  ).map((config) => ({
    kind: "check" as const,
    id: `type-visibility-${config.key}`,
    label: config.label,
    checked: s.typeVisibility[config.key],
    color: config.color,
    onSelect: () => h.toggleTypeVisibility(config.key),
    tooltip: {
      title: s.typeVisibility[config.key] ? config.enabledTitle : config.disabledTitle,
      stateText: `현재: ${s.typeVisibility[config.key] ? "표시 중" : "숨김"}`,
    },
  }));

  if (items.length === 0) return null;

  return {
    id: "class-visibility",
    icon: <Layers size={16} />,
    label: "",
    tooltip: {
      title: "클래스별 표시 설정",
      detailText: "공간, 개구부, Site 표시 여부를 전환합니다",
    },
    items,
  };
}

export function buildMeasureMenu(s: ToolbarState, h: ToolbarHandlers): ToolbarMenuConfig {
  return {
    id: "measure",
    icon: <Ruler size={16} />,
    label: "",
    tooltip: {
      title: "측정 도구",
      detailText: "2점 거리 측정 모드를 전환하거나 현재 측정을 초기화합니다",
    },
    items: [
      {
        kind: "action",
        id: "measure-toggle",
        label: s.interactionMode === "measure-distance" ? "Measure Off" : "Measure On",
        shortcut: "M",
        onSelect: h.toggleMeasurementMode,
        disabled: !s.hasRenderableGeometry,
        closeOnSelect: true,
        tooltip: {
          title: s.interactionMode === "measure-distance" ? "측정 모드 끄기" : "측정 모드 켜기",
          stateText: `현재: ${s.interactionMode === "measure-distance" ? "측정 중" : "선택 모드"}`,
          disabledReason: !s.hasRenderableGeometry ? measureDisabledReason : null,
        },
      },
      {
        kind: "action",
        id: "measure-clear",
        label: "Clear Measure",
        icon: <RefreshCcw size={14} />,
        onSelect: h.clearMeasurement,
        disabled: s.measurement.mode === "idle",
        closeOnSelect: true,
        tooltip: {
          title: "현재 측정 초기화",
          disabledReason: s.measurement.mode === "idle" ? "현재 저장된 측정이 없습니다" : null,
        },
      },
    ],
  };
}

const clippingFileDisabledReason = "열린 IFC 파일이 없습니다";

function getClippingCreationDisabledReason(state: ToolbarState) {
  if (!state.hasLoadedModel) {
    return clippingFileDisabledReason;
  }
  if (!state.hasRenderableGeometry) {
    return geometryDisabledReason;
  }
  return null;
}

export function buildSectionViewAction(s: ToolbarState, h: ToolbarHandlers): ToolbarActionConfig {
  const isCreating = s.clippingMode === "creating";
  const creationDisabledReason = getClippingCreationDisabledReason(s);

  return {
    id: "section-view",
    icon: <Scissors size={16} />,
    label: "단면보기",
    onClick: h.startCreateClippingPlane,
    disabled: creationDisabledReason !== null,
    tooltip: {
      title: "단면보기",
      shortcut: "C",
      detailText: "새 클리핑 평면을 만들어 단면을 배치합니다",
      stateText: isCreating
        ? "생성 중"
        : s.clippingPlaneCount > 0
          ? `${s.clippingPlaneCount}개`
          : undefined,
      disabledReason: creationDisabledReason,
    },
  };
}

export function buildExportMenu(s: ToolbarState, h: ToolbarHandlers): ToolbarMenuConfig {
  return {
    id: "export",
    icon: <Download size={16} />,
    label: "",
    tooltip: {
      title: "내보내기 메뉴 열기",
      detailText: "선택/모델 컨텍스트 메타데이터와 함께 뷰포트·공간·속성 데이터를 저장합니다",
    },
    items: [
      {
        kind: "action",
        id: "export-screenshot",
        label: "Viewport Screenshot",
        icon: <Camera size={14} />,
        onSelect: h.handleScreenshot,
        disabled: !s.hasRenderableGeometry,
        closeOnSelect: true,
        tooltip: {
          title: "스크린샷 저장",
          disabledReason: !s.hasRenderableGeometry ? geometryDisabledReason : null,
        },
      },
      {
        kind: "action",
        id: "export-properties-csv",
        label: "Selection Properties CSV",
        icon: <FileText size={14} />,
        onSelect: () => { void h.handleExportPropertiesCSV(); },
        disabled: s.currentModelId === null || s.selectedEntityId === null,
        closeOnSelect: true,
        tooltip: {
          title: "선택 객체 속성 CSV 저장",
          disabledReason:
            s.currentModelId === null
              ? modelDisabledReason
              : s.selectedEntityId === null
                ? selectionDisabledReason
                : null,
        },
      },
      {
        kind: "action",
        id: "export-active-ifc",
        label: "Active IFC",
        icon: <FileText size={14} />,
        onSelect: () => { void h.handleExportActiveIfc(); },
        disabled: s.currentModelId === null,
        closeOnSelect: true,
        tooltip: {
          title: "현재 활성 모델 IFC 저장",
          disabledReason: s.currentModelId === null ? modelDisabledReason : null,
        },
      },
      {
        kind: "action",
        id: "export-changed-ifcs",
        label: "Changed IFCs",
        icon: <Layers size={14} />,
        onSelect: () => { void h.handleExportChangedModels(); },
        disabled: s.trackedChanges.length === 0,
        closeOnSelect: true,
        tooltip: {
          title: "변경이 있는 모델 IFC 저장",
          disabledReason: s.trackedChanges.length === 0 ? "추적 중인 변경이 없습니다" : null,
        },
      },
      {
        kind: "action",
        id: "export-ifcb",
        label: "Pre-converted Binary (IFCB)",
        icon: <Layers size={14} />,
        onSelect: () => { void h.handleExportIfcb(); },
        disabled: s.currentModelId === null,
        closeOnSelect: true,
        tooltip: {
          title: "사전 변환 바이너리(IFCB) 저장",
          detailText: "다음 로드 시 web-ifc 파싱을 건너뛰어 빠르게 열 수 있습니다",
          disabledReason: s.currentModelId === null ? modelDisabledReason : null,
        },
      },
      { kind: "divider", id: "export-divider" },
      {
        kind: "action",
        id: "export-json",
        label: "Model Spatial JSON",
        icon: <FileJson size={14} />,
        onSelect: h.handleExportJSON,
        disabled: !s.hasSpatialTree,
        closeOnSelect: true,
        tooltip: {
          title: "공간 트리 JSON 저장",
          disabledReason: !s.hasSpatialTree ? spatialTreeDisabledReason : null,
        },
      },
      {
        kind: "action",
        id: "export-csv",
        label: "Model Spatial CSV",
        icon: <FileText size={14} />,
        onSelect: h.handleExportSpatialCSV,
        disabled: !s.hasSpatialTree,
        closeOnSelect: true,
        tooltip: {
          title: "공간 트리 CSV 저장",
          disabledReason: !s.hasSpatialTree ? spatialTreeDisabledReason : null,
        },
      },
    ],
  };
}

export function checkTypeGeometry(
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
