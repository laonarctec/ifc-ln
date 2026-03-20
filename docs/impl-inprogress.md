# ifc-ln 구현 진행 현황 — ifc-lite 대비 분석

> 작성일: 2026-03-20
> 대상: `ifc-ln` (Three.js/WebGL 기반 경량 IFC 뷰어) vs `ifc-lite` (WebGPU 기반 풀스택 BIM 플랫폼)

---

## 1. 프로젝트 규모 비교

| 항목 | ifc-ln | ifc-lite (viewer) | ifc-lite (packages) | ifc-lite (합계) |
|------|--------|-------------------|---------------------|-----------------|
| 소스 라인 수 | **~38,600줄** | ~66,000줄 | ~336,000줄 | **~402,000줄** |
| 주요 파일 수 | ~35개 | ~120개 | ~500개 | ~620개 |
| Zustand 슬라이스 | 5개 | 17개 | — | 17개 |
| 패키지/모듈 | 단일 앱 | 단일 앱 | 25+ 패키지 | 모노레포 |
| 렌더링 엔진 | Three.js (WebGL) | WebGPU (자체 구현) | — | WebGPU |
| IFC 파서 | web-ifc (C++ WASM) | 자체 Rust WASM 파서 | — | Rust WASM |

---

## 2. 기능 비교 매트릭스

### 2.1 핵심 뷰어 기능

| 기능 | ifc-ln | ifc-lite | 비고 |
|------|--------|----------|------|
| IFC 파일 로드 | ✅ | ✅ | ifc-ln: web-ifc / ifc-lite: Rust 파서 |
| 3D 렌더링 | ✅ WebGL | ✅ WebGPU | ifc-lite가 더 고성능, ifc-ln이 호환성 우수 |
| 카메라 조작 (Orbit) | ✅ | ✅ | 동등 |
| ViewCube | ✅ | ✅ | 동등 |
| AxisHelper | ✅ | ✅ | 동등 |
| 프리셋 뷰 (Front/Top 등) | ✅ 8개 뷰 | ✅ | 동등 |
| Perspective/Orthographic 전환 | ✅ | ✅ | 동등 |
| BVH 가속 레이캐스팅 | ✅ three-mesh-bvh | ✅ 자체 BVH | 동등 |
| 엣지 렌더링 (와이어프레임) | ✅ Worker 추출 | ✅ 셰이더 기반 | ifc-lite가 GPU 기반으로 더 효율적 |
| 청크 기반 지오메트리 스트리밍 | ✅ | ✅ Progressive | 동등 |
| 지오메트리 중복 제거 | ✅ 인스턴스 그룹핑 | ✅ 더 공격적 | ifc-lite가 메모리 최적화 우수 |
| 다크 모드 | ✅ | ✅ | 동등 (ifc-lite: Tokyo Night 테마) |

### 2.2 상호작용 & 선택

| 기능 | ifc-ln | ifc-lite | 비고 |
|------|--------|----------|------|
| 엔티티 클릭 선택 | ✅ | ✅ | 동등 |
| 다중 선택 (Shift+Click) | ✅ | ✅ | 동등 |
| 호버 툴팁 | ✅ | ✅ | 동등 |
| 뷰포트 우클릭 컨텍스트 메뉴 | ✅ | ✅ | 동등 |
| Hide / Isolate / Show All | ✅ | ✅ | 동등 |
| Fit Selected / Fit All | ✅ | ✅ | 동등 |
| 키보드 단축키 | ✅ 기본 | ✅ 포괄적 | ifc-lite가 더 많은 단축키 지원 |
| 단축키 도움말 다이얼로그 | ✅ | ✅ | 동등 |
| 터치 컨트롤 (모바일) | ⚠️ 기본 포인터 | ✅ 제스처 지원 | ifc-ln: 모바일 최적화 부족 |
| 스냅 감지 (버텍스/엣지) | ❌ | ✅ | **미구현** |

### 2.3 계층 구조 패널 (Hierarchy)

