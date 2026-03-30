# ifc-ln Viewer Shell Refactor Plan

## 요약

이 문서는 `ifc-ln` viewer shell의 구조 리팩터링 계획서다. 목표는 기능 변경 없이
panel/layout/toolbar/viewport controller 계층의 책임 경계를 더 명확히 만드는 것이다.

이번 계획은 구현 순서를 포함한 실행 문서로 사용한다. 각 단계는 중간에 멈춰도
빌드 가능한 상태를 유지해야 하며, 단계별 검증 명령을 반드시 함께 실행한다.

## 목표

- viewer shell의 View / Controller / utility 책임을 더 선명하게 분리한다.
- 거대한 hook/controller 안의 순수 계산과 scene object 조립을 외부 유틸로 이동한다.
- 기존 store public contract와 worker message contract는 유지한다.
- 패널 전환, 입력, 클리핑, 선택 동작의 회귀 없이 점진적으로 정리한다.

## 범위

### 포함

- `src/components/viewer/ViewerLayout.tsx`
- `src/hooks/controllers/useViewerLayoutController.ts`
- `src/hooks/controllers/useMainToolbarController.ts`
- `src/hooks/useViewportInput.ts`
- `src/hooks/useClippingPlane.ts`
- `src/components/viewer/viewport/*` 유틸 계층

### 제외

- BCF/IDS/List 기능 완성
- worker capability 추가
- store public shape 변경
- 제품 기능 추가
- UI 비주얼 재디자인

## 현재 구조 진단

| 파일 | 현재 역할 | 혼재 문제 | 리팩터 우선순위 |
| --- | --- | --- | --- |
| `ViewerLayout.tsx` | shell view, panel mode 분기 | panel registry/lazy wiring이 view 파일에 누적 | 중간 |
| `useViewerLayoutController.ts` | panel imperative sync | bootstrap side effect가 같이 섞임 | 중간 |
| `useMainToolbarController.ts` | toolbar state + action assembly | file/session/panel/clipping/export/engine concern 집중 | 높음 |
| `useViewportInput.ts` | viewport input coordinator | pointer state machine + 좌표 변환 + box select 계산이 한 파일에 집중 | 높음 |
| `useClippingPlane.ts` | clipping interaction/controller | section visual, stats, cache lifecycle이 함께 존재 | 높음 |

## 리팩터링 원칙

- 기능 변경 금지
- 작은 단계 단위 진행
- 순수 계산과 scene object 조립을 먼저 분리
- 새 파일은 책임 경계를 명확히 할 때만 만든다
- store selector와 side effect init은 controller 역할과 구분한다
- 각 단계 후 `tsc --noEmit`와 관련 테스트를 실행한다

## 진행 상태

### 전체 진척도

- 전체 진행률: `100%`
- Phase 0: 완료
- Phase 1: 완료
- Phase 2: 완료
- Phase 3: 완료
- Phase 4: 완료
- Phase 5: 완료

### 완료

