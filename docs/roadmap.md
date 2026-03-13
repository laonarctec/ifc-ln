# IFC Viewer 구현 로드맵

## 개요

`ifc-ln`은 React + Three.js + web-ifc 기반의 IFC 뷰어 프로젝트다.
`ifc-lite`의 기능 세트를 참고하여, 단일 앱 구조에서 실무급 BIM 뷰어를 구현한다.

### 한눈에 보는 현재 상태

| 항목 | 상태 |
|------|------|
| 기본 뷰어 셸 | ✅ 완료 |
| IFC 로드 + 3D 렌더링 | ✅ 완료 |
| 선택 / 하이라이트 / 가시성 제어 | ✅ 완료 |
| 하이어라키 트리 (Spatial / Class / Type) | ✅ 완료 |
| 속성 조회 (Properties / Pset / Quantities / Type / Material) | ✅ 완료 |
| 카메라 프리셋 (Home / Fit / Front / Right / Top / Iso) | ✅ 완료 |
| ViewCube / AxisHelper | ✅ 완료 |
| 성능 최적화 (geometry cache, InstancedMesh, BVH, 가상 리스트) | ✅ 완료 |
| Quick Wins (Phase 1) | 🔜 다음 |
| Core BIM Tools (Phase 2) | ⬜ 예정 |
| Advanced Features (Phase 3) | ⬜ 예정 |
| Enterprise (Phase 4) | ⬜ 예정 |

### 상태 표기

- `[완료]` — 주요 경로가 구현되어 동작하는 상태
- `[부분 완료]` — 기본 구현은 있으나 polish가 더 필요함
- `[미완료]` — 아직 구현되지 않음

---

## 구현 완료 기능

아래는 현재까지 구현이 완료된 핵심 기능을 요약한 것이다.

### 앱 셸 & 레이아웃

- [완료] React + Vite 앱 셸 구성
- [완료] Zustand 기반 상태 관리 (ui / loading / selection / visibility / data slices)
- [완료] 좌우 패널 토글 및 resizable panel
- [완료] 패널 내부 스크롤 안정화
- [완료] 디버그 패널 분리
- [완료] 전역 스타일 및 라이트 테마

### IFC 엔진 & Worker

- [완료] `web-ifc` worker 초기화 및 IFC 파일 로드
- [완료] `INIT`, `LOAD_MODEL`, `CLOSE_MODEL` 메시지
- [완료] `StreamAllMeshes` 기반 geometry 추출
- [완료] chunk 기반 progressive geometry streaming
- [완료] typed array Transferable 전송

### 3D 뷰포트 & 렌더링

- [완료] Three.js 기반 viewport scene 구성
- [완료] geometry cache, `InstancedMesh`, BVH picking
- [완료] 선택 하이라이트 (selection highlight)
- [완료] hide / isolate / show all
- [완료] 카메라 Home / Fit Selected / Front / Right / Top / Iso
- [완료] ViewCube 3D 네비게이션
- [완료] AxisHelper 축 표시
- [완료] 로드/worker 오류 상태 일관 노출
- [완료] WebGL fallback 1차 대응
- [부분 완료] WebGL fallback UX 고도화

### 하이어라키 패널

- [완료] Spatial / Class / Type 3탭 트리
- [완료] Class 탭: IFC 클래스 그룹 트리
- [완료] Type 탭: 실제 IfcType 관계 기반 트리
- [완료] 검색 입력 debounce 처리
- [완료] selection ↔ 트리 auto-expand / scroll 동기화
- [완료] 가상 리스트 기반 대형 트리 최적화
- [부분 완료] 대형 모델 expand/collapse UX 추가 검증 필요

### 속성 패널

- [완료] on-demand property loading
- [완료] Property Sets / Quantities / Type Properties / Materials 조회
- [완료] 관계 정보 (forward + inverse) 표시
- [부분 완료] 동일 엔티티 재선택 시 property cache 부재

### 가시성 & 필터

- [완료] class / type / storey 필터
- [완료] filter-selection 충돌 시 자동 해제 정책
- [완료] hidden entity count StatusBar 표시

---

## Phase 1: Quick Wins

사용자 체감이 크면서 구현 비용이 낮은 UX 개선 항목.

### 1.1 키보드 단축키

- `H` hide, `I` isolate, `S` show all, `F` fit selected, `Esc` deselect
- 단축키 목록 다이얼로그 (`?` 또는 메뉴에서 접근)
- **생성**: `src/hooks/useKeyboardShortcuts.ts`, `src/components/viewer/KeyboardShortcutsDialog.tsx`
- **수정**: `ViewerLayout.tsx`
- **ifc-lite 참고**: `packages/ui/src/components/KeyboardShortcutsDialog.tsx`