| 기능 | ifc-ln | ifc-lite | 비고 |
|------|--------|----------|------|
| Spatial 트리 | ✅ | ✅ | 동등 |
| Class 그룹핑 트리 | ✅ | ✅ | 동등 |
| Type 그룹핑 트리 | ✅ | ✅ | 동등 |
| 가상 스크롤링 | ✅ @tanstack/react-virtual | ✅ | 동등 |
| 트리 검색 필터 | ✅ | ✅ | 동등 |
| 트리 노드 우클릭 메뉴 | ✅ (신규 구현) | ✅ | 동등 |
| 마스터 가시성 토글 | ✅ (신규 구현) | ✅ | 동등 |
| IFC 아이콘 매핑 | ✅ Material Symbols | ✅ | 동등 |
| 층 고도 배지 | ✅ | ⚠️ | ifc-ln이 더 상세 |

### 2.4 속성 패널 (Properties)

| 기능 | ifc-ln | ifc-lite | 비고 |
|------|--------|----------|------|
| 기본 속성 표시 | ✅ | ✅ | 동등 |
| PropertySet 카드 | ✅ 섹션별 표시 | ✅ 카드 UI | ifc-lite가 UI 더 세련됨 |
| QuantitySet 표시 | ✅ | ✅ | 동등 |
| 관계(Relationship) 표시 | ✅ | ✅ | 동등 |
| 재질(Material) 상세 표시 | ⚠️ 기본 | ✅ MaterialCard | ifc-ln: 렌더링만, 상세 카드 없음 |
| 분류(Classification) 표시 | ⚠️ 기본 | ✅ ClassificationCard | ifc-ln: 제한적 표시 |
| bSDD 연동 | ❌ | ✅ BsddCard | **미구현** |
| 속성 편집 | ❌ | ✅ PropertyEditor | **미구현** |
| 일괄 속성 편집 | ❌ | ✅ BulkPropertyEditor | **미구현** |
| 지오메트리 메트릭스 | ✅ bounds/volume | ✅ | 동등 |

### 2.5 고급 BIM 기능 (ifc-ln 미구현)

| 기능 | ifc-ln | ifc-lite | 우선순위 |
|------|--------|----------|----------|
| **단면 평면 (Section Plane)** | ❌ | ✅ GPU 가속 절단 | 🔴 높음 |
| **측정 도구 (Measurement)** | ❌ | ✅ 스냅/직교 구속 | 🔴 높음 |
| **2D 도면 생성** | ❌ | ✅ 평면도/단면도/SVG | 🟡 중간 |
| **다중 모델 페더레이션** | ❌ | ✅ 모델 병합/관리 | 🟡 중간 |
| **다양한 내보내기 형식** | ⚠️ JSON만 | ✅ IFC/glTF/CSV/Parquet | 🟡 중간 |
| **BCF 협업** | ❌ | ✅ 이슈 트래킹/뷰포인트 | 🟡 중간 |
| **IDS 검증** | ❌ | ✅ 규격 준수 검사 | 🟢 낮음 |
| **AI/Chat 통합** | ❌ | ✅ LLM 기반 질의 | 🟢 낮음 |
| **스크립트 실행** | ❌ | ✅ 코드 에디터/샌드박스 | 🟢 낮음 |
| **커맨드 팔레트** | ❌ | ✅ 빠른 검색/실행 | 🟡 중간 |
| **렌즈 필터링** | ❌ | ✅ 시각적 필터 엔진 | 🟡 중간 |
| **리스트/테이블 빌더** | ❌ | ✅ 데이터 테이블 생성 | 🟢 낮음 |
| **핀보드/바스켓** | ❌ | ✅ 엔티티 컬렉션 관리 | 🟢 낮음 |
| **텍스트 주석** | ❌ | ✅ TextAnnotationEditor | 🟢 낮음 |
| **층 필터 드롭다운 (툴바)** | ⚠️ 트리 내 필터만 | ✅ 툴바 드롭다운 | 🟡 중간 |

---

## 3. 코드 품질 분석

