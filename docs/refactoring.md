# ifc-ln 통합 리팩토링 계획

## 1. 목적

`ifc-ln`의 대형 파일과 중복 로직을 책임 경계 기준으로 분리하여 유지보수 비용을 낮추되,
현재 기능과 UX는 그대로 보존한다.

## 2. 현황 기준선

| 항목 | 수치 |
|------|------|
| 총 코드라인 | 9,879 lines (45 TS/TSX 파일) |
| 자동화 테스트 | 없음 |
| 500줄 이상 파일 | 7개 (전체 코드의 63%) |
| `pnpm typecheck` | 통과 |
| `pnpm build` | 통과 |

### 핫스팟 파일

| # | 파일 | Lines | 핵심 문제 |
|---|------|-------|-----------|
| 1 | ViewportScene.tsx | 979 | useEffect 10개 중 메인 초기화 effect 527줄, useRef 17개, 씬/이벤트/렌더링/클린업 혼재 |
| 2 | viewportUtils.ts | 841 | 35개 함수 + 내부 상호의존 높음, 논리 그룹 없이 한 파일에 집중 |
| 3 | HierarchyPanel.tsx | 773 | useCallback 20개 (의존성 6~10개), 필터/트리빌드/선택/가시성 전부 컴포넌트 내 |
| 4 | ifc.worker.ts | 750 | 9개 메시지 타입을 단일 switch에서 처리, 핸들러별 로직이 길어 파일 비대 |
| 5 | treeDataBuilder.ts | 623 | 트리 순회 로직이 이 파일 외 2곳에서 중복 구현 |
| 6 | ViewportContainer.tsx | 570 | 상태 계산과 side-effect 혼재, selector 과다 |
| 7 | MainToolbar.tsx | 535 | 트리 수집 로직 인라인 중복 |
| - | globals.css | 2,914 | 전체 앱 스타일이 단일 파일에 집중 |

### 확인된 결함

1. 테마 토글 시 viewport 배경·grid·edge 색상이 즉시 반영되지 않음
2. `RenderManifest.vertexCount`가 실제 vertex 수가 아닌 interleaved float 수를 누적
3. `HierarchyPanel`에 개발용 `console.log` 2건 잔존 (274행, 329행)
4. `IfcWorkerClient.init()` 실패 시 rejected promise가 캐시되어 재시도 불가

## 3. 범위

### 범위 안

- `ifc-ln` 앱만 대상
- React, Zustand, Web Worker, Three.js 기반 구조 유지
- 현재 공개 동작 전체 보존 (파일 열기, reset, selection, isolate, hide/show, fit-selected, projection toggle, keyboard shortcut)
- 스타일은 분리만 수행, CSS Modules/CSS-in-JS 전환 안 함

### 범위 밖

- `ifc-lite`와의 구조 정렬 / 공용 패키지 추출
- UI 재디자인 / 상태관리 라이브러리 교체 / 렌더링 엔진 교체

## 4. 리팩토링 원칙

1. **기능 변경 없음** — 모든 Phase는 동작을 보존하는 구조 변경만 수행
2. **안전장치 먼저** — 리팩토링 착수 전 테스트 프레임워크와 결함 수정을 확보
3. **의존성 순서** — 하위 모듈(유틸리티)을 먼저 분리한 뒤 상위 컴포넌트를 분해
4. **외부 API 보존** — `useWebIfc`, `ifcWorkerClient`, worker message type 이름 유지
5. **Phase 단위 검증** — 각 Phase 종료 시 `pnpm typecheck && pnpm build && pnpm test` 통과
6. **점진적 이동** — 기존 export를 re-export로 유지, 모든 참조 갱신 후 re-export 제거
7. **300줄 룰** — 리팩토링 후 단일 파일이 300줄을 넘지 않도록 목표

---

## 5. 단계별 실행 계획

### Phase 0: Safety Rail + 결함 수정

리팩토링 중 회귀 위험을 낮추기 위한 최소 안전장치 확보.

#### 작업

- [ ] 테스트 도구 설치 (`vitest`, `jsdom`) + `package.json`에 `test` script + vitest 설정
- [ ] 첫 테스트 묶음 작성
  - render cache/manifest 계산 (meshCount, vertexCount, indexCount, initialChunkIds)
  - viewport selector (filter → hidden entity, desired chunk)
  - worker client lifecycle (init 성공/실패/재시도, error 시 pending 정리)
