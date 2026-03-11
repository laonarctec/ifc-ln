# IFC Viewer 구현 로드맵

## 개요

이 문서는 `ifc-e`의 현재 구현 상태를 빠르게 파악하고, 다음 작업 우선순위를 바로 이어갈 수 있도록 정리한 실행 문서다.

현재 프로젝트는 단순 PoC 단계를 넘어, `ifc-ln` / `ifc-lite` 스타일의 기본 IFC 뷰어 셸과 핵심 inspection 기능이 실제로 동작하는 상태까지 와 있다.

### 한눈에 보는 현재 상태

- 현재 단계: `Phase 5.5` 진행 중, `Phase 6` 진입 직전
- 현재 성격: “기본 뷰어 + 탐색 + 필터 + 카메라 조작 + 속성 조회”가 가능한 상태
- 완료된 핵심:
  - `web-ifc` worker 기반 IFC 로드
  - geometry streaming 및 3D 렌더링
  - 선택, 하이라이트, hide / isolate / show all
  - spatial tree / class tree / type-like tree / storey 기반 탐색
  - `Home`, `Fit Selected`, `Front / Right / Top / Iso` 카메라 조작
  - 실제 IFC 기반 `Properties / Quantities / PropertySet / Type / Material` 조회
  - 패널 스크롤, 리사이저, 디버그 패널 분리
  - 1차 성능 최적화: geometry cache, `InstancedMesh`, BVH picking
- 아직 남은 핵심:
  - 실제 progressive streaming 전환
  - 진짜 IfcType 관계 기반 `Type` 트리
  - 트리 성능 및 UX 추가 안정화
  - 관계 정보 확장
  - 속성 편집 v1
  - save / export
  - 멀티 모델 및 환경 fallback 고도화

### 다음 작업 추천

1. `Phase 5.5` 안정화 스프린트 진행
2. `Phase 6.1` 속성 편집 진입
3. dirty state / undo-redo 기초 추가
4. IFC 저장 경로 검증

### 상태 표기

- `[완료]`: 현재 코드와 개발 모드에서 주요 경로가 구현되어 있음
- `[부분 완료]`: 구현은 되었지만 안정화, UX 정리, 검증 보강이 더 필요함
- `[미완료]`: 아직 구현되지 않았거나 설계 수준에 머물러 있음

---

## 1. 문서 목적

이 문서는 현재 저장소 기준으로 아래를 기록한다.

- 지금 무엇이 구현되어 있는지
- 어떤 Phase까지 도달했는지
- 다음에 어디서부터 이어서 작업해야 하는지
- 기술적 위험 요소가 무엇인지

기준 시점:

- 프로젝트: `ifc-e`
- 기준 브랜치: `main`
- 확인 기준: 실제 소스코드, 최근 구현 흐름, `pnpm typecheck`, `pnpm build`

---

## 2. 현재 요약

현재 코드베이스는 “기본 IFC 뷰어로 실제 사용 가능한 수준”까지 올라와 있다.

현재 확인된 핵심 구현:

- [완료] React + Vite 앱 셸 구성
- [완료] Zustand 기반 viewer 상태 저장소
- [완료] `web-ifc` worker 초기화 및 IFC 파일 1개 로드
- [완료] `StreamAllMeshes` 기반 geometry 추출
- [완료] three.js 기반 3D viewport 렌더링
- [완료] selection, highlight, hide, isolate, show all
- [완료] spatial tree, type/class/storey 필터
- [완료] ifc-ln 스타일에 가까운 hierarchy 탭 재구성
- [완료] 카메라 `Home`, `Fit Selected`, `Front / Right / Top / Iso`
- [완료] 실제 IFC 속성 조회
- [완료] 패널 내부 스크롤 및 리사이저 구조
- [완료] 디버그 패널 분리
- [완료] geometry cache, `InstancedMesh`, BVH picking

현재 남아 있는 주요 작업:

