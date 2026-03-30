# 물량 분할 (Quantity Split) 기능 구현 계획

## 요약

IFC 모델의 지오메트리를 수평 평면 위에서 직선으로 영역을 나누고, 각 영역별로 색상을 구분하여 체적(m³)을 조회하는 기능이다.
건설 현장에서 콘크리트 타설 구간 분할, 공정 분할, 물량 산출 등에 활용한다.

---

## 워크플로우

이미지 기반 단계별 흐름:

| 단계 | 이미지 | 설명 |
|------|--------|------|
| 1 | p1 | IFC 모델 로드 상태 (회색 건물 모델) |
| 2 | p2 | 모델 바운딩 박스 기준으로 수평 분할 평면(점선 사각형) 자동 생성 |
| 3 | p3 | 평면 위에 분할선을 그어 영역 구분 (반투명 cyan 색상으로 영역 시각화) |
| 4 | p4 | 각 영역에 고유 색상 할당 (빨강/노랑/초록), 3D 지오메트리에 색상 적용 |
| 5 | p5 | 최종 결과 — 영역별 색상 적용된 모델 + 체적 조회 가능 |

### 사용자 인터랙션 흐름

```
[분할 도구 활성화]
  → 모델 바운딩 박스에서 XY 평면 자동 생성 (점선 사각형)
  → 평면 위 첫 번째 클릭: 분할선 시작점
  → 마우스 이동: 프리뷰 선 표시
  → 두 번째 클릭: 분할선 확정 (바운딩 경계까지 자동 연장)
  → 반복하여 여러 분할선 추가
  → 영역 자동 계산 → 색상 할당 → 체적 계산
  → 패널에서 영역별 물량 조회
  → [분할 도구 비활성화] → 원래 색상 복원
```

---

## 현재 상태 진단

### 재사용 가능한 기존 코드

| 기존 코드 | 위치 | 재사용 방식 |
|---|---|---|
| 체적 계산 (divergence theorem) | `src/utils/geometryMetrics.ts` | `computeMeshMetrics()`, `computeEntityMetrics()`, `computeMultiEntityMetrics()` 직접 호출 |
| 체적 hook | `src/hooks/useGeometryMetrics.ts` | 패턴 참고 (영역별 집계 hook 생성) |
| 색상 오버라이드 파이프라인 | `src/components/viewer/viewport/meshManagement.ts` | `updateMeshVisualState()`의 `colorOverrides: Map<ModelEntityKey, string>` 활용 |
| 3D 포인트 피킹 | `src/components/viewer/viewport/pointerPicking.ts` | `pickHitAtPointer()` — 클릭 위치 → 3D 좌표 |
| 평면 투영 | `src/components/viewer/viewport/clippingMath.ts` | `projectRayOntoPlane()` — ray를 평면에 투영 |
| draft → commit 상태 패턴 | `src/stores/slices/clippingSlice.ts` | 분할선 그리기의 상태 머신 패턴 참고 |
| InteractionMode 패턴 | `src/stores/slices/toolsSlice.ts` | `"quantity-split"` 모드 추가 |
| Lens 색상 규칙 | `src/stores/slices/lensSlice.ts` | 색상 오버라이드 적용 패턴 참고 |
| 메시 데이터 접근 | `src/services/viewportGeometryStore.ts` | `useViewportGeometry()` — TransferableMeshData[] 접근 |
| 꼭짓점 변환 | `src/utils/geometryMetrics.ts` | `transformVertex()` — 로컬 → 월드 좌표 변환 |

### 새로 구현해야 하는 것

| 항목 | 난이도 | 설명 |
|------|--------|------|
| Planar Subdivision 알고리즘 | 높음 | 선분 교차점 계산 → 폴리곤 영역 추출 |
| 2D Point-in-Polygon | 낮음 | Ray casting algorithm (표준 알고리즘) |
| 선 그리기 인터랙션 | 중간 | 기존 clipping draft 패턴과 유사 |
| 3D 오버레이 시각화 | 중간 | 바운딩 평면 + 분할선 + 영역 fill |
| 물량 패널 UI | 낮음 | 기존 PropertiesPanel 패턴과 유사 |

---

## 핵심 기술 결정

### 1. 분할 평면 결정

