# ifc-lite → ifc-ln 좌우패널 기능 이식 계획

## 현황 요약

ifc-ln에는 BCF/IDS/Lens/List/Script 패널의 **UI**와 **상태관리**가 이미 구현되어 있고,
워커의 9개 property section 핸들러도 **모두 실제 동작**한다.
Lens 시각화(colorOverrides + hiddenKeys)도 `useLensEffects` 훅을 통해 **뷰포트에 연동 완료**되어 있다.

실제 남은 갭은 생각보다 좁다:
- **Property 편집 비활성** (disabled: true 하드코딩)
- **BCF 카메라 더미값** (TODO 주석)
- **지오레퍼런싱 스텁** (EmptyState만 표시)
- **IDS 검증 엔진 미구현** (파싱만 동작)
- **List 쿼리 엔진 미구현** (UI만 존재)
- **커맨드 팔레트 없음**
- **내보내기 다이얼로그 없음**

---

## 현재 상태 진단

### 이미 완성된 것 (수정 불필요)

| 항목 | 근거 |
|------|------|
| 워커 property 추출 (9개 section 전부) | `propertyHandler.ts` — 모두 실제 web-ifc API 호출 |
| Zustand 슬라이스 (13개) | `stores/index.ts` — BCF, IDS, List, Script 포함 통합 |
| 레이아웃 구조 (좌/뷰포트/우/하단) | `ViewerLayout.tsx` — lazy loading + 패널 전환 |
| Lens 시각화 연동 | `useLensEffects.ts` — colorOverrides + hiddenKeys → viewport 적용 |
| BCF 파일 import/export | `bcfService.ts` — ZIP/XML 파싱/생성 동작 |
| IDS XML 파싱 | `idsParser.ts` — 전체 스펙 파싱 동작 |
| bSDD API 통합 | `bsdd.ts` + `BsddCard.tsx` — 캐싱 포함 동작 |
| 좌표 표시 | `CoordinateDisplay.tsx` — 바운딩박스 기반 좌표 + 복사 동작 |
| 모델 관리 UI | `PropertiesPanel.tsx` — Models 카드에 가시성/닫기/포커스 존재 |
| 모델 미로드 시 빈 상태 | 양쪽 패널 — LayoutTemplate/MousePointer2 아이콘 |
| 클리핑 평면 Editor 탭 | 완전 보존 |
| Toolbar Panels 메뉴 | `toolbarConfigs.tsx` — BCF/IDS/Lens/List/Script 토글 |

### 갭 분류

```
[A] 간단한 설정/연결 수정 → 30분 이내
[B] 워커 확장 + UI 연결 필요 → 수시간
[C] 신규 컴포넌트 구현 → 1일 이상
```

---

## Phase 1: 즉시 수정 가능 [A]

### 1-1. Properties 탭 편집 활성화

**문제**: typeProperties~inverseRelations 6개 섹션이 `disabled: true` 하드코딩

**파일**: `src/components/viewer/PropertiesPanel.tsx`

**변경**:
```
line 93:  disabled: true → disabled: !canEditSelectedEntity  (typeProperties)
line 103: disabled: true → disabled: !canEditSelectedEntity  (materials)
line 115: disabled: true → disabled: !canEditSelectedEntity  (documents)
line 129: disabled: true → disabled: !canEditSelectedEntity  (classifications)
line 141: disabled: true → disabled: !canEditSelectedEntity  (metadata)
line 151: disabled: true → disabled: !canEditSelectedEntity  (relations)
line 161: disabled: true → disabled: !canEditSelectedEntity  (inverseRelations)
```

### 1-2. BCF 카메라 실제 값 전달

**문제**: `BCFPanel.tsx:96-99` 더미 카메라 좌표 하드코딩 + viewpoint 활성화 스텁

**파일**: `src/components/viewer/BCFPanel.tsx`

**변경**:
- Three.js 카메라의 실제 position/target/up/fov를 스토어 또는 ref에서 가져오기
- `threeCameraToBcfViewpoint()` 호출 시 실제 값 전달
- `handleActivateViewpoint`에서 `bcfViewpointToThreeCamera()` 결과를 카메라에 적용
- 기존 `bcfViewpoint.ts`의 좌표 변환 로직 활용 (이미 구현됨)

---

## Phase 2: 워커 확장 [B]

### 2-1. 지오레퍼런싱 구현

**문제**: `GeoreferencingPanel.tsx`가 EmptyState 스텁

**신규 파일**: 없음 (기존 파일 수정)
**수정 파일**:
- `src/workers/handlers/propertyHandler.ts` — `GET_GEOREFERENCING` 핸들러 추가
- `src/types/worker-messages.ts` — 요청/응답 타입 추가
- `src/services/IfcWorkerClient.ts` — `getGeoreferencing()` 메서드 추가
- `src/components/viewer/properties/GeoreferencingPanel.tsx` — 실제 데이터 표시

**워커 로직**:
```
api.GetLineIDsWithType(modelId, IFCPROJECTEDCRS) → CRS 엔티티 추출
api.GetLineIDsWithType(modelId, IFCMAPCONVERSION) → 변환 엔티티 추출
→ name, geodeticDatum, mapProjection, eastings, northings, scale 반환
```

**주의**: `IfcProjectedCRS`는 IFC4부터 지원. IFC2X3 모델에는 없을 수 있음.

### 2-2. IDS 검증 엔진

**문제**: IDS XML 파싱은 되지만 모델 검증 로직 없음

**신규 파일**: `src/services/idsValidator.ts`
**수정 파일**:
- `src/types/worker-messages.ts` — `VALIDATE_IDS` 메시지 타입
- `src/workers/ifc.worker.ts` — 핸들러 라우팅
- `src/services/IfcWorkerClient.ts` — `validateIds()` 메서드
- `src/components/viewer/IDSPanel.tsx` — "Validate" 버튼 + 결과 연결

