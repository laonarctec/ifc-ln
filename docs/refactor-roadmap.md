# Refactor Roadmap

이 문서는 `ifc-ln` 리팩토링 진행 상황을 단계별로 확인하기 위한 작업 보드입니다.

## 진행 원칙

- 각 단계는 `리뷰 -> 작은 범위 리팩토링 -> 검증 -> 로그 기록` 순서로 진행합니다.
- 기능 변경보다 가독성, 책임 분리, dead code 제거, 테스트 가능성 향상을 우선합니다.
- 각 단계 완료 기준은 `pnpm typecheck`, 필요 시 `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters`, `pnpm test` 통과입니다.

## 단계 현황

### 1. Properties / Hierarchy 1차 정리

- 상태: 완료
- 목표: 탭 상태 흐름 단순화, 반복 JSX 축소, hidden entity 파생 로직 공통화, unused 코드 제거
- 주요 대상:
  - `src/hooks/controllers/usePropertiesController.tsx`
  - `src/components/viewer/PropertiesPanel.tsx`
  - `src/hooks/useHierarchyController.ts`
  - `src/components/viewer/hierarchy/useHierarchyTree.ts`
  - `src/stores/viewerSelectors.ts`
  - `src/services/IfcWorkerClient.ts`

### 2. ViewportController 구조 정리

- 상태: 완료
- 목표: 뷰포트 컨트롤러의 데이터 조합, empty state 판단, 컨텍스트 메뉴/선택 계산을 분리해 테스트 가능한 구조로 정리
- 주요 대상:
  - `src/hooks/controllers/useViewportController.ts`
  - `src/components/viewer/ViewportContainer.tsx`
  - `src/hooks/controllers/viewportControllerUtils.ts`
- 세부 체크리스트:
  - [x] 순수 계산 로직을 유틸로 분리
  - [x] 컨텍스트 메뉴 대상 모델 계산을 명확히 정리
  - [x] 전용 테스트 추가

### 3. ViewportScene 렌더 파이프라인 분리

- 상태: 완료
- 목표: scene 구성, overlay, 입력 브리지, 카메라 명령 처리를 역할별로 분리
- 주요 대상:
  - `src/components/viewer/ViewportScene.tsx`
  - `src/components/viewer/viewport/meshManagement.ts`
- 세부 체크리스트:
  - [x] 측정 오버레이 생명주기와 동기화 로직 분리
  - [x] 카메라 preset/home/zoom/fit-selected 명령 처리 분리
  - [x] 입력 브리지와 clipping/measurement 연동 정리
  - [x] scene 계산 유틸 및 전용 테스트 추가

### 4. Clipping 서브시스템 정리

- 상태: 완료
- 목표: 생성/선택/변형 로직을 순수 계산과 상태 전이로 분리
- 주요 대상:
  - `src/hooks/useClippingPlane.ts`
  - `src/stores/slices/clippingSlice.ts`
  - `src/components/viewer/viewport/clippingMath.ts`
- 세부 체크리스트:
  - [x] clipping slice 상태 전이 규칙을 유틸로 분리
  - [x] active clipping plane 조회 로직을 공통 selector로 통합
  - [x] scene 크기/label 투영 계산을 순수 유틸로 분리
  - [x] draft/resize/state 유틸 테스트 추가

### 5. 대형 UI 컴포넌트 축소

- 상태: 완료
- 목표: 긴 UI 파일에서 설정 객체와 view model을 분리
- 주요 대상:
  - `src/components/viewer/MainToolbar.tsx`
  - `src/components/viewer/HierarchyPanel.tsx`
  - `src/components/viewer/StatusBar.tsx`
- 세부 체크리스트:
  - [x] MainToolbar section 구성을 설정 객체로 분리
  - [x] HierarchyPanel grouping/empty/footer 표시 규칙을 view model로 분리
  - [x] HierarchyPanel storey scope, semantic filter bar를 보조 컴포넌트로 분리
  - [x] StatusBar badge/debug panel 표시 규칙을 view model로 분리
  - [x] UI view model 전용 테스트 추가

### 6. 최종 안정화

- 상태: 완료
- 목표: 남은 dead code 정리, selector/utility 중복 제거, 테스트 보강, 회귀 검증
- 주요 대상:
  - `src/hooks/useHierarchyController.ts`
  - `src/components/viewer/StatusBar.tsx`
  - `src/stores/viewerSelectors.ts`
  - `src/components/viewer/HierarchyPanel.test.tsx`
- 세부 체크리스트:
  - [x] Hierarchy controller dead return 및 unused 핸들러 정리
  - [x] StatusBar store 구독을 공통 selector 기반으로 통합
  - [x] selector helper 전용 테스트 추가
  - [x] 전체 타입/unused/테스트 회귀 검증 통과

## 이번 단계 검증 기록

- 완료:
  - `pnpm typecheck`
  - `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters`
  - `pnpm test`