### 3.1 파일별 상세 분석

| 파일 | 라인 수 | 심각도 | 주요 이슈 |
|------|---------|--------|-----------|
| `ViewportScene.tsx` | **979줄** | 🔴 심각 | 단일 useEffect 500줄+, 14개 ref, 포인터 핸들러 8개 |
| `HierarchyPanel.tsx` | **773줄** | 🔴 심각 | 29개 memoization, 49개 store selector, JSX 300줄 |
| `viewportUtils.ts` | **841줄** | 🟡 주의 | 32+ 함수 단일 파일, 도메인 분리 부족 |
| `ifc.worker.ts` | **750줄** | 🟡 주의 | 에러 핸들링 미흡, 대형 함수 |
| `globals.css` | **2,914줄** | 🟡 주의 | 단일 거대 파일, 모듈화 필요 |
| `ViewportContainer.tsx` | **570줄** | 🟡 주의 | 청크 로딩 + 가시성 필터 혼재 |
| `MainToolbar.tsx` | **535줄** | 🟢 양호 | 범위 대비 적절, 소폭 개선 여지 |
| `treeDataBuilder.ts` | **623줄** | 🟢 우수 | 함수별 분리 양호, 재귀 알고리즘 명확 |
| `PropertiesPanel.tsx` | **389줄** | 🟢 우수 | 적절한 크기, 관심사 분리 양호 |
| `dataSlice.ts` | **184줄** | 🟢 우수 | 깔끔한 구조, 개선 불필요 |

### 3.2 `ViewportScene.tsx` (979줄) — 가장 시급한 개선 대상

**문제점:**
- 단일 `useEffect` 내 Three.js 초기화 → 렌더링 → 이벤트 바인딩 → 클린업이 모두 포함 (264~790줄)
- 포인터 상태 변수 8개 (`pointerIsDown`, `didDrag`, `rmbIsDown`, `rmbDidDrag` 등) 인라인 관리
- `ref` 객체 14개 — stale closure 위험
- 지오메트리 캐시 refCount 로직이 청크 렌더링과 혼재
- `raycaster` 객체 미해제, `grid` material 미명시적 dispose

**개선안:**
```
ViewportScene.tsx (979줄)
  → useThreeJsScene.ts        (~200줄) 씬 초기화/정리
  → useViewportPointer.ts     (~150줄) 포인터 이벤트 로직
  → useViewportRendering.ts   (~100줄) 렌더 루프/FPS
  → ViewportScene.tsx          (~300줄) 조합 및 JSX
```

### 3.3 `HierarchyPanel.tsx` (773줄) — 두 번째로 시급

**문제점:**
- `useCallback` / `useMemo` 29개 — 단일 컴포넌트에 과도한 메모이제이션
- Zustand store에서 49개 셀렉터 추출 — 관심사 분리 부족
- 필터링, 선택, 가시성, 격리, 컨텍스트 메뉴 로직이 모두 한 컴포넌트에 존재
- 반환 JSX가 ~300줄 (472~773) — 중첩 삼항 연산자 다수

**개선안:**
```
HierarchyPanel.tsx (773줄)
  → useHierarchyActions.ts    (~150줄) 선택/가시성/격리 핸들러
  → useHierarchyFilters.ts    (~80줄) 필터 상태/로직 (기존 파일 확장)
  → HierarchyHeader.tsx       (~100줄) 탭/검색/마스터 토글
  → HierarchyTreeContent.tsx  (~150줄) 가상 스크롤 트리
  → HierarchyPanel.tsx        (~200줄) 조합
```

### 3.4 `viewportUtils.ts` (841줄) — 도메인 분리 필요

**문제점:**
- 카메라, 지오메트리, 렌더링, 인터랙션 유틸리티 32+ 함수가 단일 파일
- `fitCameraToBoundsWithDirection()` 85줄 — perspective/orthographic 분기 혼재
- `appendMeshesToGroup()` 127줄 — 중복 제거/인스턴싱/재질 할당 혼재
- 파라미터 5개 이상 함수 다수 — 파라미터 객체 패턴 미사용