- [부분 완료] 뷰포트 안정화
- [부분 완료] 패널 안정화
- [부분 완료] 하이어라키 UX 마무리
- [부분 완료] progressive streaming
- [완료] error 상태 노출 정리
- [완료] 필터와 selection 상태 동기화
- [부분 완료] 속성 패널의 관계 정보 확장
- [미완료] 속성 수정
- [미완료] undo / redo
- [미완료] IFC save / export
- [부분 완료] WebGL fallback 고도화
- [미완료] 멀티 모델 federation

---

## 3. Phase 상태

| Phase | 상태 | 비고 |
|------|------|------|
| Phase 1. Shell Boot | 완료 | 기본 viewer shell과 store 구성 완료 |
| Phase 2. Engine Boot | 완료 | worker 초기화 및 IFC 1개 로드 완료 |
| Phase 3. First Render | 완료 | geometry streaming, 렌더링, 기본 viewport 동작 완료 |
| Phase 4. Inspect | 완료 | selection, hierarchy, properties inspection 가능 |
| Phase 5. Operate | 완료 | visibility, isolate, filter, focus, camera preset 가능 |
| Phase 5.5 Stabilize | 부분 완료 | error/fallback, filter-selection, hierarchy 재구성 반영 완료. streaming/최종 UX 보강 남음 |
| Phase 6. Edit v1 | 미완료 | 편집, dirty state, save/export 미구현 |
| Phase 7. Harden | 부분 완료 | 1차 성능 최적화는 반영, fallback/멀티모델은 미완료 |

---

## 4. 상세 진행 상태

## Phase 1 - Shell Boot

### 목표

`ifc-ln` / `ifc-lite` 스타일의 기본 viewer shell과 최소 상태 구조를 만든다.

### 현재 상태

- [완료] 앱 골격 생성
- [완료] 전역 스타일 및 라이트 테마 적용
- [완료] 기본 viewer shell 컴포넌트 분리
  - [ViewerLayout.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewerLayout.tsx)
  - [MainToolbar.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/MainToolbar.tsx)
  - [HierarchyPanel.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/HierarchyPanel.tsx)
  - [ViewportContainer.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewportContainer.tsx)
  - [PropertiesPanel.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/PropertiesPanel.tsx)
  - [StatusBar.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/StatusBar.tsx)
- [완료] Zustand slice 구성
  - `ui`
  - `loading`
  - `selection`
  - `visibility`
  - `data`
- [완료] 좌우 패널 토글 및 resizable panel 반영
- [완료] 패널 스크롤 안정화

### 비고

- `ifc-ln` 코드 자체를 그대로 가져온 구조는 아니고, UI/UX 흐름과 밀도를 반영한 구현이다.

---

## Phase 2 - Engine Boot

### 목표

실제 `web-ifc` worker를 통해 IFC 파일을 열고 모델 메타데이터를 읽는다.

### 현재 상태

- [완료] `web-ifc` 의존성 추가
- [완료] wasm asset 로딩 설정
- [완료] worker 생성
  - [ifc.worker.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/workers/ifc.worker.ts)
- [완료] worker client 생성
  - [IfcWorkerClient.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/services/IfcWorkerClient.ts)
- [완료] `INIT`, `LOAD_MODEL`, `CLOSE_MODEL`
- [완료] `useWebIfc()`와 파일 로드 흐름 연결
  - [useWebIfc.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/hooks/useWebIfc.ts)
- [완료] 엔진 상태 표시 및 세션 초기화

### 검증 상태

- [완료] `pnpm typecheck`
- [완료] `pnpm build`
- [완료] 실제 IFC 파일 메타데이터 로드 확인

---

## Phase 3 - First Render

### 목표

IFC geometry를 추출해 viewport에 렌더링하고 기본 3D 상호작용을 제공한다.

### 현재 상태

#### Step 3.1 - Geometry Streaming