1. `useClippingPlane.ts`에서 section plane visual 조립을 `clippingSectionVisuals.ts`로 분리
2. `clippingSectionVisuals.test.ts` 추가
3. `useViewportInput.ts`의 client 좌표 변환 / viewport bounds check / box selection query 계산을 `viewportPointerUtils.ts`로 분리
4. `viewportPointerUtils.test.ts` 추가
5. `useViewportInput.ts`의 click / clipping-preview 분기를 `viewportInputCommands.ts`로 분리
6. `viewportInputCommands.test.ts` 추가
7. `useViewportInput.ts`의 drag threshold / box activation / context menu release 판단을 `viewportPointerState.ts`로 분리
8. context menu 해석을 `viewportInputCommands.ts`로 통합
9. `viewportPointerState.test.ts` 추가
10. `useViewportInput.ts`의 hover timer / hover display 상태를 `viewportHoverState.ts`로 분리
11. `viewportHoverState.test.ts` 추가
12. `useViewerLayoutController.ts`의 bootstrap side effect를 `useViewerShellBootstrap.ts`로 분리
13. `useViewerShellBootstrap.test.tsx` 추가
14. `useMainToolbarController.ts`의 file/session 로드 흐름을 `useToolbarFileActions.ts`로 분리
15. `useToolbarFileActions.test.tsx` 추가
16. `useMainToolbarController.ts`의 clipping action 분기를 `useToolbarClippingActions.ts`로 분리
17. `useToolbarClippingActions.test.tsx` 추가
18. `useMainToolbarController.ts`의 engine 초기화 분기를 `useToolbarEngineActions.ts`로 분리
19. `useToolbarEngineActions.test.tsx` 추가
20. `ViewerLayout.tsx`의 right/bottom panel registry를 `ViewerLayoutPanels.tsx`로 분리
21. `ViewerLayoutPanels.test.tsx` 추가
22. `useClippingPlane.ts`의 plane별 section stats/visual 계산을 `clippingSectionBuilder.ts`로 분리
23. `clippingSectionBuilder.test.ts` 추가
24. `sectionTopologyCache.ts`에 cached topology 조회 helper 추가
25. `sectionTopologyCache.test.ts` 추가
26. `useClippingPlane.ts`의 scene teardown을 `clippingSceneLifecycle.ts`로 분리
27. `clippingSceneLifecycle.test.ts` 추가
28. `useMainToolbarController.ts`의 menu auto-close side effect를 `useToolbarMenuAutoClose.ts`로 분리
29. `useToolbarMenuAutoClose.test.tsx` 추가
30. `useViewportInput.ts`의 context menu / box selection / wheel throttle 실행 보조를 `viewportInputEffects.ts`로 분리
31. `viewportInputEffects.test.ts` 추가
32. `useViewportInput.ts`의 click / hover dispatch를 `viewportInputDispatch.ts`로 분리
33. `viewportInputDispatch.test.ts` 추가
34. `useViewportInput.ts`의 local pointer bookkeeping을 `viewportPointerSession.ts`로 분리
35. `viewportPointerSession.test.ts` 추가
36. `useViewportInput.ts`의 listener side effect를 `viewportInputLifecycle.ts`로 분리
37. `viewportInputLifecycle.test.ts` 추가
38. `useClippingPlane.ts`의 plane widget / draft / gumball scene sync를 `clippingPlaneSceneSync.ts`로 분리
39. `clippingPlaneSceneSync.test.ts` 추가
40. `useClippingPlane.ts`의 gumball viewport scale 계산을 `clippingGumballViewportSync.ts`로 분리
41. `clippingGumballViewportSync.test.ts` 추가
42. `useClippingPlane.ts`의 control change / ResizeObserver binding을 `clippingGumballViewportLifecycle.ts`로 분리
43. `clippingGumballViewportLifecycle.test.ts` 추가
44. `useViewportInput.ts`의 DOM/window/document listener registration을 `viewportInputBindings.ts`로 분리
45. `viewportInputBindings.test.ts` 추가

### 현재 단계

- 현재 계획 범위 구현 완료

### 다음 단계

- 브라우저 수동 회귀 확인과 추가 기능 작업은 별도 후속 범위로 분리
- `useMainToolbarController.ts`의 panel mode action은 현재 pass-through 유지가 더 단순하므로 현 계획에서는 분리하지 않음

## 단계별 실행 계획

### Phase 0. Baseline 문서화

목표:
- viewer shell 핵심 파일의 현재 책임과 혼재 지점을 기록한다.

완료 조건:
- 다음 구현자가 문서만 읽고 어느 파일부터 줄여야 할지 판단 가능해야 한다.

### Phase 1. Viewport utility 추출

목표:
- 큰 viewport hook 안의 순수 계산과 scene object 생성 코드를 분리한다.

작업 항목:
- `useClippingPlane.ts`
  - section visual creation
  - section object dispose
  - section stats/cache helper 후보 식별
- `useViewportInput.ts`
  - client 좌표 → NDC 변환
  - viewport bounds check
  - box selection rectangle → NDC query 계산
  - 이후 pointer branch 분리 기반 마련

현재 상태:
- `clippingSectionVisuals.ts` 추출 완료
- `clippingSectionBuilder.ts`로 plane별 stats/visual 계산 분리 완료
- `sectionTopologyCache.ts`로 cached topology 조회 경계 분리 완료
- `clippingSceneLifecycle.ts`로 clipping scene teardown 분리 완료
- `clippingPlaneSceneSync.ts`로 plane widget / draft / gumball scene sync 분리 완료
- `clippingGumballViewportSync.ts`로 gumball viewport scale 계산 분리 완료
- `viewportPointerUtils.ts` 추출 완료
- `viewportInputCommands.ts` 추출 완료
- `viewportPointerState.ts` 추출 완료
- `viewportHoverState.ts` 추출 완료
- `viewportInputEffects.ts`로 context menu / box selection / wheel throttle 실행 보조 분리 완료
- `viewportInputDispatch.ts`로 click / hover dispatch 분리 완료
- `viewportPointerSession.ts`로 local pointer bookkeeping 분리 완료
- `viewportInputLifecycle.ts`로 listener side effect 분리 완료

완료 조건:
- hook 파일에 남는 코드는 orchestration 중심이어야 한다.

검증:
- `pnpm -C ifc-ln exec vitest run src/components/viewer/viewport/clippingSectionVisuals.test.ts src/hooks/useViewportInput.test.tsx`
- `pnpm -C ifc-ln exec tsc --noEmit`