모델 바운딩 박스의 XY 평면을 사용한다.
- Z 값: 바운딩 박스의 `minZ` (바닥 높이) 사용 — 평면도 관점에서 가장 자연스러움
- XY 범위: 바운딩 박스를 10% 확장한 사각형
- 시각화: 점선 사각형 (p2 참조)

```typescript
// 바운딩 계산 예시
const padding = 0.1; // 10% 확장
const bounds = {
  min: [modelMin[0] - dx * padding, modelMin[1] - dy * padding],
  max: [modelMax[0] + dx * padding, modelMax[1] + dy * padding],
};
const splitPlaneZ = modelMin[2]; // 바닥 높이
```

### 2. 분할선 → 영역 변환 알고리즘

**Planar Subdivision** 방식을 사용한다.

```
입력: 바운딩 사각형 + N개의 분할선
출력: M개의 폴리곤 영역

알고리즘:
1. 바운딩 사각형의 4변을 선분으로 수집
2. 각 사용자 분할선을 바운딩 사각형 경계까지 연장 (clip)
3. 모든 선분 쌍의 교차점 계산
4. 교차점에서 선분을 분할 → edge list 생성
5. 각 교차점(vertex)에서 나가는 edge를 각도순 정렬
6. Left-most turn rule로 최소 face (폴리곤) 추출
7. 무한 외부 face 제거
```

**복잡도**: O(n² log n) — n은 edge 수. 일반적으로 분할선이 10개 미만이므로 충분히 빠름.

### 3. 엔티티 → 영역 할당

각 IFC 엔티티의 **월드 좌표 centroid**를 XY 평면에 투영하여 영역을 결정한다.

```
각 엔티티에 대해:
1. TransferableMeshData의 vertices(6-stride) + transform으로 월드 좌표 계산
2. 모든 꼭짓점의 평균 → centroid (cx, cy, cz)
3. (cx, cy)로 2D point-in-polygon 테스트
4. 매칭되는 영역에 엔티티 할당
5. 어느 영역에도 속하지 않으면 "미할당" 처리
```

**Point-in-Polygon**: Ray casting algorithm (수평 반직선과 폴리곤 변의 교차 횟수가 홀수면 내부)

### 4. 체적 계산

기존 `computeMultiEntityMetrics(meshes, entityIds)` 를 영역별로 호출한다.
- 입력: 영역에 속한 entityId 배열
- 출력: `GeometryMetrics` (volume, surfaceArea, triangleCount, vertexCount, boundingBox)

### 5. 색상 시각화

기존 `colorOverrides: Map<ModelEntityKey, string>` 파이프라인을 활용한다.

```typescript
// 영역별 기본 색상 팔레트
const REGION_COLORS = [
  "#e74c3c", // 빨강
  "#f1c40f", // 노랑
  "#2ecc71", // 초록
  "#3498db", // 파랑
  "#9b59b6", // 보라
  "#e67e22", // 주황
  "#1abc9c", // 청록
  "#e84393", // 분홍
];
```

---

## 구현 단계

### Phase 1: State — `quantitySplitSlice.ts` ✅ 완료

**새로 생성**: `src/stores/slices/quantitySplitSlice.ts`
**수정**: `src/stores/index.ts` — slice 등록

핵심 타입:

```typescript
interface SplitLine {
  id: string;
  start: [number, number];  // XY 좌표
  end: [number, number];
}

interface SplitRegion {
  id: string;
  polygon: [number, number][];  // 꼭짓점 리스트 (CCW)
  color: string;
  entityKeys: ModelEntityKey[];
  metrics: GeometryMetrics | null;
}

interface QuantitySplitState {
  active: boolean;
  splitPlaneZ: number;
  bounds: SplitBounds | null;
  lines: SplitLine[];
  regions: SplitRegion[];
  drawingLine: { start: [number, number] } | null;
}
```

액션:
- `startQuantitySplit(splitPlaneZ, bounds)` — 활성화
- `addSplitLine(start, end)` — 분할선 추가
- `removeSplitLine(id)` — 분할선 삭제
- `setDrawingLineStart(start | null)` — 드로잉 상태
- `updateRegions(regions)` — 영역 갱신
- `clearQuantitySplit()` — 초기화

검증: `tsc --noEmit` 통과

---

### Phase 2: 핵심 알고리즘 — `splitRegionComputer.ts`

