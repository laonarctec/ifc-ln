# ifc-lite / ifc-ln 패널 구현 비교

## 범위

- 좌측 패널: `HierarchyPanel`
- 우측 패널: `ViewerLayout` 기준 우측 슬롯과 `PropertiesPanel`

## 한줄 요약

- `ifc-ln`은 좌우 패널이 뷰어 핵심 흐름(계층 탐색, 속성 조회, 클리핑 편집)에 집중되어 있다.
- `ifc-lite`는 좌측을 federated navigator로, 우측을 properties 기반 workspace dock으로 확장해 주변 기능까지 흡수한다.

## 좌측 패널 비교

| 항목 | ifc-ln | ifc-lite | 참고 포인트 |
| --- | --- | --- | --- |
| 패널 역할 | 좌측 슬롯은 항상 `HierarchyPanel`이다. | 좌측 슬롯은 `HierarchyPanel`이지만 federated navigator 역할까지 맡는다. | `ifc-lite`는 단순 트리보다 작업 공간 네비게이터에 가깝다. |
| 레이아웃 구조 | `ViewerLayout`의 고정 3분할 데스크톱 레이아웃이다. | 데스크톱 3분할 + 모바일 bottom sheet를 별도로 가진다. | 모바일 대응은 `ifc-lite`가 한 단계 더 들어가 있다. |
| 데이터 소스 | `useHierarchyPanelData`가 store의 `spatialTree`, `typeTree`, `currentModelId`를 읽고, `useHierarchyController`가 type tree를 worker에서 lazy load한다. | `useHierarchyTree`가 `models`, `IfcDataStore`, `geometryResult`를 직접 받아 클라이언트에서 트리를 조립한다. | `ifc-ln`은 worker 경계가 뚜렷하고, `ifc-lite`는 패널 내부 계산 비중이 더 크다. |
| 멀티모델 대응 | 좌측 트리는 사실상 active model 기준 단일 트리다. | federated tree를 전제로 하고 `Building Storeys` / `Models`를 분리 렌더링한다. | 멀티모델 참고 목적이면 `ifc-lite` 좌측 패널 쪽이 더 직접적이다. |
| 그룹핑 모드 | `spatial / class / type` 3모드, `PanelSegmentedControl` 사용. | `spatial / type / ifc-type` 3모드, 버튼 그룹 사용. | `ifc-lite`는 `IfcType` 엔티티 트리를 별도 모드로 떼어낸다. |
| 검색/가상화 | `@tanstack/react-virtual` 기반 단일 스크롤 가상화, `useDeferredValue` 검색 디바운싱. | 동일하게 virtualized tree이지만 federated spatial 모드에서는 스토리/모델 섹션별 virtualizer를 따로 운용한다. | 큰 모델 + 멀티모델로 갈수록 `ifc-lite` 구현이 더 복합적이다. |
| 선택/필터 UX | storey scope 섹션, semantic filter bar, shift-add 선택, 우클릭 context menu를 제공한다. | 클릭 기반 storey/class/type 필터, Ctrl/Cmd 토글, footer filter chip, `ESC` clear 흐름이 중심이다. | `ifc-ln`은 컨텍스트 메뉴 중심, `ifc-lite`는 연속 필터 중심이다. |
| 액션 범위 | isolate, hide/show, focus, select를 `TreeContextMenu`에서 수행한다. | node visibility, model visibility, model remove, active model 전환까지 좌측에서 처리한다. | `ifc-lite`는 model-level action이 좌측 패널로 내려와 있다. |
| 상태 유지 | 그룹핑 모드는 localStorage, 패널 접힘 상태는 viewer store + controller ref로 동기화한다. | 그룹핑 모드는 localStorage, 패널 접힘/모바일 상태는 UI slice에서 직접 관리한다. | 둘 다 상태 보존은 있지만 `ifc-lite`가 모바일 분기까지 포함한다. |

## 우측 패널 비교

