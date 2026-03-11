# IFC Viewer 구현 로드맵

## 1. 문서 목적

이 문서는 `ifc-e`의 현재 코드베이스 기준 구현 진행 상태를 정리한 실행 문서다.

이전의 “계획만 있는 로드맵”이 아니라, 지금 저장소에 실제로 들어와 있는 코드 기준으로 아래를 기록한다.

- 무엇이 완료되었는지
- 무엇이 부분 완료 상태인지
- 다음에 무엇부터 이어서 작업해야 하는지
- 현재 막히는 위험 요소가 무엇인지

기준 시점:

- 현재 브랜치: `main`
- 현재 HEAD: `a3932fe update all`
- 확인 기준: 실제 소스코드와 `pnpm typecheck` 결과

상태 표기:

- `[완료]`: 현재 코드에서 동작 경로가 존재함
- `[부분 완료]`: 코드가 있으나 안정화나 실제 검증이 더 필요함
- `[미완료]`: 아직 구현되지 않았거나 mock 수준임

---

## 2. 현재 요약

현재 코드베이스는 대략 `Phase 4` 초반까지 와 있다.

완료 또는 부분 완료된 핵심:

- React + Vite 기반 앱 골격
- Zustand 기반 viewer 상태 저장소
- `web-ifc` worker 초기화
- IFC 파일 1개 로드
- `StreamAllMeshes` 기반 geometry 추출
- three.js 기반 3D viewport 렌더링 코드
- spatial tree 요청 및 좌측 패널 표시
- 기본 selection 상태 연동
- 기본 hide/reset visibility 상태 연동

현재 주요 이슈:

- `ViewerLayout`이 다시 단순 grid 기반이라, 최근에 진행했던 resizable panel 구조가 현재 HEAD에는 반영되지 않음
- geometry payload를 Zustand store에 직접 저장하고 있어 대형 IFC에서 느려질 가능성이 큼
- `ViewportScene`에는 WebGL fallback이 아직 반영되지 않음
- Properties 패널은 아직 실제 IFC property 조회가 아니라 mock 데이터에 가까움
- 좌측 tree와 우측 properties는 구조는 있으나 `ifc-ln` 수준의 UX 완성도는 아직 부족함

---

## 3. Phase 상태

| Phase | 상태 | 비고 |
|------|------|------|
| Phase 1. Shell Boot | 완료 | 앱 셸, 기본 상태 저장소 구성 완료 |
| Phase 2. Engine Boot | 완료 | worker 초기화 및 IFC 1개 로드 가능 |
| Phase 3. First Render | 부분 완료 | geometry streaming 및 렌더 코드 존재, 환경/성능 이슈 있음 |
| Phase 4. Inspect | 부분 완료 | selection/tree 일부 연결, properties 미완성 |
| Phase 5. Operate | 부분 완료 | hide/reset 일부 가능, isolate/filter/focus 미완료 |
| Phase 6. Edit v1 | 미완료 | mutation/save 경로 없음 |
| Phase 7. Harden | 미완료 | 멀티 모델, fallback, 성능 고도화 미완료 |

---

## 4. 상세 진행 상태

## Phase 1 - Shell Boot

### 목표

`ifc-ln` 스타일의 viewer shell과 최소 app state를 구성한다.

### 현재 상태

- [완료] 앱 골격 생성
- [완료] `src/main.tsx`, `src/App.tsx`, 전역 스타일 구성
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

### 비고

- `ifc-ln`을 “그대로 재사용”하는 수준은 아님
- 현재는 구조와 흐름을 차용한 경량 셸에 가까움

---

## Phase 2 - Engine Boot

### 목표

실제 `web-ifc` worker를 통해 IFC 파일을 로드한다.

### 현재 상태

- [완료] `web-ifc` 의존성 추가
- [완료] wasm asset 로딩 설정
- [완료] worker 생성
  - [ifc.worker.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/workers/ifc.worker.ts)
- [완료] worker client 생성
  - [IfcWorkerClient.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/services/IfcWorkerClient.ts)
- [완료] `INIT` 구현
- [완료] `LOAD_MODEL` 구현
- [완료] `CLOSE_MODEL` 구현
- [완료] `useWebIfc()`와 파일 로드 흐름 연결
  - [useWebIfc.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/hooks/useWebIfc.ts)

### 검증 상태

- [완료] `pnpm typecheck`
- [완료] 실제 IFC 파일 메타데이터 로드 경로 존재

---

## Phase 3 - First Render

### 목표

IFC geometry를 추출해 viewport에 렌더링한다.

### 현재 상태

#### Step 3.1 - Geometry Streaming

- [완료] `StreamAllMeshes` 구현
- [완료] typed array Transferable 전송
- [완료] geometry summary 계산

관련 파일:

- [ifc.worker.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/workers/ifc.worker.ts)
- [worker-messages.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/types/worker-messages.ts)