**새로 생성**: `src/utils/splitRegionComputer.ts`
**새로 생성**: `src/utils/splitRegionComputer.test.ts`

#### 2-1. 선분 교차점 계산

```typescript
function segmentIntersection(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number],
): [number, number] | null;
```

두 선분의 교차점을 parametric 방식으로 계산한다. t, u ∈ [0, 1] 범위에서만 유효.

#### 2-2. 선분의 바운딩 사각형 클리핑

```typescript
function clipLineToBounds(
  start: [number, number],
  end: [number, number],
  bounds: SplitBounds,
): [number, number, number, number] | null;
```

사용자가 그은 선분을 바운딩 사각형 경계까지 연장(또는 클리핑)한다.
Cohen-Sutherland 또는 Liang-Barsky 알고리즘 사용.

#### 2-3. Planar Subdivision → 폴리곤 추출

```typescript
function computeRegionsFromLines(
  bounds: SplitBounds,
  lines: SplitLine[],
): [number, number][][];
```

핵심 알고리즘:

```
1. 모든 선분 수집 (바운딩 4변 + 클리핑된 분할선)
2. 모든 선분 쌍의 교차점 계산
3. 각 선분을 교차점에서 분할 → sub-edge 리스트
4. 중복 edge 제거, vertex 좌표 정규화 (epsilon 병합)
5. adjacency graph 구축: 각 vertex에서 나가는 edge를 각도(atan2)순 정렬
6. Face extraction:
   a. 미방문 half-edge 선택
   b. 현재 vertex에서 "가장 왼쪽 회전" (next edge = 현재 edge의 reverse 직후 각도순)
   c. 시작 half-edge로 돌아올 때까지 반복 → 하나의 face
   d. 모든 half-edge가 방문될 때까지 반복
7. 외부 face (넓이가 가장 큰 CCW face 또는 CW face) 제거
8. 나머지 face들이 내부 영역 폴리곤
```

#### 2-4. Point-in-Polygon

```typescript
function pointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean;
```

Ray casting algorithm: 점에서 +X 방향 반직선을 쏴서 폴리곤 변과의 교차 횟수가 홀수면 내부.

#### 2-5. 엔티티 centroid 계산

```typescript
function computeEntityCentroid(
  meshes: TransferableMeshData[],
  entityId: number,
): [number, number] | null;
```

기존 `transformVertex()`를 사용하여 월드 좌표로 변환 후 XY 평균 계산.

#### 2-6. 영역별 엔티티 할당 + 체적 집계

```typescript
function assignEntitiesToRegions(
  polygons: [number, number][][],
  meshes: TransferableMeshData[],
  entityIds: number[],
  modelId: number,
): SplitRegion[];
```

각 엔티티의 centroid로 point-in-polygon → 영역 할당 → `computeMultiEntityMetrics()`로 체적 집계.

#### 테스트 케이스

```
- 분할선 없음 → 바운딩 전체가 1개 영역
- 수평선 1개 → 2개 영역
- 수직선 1개 → 2개 영역
- 십자선 → 4개 영역
- L자 선 → 3개 영역
- point-in-polygon 경계 케이스
- 엔티티 centroid가 정확히 경계 위일 때
```

검증:
- `pnpm -C ifc-ln exec vitest run src/utils/splitRegionComputer.test.ts`
- `pnpm -C ifc-ln exec tsc --noEmit`

---

### Phase 3: 인터랙션 — 분할선 그리기

#### 3-1. InteractionMode 확장

**수정**: `src/stores/slices/toolsSlice.ts`

```typescript
// Before
export type InteractionMode = "select" | "measure-distance" | "create-clipping-plane";

// After
export type InteractionMode = "select" | "measure-distance" | "create-clipping-plane" | "quantity-split";
```

#### 3-2. 뷰포트 인터랙션 브리지

**수정**: `src/hooks/useViewportInteractionBridge.ts`

분할 모드일 때의 클릭/이동 처리:

```
클릭 처리:
1. raycaster로 분할 평면(Z=splitPlaneZ)과의 교차점 계산
2. drawingLine이 null이면 → setDrawingLineStart(교차점)
3. drawingLine이 있으면 → addSplitLine(start, 교차점) → 영역 재계산

이동 처리:
1. drawingLine이 있을 때 마우스 위치를 평면에 투영
2. 프리뷰 선 업데이트

ESC 처리:
1. drawingLine 취소 (setDrawingLineStart(null))
2. 또는 분할 모드 전체 해제
```