| 항목 | ifc-ln | ifc-lite | 참고 포인트 |
| --- | --- | --- | --- |
| 우측 슬롯 구조 | 우측 슬롯은 항상 `PropertiesPanel`이고 내부 탭만 바뀐다. | 우측 슬롯 자체가 `Properties / BCF / IDS / Lens` 중 하나로 교체된다. | `ifc-lite`는 우측을 inspector가 아니라 workspace dock처럼 쓴다. |
| 탭/패널 상태 관리 | `rightPanelTab`을 store에서 제어하고, 클리핑 생성 시 `editor` 탭으로 자동 전환한다. | 속성 패널 내부 `Tabs`는 `defaultValue=\"properties\"` 기반이고, 우측 슬롯 전환은 `bcfPanelVisible`, `idsPanelVisible`, `lensPanelVisible` 같은 boolean slice로 제어한다. | `ifc-ln`은 단일 state machine에 가깝고, `ifc-lite`는 패널별 독립 slice가 많다. |
| 데이터 로딩 경로 | `usePropertiesPanelData`가 worker에 부족한 section만 요청해서 merge한다. | `PropertiesPanel`이 `IfcDataStore`와 `MutablePropertyView`에서 속성, 문서, 재질, 관계, georef를 on-demand 추출한다. | `ifc-ln`은 worker fetch형, `ifc-lite`는 client extraction형이다. |
| 기본/빈 상태 | 선택이 없어도 Models, LensRules, Changes, Inspector 요약, Geometry 카드가 유지된다. | 선택이 없으면 빈 상태 또는 `ModelMetadataPanel`이 보이고, 모델 선택/통합 스토리 선택에 따라 별도 화면으로 분기된다. | `ifc-lite`는 selection variant별 전용 패널이 명확하다. |
| 속성 범위 | attributes, property sets, quantity sets, metadata, materials, documents, classifications, relations, inverse relations까지 섹션화되어 있다. | properties, quantities, classifications, materials, documents, relationships, georeferencing, bSDD가 핵심이다. | `ifc-lite`는 georef/bSDD가 강하고, `ifc-ln`은 inverse/direct relation 섹션 구성이 더 선명하다. |
| 편집 모델 | `EditableEntryRow` 기반 scalar 편집, tracked change map, revert 버튼 중심이다. | edit mode + `EditToolbar` + `MutablePropertyView` 기반이며 occurrence/type 영향 범위까지 계산한다. | 속성 mutation 체계는 `ifc-lite`가 더 진화돼 있다. |
| 모델/워크스페이스 통합 | Models 카드, Lens rules 카드, Changes 카드가 속성 패널 내부에 함께 있다. | BCF, IDS, Lens는 우측 별도 패널로 빠지고, Lists/Script는 하단 패널로 분리된다. | `ifc-lite`는 기능 모듈을 패널 단위로 분리했고, `ifc-ln`은 inspector 안에 묶어 둔 상태다. |
| 좌표/지오메트리 정보 | Geometry metric, multi-select aggregate, model context, measure 상태를 한 패널에 모은다. | GlobalId copy, focus/hide, storey/elevation 표시, world 좌표, georeferencing 편집을 더 깊게 제공한다. | 좌표/지리 정보 참고는 `ifc-lite`, 단면/기하 요약 참고는 `ifc-ln`이 유리하다. |
| 단면/편집 도구 | `editor` 탭이 사실상 clipping plane editor 전용이다. | 단면은 별도 도구 패널 계열로 분산되고, PropertiesPanel은 속성/좌표/지오리퍼런스 중심이다. | Rhino식 단면 편집 UX를 참고하려면 `ifc-ln` 우측 패널이 더 직접적이다. |
| 반응형 | 별도 모바일 우측 패널 분기가 없다. | 모바일에서는 우측 패널을 bottom sheet로 띄우고 현재 열린 패널 이름을 동적으로 바꾼다. | 모바일 UX는 `ifc-lite` 쪽 설계가 더 완성돼 있다. |

## 지금 참고 우선순위

1. 좌측 패널을 확장하려면 `ifc-lite`의 federated tree 분리 구조와 model-level action 배치를 먼저 보는 편이 낫다.
2. 우측 패널을 고도화하려면 `ifc-lite`의 `MutablePropertyView` 기반 속성 편집 흐름과 `ModelMetadataPanel` 분기를 참고할 가치가 크다.
3. 반대로 `ifc-ln`의 장점은 worker 기반 section loading과 clipping editor처럼 목적이 뚜렷한 inspector 구성에 있다.

## 참고 파일

- `ifc-ln/src/components/viewer/ViewerLayout.tsx`
- `ifc-ln/src/components/viewer/HierarchyPanel.tsx`
- `ifc-ln/src/hooks/useHierarchyController.ts`
- `ifc-ln/src/components/viewer/PropertiesPanel.tsx`
- `ifc-ln/src/hooks/controllers/usePropertiesController.tsx`
- `ifc-ln/src/components/viewer/properties/usePropertiesPanelData.ts`
- `ifc-lite/apps/viewer/src/components/viewer/ViewerLayout.tsx`
- `ifc-lite/apps/viewer/src/components/viewer/HierarchyPanel.tsx`
- `ifc-lite/apps/viewer/src/components/viewer/hierarchy/useHierarchyTree.ts`
- `ifc-lite/apps/viewer/src/components/viewer/PropertiesPanel.tsx`
- `ifc-lite/apps/viewer/src/components/viewer/MainToolbar.tsx`