- [ ] 결함 수정
  - 테마 토글 즉시 반영 — ViewportScene 280행에서 theme을 mount 시 1회만 조회, useEffect로 theme 변경 구독 필요
  - vertexCount → `vertices.length / 6` 기준 보정 (현재 ifc.worker.ts 524행에서 float 수를 그대로 누적)
  - HierarchyPanel `console.log` 2건 제거 (274행 `[handleNodeClick]`, 329행 `[handleGroupIsolate]`)
  - IfcWorkerClient `initPromise` 실패 시 캐시 초기화 — rejected promise 재시도 가능하도록 수정

#### 완료 조건

- `pnpm test` 통과
- `pnpm typecheck && pnpm build` 통과
- 수동 확인: 테마 토글 즉시 반영

---

### Phase 1: viewportUtils 모듈 분리 (841줄 → 5개 파일)

ViewportScene의 핵심 의존성을 먼저 분리하여, 이후 컴포넌트 분해 시 import 경계를 깔끔하게 만든다.

> **주의:** 함수 간 내부 의존성이 높다 — `appendMeshesToGroup`이 `colorKey`, `groupMeshes`, `getOrCreateGeometry`, `setEntryVisualState`, `indexRenderEntry`를 호출하고, `fitCameraToBounds`가 `fitCameraToBoundsWithDirection`을 호출하는 등 cross-cutting 참조가 있으므로, 의존 그래프를 먼저 그린 뒤 경계를 확정해야 한다.

#### 목표 구조

```
src/components/viewer/viewport/
├── cameraMath.ts        # 카메라 조작, frustum fitting, aspect 계산
├── meshManagement.ts    # 그룹핑, 인스턴싱, 비주얼 상태 적용
├── geometryFactory.ts   # BufferGeometry 생성, 캐싱
├── raycasting.ts        # 엔티티 피킹, 교차 감지
├── overlayMath.ts       # 스케일바 계산, 회전 행렬, 포맷팅
└── index.ts             # barrel re-export (전환기 호환용)
```

#### 작업

- [ ] 함수별 의존 관계 분석 → 모듈 경계 확정
- [ ] 각 모듈로 함수 이동 + import 경로 업데이트
- [ ] barrel export (`index.ts`) 구성 → 기존 `viewportUtils` import 깨지지 않게 유지
- [ ] 분리된 순수 함수 단위 테스트 추가 (cameraMath, raycasting)
- [ ] 모든 참조 갱신 후 barrel re-export 및 원본 파일 제거

#### 완료 조건

- `viewportUtils.ts` 삭제됨
- 5개 모듈 각각 300줄 이하
- `pnpm test && pnpm typecheck && pnpm build` 통과

---

### Phase 2: ViewportScene 분해 (979줄 → ~300줄)

가장 큰 God Component를 4개 커스텀 훅으로 분리.

#### 목표 구조

```
src/components/viewer/viewport/
├── ViewportScene.tsx              # 훅 조합만 담당 (~300줄)
├── hooks/
│   ├── useThreeScene.ts           # Scene, Camera, Renderer, Controls, Light, Grid 생성/dispose
│   ├── useViewportRenderer.ts     # rAF 루프, FPS 샘플링, 리사이즈, 오버레이 업데이트
│   ├── useViewportInput.ts        # 포인터/클릭/호버 쓰로틀링/선택/컨텍스트 메뉴
│   └── useChunkSceneGraph.ts      # 청크 가시성, 메시 그룹 추가/제거, 비주얼 상태 동기화
```

#### 작업

- [ ] `useThreeScene` — Scene/Camera/Renderer/Controls/Light/Grid 초기화 및 dispose
- [ ] `useViewportRenderer` — requestAnimationFrame 루프, FPS 샘플링, 오버레이 업데이트
- [ ] `useViewportInput` — 포인터 이벤트, 호버 쓰로틀링, 선택, 컨텍스트 메뉴
- [ ] `useChunkSceneGraph` — 청크 로딩/언로딩, 메시 그룹 관리, 비주얼 상태 동기화
- [ ] ViewportScene.tsx에서 훅 조합만 남기기

#### 완료 조건

- ViewportScene.tsx 300줄 이하
- scene theme sync, chunk residency, hover/context menu 동작 유지
- `pnpm test && pnpm typecheck && pnpm build` 통과

---

### Phase 3: ViewportContainer 축소 + 트리 순회 통합

ViewportContainer의 계산 로직을 hook/selector로 추출하고, 3곳에 분산된 트리 순회를 통합.

#### 작업 A — ViewportContainer 축소