#### 3-3. 인풋 디스패치

**수정**: `src/components/viewer/viewport/viewportInputDispatch.ts`

기존 measurement/clipping 분기와 동일한 패턴으로 `"quantity-split"` 분기 추가.

검증:
- `pnpm -C ifc-ln exec tsc --noEmit`
- 수동: 분할 모드 진입 → 클릭으로 선 그리기 → ESC 취소

---

### Phase 4: 3D 시각화 오버레이

**새로 생성**: `src/hooks/useQuantitySplitOverlay.ts`

#### 4-1. 바운딩 평면 시각화

```typescript
// THREE.LineSegments — 점선 사각형
const material = new THREE.LineDashedMaterial({
  color: 0x666666,
  dashSize: 0.3,
  gapSize: 0.15,
});
```

바운딩 사각형의 4변을 `LineSegments`로 렌더링. Z = splitPlaneZ 높이에 배치.

#### 4-2. 분할선 시각화

```typescript
// THREE.LineSegments — 실선
const material = new THREE.LineBasicMaterial({ color: 0x00bcd4 });
```

확정된 분할선 + 현재 그리는 프리뷰 선.

#### 4-3. 영역 폴리곤 시각화

```typescript
// THREE.Mesh + ShapeGeometry — 반투명 색상 fill
for (const region of regions) {
  const shape = new THREE.Shape(
    region.polygon.map(([x, y]) => new THREE.Vector2(x, y))
  );
  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({
    color: region.color,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  // Z = splitPlaneZ에 배치
}
```

#### 4-4. 지오메트리 색상 오버라이드

영역이 확정되면 `colorOverrides` Map을 생성하여 기존 파이프라인에 주입:

**수정**: `src/hooks/useChunkSceneGraph.ts`

```typescript
// 기존 colorOverrides (Lens)에 quantitySplit colorOverrides를 병합
const mergedOverrides = new Map([...lensOverrides, ...splitOverrides]);
```

검증:
- `pnpm -C ifc-ln exec tsc --noEmit`
- 수동: 분할선 그리기 → 영역 색상 확인 → 비활성화 시 복원 확인

---

### Phase 5: UI 패널 + 체적 표시

**새로 생성**: `src/components/viewer/QuantitySplitPanel.tsx`

#### 5-1. 패널 레이아웃

```
┌─────────────────────────────────┐
│  물량 분할                [X]   │
├─────────────────────────────────┤
│  [분할 시작] [초기화]           │
├─────────────────────────────────┤
│  분할선 (3개)                   │
│  ├ 선 1  ─────────── [삭제]     │
│  ├ 선 2  ─────────── [삭제]     │
│  └ 선 3  ─────────── [삭제]     │
├─────────────────────────────────┤
│  영역별 물량                    │
│  ┌──────────────────────────┐   │
│  │ ● 영역 1 (빨강)         │   │
│  │   체적: 125.34 m³        │   │
│  │   면적: 234.56 m²        │   │
│  │   엔티티: 42개           │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │ ● 영역 2 (노랑)         │   │
│  │   체적: 89.12 m³         │   │
│  │   면적: 178.90 m²        │   │
│  │   엔티티: 28개           │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │ ● 영역 3 (초록)         │   │
│  │   체적: 67.45 m³         │   │
│  │   면적: 145.23 m²        │   │
│  │   엔티티: 19개           │   │
│  └──────────────────────────┘   │
├─────────────────────────────────┤
│  합계                           │
│  체적: 281.91 m³                │
│  면적: 558.69 m²                │
│  엔티티: 89개                   │
├─────────────────────────────────┤
│  [CSV 내보내기]                 │
└─────────────────────────────────┘
```

#### 5-2. 툴바 메뉴 항목

**수정**: `src/components/viewer/toolbar/toolbarConfigs.tsx`

Tools 메뉴에 "물량 분할" 항목 추가:

```typescript
{
  id: "quantity-split",
  label: "물량 분할",
  icon: <Grid3X3 size={16} />,
  action: () => { /* 분할 모드 토글 */ },
}
```

#### 5-3. 패널 등록

**수정**: `src/components/viewer/ViewerLayoutPanels.tsx`