- [완료] `StreamAllMeshes` 구현
- [완료] typed array Transferable 전송
- [완료] geometry summary 계산
- [부분 완료] 실제 progressive chunk 전송은 아직 미반영
- [부분 완료] 대형 IFC에서 worker->main 대량 전송 메모리 피크 가능성 있음

관련 파일:

- [ifc.worker.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/workers/ifc.worker.ts)
- [worker-messages.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/types/worker-messages.ts)

#### Step 3.2 - Viewport Rendering

- [완료] three.js 기반 viewport scene 구성
- [완료] raw vertex 배열을 render 가능한 geometry로 변환
- [완료] 카메라 fit, orbit controls, 기본 조명 구성
- [부분 완료] WebGL 차단 환경 대응은 1차 반영, 추가 fallback UX 보강 여지 있음
- [완료] 로드/worker 오류 상태를 viewport / debug / status에 일관되게 노출
- [완료] empty state 문구를 현재 단계 기준으로 정리

관련 파일:

- [ViewportScene.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewportScene.tsx)
- [ViewportContainer.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewportContainer.tsx)

#### Step 3.3 - Performance 1차 최적화

- [완료] geometry cache
- [완료] `InstancedMesh`
- [완료] BVH picking
- [완료] viewport geometry store 분리
- [부분 완료] progressive rendering으로 이어질 수 있는 scene update 구조는 아직 미완성

관련 파일:

- [ViewportScene.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewportScene.tsx)
- [viewportGeometryStore.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/services/viewportGeometryStore.ts)

---

## Phase 4 - Inspect

### 목표

모델을 선택하고, tree로 탐색하고, 실제 IFC 속성을 확인한다.

### 현재 상태

#### Step 4.1 - Selection

- [완료] viewport click picking
- [완료] expressID 기반 선택 상태 연동
- [완료] 선택 highlight
- [부분 완료] selection UX polish 여지 있음

#### Step 4.2 - Hierarchy Tree

- [완료] `GET_SPATIAL_STRUCTURE` 구현
- [완료] spatial tree를 좌측 panel에 표시
- [완료] tree 클릭과 selection 상태 연동
- [완료] 디렉토리형 트리 UI 개선
- [완료] 좌측 패널 내부 스크롤 안정화
- [완료] `Spatial / Class / Type` 탭 반영
- [완료] `Class` 탭을 IFC 클래스 그룹 트리로 재구성
- [부분 완료] `Type` 탭을 type-like 그룹 트리로 재구성
- [완료] 검색 입력 지연 처리 적용
- [완료] selection과 트리 auto-expand / scroll 동기화
- [부분 완료] virtualized tree 수준의 대형 모델 최적화는 아직 없음
- [부분 완료] `Type` 탭은 아직 진짜 IfcType 관계 기반이 아님

관련 파일:

- [HierarchyPanel.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/HierarchyPanel.tsx)
- [useWebIfc.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/hooks/useWebIfc.ts)

#### Step 4.3 - Properties Panel

- [완료] on-demand property loading
- [완료] 기본 속성 조회
- [완료] `Property Sets` 조회
- [완료] `Quantities` 분리 표시
- [완료] `Type Properties` 조회
- [완료] `Materials` 조회
- [부분 완료] 관계 정보, inverse relation 정보는 아직 미표시
- [부분 완료] 동일 엔티티 재선택 시 property cache 부재

관련 파일:

- [PropertiesPanel.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/PropertiesPanel.tsx)
- [ifc.worker.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/workers/ifc.worker.ts)

---

## Phase 5 - Operate

### 목표

기본 inspection을 넘어서, 실제 viewer 조작 기능을 붙인다.

### 현재 상태

#### Step 5.1 - Visibility Control

- [완료] 선택 객체 hide
- [완료] 숨김 reset
- [완료] viewport object visibility 반영
- [부분 완료] 다중 selection 기반 조작은 아직 없음

#### Step 5.2 - Isolation

- [완료] isolate
- [완료] show all