#### Step 3.2 - Viewport Rendering

- [완료] three.js 기반 viewport scene 구성
- [완료] raw vertex 배열을 render 가능한 geometry로 변환
- [완료] 카메라 fit, orbit controls, 기본 조명 구성
- [부분 완료] 실제 환경별 WebGL 실패 대응은 아직 현재 HEAD에 없음
- [부분 완료] 대형 IFC 성능 최적화는 아직 부족함

관련 파일:

- [ViewportScene.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewportScene.tsx)
- [ViewportContainer.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/ViewportContainer.tsx)

### 현재 위험

- geometry 전체를 store에 직접 보관하고 있어 렌더 외 UI도 같이 무거워질 수 있음
- WebGL이 막힌 브라우저에서는 fallback 없이 예외가 날 수 있음

---

## Phase 4 - Inspect

### 목표

모델을 선택하고, tree로 탐색하고, properties를 확인한다.

### 현재 상태

#### Step 4.1 - Selection

- [부분 완료] viewport click picking 코드 존재
- [부분 완료] expressID 기반 선택 상태 연동 존재
- [부분 완료] 선택 highlight 코드 존재
- [미완료] 안정성 검증과 환경 대응 부족

#### Step 4.2 - Hierarchy Tree

- [완료] `GET_SPATIAL_STRUCTURE` 구현
- [완료] spatial tree를 좌측 panel에 표시
- [부분 완료] tree 클릭과 selection 상태 연동
- [미완료] 디렉토리형 UX, 트리 내부 스크롤 안정화, focus 연동 부족

관련 파일:

- [HierarchyPanel.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/HierarchyPanel.tsx)
- [useWebIfc.ts](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/hooks/useWebIfc.ts)

#### Step 4.3 - Properties Panel

- [미완료] 실제 IFC property 조회 미구현
- [미완료] on-demand property loading 미구현
- [미완료] 현재 panel은 mock property 데이터 기반

관련 파일:

- [PropertiesPanel.tsx](/Users/1ncarnati0n/Desktop/tsxPJT/ifc-e/src/components/viewer/PropertiesPanel.tsx)

---

## Phase 5 - Operate

### 목표

기본 inspection 동작을 viewer에 붙인다.

### 현재 상태

#### Step 5.1 - Visibility Control

- [부분 완료] 선택 객체 hide 상태 저장
- [부분 완료] 숨김 reset 상태 저장
- [부분 완료] viewport object visibility 반영 코드 존재
- [미완료] 개별 show, 다중 show, UI 정교화 부족

#### Step 5.2 - Isolation

- [미완료] isolate 없음

#### Step 5.3 - Filter And Focus

- [미완료] type filter 없음
- [미완료] storey filter 없음
- [미완료] fit selected 없음
- [미완료] home camera 고도화 없음

---

## Phase 6 - Edit v1

### 목표

속성 편집과 save/export의 기초를 만든다.

### 현재 상태

- [미완료] mutation service 없음
- [미완료] dirty state 없음
- [미완료] undo/redo 없음
- [미완료] IFC save/export mutation 없음

---

## Phase 7 - Harden

### 목표

대형 모델, 멀티 모델, 환경별 fallback을 포함한 안정화를 진행한다.

### 현재 상태

- [미완료] WebGL fallback 미반영
- [미완료] geometry store 분리 미반영
- [미완료] resizable panel 구조 미반영
- [미완료] 멀티 모델 federation 없음
- [미완료] 성능 최적화와 메모리 관리 부족

---

## 5. 현재 우선순위

지금 코드베이스에서 바로 이어서 작업할 우선순위는 아래 순서가 적절하다.

1. `Viewport 안정화`
   - WebGL fallback 추가
   - geometry payload를 Zustand 밖으로 분리
   - viewport가 환경 문제로 전체 앱을 깨뜨리지 않도록 수정

2. `Panel 안정화`
   - 좌우 패널 내부 스크롤 고정
   - 트리 길이에 따라 중앙 viewport 높이가 흔들리지 않도록 수정
   - 가능하면 `ifc-ln`처럼 resizable panel 도입

3. `Hierarchy UX 개선`
   - 디렉토리형 tree 스타일
   - 선택/확장/스크롤 UX 정리

4. `Properties 실제 연결`
   - `GET_PROPERTIES`
   - type properties / psets
   - 우측 panel 실제 데이터 연결

5. `성능 1차 정리`
   - geometry 전용 store 분리
   - 불필요한 전체 리렌더 제거

---

## 6. 다음 작업 시작점

현재 코드 기준 다음 작업 시작점은 아래 중 하나다.

- `안정화 우선`: viewport fallback + geometry store 분리
- `UX 우선`: 좌측 tree 스크롤/디렉토리형 UI + resizable panel
- `기능 우선`: 실제 properties panel 연결

현재 코드 상태를 고려하면 `안정화 우선`이 가장 안전하다.