### 1.2 호버 툴팁

- 3D 뷰포트에서 엔티티 위에 마우스를 올리면 이름/타입 표시
- **생성**: `src/components/viewer/HoverTooltip.tsx`
- **수정**: `ViewportScene.tsx`
- **ifc-lite 참고**: `packages/ui/src/components/HoverTooltip.tsx`

### 1.3 컨텍스트 메뉴 (우클릭)

- 엔티티 우클릭 시 hide / isolate / fit / properties 메뉴
- **생성**: `src/components/viewer/ContextMenu.tsx`
- **수정**: `ViewportScene.tsx`
- **ifc-lite 참고**: `packages/ui/src/components/EntityContextMenu.tsx`

### 1.4 다크/라이트 테마 전환

- 토글 스위치로 테마 전환
- CSS 변수 기반 테마 시스템
- **생성**: `src/components/viewer/ThemeSwitch.tsx`
- **수정**: `globals.css`, `MainToolbar.tsx`
- **ifc-lite 참고**: `packages/ui/src/components/ThemeSwitch.tsx`

### 1.5 토스트 알림

- 파일 로드 완료, 오류, 내보내기 성공 등의 피드백
- **생성**: `src/components/ui/Toast.tsx`
- **수정**: `useWebIfc.ts`
- **ifc-lite 참고**: `packages/ui/src/components/ui/toast.tsx`

### 1.6 스크린샷 캡처

- 현재 뷰포트를 PNG로 캡처/다운로드
- **생성**: `src/utils/screenshot.ts`
- **수정**: `MainToolbar.tsx`
- **ifc-lite 참고**: `packages/viewer/src/utils/screenshot.ts`

---

## Phase 2: Core BIM Tools

BIM 뷰어로서 핵심적인 도구 기능.

### 2.1 활성 도구 시스템

- Select / Measure / Section 등 도구 모드 전환
- 활성 도구에 따라 뷰포트 인터랙션 변경
- **생성**: `src/stores/slices/toolSlice.ts`, `src/components/viewer/ToolBar.tsx`
- **수정**: `ViewportScene.tsx`, `MainToolbar.tsx`
- **ifc-lite 참고**: `packages/viewer/src/stores/toolStore.ts`

### 2.2 단면 (Clipping Plane / Section Box)

- 단일/다중 클리핑 플레인
- Section Box로 영역 잘라내기
- 단면 시각화
- **생성**: `src/components/viewer/SectionPanel.tsx`, `src/services/clippingService.ts`
- **수정**: `ViewportScene.tsx`
- **ifc-lite 참고**: `packages/viewer/src/components/SectionPanel.tsx`, `packages/viewer/src/services/SectionVisualization.ts`

### 2.3 측정 (거리 / 면적 / 각도)

- point-to-point 거리 측정
- polygon 면적 측정
- 각도 측정
- vertex/edge/face 스냅
- 측정값 오버레이 표시
- **생성**: `src/components/viewer/MeasurePanel.tsx`, `src/services/measureService.ts`, `src/components/viewer/MeasurementVisuals.tsx`
- **수정**: `ViewportScene.tsx`
- **ifc-lite 참고**: `packages/viewer/src/components/MeasurePanel.tsx`, `packages/viewer/src/utils/computePolygonArea.ts`

### 2.4 걷기 모드 (First-person Navigation)

- WASD 키 기반 1인칭 이동
- 마우스로 시점 회전
- 충돌 감지 (선택적)
- **생성**: `src/services/walkMode.ts`
- **수정**: `ViewportScene.tsx`, `MainToolbar.tsx`
- **ifc-lite 참고**: `packages/viewer/src/controls/WalkController.ts`

### 2.5 커맨드 팔레트 (Ctrl+K)

- 검색 기반 명령 실행 인터페이스
- 파일 열기, 뷰 전환, 도구 전환 등 빠른 접근
- **생성**: `src/components/viewer/CommandPalette.tsx`
- **수정**: `ViewerLayout.tsx`
- **ifc-lite 참고**: `packages/ui/src/components/CommandPalette.tsx`

---

## Phase 3: Advanced Features

뷰어의 활용 범위를 넓히는 고급 기능.

### 3.1 내보내기 (Export)

- glTF / CSV / JSON / IFC 내보내기
- 수정된 모델 IFC 저장
- 변경 사항만 내보내기
- **생성**: `src/services/exportService.ts`, `src/components/viewer/ExportDialog.tsx`
- **수정**: `MainToolbar.tsx`, `ifc.worker.ts`
- **ifc-lite 참고**: `packages/export/src/index.ts`, `packages/ui/src/components/ExportDialog.tsx`