#### Step 5.3 - Filter And Focus

- [완료] type filter
- [완료] class filter
- [완료] storey filter
- [완료] fit selected
- [완료] home camera
- [완료] 필터로 숨겨진 selection 자동 해제 정책 반영
- [부분 완료] 필터 active 상태와 viewport/debug/status 표현 일관성 보강 필요

#### Step 5.4 - Camera UX

- [완료] `Front / Right / Top / Iso` preset
- [완료] 헤더 `View` 드롭다운 구조
- [부분 완료] 실제 view cube는 아직 미구현

#### Step 5.5 - Stabilize Sprint

- [부분 완료] 뷰포트 높이 고정 및 패널 길이 분리
- [부분 완료] 좌우 패널 내부 스크롤 안정화
- [부분 완료] 하이어라키 ifc-ln 스타일 재구성
- [부분 완료] 헤더 중복 조작 제거 및 조작/상태 역할 분리
- [부분 완료] 디버그 패널을 상태창 중심으로 정리
- [완료] 로드/worker 오류를 store와 viewport에 일관되게 표기
- [완료] 뷰포트 빈 상태 / fallback copy 정리
- [완료] filter-selection 충돌 시 자동 선택 해제 정책 구현
- [완료] IFC class 분류 로직 공용화
- [미완료] progressive streaming 전환 또는 chunked rendering 전략 정리
- [미완료] 트리 expand/collapse 성능 및 긴 모델 UX 추가 검증
- [부분 완료] 선택 상태와 트리 스크롤 동기화 보강
- [미완료] `Type` 탭을 실제 IfcType 관계 기반 트리로 고도화

### Phase 3~5 부족한 부분 요약

#### Phase 3 - First Render

- `StreamAllMeshes`를 사용하지만 실제로는 한 번에 모아서 전송하고 있어 “진짜 streaming”은 아님
- 로딩/오류/empty/fallback 상태가 분산되어 있어 디버깅과 사용자 피드백이 약함
- progressive render로 확장 가능한 구조 정리가 더 필요함

#### Phase 4 - Inspect

- 큰 spatial tree에서 검색과 expand/collapse 성능 검증이 아직 부족함
- 선택된 엔티티 auto-reveal은 반영됐지만 대형 모델에서 추가 검증이 필요함
- relations / inverse relations가 아직 표시되지 않음
- `Type` 탭은 아직 IfcRelDefinesByType 기반의 진짜 타입 트리가 아님

#### Phase 5 - Operate

- filter-selection 기본 정책은 반영됐지만 group selection/isolate UX는 더 다듬을 여지가 있음
- viewport / debug / toolbar / panel 간 상태 표현은 1차 정리됐으나 추가 polish 여지 있음
- `Class` 탭은 공용 유틸로 정리됐고, `Type` 탭은 관계 기반 고도화가 남아 있음

### 안정화 스프린트 권장 체크리스트

#### A. 구현 체크리스트

1. `STREAM_MESHES`를 chunk 단위 전송 또는 progressive render 구조로 재설계
2. `Type` 탭을 실제 IfcType 관계 기반 트리로 전환
3. hierarchy expand/collapse 대형 모델 성능 검증 및 필요 시 virtualization 검토
4. hierarchy group 클릭 시 isolate/selection UX 세부 규칙 정리
5. relations / inverse relations를 우측 패널에 추가

#### B. 개발모드 테스트 체크리스트

1. 큰 IFC를 열었을 때 첫 렌더까지 UI가 완전히 멎지 않는지 확인
2. 로딩 실패 또는 worker 오류를 강제로 만들었을 때 오류 메시지가 viewport/debug/status에 보이는지 확인
3. 타입/클래스/층 필터를 적용한 뒤 기존 selection이 숨겨지면 상태가 일관되게 바뀌는지 확인
4. 긴 트리에서 검색, expand/collapse, 선택이 과도하게 느려지지 않는지 확인
5. `Class`/`Type` 탭이 `ifc-ln`처럼 그룹 트리로 읽히고, 그룹 클릭 시 기대한 isolate가 되는지 확인
6. 트리에서 선택한 엔티티와 3D에서 클릭한 엔티티가 계속 동일하게 표시되는지 확인
7. WebGL 불가 환경에서 fallback 메시지와 비3D UX가 충분히 읽히는지 확인
8. 좁은 폭과 일반 데스크톱 폭 모두에서 툴바/패널/뷰포트가 깨지지 않는지 확인