**개선안:**
```
viewportUtils.ts (841줄)
  → cameraUtils.ts      (~200줄) 카메라 관련
  → geometryUtils.ts    (~250줄) 메시/지오메트리 관련
  → renderingUtils.ts   (~200줄) 렌더링/인스턴싱
  → pickingUtils.ts     (~100줄) 레이캐스팅/피킹
```

### 3.5 `ifc.worker.ts` (750줄) — 에러 핸들링 개선 필요

**문제점:**
- try-catch가 최외곽에만 존재, 모든 에러를 동일하게 처리
- 에러 메시지가 한국어 일반 문자열 — 디버깅 어려움
- `buildRenderCache()` (423~540) 117줄 대형 함수
- 청킹 휴리스틱 (128 meshes, 75000 indices/chunk) 미문서화
- 모델 닫기 시 `renderCaches`, `spatialTrees` Map 정리 불완전

**개선안:**
- 에러 타입 분류: `IfcParsingError`, `GeometryError`, `PropertyError`
- `buildRenderCache()` → `collectMeshes()` + `chunkMeshes()` + `buildManifest()` 분리
- 청킹 상수에 주석으로 트레이드오프 문서화
- 모델 닫기 시 관련 캐시 전체 삭제 보장

### 3.6 `globals.css` (2,914줄) — 모듈화 필요

**문제점:**
- 단일 파일에 레이아웃, 타이포그래피, 컴포넌트, 유틸리티 혼재
- 다크 모드 변수가 파일 전체에 분산
- 미사용 셀렉터 누적 가능성

**개선안:**
```
globals.css (2914줄)
  → variables.css    (~100줄) CSS 커스텀 프로퍼티, 테마 변수
  → layout.css       (~300줄) 그리드, 패널, 리사이즈
  → components.css   (~1500줄) 컴포넌트별 스타일
  → utilities.css    (~200줄) 유틸리티 클래스
```

---

## 4. 아키텍처 비교

### 4.1 렌더링 파이프라인

```
ifc-ln:
  IFC File → web-ifc (C++ WASM) → Worker 추출 → 청크 매니페스트
  → Three.js Mesh 생성 → WebGL 렌더링 → BVH 피킹

ifc-lite:
  IFC File → Rust WASM 파서 → 컬럼너 스토리지 → Zero-copy GPU 업로드
  → WebGPU 파이프라인 → 셰이더 기반 렌더링 → GPU 피킹
```

**차이점:** ifc-lite는 파싱부터 렌더링까지 zero-copy 체인. ifc-ln은 Worker→Main 전송 시 ArrayBuffer 복사 발생.

### 4.2 상태 관리

```
ifc-ln (5 슬라이스):
  dataSlice     → 모델 데이터, 공간 트리, 필터, 속성
  loadingSlice  → 로딩 상태
  selectionSlice → 선택 상태
  uiSlice       → UI 상태, 카메라 명령
  visibilitySlice → 가시성 상태

ifc-lite (17 슬라이스):
  위 5개 + modelSlice, cameraSlice, sectionSlice, measurementSlice,
  mutationSlice, drawing2DSlice, sheetSlice, bcfSlice, idsSlice,
  listSlice, pinboardSlice, lensSlice, scriptSlice, chatSlice, hoverSlice
```

**평가:** ifc-ln의 5-슬라이스 구조는 현재 기능에 적절. 다만 `dataSlice`는 모델 데이터 + 속성 + 필터 + 엔진 상태가 혼재되어 향후 분리 고려 필요.

### 4.3 UI 프레임워크

| 항목 | ifc-ln | ifc-lite |
|------|--------|----------|
| 스타일링 | CSS (globals.css) | Tailwind CSS v4 |
| 컴포넌트 라이브러리 | 직접 구현 | Radix UI + CVA |
| 아이콘 | lucide-react | lucide-react |
| 레이아웃 | react-resizable-panels | react-resizable-panels |
| 가상 스크롤 | @tanstack/react-virtual | @tanstack/react-virtual |