Right panel 탭에 "Split" 탭 추가 또는 별도 패널 모드로 등록.

#### 5-4. CSV 내보내기

```csv
영역,색상,체적(m³),표면적(m²),엔티티수
영역 1,#e74c3c,125.34,234.56,42
영역 2,#f1c40f,89.12,178.90,28
영역 3,#2ecc71,67.45,145.23,19
합계,,281.91,558.69,89
```

검증:
- `pnpm -C ifc-ln exec tsc --noEmit`
- 수동: 전체 워크플로우 (모델 로드 → 분할 → 체적 확인 → CSV 내보내기)

---

## 수정 대상 파일 총정리

### 새로 생성 (4개)

| 파일 | Phase | 설명 |
|------|-------|------|
| `src/stores/slices/quantitySplitSlice.ts` | 1 ✅ | 상태 관리 |
| `src/utils/splitRegionComputer.ts` | 2 | 핵심 알고리즘 |
| `src/hooks/useQuantitySplitOverlay.ts` | 4 | 3D 오버레이 |
| `src/components/viewer/QuantitySplitPanel.tsx` | 5 | UI 패널 |

### 테스트 (1개)

| 파일 | Phase | 설명 |
|------|-------|------|
| `src/utils/splitRegionComputer.test.ts` | 2 | 알고리즘 단위 테스트 |

### 수정 (7개)

| 파일 | Phase | 변경 내용 |
|------|-------|-----------|
| `src/stores/index.ts` | 1 ✅ | QuantitySplitSlice 등록 |
| `src/stores/slices/toolsSlice.ts` | 3 | InteractionMode에 `"quantity-split"` 추가 |
| `src/hooks/useViewportInteractionBridge.ts` | 3 | 분할 모드 클릭/이동 처리 |
| `src/components/viewer/viewport/viewportInputDispatch.ts` | 3 | 분할 모드 디스패치 분기 |
| `src/hooks/useChunkSceneGraph.ts` | 4 | 분할 색상 오버라이드 병합 |
| `src/components/viewer/ViewerLayoutPanels.tsx` | 5 | 패널 등록 |
| `src/components/viewer/toolbar/toolbarConfigs.tsx` | 5 | 메뉴 항목 추가 |

---

## 구현 순서 (의존성)

```
Phase 1 (State) ✅
  └─→ Phase 2 (Algorithm)
        └─→ Phase 3 (Interaction)
              └─→ Phase 4 (Visualization)
                    └─→ Phase 5 (UI Panel)
```

---

## 회귀 위험

| 위험 | 대응 |
|------|------|
| InteractionMode 추가로 기존 모드 동작 변경 | 기존 분기문에 영향 없도록 else-if / switch 끝에 추가 |
| colorOverrides 충돌 (Lens + Split) | Map 병합 시 Split이 Lens보다 우선 (또는 분할 활성 시 Lens 비활성) |
| 분할 모드에서 selection 동작 | 분할 모드일 때 entity selection을 block |
| 대규모 모델에서 centroid 계산 성능 | 메시 수가 많으면 Web Worker로 오프로드 가능 (2차 최적화) |
| 분할선이 많을 때 planar subdivision 성능 | 선 10개 미만이면 문제 없음. 필요 시 incremental 업데이트 |

---

## 검증 체크리스트

### 자동 검증

- [ ] `pnpm -C ifc-ln exec tsc --noEmit` — 각 Phase 후 통과
- [ ] `pnpm -C ifc-ln exec vitest run src/utils/splitRegionComputer.test.ts` — 알고리즘 테스트 통과

### 수동 검증

- [ ] IFC 모델 로드
- [ ] 분할 도구 활성화 → 바운딩 평면(점선 사각형) 표시
- [ ] 클릭 2회로 분할선 그리기 → 프리뷰 선 → 확정
- [ ] 2~3개 분할선 추가 → 영역 자동 생성
- [ ] 영역별 색상이 3D 지오메트리에 적용됨
- [ ] 패널에서 영역별 체적/면적/엔티티 수 확인
- [ ] 분할선 삭제 → 영역 재계산 → 색상 업데이트
- [ ] 분할 도구 비활성화 → 원래 색상 복원
- [ ] CSV 내보내기 동작
- [ ] 기존 기능 회귀 없음 (selection, measurement, clipping)