#### C. 통과 조건

1. 대형 IFC 기준으로 로드 직후 툴바와 패널 반응이 유지된다
2. 필터, 선택, 속성, 뷰포트 하이라이트가 서로 어긋나지 않는다
3. 오류 상태가 숨지 않고 사용자에게 보인다
4. 트리와 패널이 길어져도 중앙 뷰포트 레이아웃이 흔들리지 않는다
5. 이후 `Edit v1`로 넘어가도 될 만큼 상태 동기화 규칙이 명확하다

---

## Phase 6 - Edit v1

### 목표

속성 편집과 save/export의 기초를 만든다.

### 현재 상태

- [미완료] mutation service 없음
- [미완료] editable property workflow 없음
- [미완료] dirty state 없음
- [미완료] undo/redo 없음
- [미완료] IFC save/export mutation 없음

### 다음 추천 작업

1. `UpdateProperty` command 구조 정의
2. editable field 범위 확정
3. dirty state 표시
4. undo/redo stack 기초
5. save/export 가능성 검증

---

## Phase 7 - Harden

### 목표

대형 모델, 멀티 모델, 환경별 fallback을 포함한 안정화를 진행한다.

### 현재 상태

- [완료] geometry store 분리
- [완료] 1차 성능 최적화 반영
- [완료] resizable panel 구조 반영
- [부분 완료] WebGL fallback 1차 대응
- [미완료] 멀티 모델 federation
- [미완료] 메모리 회수 전략 정교화
- [미완료] 편집 상태 회귀 테스트

### 현재 위험 요소

- 큰 IFC에서 속성 조회와 트리 렌더가 여전히 무거워질 수 있음
- 편집 기능이 들어가면 geometry/selection/undo 상태 동기화 복잡도가 커질 수 있음
- 브라우저 환경에 따라 WebGL 제한이 있을 수 있음

---

## 5. 다음 우선순위

현재 기준 다음 작업 우선순위는 아래 순서가 가장 자연스럽다.

1. `Phase 5.5.4 - progressive streaming 설계 또는 1차 적용`
2. `Phase 5.5.5 - IfcType 관계 기반 hierarchy 고도화`
3. `Phase 5.5.6 - hierarchy 대형 모델 성능 검증`
4. `Phase 6.1 - 속성 편집 v1`
5. `Phase 6.2 - dirty state / undo-redo`
6. `Phase 6.3 - save / export`
7. `Phase 7.1 - fallback / 회귀 테스트`
8. `Phase 7.2 - 멀티 모델`

---

## 6. 현재 기준 핵심 파일

- shell / layout
  - [ViewerLayout.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewerLayout.tsx)
  - [MainToolbar.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/MainToolbar.tsx)
  - [globals.css](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/globals.css)
- engine / worker
  - [useWebIfc.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/hooks/useWebIfc.ts)
  - [IfcWorkerClient.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/services/IfcWorkerClient.ts)
  - [ifc.worker.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/workers/ifc.worker.ts)
- viewport / performance
  - [ViewportContainer.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewportContainer.tsx)
  - [ViewportScene.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewportScene.tsx)
  - [viewportGeometryStore.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/services/viewportGeometryStore.ts)
- inspect
  - [HierarchyPanel.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/HierarchyPanel.tsx)
  - [PropertiesPanel.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/PropertiesPanel.tsx)
  - [worker-messages.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/types/worker-messages.ts)
