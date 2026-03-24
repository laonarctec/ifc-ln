# ifc-lite vs ifc-ln 기능 비교 검증

## 1. 목적

이 문서는 현재 워크스페이스 기준으로 `ifc-lite`와 `ifc-ln`의 구현 기능을 비교해,
`ifc-ln`을 어디까지 구현할지 결정하기 위한 기준선으로 사용한다.

기준 날짜: `2026-03-24`

---

## 2. 비교 전제

이 비교는 완전히 같은 제품끼리의 비교가 아니다.

- `ifc-lite`는 **뷰어 + SDK + CLI + 서버 + 데스크톱 + 생성/변경/검증 도구**를 포함한 플랫폼이다.
- `ifc-ln`은 현재 **브라우저 기반 단일 IFC 뷰어 앱**에 가깝다.

따라서 아래처럼 나눠서 봐야 한다.

1. **직접 비교 가능한 뷰어 기능**
   `ifc-ln`이 실제로 따라가야 할 후보군
2. **플랫폼 기능**
   `ifc-lite`에는 있지만 `ifc-ln`의 기본 목표로 삼기엔 과한 범위

---

## 3. 검증 기준

README 문구만 보지 않고, 실제 구현 파일을 기준으로 비교했다.

주의:

- 본 문서는 **정적 코드 검토 기준의 비교 문서**다.
- 실제 UX 품질, 성능, 대형 모델 안정성은 별도의 smoke test / benchmark 문서로 분리하는 것이 맞다.

### ifc-lite에서 확인한 대표 구현

- `README.md`
- `apps/viewer/src/components/viewer/MainToolbar.tsx`
- `apps/viewer/src/components/viewer/ViewerLayout.tsx`
- `apps/viewer/src/components/viewer/HierarchyPanel.tsx`
- `apps/viewer/src/components/viewer/PropertiesPanel.tsx`
- `apps/viewer/src/components/viewer/BCFPanel.tsx`
- `apps/viewer/src/components/viewer/IDSPanel.tsx`
- `apps/viewer/src/components/viewer/LensPanel.tsx`
- `apps/viewer/src/components/viewer/ScriptPanel.tsx`
- `apps/viewer/src/components/viewer/lists/ListPanel.tsx`
- `apps/viewer/src/hooks/useIfc.ts`
- `apps/viewer/src/hooks/useIfcFederation.ts`
- `apps/viewer/src/hooks/useBCF.ts`
- `apps/viewer/src/hooks/useIDS.ts`
- `docs/guide/federation.md`
- `docs/guide/drawing-2d.md`

### ifc-ln에서 확인한 대표 구현