### Phase 2. Layout shell controller 정리

목표:
- `useViewerLayoutController.ts`에서 panel imperative sync와 app bootstrap을 분리한다.

작업 항목:
- panel ref / collapse sync는 controller에 남긴다
- `useWebIfc`, `useKeyboardShortcuts`, `useThemeSync`, `useWebIfcPropertySync` 초기화 묶음을 별도 bootstrap hook으로 분리한다
- `ViewerLayout.tsx`의 right/bottom panel content registry를 shell helper로 이동할지 평가하고 필요 시 이동한다

완료 조건:
- layout controller는 panel orchestration 중심이 된다.

현재 상태:
- `useViewerShellBootstrap.ts`로 bootstrap side effect 분리 완료
- `ViewerLayoutPanels.tsx`로 panel registry 분리 완료

검증:
- 관련 controller test
- panel collapse / expand 수동 확인
- `pnpm -C ifc-ln exec tsc --noEmit`

### Phase 3. Main toolbar controller 분해

목표:
- `useMainToolbarController.ts`의 action family를 더 작은 controller util로 나눈다.

작업 항목:
- file/session actions
- panel toggle actions
- clipping actions
- engine actions
- export actions

완료 조건:
- main toolbar controller는 state 조합과 action assembly만 담당한다.

현재 상태:
- `useToolbarFileActions.ts`로 file/session 로드 흐름 분리 완료
- `useToolbarClippingActions.ts`로 clipping action 분리 완료
- `useToolbarEngineActions.ts`로 engine action 분리 완료
- `useToolbarMenuAutoClose.ts`로 toolbar menu dismiss side effect 분리 완료
- panel mode action은 현재 store toggle pass-through라 추가 분리 없이 종료

검증:
- `pnpm -C ifc-ln exec vitest run src/hooks/controllers/useMainToolbarController.test.tsx src/components/viewer/mainToolbarViewModel.test.ts`
- `pnpm -C ifc-ln exec tsc --noEmit`

### Phase 4. Viewport input branch 분리

목표:
- `useViewportInput.ts`를 event registration + branch dispatch 중심으로 축소한다.

작업 항목:
- left click path
- right click / context menu path
- hover path
- box select path
- clipping preview/place path
- measurement path

완료 조건:
- 개별 행동 규칙이 외부 helper로 테스트 가능해야 한다.

현재 상태:
- `viewportInputBindings.ts`로 DOM/window/document listener registration 분리 완료
- `useViewportInput.ts`는 event registration + branch dispatch 중심으로 축소 완료

검증:
- `pnpm -C ifc-ln exec vitest run src/hooks/useViewportInput.test.tsx src/components/viewer/viewport/pointerPicking.test.ts src/components/viewer/viewport/raycasting.test.ts`
- `pnpm -C ifc-ln exec tsc --noEmit`

### Phase 5. 진행 로그 동기화

목표:
- 리팩터링 문서와 실제 변경 상태를 맞춘다.

작업 항목:
- 각 단계 완료 시 이 문서의 상태를 갱신한다
- 필요 시 루트 `logs/*.log`에 `변경 내용 / 검증 / 결과` 구조로 별도 기록한다

완료 조건:
- 현재 완료 단계와 다음 단계가 문서에서 즉시 보인다.

현재 상태:
- 이 문서의 진행률, 완료 항목, 후속 후보를 코드 상태와 동기화 완료

## 회귀 위험

- panel mode 전환 시 lazy panel mount/unmount 회귀
- right/bottom panel collapse 상태 불일치
- overlay blocker / clipped selection / hover 누수
- clipping gumball scale sync 회귀
- context menu와 selection clear 충돌
- bootstrap side effect 중복 초기화

## 검증 기준

### 공통

- `pnpm -C ifc-ln exec tsc --noEmit`

### toolbar / layout

- 새 파일 열기와 모델 추가 동작 분리 유지
- right panel mode / bottom panel mode 전환 유지
- layout collapse/expand 유지

### viewport / clipping

- hover / click / context menu 유지
- box selection 유지
- selection blocker 유지
- clipping create / preview 유지
- gumball scale sync 유지
- section visual 생성/정리 유지

### 수동 확인

- IFC 로드
- 우측 패널 전환
- 하단 패널 열기/닫기
- 단면 편집 중 선택 누수 없음

## 참고 파일

- `src/components/viewer/ViewerLayout.tsx`
- `src/hooks/controllers/useViewerLayoutController.ts`
- `src/hooks/controllers/useMainToolbarController.ts`
- `src/hooks/useViewportInput.ts`
- `src/hooks/useClippingPlane.ts`
- `src/components/viewer/viewport/clippingSectionVisuals.ts`
- `src/components/viewer/viewport/pointerPicking.ts`