### 3.2 뷰포인트 저장/복원

- 카메라 위치 + 가시성 상태를 뷰포인트로 저장
- 뷰포인트 목록에서 복원
- **생성**: `src/stores/slices/viewpointSlice.ts`, `src/components/viewer/ViewpointPanel.tsx`
- **수정**: `ViewportScene.tsx`
- **ifc-lite 참고**: `packages/viewer/src/stores/viewpointStore.ts`

### 3.3 멀티모델 페더레이션

- 다중 IFC 모델 동시 로딩
- 모델별 가시성 토글 / 제거
- 통합 spatial tree
- 모델 간 정합 (alignment)
- **생성**: `src/stores/slices/modelSlice.ts`
- **수정**: `useWebIfc.ts`, `HierarchyPanel.tsx`, `ifc.worker.ts`, `ViewportScene.tsx`
- **ifc-lite 참고**: `packages/viewer/src/stores/modelStore.ts`, `packages/viewer/src/services/ModelFederation.ts`

### 3.4 2D 평면도 생성

- 층별 평면도 / 단면도 생성
- SVG 기반 2D 캔버스
- 도면 시트 설정 및 title block
- SVG/PDF 내보내기
- **생성**: `src/components/drawing/Drawing2DCanvas.tsx`, `src/services/drawingService.ts`
- **수정**: `ViewerLayout.tsx`
- **ifc-lite 참고**: `packages/drawing-2d/src/index.ts`, `packages/ui/src/components/drawing/`

---

## Phase 4: Enterprise

전문 BIM 도구 수준의 기능. 도메인 전문 지식과 상당한 구현 비용이 필요.

### 4.1 BCF (BIM Collaboration Format)

- BCF topic 목록 / 상세 / 생성
- viewpoint 저장/복원 (카메라 + 가시성)
- comment 작성
- BCF 파일 가져오기/내보내기
- **생성**: `src/components/bcf/BCFPanel.tsx`, `src/services/bcfService.ts`
- **수정**: `ViewerLayout.tsx`
- **ifc-lite 참고**: `packages/bcf/src/index.ts`, `packages/ui/src/components/bcf/`

### 4.2 데이터 테이블 (List & Schedule)

- 동적 테이블 생성 (리스트 빌더)
- 스케줄 / 수량 산출
- 테이블 내보내기
- **생성**: `src/components/list/ListPanel.tsx`, `src/services/listService.ts`
- **수정**: `ViewerLayout.tsx`
- **ifc-lite 참고**: `packages/lists/src/index.ts`, `packages/ui/src/components/list/`

### 4.3 속성 편집 (Property Editing + Mutations)

- 속성 인라인 편집
- 벌크 속성 편집
- dirty state 추적
- undo/redo stack
- mutation command 패턴
- PropertySet 추가/삭제
- **생성**: `src/services/mutationService.ts`, `src/stores/slices/editSlice.ts`
- **수정**: `PropertiesPanel.tsx`, `ifc.worker.ts`
- **ifc-lite 참고**: `packages/mutations/src/index.ts`, `packages/ui/src/components/properties/PropertyEditor.tsx`

### 4.4 IDS 검증 (Information Delivery Specification)

- IDS 규격 검증 실행
- 검증 결과 표시
- IDS → BCF 내보내기
- IDS 파일 불러오기
- **생성**: `src/components/ids/IDSPanel.tsx`, `src/services/idsService.ts`
- **수정**: `ViewerLayout.tsx`
- **ifc-lite 참고**: `packages/ids/src/index.ts`, `packages/ui/src/components/ids/`

### 4.5 스크립팅 & AI 채팅

- 코드 에디터 (CodeMirror)
- 스크립트 실행 (QuickJS 샌드박스)
- AI 채팅 인터페이스
- 실행 가능 코드 블록
- **생성**: `src/components/scripting/ScriptPanel.tsx`, `src/components/chat/ChatPanel.tsx`
- **수정**: `ViewerLayout.tsx`
- **ifc-lite 참고**: `packages/sandbox/src/index.ts`, `packages/ui/src/components/scripting/`

---

## 핵심 수정 파일

현재 `ifc-ln/src/` 기준 핵심 파일 목록.

### 셸 & 레이아웃

- `src/components/viewer/ViewerLayout.tsx`
- `src/components/viewer/MainToolbar.tsx`
- `src/components/viewer/StatusBar.tsx`
- `src/main.tsx`, `src/App.tsx`

### 엔진 & Worker