- `README.md`
- `docs/refactoring.md`
- `src/components/viewer/MainToolbar.tsx`
- `src/components/viewer/ViewerLayout.tsx`
- `src/components/viewer/HierarchyPanel.tsx`
- `src/components/viewer/PropertiesPanel.tsx`
- `src/components/viewer/ViewportContainer.tsx`
- `src/components/viewer/ViewportScene.tsx`
- `src/hooks/useWebIfc.ts`
- `src/hooks/useHierarchyController.ts`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/workers/handlers/spatialHandler.ts`
- `src/workers/handlers/propertyHandler.ts`
- `src/workers/handlers/typeTreeHandler.ts`

---

## 4. 직접 비교 가능한 뷰어 기능 매트릭스

상태 기준:

- `동등`: 현재 `ifc-ln`이 핵심 기능을 거의 갖춤
- `부분`: 일부는 구현됐지만 범위나 깊이가 작음
- `없음`: 현재 `ifc-ln`에 없음

우선순위 기준:

- `P1`: `ifc-ln`이 독립적인 IFC 뷰어로 완성도를 가지려면 추천
- `P2`: 제품 요구가 있을 때 확장
- `P3`: 장기 과제
- `Out`: 현재 아키텍처/제품 목표에서는 비대상

| 영역 | ifc-lite | ifc-ln | 상태 | 권장 |
|---|---|---|---|---|
| 단일 모델 IFC 로딩/브라우저 렌더링 | 구현. 브라우저 뷰어가 핵심 축이며 툴바/패널/뷰포트가 완성돼 있음 | 구현. `web-ifc` worker + chunk manifest/residency + Three.js 렌더링 | 동등 | P1 |
| 선택/멀티선택/숨김/격리/fit/preset/projection/hover | 구현 | 구현. `hide/isolate/show all`, `fit-selected`, `fit-all`, preset view, projection toggle, hover tooltip 존재 | 거의 동등 | P1 |
| 계층 탐색 | 구현. spatial/class/type, 검색, storey, 모델 계층 | 구현. spatial/class/type, 검색, storey scope, semantic filter 존재 | 동등에 가까움 | P1 |
| 속성 조회 기본기 | 구현. 속성/수량/타입/재질/관계/문서/분류/좌표/메타데이터 | 구현. attributes, property sets, quantity sets, type properties, materials, relations, inverse relations, geometry metrics | 부분 | P1 |
| 상태/디버그/테마 | 구현 | 구현. status bar, debug popup, theme switch, engine/loading/error state 존재 | 동등 | P1 |
| 스크린샷/기본 JSON export | 구현 | 구현. screenshot + spatial tree JSON export | 부분 | P1 |
| 측정 도구 | 구현. 3D/2D 측정 흐름 존재 | 없음 | 없음 | P1 |
| 단면(Section) 도구 | 구현. section plane + 관련 UI 존재 | 없음 | 없음 | P1 |
| 2D 도면/단면 생성/주석/SVG export | 구현 | 없음 | 없음 | P2 |
| 멀티모델 federation | 구현. 다중 모델 로딩, model visibility, unified hierarchy, ID offset 관리 | 없음. 현재 단일 `currentModelId` 중심 | 없음 | P2 |
| 모델 단위 관리 | 구현. add/remove model, model visibility/collapse, active model | 없음 | 없음 | P2 |
| IFCX/overlay composition/GLB 입력 | 구현. IFCX federated composition, GLB 입력까지 고려 | 없음. 현재 `web-ifc` 단일 IFC 뷰어 성격 | 없음 | Out |
| 속성 편집/변경 추적/변경 IFC export | 구현. inline edit, bulk edit, mutation export 흐름 존재 | 없음 | 없음 | P2 |
| bSDD 연계 | 구현. 실시간 조회 및 속성 추가 흐름 존재 | UI만 있음. `PropertiesPanel`에 disabled bSDD 탭만 존재 | 없음 | P2 |
| BCF 협업 | 구현. topic/comment/viewpoint import/export | 없음 | 없음 | P2 |
| IDS 검증 | 구현. IDS 로드, validation, colorize, report export | 없음 | 없음 | P2 |
| 규칙 기반 필터/컬러링(Lens) | 구현 | 없음 | 없음 | P3 |
| 스크립트/리스트/AI 보조/CSV import | 구현 | 없음 | 없음 | Out |
| 모바일 전용 레이아웃 | 구현. 모바일 bottom sheet 대응 | 없음. 현재 데스크톱 레이아웃 중심 | 부분 | P3 |

---

## 5. 플랫폼 레벨 차이

아래 항목은 `ifc-lite`에 존재하지만, 현재의 `ifc-ln`을 같은 레벨로 확장하려면
뷰어 범위를 넘어서는 별도 제품 설계가 필요하다.

| 영역 | ifc-lite | ifc-ln | 권장 |
|---|---|---|---|
| CLI / Headless BIM 작업 | 구현. query/export/ids/bcf/create/diff/mutate 등 | 없음 | Out |
| 서버 백엔드 / 캐시 / 스트리밍 | 구현. `@ifc-lite/server-client`, server-bin | 없음 | Out |
| 데스크톱 앱(Tauri) | 구현 | 없음 | Out |
| IFC 생성(Create) | 구현. `@ifc-lite/create` | 없음 | Out |
| SDK/패키지 생태계 | 구현. parser/query/export/mutations/ids/bcf/lens 등 다수 패키지 | 없음 | Out |

핵심 해석:

- `ifc-lite`는 **뷰어가 포함된 BIM 플랫폼**
- `ifc-ln`은 현재 **집중된 단일 뷰어**

즉, `ifc-lite 전체와의 동등성`을 목표로 잡으면 범위가 비현실적으로 커진다.

---

## 6. 핵심 차이 해석

### 6.1 `ifc-ln`이 이미 잘 갖춘 영역

- 단일 모델 IFC 로딩과 브라우저 렌더링
- 계층 탐색(spatial/class/type)
- 선택/숨김/격리/fit/preset/projection
- 기본 속성 조회와 geometry metric
- worker 분리, chunk 기반 점진 로딩, 상태/디버그 UI

즉 현재 `ifc-ln`은 이미 **"단일 모델 IFC inspector/viewer"**로는 충분히 유효하다.

### 6.2 `ifc-lite` 대비 가장 큰 기능 공백

- 측정/단면/2D 도면
- 멀티모델 federation
- 편집/변경 저장
- BCF / IDS / bSDD
- workflow panel 계열(script, lists, lens, data import)

즉 현재 `ifc-ln`은 **"뷰어"는 되었지만 "BIM 워크플로 허브"는 아니다.**

### 6.3 아키텍처상 바로 따라가기 어려운 영역

- `ifc-lite`는 Rust/WASM + WebGPU + 자체 패키지 생태계를 전제로 한다.
- `ifc-ln`은 `web-ifc + Three.js/WebGL + 단일 앱` 구조다.

따라서 아래는 단순 UI 추가가 아니라 아키텍처 확대에 가깝다.

- IFCX overlay composition
- mutation/export round-trip
- CLI/server/desktop parity
- 전체 SDK 생태계 재현

이 영역은 "기능 추가"가 아니라 "제품 축 확장"으로 봐야 한다.

---

## 7. `ifc-ln` 권장 목표선

### 권장안 A: Core Viewer Parity

가장 현실적이고 추천하는 목표선이다.

포함:

- 현재 단일 모델 뷰어 품질 강화
- 측정 도구
- section plane
- 속성 패널 보강
  - classification
  - documents
  - model metadata
- export 보강
  - CSV 또는 GLB 중 실제 필요한 것부터

이 수준이면 `ifc-ln`은 `ifc-lite`의 전체 대체는 아니지만,
**실무용 IFC 뷰어로는 충분한 경쟁력**을 가질 수 있다.

### 권장안 B: Viewer + Workflow

업무 요구가 분명할 때만 추가한다.

후보:

- federation
- BCF
- IDS
- bSDD
- property editing

이 단계부터는 단순 viewer가 아니라 협업/검증 툴로 성격이 바뀐다.

### 권장안 C: Platform Parity

현재는 추천하지 않는다.

포함:

- CLI
- server
- desktop
- IFC creation
- script/list/AI/lens 전반

이 단계는 `ifc-ln`을 별도 플랫폼으로 재정의하는 수준이다.

---

## 8. 최종 권고

### 결론

`ifc-ln`의 현실적인 목표는 **`ifc-lite` 전체 복제**가 아니라,
**`ifc-lite`의 코어 viewer 기능 중 실제 필요한 영역만 선별적으로 흡수하는 것**이 맞다.

### 추천 우선순위

1. `P1`
   측정, section, 속성 패널 보강, export 보강
2. `P2`
   federation, BCF, IDS, bSDD, property editing 중 실제 제품 요구가 있는 것만
3. `Out`
   CLI/server/desktop/create/script/list/lens까지 한 번에 따라가려는 목표

### 한 줄 판단

현재 `ifc-ln`은 **"단일 모델 viewer" 범위는 이미 충분히 구현**되어 있고,
다음 목표는 `ifc-lite`의 **workflow feature 중 무엇을 선택적으로 가져올지 결정하는 단계**다.