- [ ] selector/hook으로 추출
  - `useViewportEntityFilters.ts` — effectiveHiddenIdSet, entity summary
  - `useChunkResidency.ts` — desiredChunkIds, chunk residency 오케스트레이션
- [ ] ViewportContainer에는 empty state, debug overlay, tooltip/context menu 연결만 남기기

#### 작업 B — 트리 순회 유틸리티 통합

- [ ] ViewportContainer의 `findStoreyNode`, `collectRenderableNodeEntityIds` → `treeDataBuilder.ts`로 이동
- [ ] MainToolbar의 `collectStoreys` → `treeDataBuilder.ts`로 이동
- [ ] HierarchyPanel 인라인 트리 필터링 → `treeDataBuilder.ts`로 이동
- [ ] 공통 인터페이스 통일 (`walkTree`, `collectEntities`, `findNode`)

#### 작업 C — 공유 spatial selector

- [ ] `src/utils/spatialTreeSelectors.ts` 도입
- [ ] viewport와 hierarchy에서 공통 사용

#### 완료 조건

- ViewportContainer.tsx 300줄 이하
- 트리 순회 로직이 `treeDataBuilder.ts`에 통합
- `pnpm test && pnpm typecheck && pnpm build` 통과

---

### Phase 4: Session / Worker 경계 정리

세션 흐름을 정리하고 워커를 모듈화.

#### 작업 A — useWebIfc / IfcWorkerClient 정리

- [ ] `useWebIfc` 내부를 3개 흐름으로 분리 (facade API 유지)
  - `initEngine` / `loadModelFromFile` / `resetViewerSession`
- [ ] 중복 reset 제거 — 로드 전 초기화, 실패 시 rollback, 수동 reset이 같은 cleanup 경로 사용
- [ ] `IfcWorkerClient` 공통 `request<TExpected>()` 래퍼 도입, 응답 타입 검증 helper로 이동
- [ ] worker init 실패 시 재시도 가능하도록 내부 상태 초기화

#### 작업 B — Worker 모듈화 (750줄 → 디스패처 + 모듈)

```
src/workers/
├── ifc.worker.ts              # 메시지 디스패처만 (~150줄)
├── handlers/
│   ├── geometryHandler.ts     # BUILD_RENDER_CACHE, LOAD/RELEASE_RENDER_CHUNKS
│   ├── propertyHandler.ts     # GET_PROPERTIES_SECTIONS
│   ├── spatialHandler.ts      # GET_SPATIAL_STRUCTURE
│   └── typeTreeHandler.ts     # GET_TYPE_TREE
├── workerContext.ts           # 공유 상태 (api, openModelIds, renderCaches, spatialTrees)
├── ifcGeometryUtils.ts        # (기존 유지)
├── ifcPropertyUtils.ts        # (기존 유지)
└── edgeExtractor.ts           # (기존 유지)
```

- [ ] 메시지 타입별 핸들러 함수 추출
- [ ] 워커 공유 상태를 `workerContext.ts`로 분리
- [ ] ifc.worker.ts를 디스패처 패턴으로 리팩토링

#### 완료 조건

- `useWebIfc` 외부 호출부 변경 없음
- load/reset/error 경로가 하나의 cleanup 흐름 사용
- ifc.worker.ts 150줄 이하
- `pnpm test && pnpm typecheck && pnpm build` 통과

---

### Phase 5: HierarchyPanel / Properties 분리

패널 UI와 도메인 로직을 분리.

#### 목표 구조

```
src/components/viewer/hierarchy/
├── HierarchyPanel.tsx           # 레이아웃 + 탭 전환만 (~300줄)
├── components/
│   ├── HierarchyFilterBar.tsx   # 검색/필터 UI
│   └── HierarchyTreeView.tsx    # 가상 트리 렌더링
├── hooks/
│   ├── useHierarchyController.ts  # type tree lazy loading, selection, isolate, visibility, context menu action
│   ├── useHierarchyFilters.ts     # 필터 상태 + 적용 로직
│   └── useFilteredTreeView.ts     # 필터링된 노드 계산
```

#### 작업

- [ ] controller hook 추출 — type tree loading, storey scope, entity selection, group isolate, visibility toggle, context menu action
- [ ] 필터 상태/로직 → `useHierarchyFilters`
- [ ] 필터링된 트리 계산 → `useFilteredTreeView`
- [ ] FilterBar, TreeView 서브 컴포넌트 추출
- [ ] property query 흐름 정리
  - `useWebIfcPropertySync`: 기본 attributes preload만 유지
  - `usePropertiesPanelData`: lazy section load 진입점 유지
  - 공통 helper → `src/services/ifcPropertyQueries.ts`