**평가:** ifc-lite는 Radix UI로 접근성/재사용성이 우수. ifc-ln은 직접 구현으로 의존성은 적지만, 복잡한 UI 추가 시 부담 증가.

---

## 5. ifc-ln 강점 (유지할 부분)

| 강점 | 설명 |
|------|------|
| **경량성** | ~38K줄 단일 앱, 빠른 빌드/배포 |
| **호환성** | Three.js WebGL — 거의 모든 브라우저 지원 |
| **친숙한 기술 스택** | Three.js + React + Zustand — 커뮤니티 리소스 풍부 |
| **청크 스트리밍** | Worker 기반 점진적 로딩 — 대형 모델 대응 |
| **트리 구현 완성도** | Spatial/Class/Type 3가지 뷰, 검색, 컨텍스트 메뉴 모두 구현 |
| **IFC 아이콘 시스템** | Material Symbols 매핑으로 시각적 구분 우수 |
| **층 고도 배지** | ifc-lite에 없는 디테일 |

---

## 6. 개선 로드맵 (우선순위별)

### 🔴 Phase 1: 코드 품질 개선 (리팩토링)

| # | 작업 | 예상 효과 |
|---|------|-----------|
| 1-1 | `ViewportScene.tsx` 훅 분리 (979줄 → 4파일) | 유지보수성 대폭 개선, Three.js 메모리 누수 방지 |
| 1-2 | `HierarchyPanel.tsx` 컴포넌트 분리 (773줄 → 5파일) | 29개 memoization 제거, 테스트 용이성 |
| 1-3 | `viewportUtils.ts` 도메인 분할 (841줄 → 4파일) | 코드 탐색성, 재사용성 |
| 1-4 | `ifc.worker.ts` 에러 핸들링 강화 | 디버깅 효율성, 안정성 |
| 1-5 | `globals.css` 모듈화 (2914줄 → 4파일) | 스타일 충돌 방지, 유지보수 |

### 🟡 Phase 2: 핵심 기능 추가

| # | 기능 | 이유 |
|---|------|------|
| 2-1 | **단면 평면 (Section Plane)** | 건축 워크플로우 필수 — 층별 수평 절단, 수직 단면 |
| 2-2 | **측정 도구 (Measurement)** | 검측/검수 필수 — 거리, 면적 측정 |
| 2-3 | **층 필터 드롭다운** | 툴바에서 빠른 층 전환 — 현재 트리 내에서만 가능 |
| 2-4 | **커맨드 팔레트** | 파워 유저 UX — Ctrl+K로 명령 빠른 실행 |
| 2-5 | **glTF 내보내기** | 다른 3D 도구/플랫폼과 연동 |

### 🟢 Phase 3: 고급 기능

| # | 기능 | 이유 |
|---|------|------|
| 3-1 | 다중 모델 페더레이션 | 분야별 모델 병합 (건축+구조+MEP) |
| 3-2 | 속성 편집 + 변경 추적 | 읽기 전용 → 편집 가능 뷰어로 진화 |
| 3-3 | BCF 협업 | 이슈/코멘트 관리 — 팀 워크플로우 |
| 3-4 | 렌즈 필터링 | 시각적 데이터 분석 (용도별 색상화 등) |
| 3-5 | 2D 도면 생성 | 평면도/단면도 SVG 출력 |

---

## 7. 상세 미구현 기능 목록

### 7.1 단면 평면 (Section Plane) — ifc-lite 참조

ifc-lite 구현 위치:
- `packages/renderer/src/section-plane.ts` — GPU 절단면 렌더링
- `packages/renderer/src/section-2d-overlay.ts` — 2D 오버레이
- `apps/viewer/src/store/slices/sectionSlice.ts` — 상태 관리
- `apps/viewer/src/components/viewer/SectionPanel.tsx` — UI 패널
- `apps/viewer/src/components/viewer/SectionVisualization.tsx` — 시각화

