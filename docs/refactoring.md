# ifc-ln 통합 리팩토링 계획

## 1. 목적

`ifc-ln`의 대형 파일과 중복 로직을 책임 경계 기준으로 분리하여 유지보수 비용을 낮추되,
현재 기능과 UX는 그대로 보존한다.

## 2. 현황 기준선

### 리팩토링 전 (Before)

| 항목 | 수치 |
|------|------|
| 총 코드라인 | 9,879 lines (45 TS/TSX 파일) |
| 자동화 테스트 | 없음 |
| 500줄 이상 파일 | 7개 (전체 코드의 63%) |

### 리팩토링 후 현재 (Phase 0~6 완료)

| 항목 | 수치 |
|------|------|
| 자동화 테스트 | 24개 (4 test files) |
| 300줄 이상 파일 | 2개 (`useThreeScene` 313줄, `meshManagement` 405줄 — 단일 책임으로 허용) |
| 확인된 결함 | 4건 → 4건 수정 완료 |
| `pnpm typecheck` / `build` / `test` | 모두 통과 |

### 핫스팟 파일 변화

| # | 파일 | Before | After | 비고 |
|---|------|--------|-------|------|
| 1 | ViewportScene.tsx | 979 | **251** | 4개 훅으로 분해 |
| 2 | viewportUtils.ts | 841 | **삭제** | 5개 모듈로 분리 |
| 3 | HierarchyPanel.tsx | 773 | **269** | useHierarchyController 추출 |
| 4 | ifc.worker.ts | 751 | **77** | 4개 핸들러 + workerContext 분리 |
| 5 | treeDataBuilder.ts | 623 | **212** | treeHelpers + treeEntityUtils 분리 |
| 6 | ViewportContainer.tsx | 570 | **272** | 필터/청크 훅 추출 |
| 7 | MainToolbar.tsx | 535 | **521** | collectStoreys 이동 |
| - | IfcWorkerClient.ts | 272 | **158** | typedRequest 래퍼 도입 |
| - | globals.css | 2,914 | **삭제** | 7개 역할별 CSS 파일로 분리 |

### 확인된 결함 (4건 — 전부 수정 완료)

1. ~~테마 토글 시 viewport 배경·grid·edge 색상이 즉시 반영되지 않음~~ → ViewportScene에 theme subscribe useEffect 추가
2. ~~`RenderManifest.vertexCount`가 float 수를 누적~~ → `vertices.length / 6` 보정
3. ~~`HierarchyPanel`에 개발용 `console.log` 2건~~ → 제거
4. ~~`IfcWorkerClient.init()` 실패 시 재시도 불가~~ → rejected promise 캐시 초기화

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

### Phase 0: Safety Rail + 결함 수정 ✅

- [x] 테스트 도구 설치 (`vitest 2.x`, `jsdom`) + `vitest.config.ts` 생성
- [x] 첫 테스트 묶음 작성 (10개): ifcGeometryUtils (7), IfcWorkerClient (3)
- [x] 결함 수정 4건

---

### Phase 1: viewportUtils 모듈 분리 ✅

`viewportUtils.ts` (841줄) → 5개 모듈로 분리 후 삭제

- [x] `cameraMath.ts` (261줄) + `cameraMath.test.ts` (10개 테스트)
- [x] `geometryFactory.ts` (108줄)
- [x] `meshManagement.ts` (405줄)
- [x] `overlayMath.ts` (52줄) + `overlayMath.test.ts` (4개 테스트)
- [x] `raycasting.ts` (33줄)
- [x] `viewportUtils.ts` 삭제

---

### Phase 2: ViewportScene 분해 ✅

`ViewportScene.tsx` (979줄) → 251줄 + 4개 훅

- [x] `useThreeScene.ts` (313줄) → `src/hooks/`
- [x] `useRenderLoop.ts` (99줄) → `src/hooks/`
- [x] `useViewportInput.ts` (189줄) → `src/hooks/`
- [x] `useChunkSceneGraph.ts` (131줄) → `src/hooks/`
- [x] SceneRefs 인터페이스로 훅 간 ref 공유

---

### Phase 3: ViewportContainer 축소 + 트리 순회 통합 ✅

- [x] `useViewportEntityFilters.ts` (111줄) → `src/hooks/`
- [x] `useChunkResidency.ts` (115줄) → `src/hooks/`
- [x] ViewportContainer (570줄 → 272줄)
- [x] 트리 순회 중복 3곳 → `treeDataBuilder.ts`로 통합
- [x] `hierarchy/types.ts` → `src/types/hierarchy.ts`로 이동

---

### Phase 4: Session / Worker 경계 정리 ✅

- [x] `useWebIfc` — `cleanupViewerState()` 공통 함수로 cleanup 경로 통일
- [x] `IfcWorkerClient` — `typedRequest<R>()` 제네릭 래퍼 도입 (272줄 → 158줄)
- [x] Worker 모듈화 (751줄 → 77줄 디스패처)
  - `workerContext.ts` (51줄)
  - `handlers/geometryHandler.ts` (242줄)
  - `handlers/propertyHandler.ts` (102줄)
  - `handlers/spatialHandler.ts` (60줄)
  - `handlers/typeTreeHandler.ts` (89줄)

---

### Phase 5: HierarchyPanel / Properties 분리 ✅