#### 완료 조건

- HierarchyPanel.tsx 300줄 이하
- 비즈니스 로직이 테스트 가능한 hook으로 이동
- `pnpm test && pnpm typecheck && pnpm build` 통과

---

### Phase 6: 상태 관리 정리 + CSS 분리

#### 작업 A — 상태 관리

- [ ] `viewportGeometryStore`를 Zustand 슬라이스로 통합 검토
- [ ] 필터 상태를 `filterSlice`로 통합 (현재 uiSlice + dataSlice + 로컬 상태 분산)
- [ ] 파생 상태를 Zustand 셀렉터로 전환 (불필요한 상태 저장 제거)
- [ ] viewportCommand sequence number 패턴 → 이벤트 기반 변경 검토

#### 작업 B — CSS 분리

```
src/styles/
├── base.css                         # reset, CSS variables (색상, spacing, theme token)
├── viewer-layout.css                # 전체 레이아웃
├── viewer-toolbar.css               # 툴바
├── viewer-panels.css                # 패널 공통
├── viewer-viewport.css              # 뷰포트
└── viewer-properties-hierarchy.css  # 속성/계층 패널
```

- [ ] `globals.css`를 역할별 파일로 분리
- [ ] 공통 색상/spacing/border → CSS variable로 정리
- [ ] `main.tsx` import 순서 정리
- [ ] class name 유지, 중복 selector 제거

#### 완료 조건

- 필터 상태가 하나의 슬라이스에서 관리됨
- `globals.css` 제거 또는 thin compatibility file로 축소
- light/dark 테마 모두 정상
- `pnpm test && pnpm typecheck && pnpm build` 통과

---

## 6. 실행 순서 총괄

| 순서 | Phase | 핵심 근거 | 위험도 | 예상 변경 파일 |
|------|-------|-----------|--------|---------------|
| 0 | Safety Rail + 결함 수정 | 리팩토링 전 회귀 감지 수단 확보 | 낮음 | ~8 |
| 1 | viewportUtils 분리 | 하위 의존성 먼저 분리해야 상위 분해가 깔끔 | 낮음 | ~8 |
| 2 | ViewportScene 분해 | 최대 핫스팟(979줄) 해소 | 중간 | ~6 |
| 3 | ViewportContainer + 트리 통합 | selector/중복 제거로 나머지 분해 준비 | 낮음 | ~8 |
| 4 | Session / Worker 정리 | 세션 흐름 안정화 + 워커 모듈화 | 낮음 | ~8 |
| 5 | HierarchyPanel / Properties | 패널 UI와 도메인 로직 분리 | 낮음 | ~7 |
| 6 | 상태 관리 + CSS | 마무리 정리, 가장 넓은 변경 범위 | 중간 | ~12 |

---

## 7. 테스트 전략

### 자동화 테스트 (Phase 0에서 프레임워크 구축, 이후 Phase마다 증분)

| 대상 | 테스트 항목 |
|------|------------|
| render cache/manifest | meshCount, vertexCount (`/6`), indexCount, initialChunkIds |
| viewport selector | filter → hidden entity 계산, desired chunk 계산 |
| cameraMath | frustum fitting, aspect 계산 |
| raycasting | 엔티티 피킹 로직 |
| treeDataBuilder | 트리 변환, walkTree, collectEntities |
| hierarchy controller | storey click, additive selection, isolate/reset |
| worker client | init 성공/실패/재시도, error 시 pending 정리 |

목표 커버리지: 유틸리티 80%, 훅 60%

### 수동 Smoke Checklist

매 Phase 완료 후 수행:

- [ ] 앱 시작 → 엔진 초기화
- [ ] IFC 로드 → reset → 다른 IFC 재로드
- [ ] 테마 토글 (배경/grid/edge 즉시 반영)
- [ ] hide / isolate / show all
- [ ] storey scope / class filter / type filter
- [ ] hover tooltip / context menu
- [ ] fit-selected / projection toggle
- [ ] keyboard shortcuts 전체

---

## 8. 최종 완료 기준

- [ ] 300줄 이상 파일 없음 (목표)
- [ ] 확인된 결함 4건 수정
- [ ] 트리 순회 로직 단일 모듈로 통합
- [ ] session / worker / viewport / hierarchy / styles 경계가 본 문서 구조와 일치
- [ ] `pnpm test` 통과 (유틸리티 80%, 훅 60% 커버리지)
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm build` 통과