ifc-ln 구현 시 필요사항:
- Three.js `ClippingPlane` 활용 (renderer.clippingPlanes)
- X/Y/Z축 절단 + 위치 슬라이더
- 절단면 시각적 표시 (반투명 평면)
- `sectionSlice.ts` 추가 (axis, position, enabled, flipped)

### 7.2 측정 도구 (Measurement) — ifc-lite 참조

ifc-lite 구현 위치:
- `packages/renderer/src/snap-detector.ts` — 스냅 포인트 감지
- `apps/viewer/src/store/slices/measurementSlice.ts` — 상태 관리
- `apps/viewer/src/components/viewer/MeasurePanel.tsx` — UI 패널
- `apps/viewer/src/components/viewer/MeasurementVisuals.tsx` — 시각화

ifc-ln 구현 시 필요사항:
- 두 점 간 거리 측정 (point-to-point)
- 3D 라벨 표시 (Three.js CSS2DRenderer 또는 스프라이트)
- 스냅 감지 (버텍스, 엣지 중점, 면 중심)
- `measurementSlice.ts` 추가

### 7.3 다양한 내보내기 형식

ifc-lite 지원 형식:
- IFC/STEP (원본 재구성)
- IFC5/IFCX (차세대 포맷)
- glTF/GLB (3D 모델)
- CSV (속성 테이블)
- Apache Parquet (분석용)
- JSON-LD (시맨틱 웹)
- SVG (2D 도면)

ifc-ln 현재 지원: JSON (공간 트리)만

### 7.4 다중 모델 페더레이션

ifc-lite 구현:
- `apps/viewer/src/store/slices/modelSlice.ts` — 모델 레지스트리
- `packages/renderer/src/federation-registry.ts` — ID 매핑
- `apps/viewer/src/store/types.ts` — 다중 모델 참조 타입

ifc-ln 구현 시 필요사항:
- 모델별 expressId 네임스페이스 (충돌 방지)
- 모델 추가/제거/토글 UI
- 페더레이션 레지스트리 서비스

### 7.5 기타 미구현 항목 요약

| 기능 | ifc-lite 참조 파일 | 예상 난이도 |
|------|-------------------|------------|
| 커맨드 팔레트 | `CommandPalette.tsx` | 중 |
| 터치 제스처 | `useTouchControls.ts` | 중 |
| 속성 편집 | `PropertyEditor.tsx` + `@ifc-lite/mutations` | 상 |
| BCF | `BCFPanel.tsx` + `@ifc-lite/bcf` | 상 |
| IDS 검증 | `IDSPanel.tsx` + `@ifc-lite/ids` | 상 |
| AI Chat | `ChatPanel.tsx` + `/lib/llm/` | 상 |
| 스크립트 | `ScriptPanel.tsx` + `@ifc-lite/sandbox` | 상 |
| 렌즈 필터 | `LensPanel.tsx` + `@ifc-lite/lens` | 중 |
| 리스트 빌더 | `ListPanel.tsx` + `@ifc-lite/lists` | 중 |
| 핀보드 | `BasketPresentationDock.tsx` | 하 |

---

## 8. 결론

**ifc-ln의 현재 위치:** ifc-lite 대비 **핵심 뷰어 기능의 ~70%** 를 구현.
3D 렌더링, 공간 탐색, 속성 조회, 가시성 제어 등 기본 뷰잉은 충실하나,
BIM 전문 도구(단면/측정/편집/협업/검증)는 전면 미구현.

**코드 품질:** 전반적으로 양호하나 상위 3개 파일(`ViewportScene`, `HierarchyPanel`, `viewportUtils`)의
리팩토링이 시급. 향후 기능 추가 전 코드 구조 개선을 권장.

**전략적 방향:**
ifc-ln은 "경량 임베더블 뷰어"로서의 강점(호환성, 속도, 단순성)을 유지하면서,
Phase 2의 단면 평면 + 측정 도구 추가로 실무 활용도를 크게 높일 수 있음.