**검증 로직**:
1. Applicability 매칭: `GetLineIDsWithType()` → IFC 타입별 엔티티 수집
2. Requirements 체크: 각 엔티티에 대해 속성 존재/값 검사
3. 결과: `IdsSpecificationResult[]` → `idsSlice.setIdsResults()`

### 2-3. List 쿼리 엔진

**문제**: 리스트 UI는 완성이나 쿼리 실행 불가

**수정 파일**:
- `src/types/worker-messages.ts` — `QUERY_ENTITIES` 메시지 타입
- `src/workers/ifc.worker.ts` — 핸들러 라우팅
- `src/workers/handlers/listHandler.ts` (신규) — 쿼리 실행
- `src/services/IfcWorkerClient.ts` — `queryEntities()` 메서드
- `src/components/viewer/lists/ListPanel.tsx` — "Run" 버튼 연결

**쿼리 로직**:
```
GetLineIDsWithType(modelId, ifcTypeCode) → express ID 목록
각 ID에 대해 GetLine() → Name, GlobalId 등 속성 추출
→ ListResultRow[] 반환
```

---

## Phase 3: 신규 기능 [C]

### 3-1. 커맨드 팔레트 (Ctrl+K)

**문제**: 없음

**신규 파일**: `src/components/viewer/CommandPalette.tsx`
**수정 파일**:
- `src/hooks/useKeyboardShortcuts.ts` — Ctrl+K 바인딩
- `src/components/viewer/ViewerLayout.tsx` — 렌더링

**구현**:
- 모달 오버레이 + 검색 + 결과 목록
- 카테고리: File, View, Tools, Visibility, Panels, Export
- 기존 toolbar 핸들러 재사용
- 키보드 네비게이션 (↑↓ + Enter + Esc)

### 3-2. 내보내기 다이얼로그

**문제**: toolbar 메뉴에서 직접 export만 가능, 옵션 UI 없음

**신규 파일**: `src/components/viewer/ExportDialog.tsx`
**수정 파일**: `src/stores/slices/uiSlice.ts` — 다이얼로그 상태

**구현**:
- 범위 선택 (현재 모델 / 전체)
- 변경사항 포함 토글
- 진행률 표시
- `ifcWorkerClient.exportModel()` 활용

### 3-3. 좌측 패널 모델 관리 강화 (선택적)

**현재 상태**: PropertiesPanel에 Models 카드가 있어 기본 관리 가능.
HierarchyPanel에는 모델 목록 없음.

**판단**: PropertiesPanel의 Models 카드로 충분할 수 있음.
필요시 HierarchyPanel 상단에 간단한 모델 드롭다운 추가.

---

## Phase 4: ifc-lite 고유 기능 이식 판단

| 기능 | 이식 권장 | 이유 |
|------|-----------|------|
| 2D 도면/섹션 뷰 | 보류 | 클리핑 평면으로 대체 가능 |
| 시트 관리 | 보류 | 2D 도면 의존 |
| 바스켓/핀보드 | 선택적 | 멀티 엔티티 컬렉션 UX |
| AI 채팅 | 보류 | LLM 서비스 필요 |
| CodeMirror 에디터 | 선택적 | 현재 textarea → 업그레이드 가능 |
| LocationMap | 보류 | MapLibre GL 의존성 무거움 |

---

## 실행 순서 요약

```
Phase 1 (즉시 수정) ── 30분~반나절
├── 1-1. Properties disabled 플래그 수정 (10분)
└── 1-2. BCF 카메라 실제 값 연동 (2~3시간)

Phase 2 (워커 확장) ── 2~4일
├── 2-1. Georeferencing 워커 + UI (4~6시간)
├── 2-2. IDS 검증 엔진 (1~2일)
└── 2-3. List 쿼리 엔진 (4~6시간)

Phase 3 (신규 기능) ── 2~3일
├── 3-1. 커맨드 팔레트 (1~2일)
└── 3-2. 내보내기 다이얼로그 (4~6시간)
```

---

## 검증 방법

1. `npx tsc --noEmit` — 컴파일 에러 없음
2. `npx vitest run` — 기존 테스트 통과
3. `pnpm dev` → IFC 파일 로드:
   - Properties 각 섹션 편집 가능 확인
   - BCF viewpoint capture → 실제 카메라 위치 반영
   - IDS import → Validate → pass/fail 결과 표시
   - List 쿼리 실행 → 테이블 데이터 표시
   - Georeferencing 데이터 표시 (IFC4 모델)
4. Editor 탭 클리핑 평면 정상 동작
5. Lens 규칙 → 3D 컬러/숨김 정상 반영 (이미 동작 확인)

---

## 주요 참조 파일

| 카테고리 | 파일 |
|----------|------|
| 워커 핸들러 | `src/workers/handlers/propertyHandler.ts` |
| 속성 빌더 | `src/workers/ifcSectionBuilder.ts` |
| 워커 클라이언트 | `src/services/IfcWorkerClient.ts` |
| 메시지 타입 | `src/types/worker-messages.ts` |
| Properties 컨트롤러 | `src/hooks/controllers/usePropertiesController.tsx` |
| Properties 패널 | `src/components/viewer/PropertiesPanel.tsx` |
| Lens 효과 | `src/hooks/useLensEffects.ts` |
| BCF 서비스 | `src/services/bcfService.ts`, `src/services/bcfViewpoint.ts` |
| IDS 파서 | `src/services/idsParser.ts` |
| 스토어 | `src/stores/index.ts` |