- `src/workers/ifc.worker.ts`
- `src/services/IfcWorkerClient.ts`
- `src/hooks/useWebIfc.ts`
- `src/types/worker-messages.ts`

### 뷰포트 & 렌더링

- `src/components/viewer/ViewportScene.tsx`
- `src/components/viewer/ViewportContainer.tsx`
- `src/components/viewer/ViewportOverlays.tsx`
- `src/components/viewer/ViewCube.tsx`
- `src/components/viewer/AxisHelper.tsx`
- `src/services/viewportGeometryStore.ts`

### 하이어라키 & 속성

- `src/components/viewer/HierarchyPanel.tsx`
- `src/components/viewer/hierarchy/useHierarchyPanelData.ts`
- `src/components/viewer/PropertiesPanel.tsx`
- `src/components/viewer/properties/usePropertiesPanelData.ts`

### 상태 관리

- `src/stores/index.ts`
- `src/stores/slices/dataSlice.ts`
- `src/stores/slices/loadingSlice.ts`
- `src/stores/slices/selectionSlice.ts`
- `src/stores/slices/uiSlice.ts`
- `src/stores/slices/visibilitySlice.ts`

### 유틸리티

- `src/utils/ifc-class.ts`

---

## 구현 일정

| Phase | 범위 | 예상 난이도 |
|-------|------|------------|
| Phase 1: Quick Wins | 1.1~1.6 | 🟢 낮음 |
| Phase 2: Core BIM Tools | 2.1~2.5 | 🟡 중간 |
| Phase 3: Advanced Features | 3.1~3.4 | 🟡~🔴 중~높음 |
| Phase 4: Enterprise | 4.1~4.5 | 🔴 높음 |

**권장 순서**: Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1은 기존 코드에 부담 없이 추가 가능한 항목이므로 빠르게 처리한다.
Phase 2는 BIM 뷰어의 핵심 차별점이므로 집중 투자한다.
Phase 3~4는 실무 요구사항에 따라 선택적으로 진행한다.

---

## ifc-lite 참고 파일 매핑

각 Phase 기능별로 `ifc-lite`에서 참고할 소스 경로를 정리한다.

| 기능 | ifc-lite 참고 경로 |
|------|-------------------|
| 키보드 단축키 | `packages/ui/src/components/KeyboardShortcutsDialog.tsx` |
| 호버 툴팁 | `packages/ui/src/components/HoverTooltip.tsx` |
| 컨텍스트 메뉴 | `packages/ui/src/components/EntityContextMenu.tsx` |
| 테마 전환 | `packages/ui/src/components/ThemeSwitch.tsx` |
| 토스트 알림 | `packages/ui/src/components/ui/toast.tsx` |
| 스크린샷 | `packages/viewer/src/utils/screenshot.ts` |
| 도구 시스템 | `packages/viewer/src/stores/toolStore.ts` |
| 단면 | `packages/viewer/src/components/SectionPanel.tsx` |
| 측정 | `packages/viewer/src/components/MeasurePanel.tsx` |
| 걷기 모드 | `packages/viewer/src/controls/WalkController.ts` |
| 커맨드 팔레트 | `packages/ui/src/components/CommandPalette.tsx` |
| 내보내기 | `packages/export/src/index.ts` |
| 뷰포인트 | `packages/viewer/src/stores/viewpointStore.ts` |
| 멀티모델 | `packages/viewer/src/services/ModelFederation.ts` |
| 2D 평면도 | `packages/drawing-2d/src/index.ts` |
| BCF | `packages/bcf/src/index.ts` |
| 데이터 테이블 | `packages/lists/src/index.ts` |
| 속성 편집 | `packages/mutations/src/index.ts` |
| IDS 검증 | `packages/ids/src/index.ts` |
| 스크립팅 | `packages/sandbox/src/index.ts` |

---

## 검증 방법

### 기능 검증

- 각 Phase 완료 시 해당 기능이 개발 모드에서 정상 동작하는지 확인
- `pnpm typecheck` 및 `pnpm build` 통과
- 기존 기능 회귀 여부 확인 (선택/가시성/필터/속성/카메라)

### 성능 검증

- 대형 IFC 파일 로드 시 UI 응답성 유지
- 트리 expand/collapse, 검색 시 과도한 지연 없음
- 동일 엔티티 반복 선택 시 property 조회 비용 안정

### UX 검증

- 새로 추가된 도구/단축키가 기존 toolbar 조작과 충돌하지 않음
- 모든 상태 변경이 viewport / panel / status에서 일관되게 표현됨
- 좁은 폭과 일반 데스크톱 폭 모두에서 레이아웃이 유지됨