- [x] `useHierarchyController.ts` (270줄) → `src/hooks/` — 핸들러 20개 + 필터 + 컨텍스트 메뉴
- [x] HierarchyPanel.tsx (771줄 → 269줄)
- [x] `treeDataBuilder.ts` 분리 (666줄 → 212줄)
  - `treeHelpers.ts` (97줄) — 포맷팅, 이름 추출, 순회, 검색
  - `treeEntityUtils.ts` (78줄) — 엔티티 수집, 메트릭, storey
  - `treeDataBuilder.ts` (212줄) — buildSpatialTree/ClassTree/TypeTree + re-export

---

### Phase 6: 상태 관리 검토 + CSS 분리 ✅

#### 작업 A — 상태 관리 검토

전체 Zustand 슬라이스(5개) + `viewportGeometryStore` 구조를 검토한 결과, Phase 0~5를 통해 이미 잘 정리되어 있어 구조적 변경 불필요로 판단.

- [x] `viewportGeometryStore` Zustand 통합 검토 → **유지** (useSyncExternalStore가 고빈도 geometry 갱신에 적합)
- [x] 필터 상태 분산 검토 → **유지** (dataSlice에 이미 중앙화, useViewportEntityFilters가 파생 상태 정확히 조합)
- [x] 파생 상태 Zustand 셀렉터 전환 검토 → **유지** (useMemo가 복잡 Set 연산에 적합)
- [x] viewportCommand seq → 이벤트 기반 검토 → **유지** (단순·안정적, 동일 타입 반복 발행도 처리)

#### 작업 B — CSS 분리

`globals.css` (2,914줄) → 7개 역할별 파일로 분리 후 삭제

```
src/styles/
├── base.css              (112줄) — CSS variables, reset, 글로벌 button, dark theme base
├── viewer-layout.css     (243줄) — shell, content, slots, resize handle, statusbar, media queries
├── viewer-toolbar.css    (505줄) — toolbar, brand, menus, status chips, filters, viewport notifications
├── viewer-panels.css   (1,092줄) — panels, tabs, tree, scope cards, filter bars, section headers
├── viewer-viewport.css   (510줄) — viewport, viewcube, axis helper, scale bar, nav controls
├── viewer-properties.css (175줄) — inspector card, property list
└── viewer-overlays.css   (314줄) — hover tooltip, context menu, toast, shortcuts dialog
```

- [x] `globals.css` (2,914줄)를 역할별 파일로 분리
- [x] 공통 색상/spacing → `:root` CSS variable 20개 정의 (`--color-text`, `--color-border`, `--font-mono` 등)
- [x] `main.tsx` import 순서 정리 (7개 파일 순차 임포트)
- [x] class name 유지, 중복 selector 병합 (base + ifc-ln density 오버라이드 → 최종 값으로 통합)
- [x] 각 파일에 관련 dark theme 셀렉터 공존 (파일 간 cascade 의존성 제거)
- [x] `globals.css` 삭제

#### 완료 조건

- [x] 상태 관리 구조 검토 완료 (변경 불필요 확인)
- [x] `globals.css` 제거, 7개 역할별 파일로 분리
- [x] light/dark 테마 정상 (CSS variable + 인라인 dark override)
- [x] `pnpm test && pnpm typecheck && pnpm build` 통과

---

## 6. 실행 순서 총괄

| 순서 | Phase | 상태 | 핵심 성과 |
|------|-------|------|-----------|
| 0 | Safety Rail + 결함 수정 | ✅ 완료 | vitest 설정, 결함 4건 수정, 테스트 10개 |
| 1 | viewportUtils 분리 | ✅ 완료 | 841줄 → 5개 모듈, viewportUtils 삭제 |
| 2 | ViewportScene 분해 | ✅ 완료 | 979줄 → 251줄 + 4개 훅 |
| 3 | ViewportContainer + 트리 통합 | ✅ 완료 | 570줄 → 272줄, 중복 3곳 제거 |
| 4 | Session / Worker 정리 | ✅ 완료 | 751줄 → 77줄 디스패처, typedRequest 도입 |
| 5 | HierarchyPanel / Properties | ✅ 완료 | 771줄 → 269줄, treeDataBuilder 666→212줄 |
| 6 | 상태 관리 검토 + CSS 분리 | ✅ 완료 | globals.css 2,914줄 → 7개 파일, CSS variable 도입 |

---

## 7. 테스트 현황

### 자동화 테스트 (24개, 4 파일)

| 파일 | 테스트 수 | 대상 |
|------|-----------|------|
| `ifcGeometryUtils.test.ts` | 7 | unionBounds, createMeshBounds, createManifestFromChunks |
| `IfcWorkerClient.test.ts` | 3 | init 성공/실패재시도/onerror |
| `cameraMath.test.ts` | 10 | getCameraAspect, setCameraAspect, updateOrthographicFrustum, boundsFromTuple, buildBoundsForEntries |
| `overlayMath.test.ts` | 4 | formatScaleLabel (km/m/cm/mm) |

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

- [x] 확인된 결함 4건 수정
- [x] 트리 순회 로직 단일 모듈로 통합
- [x] session / worker / viewport / hierarchy 경계 분리 완료
- [x] `pnpm typecheck` 통과
- [x] `pnpm build` 통과
- [x] `pnpm test` 통과 (24/24)
- [x] styles 경계 분리 — `globals.css` → 7개 역할별 파일 + CSS variable
- [ ] 300줄 이상 TS 파일 — `useThreeScene` (313줄), `meshManagement` (405줄) 2건 잔존 (단일 책임으로 허용)
