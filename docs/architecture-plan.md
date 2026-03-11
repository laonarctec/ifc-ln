# IFC Model Viewer 웹앱 아키텍처 기획서

## 1. 프로젝트 개요

### 1.1 목표
web-ifc(C++ WASM)를 지오메트리 엔진으로 활용하고, React/TypeScript로 커스텀 BIM 뷰어 웹앱을 구축한다.

### 1.2 기술 스택 결정 근거

| 레이어 | 기술 선택 | 선택 이유 |
|--------|-----------|-----------|
| IFC 파싱 + 지오메트리 | **web-ifc** (C++ → WASM via Emscripten) | 10년+ 개발 역사, IFC2x3/IFC4/IFC4x3 지원, 산업 표준 수준의 지오메트리 커널 |
| 3D 렌더링 | **Three.js** + React Three Fiber | WebGL/WebGPU 호환, React 생태계 통합, 풍부한 BIM 관련 레퍼런스 |
| UI 프레임워크 | **React 18+** / TypeScript / Next.js | contech-dx 기존 스택과 일치, 재사용 가능 |
| 상태 관리 | **Zustand** 또는 Jotai | 경량, TypeScript 친화, 3D 상태 관리에 적합 |
| 빌드 | **Vite** | WASM 지원 우수, HMR 빠름, Next.js 외부 standalone viewer 시 적합 |

---

## 2. 시스템 아키텍처

### 2.1 전체 레이어 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    React / TypeScript UI                    │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Viewer   │  │ Property  │  │ Spatial  │  │ Toolbar    │ │
│  │ Canvas   │  │ Panel     │  │ Tree     │  │ Controls   │ │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └─────┬──────┘ │
│       │              │             │              │        │
│  ─────┴──────────────┴─────────────┴──────────────┴─────── │
│                     State Management (Zustand)              │
│  ┌────────────────────────────────────────────────────────┐│
│  │ modelStore: 로드된 모델, 선택 상태, 가시성, 하이라이트        ││
│  │ viewerStore: 카메라, 클리핑 플레인, 렌더 설정                ││
│  │ propertyStore: 속성 데이터, 공간 구조 캐시                  ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                   Service Layer (TypeScript)                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ IfcService   │  │ GeometryServ │  │ PropertyService   │  │
│  │ (로드/언로드)  │  │ (메시 변환)   │  │ (속성 쿼리/캐시)    │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         │                 │                     │            │
│  ───────┴─────────────────┴─────────────────────┴──────────  │
│              Web Worker (off-main-thread processing)         │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ifc.worker.ts — web-ifc 인스턴스를 Worker 내부에서 구동      ││
│  │ • IFC 파일 파싱                                           ││
│  │ • 지오메트리 스트리밍 (StreamAllMeshes)                     ││
│  │ • 속성 쿼리 (GetLine, GetPropertySets)                    ││
│  │ • 공간 구조 추출 (GetSpatialStructure)                     ││
│  └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                     web-ifc (C++ → WASM)                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ web-ifc-api.js + web-ifc.wasm (+ web-ifc-mt.wasm)      │  │
│  │ • STEP/IFC 파싱                                        │  │
│  │ • 파라메트릭 지오메트리 → 삼각 메시 변환                    │  │
│  │   (ExtrudedAreaSolid, BooleanClipping, CSG, B-rep...)  │  │
│  │ • 속성/관계/타입 쿼리                                     │  │
│  │ • IFC 스키마 타입 시스템                                  │  │
│  └────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Three.js + React Three Fiber                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ • BufferGeometry 기반 인스턴스 렌더링                     │  │
│  │ • 오브젝트 피킹 (Raycaster + expressID 매핑)              │  │
│  │ • 클리핑 플레인 / 섹션 컷                                 │  │
│  │ • 카메라 컨트롤 (Orbit, First-person, Fly)               │  │
│  │ • 포스트 프로세싱 (SSAO, Edge detection)                 │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름 (File → Screen)

```
IFC 파일 (ArrayBuffer)
    │
    ▼
[Web Worker] web-ifc.OpenModel(data, settings)
    │
    ├─► StreamAllMeshes() ──► FlatMesh[] (vertex/index/color/transform)
    │       │
    │       ▼ (Transferable로 메인 스레드 전달)
    │   [Main Thread] GeometryService
    │       │
    │       ├─► expressID별 BufferGeometry 생성
    │       ├─► Material 그룹핑 (IFC 타입별 기본 색상)
    │       ├─► 인스턴스 매트릭스 적용
    │       └─► Three.js Scene에 Mesh 추가
    │
    ├─► GetSpatialStructure() ──► 공간 트리 (Project > Site > Building > Storey)
    │       │
    │       ▼
    │   [UI] Spatial Tree 컴포넌트 렌더링
    │
    └─► GetLine(expressID) ──► 개별 엔티티 속성/PropertySet
            │
            ▼ (on-demand, 클릭 시)
        [UI] Property Panel 렌더링
```

---

## 3. 핵심 모듈 상세 설계

### 3.1 Web Worker 기반 IFC 서비스

web-ifc의 WASM은 메인 스레드를 블로킹하므로, **반드시 Web Worker에서 구동**해야 한다.

```
src/
├── workers/
│   └── ifc.worker.ts          # web-ifc 인스턴스 관리
├── services/
│   ├── IfcService.ts          # Worker 통신 추상화 (Comlink 또는 수동)
│   ├── GeometryService.ts     # FlatMesh → Three.js BufferGeometry 변환
│   └── PropertyService.ts     # 속성 쿼리 + LRU 캐시
```

**Worker 통신 프로토콜 (메시지 타입 정의):**

```typescript
// types/worker-messages.ts
type WorkerRequest =
  | { type: 'INIT'; wasmPath: string }
  | { type: 'LOAD_MODEL'; data: ArrayBuffer; settings?: LoaderSettings }
  | { type: 'STREAM_MESHES'; modelID: number }
  | { type: 'GET_SPATIAL_STRUCTURE'; modelID: number }
  | { type: 'GET_PROPERTIES'; modelID: number; expressID: number }
  | { type: 'GET_PROPERTY_SETS'; modelID: number; expressID: number }
  | { type: 'GET_TYPE_PROPERTIES'; modelID: number; typeID: number }
  | { type: 'GET_ALL_IDS'; modelID: number; ifcType: number }
  | { type: 'CLOSE_MODEL'; modelID: number };

type WorkerResponse =
  | { type: 'INIT_COMPLETE' }
  | { type: 'MODEL_LOADED'; modelID: number }
  | { type: 'MESH_DATA'; meshes: TransferableMeshData[] }    // Transferable
  | { type: 'SPATIAL_STRUCTURE'; tree: SpatialNode }
  | { type: 'PROPERTIES'; data: IfcProperties }
  | { type: 'PROGRESS'; loaded: number; total: number }
  | { type: 'ERROR'; message: string };
```

**핵심 포인트 — Transferable Objects:**

web-ifc의 `StreamAllMeshes`가 반환하는 vertex/index 배열을 `postMessage`의 Transferable로 전달하면 zero-copy로 메인 스레드에 넘길 수 있다. 이것이 대형 모델 성능의 핵심이다.

```typescript
// ifc.worker.ts 내부
ifcApi.StreamAllMeshes(modelID, (mesh) => {
  const geometries = mesh.geometries.size();
  for (let i = 0; i < geometries; i++) {
    const geom = mesh.geometries.get(i);
    const vertexData = ifcApi.GetVertexArray(
      geom.geometryExpressID, modelID
    );
    const indexData = ifcApi.GetIndexArray(
      geom.geometryExpressID, modelID
    );
    // Float32Array, Uint32Array → Transferable
    self.postMessage(
      { type: 'MESH_DATA', expressID: mesh.expressID,
        vertices: vertexData, indices: indexData,
        color: geom.color, transform: geom.flatTransformation },
      [vertexData.buffer, indexData.buffer]  // zero-copy transfer
    );
  }
});
```

### 3.2 지오메트리 서비스 (Mesh 변환 전략)

web-ifc가 반환하는 FlatMesh 데이터를 Three.js에 효율적으로 매핑하는 전략:

**전략 A: IFC 타입별 Merged Geometry (권장, 대형 모델)**

```
IfcWall      → 1개 MergedBufferGeometry → 1 draw call
IfcSlab      → 1개 MergedBufferGeometry → 1 draw call
IfcWindow    → 1개 MergedBufferGeometry → 1 draw call
IfcDoor      → 1개 MergedBufferGeometry → 1 draw call
...
```

장점: draw call 수 최소화 → 수만 객체도 60fps 유지 가능
단점: 개별 객체 조작(색상변경, 숨기기) 시 geometry rebuild 필요

**전략 B: expressID 기반 개별 Mesh (소형 모델, 인터랙션 중시)**

```
expressID_123 → Mesh (BufferGeometry + Material)
expressID_456 → Mesh (BufferGeometry + Material)
...
```

장점: 개별 조작 용이
단점: 1000개 이상 객체에서 성능 급감

**권장: 하이브리드 — Merged + Fragment Map**

```typescript
interface FragmentMap {
  // expressID → 어느 merged geometry의 어느 vertex 범위에 있는지
  [expressID: number]: {
    geometryGroupIndex: number;  // 소속 merged geometry
    vertexStart: number;
    vertexCount: number;
    indexStart: number;
    indexCount: number;
  };
}
```

이 맵을 유지하면 merged geometry에서도 개별 객체를 색상 변경/숨기기 할 수 있다 (vertex color attribute 또는 custom shader uniform으로 제어).

### 3.3 오브젝트 피킹 (선택)

GPU 피킹 방식 권장:

```
1. 별도 렌더 타겟에 expressID를 color로 인코딩하여 렌더
2. 마우스 위치의 픽셀 읽기 → expressID 복원
3. expressID로 속성 조회 트리거
```

```typescript
// expressID → RGB 인코딩
function encodeExpressID(id: number): [number, number, number] {
  return [
    (id & 0xFF) / 255,
    ((id >> 8) & 0xFF) / 255,
    ((id >> 16) & 0xFF) / 255,
  ];
}
```

### 3.4 속성 패널 (On-demand 로딩)

IFC 속성은 모델 로딩 시 전부 가져오지 않고, **클릭 시점에 Worker에 요청**한다.

```typescript
// PropertyService.ts
class PropertyService {
  private cache = new LRUCache<number, IfcProperties>(500);

  async getProperties(modelID: number, expressID: number) {
    if (this.cache.has(expressID)) return this.cache.get(expressID);

    const [props, psets, type] = await Promise.all([
      this.worker.request('GET_PROPERTIES', { modelID, expressID }),
      this.worker.request('GET_PROPERTY_SETS', { modelID, expressID }),
      this.worker.request('GET_TYPE_PROPERTIES', { modelID, expressID }),
    ]);

    const result = { ...props, propertySets: psets, typeProperties: type };
    this.cache.set(expressID, result);
    return result;
  }
}
```

### 3.5 공간 트리 (Spatial Structure)

```typescript
interface SpatialNode {
  expressID: number;
  type: string;         // 'IFCPROJECT' | 'IFCSITE' | 'IFCBUILDING' | 'IFCBUILDINGSTOREY'
  name: string;
  children: SpatialNode[];
  elements?: number[];  // 이 노드에 소속된 요소들의 expressID
}
```

web-ifc의 `GetSpatialStructure(modelID)` → 트리 구조 반환 → React Tree 컴포넌트로 렌더링

---

## 4. 프로젝트 구조

```
ifc-viewer/
├── public/
│   └── wasm/
│       ├── web-ifc.wasm              # web-ifc WASM 바이너리
│       └── web-ifc-mt.wasm           # 멀티스레드 버전
│
├── src/
│   ├── types/
│   │   ├── ifc.ts                    # IFC 관련 타입 정의
│   │   ├── geometry.ts               # 지오메트리 타입
│   │   └── worker-messages.ts        # Worker 통신 프로토콜
│   │
│   ├── workers/
│   │   └── ifc.worker.ts             # web-ifc WASM Worker
│   │
│   ├── services/
│   │   ├── IfcService.ts             # Worker 래퍼 (로드/언로드)
│   │   ├── GeometryService.ts        # FlatMesh → Three.js 변환
│   │   ├── PropertyService.ts        # 속성 쿼리 + 캐시
│   │   ├── PickingService.ts         # GPU 피킹
│   │   └── FragmentService.ts        # Merged geometry + fragment map
│   │
│   ├── stores/
│   │   ├── modelStore.ts             # 모델 상태 (Zustand)
│   │   ├── viewerStore.ts            # 뷰어 상태
│   │   └── selectionStore.ts         # 선택/하이라이트 상태
│   │
│   ├── components/
│   │   ├── viewer/
│   │   │   ├── ViewerCanvas.tsx       # R3F Canvas 래퍼
│   │   │   ├── ModelScene.tsx         # 3D 씬 관리
│   │   │   ├── CameraControls.tsx     # 카메라 컨트롤
│   │   │   ├── ClippingPlane.tsx      # 클리핑 플레인
│   │   │   └── GridHelper.tsx         # 그리드/축
│   │   │
│   │   ├── panels/
│   │   │   ├── PropertyPanel.tsx      # 속성 패널
│   │   │   ├── SpatialTree.tsx        # 공간 구조 트리
│   │   │   ├── TypeFilter.tsx         # IFC 타입별 필터/가시성
│   │   │   └── MeasurePanel.tsx       # 측정 도구 (Phase 2)
│   │   │
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx            # 메인 툴바
│   │   │   ├── FileLoader.tsx         # 파일 업로드
│   │   │   ├── ViewModes.tsx          # 뷰 모드 전환
│   │   │   └── SectionTools.tsx       # 단면 도구
│   │   │
│   │   └── layout/
│   │       ├── AppLayout.tsx          # 전체 레이아웃
│   │       └── ResizablePanel.tsx     # 리사이즈 가능 패널
│   │
│   ├── hooks/
│   │   ├── useIfcLoader.ts           # IFC 로딩 훅
│   │   ├── useSelection.ts           # 선택 상태 훅
│   │   ├── useClipping.ts            # 클리핑 훅
│   │   └── useProperties.ts          # 속성 조회 훅
│   │
│   ├── utils/
│   │   ├── geometry.ts               # 지오메트리 유틸리티
│   │   ├── ifc-constants.ts          # IFC 타입 상수/색상 매핑
│   │   └── math.ts                   # 변환 행렬 유틸
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── package.json
├── tsconfig.json
├── vite.config.ts                    # WASM 서빙 설정 포함
└── README.md
```

---

## 5. 개발 페이즈 로드맵

### Phase 1: 코어 뷰어 (4~6주)

**목표**: IFC 파일을 로드하고 3D로 렌더링 + 기본 인터랙션

| 태스크 | 설명 | 예상 기간 |
|--------|------|-----------|
| 프로젝트 셋업 | Vite + React + TypeScript + Three.js/R3F, web-ifc npm 설치, WASM 서빙 설정 | 2일 |
| Worker 통신 | ifc.worker.ts 구현, Comlink 또는 수동 메시지 프로토콜 | 3일 |
| 지오메트리 로딩 | StreamAllMeshes → BufferGeometry 변환 파이프라인 | 5일 |
| 기본 렌더링 | 모델 렌더링 + Orbit 카메라 + 그리드 + 축 | 3일 |
| 오브젝트 피킹 | GPU 피킹 → expressID 선택 + 하이라이트 | 3일 |
| 속성 패널 | 클릭 시 속성/PropertySet 표시 | 3일 |
| 공간 트리 | Spatial Structure 트리 뷰 + 트리↔3D 연동 | 3일 |
| 파일 로딩 UI | 드래그앤드롭/파일 선택 + 로딩 프로그레스 | 2일 |

**Phase 1 산출물**: 기본 IFC 뷰어 (로드, 보기, 선택, 속성 확인)

### Phase 2: BIM 도구 (4~6주)

| 태스크 | 설명 | 예상 기간 |
|--------|------|-----------|
| 타입별 가시성 | IFC 타입별 표시/숨기기 (IfcWall, IfcSlab...) | 3일 |
| 클리핑 플레인 | X/Y/Z 축 단면 컷 + 인터랙티브 이동 | 5일 |
| 투명도/X-ray | 선택 외 객체 반투명 모드 | 2일 |
| 층별 보기 | IfcBuildingStorey 기반 층 필터링 | 3일 |
| 거리 측정 | 두 점 간 거리 측정 도구 | 5일 |
| 스냅샷 | 현재 뷰 PNG 내보내기 | 2일 |
| 성능 최적화 | Merged geometry, LOD, frustum culling | 5일 |

**Phase 2 산출물**: 실용적 BIM 검토 도구

### Phase 3: 고급 기능 + contech-dx 통합 (6~8주)

| 태스크 | 설명 | 예상 기간 |
|--------|------|-----------|
| 물량 산출 | IfcQuantitySet 추출 / 지오메트리 기반 체적 계산 | 5일 |
| BCF 지원 | BIM Collaboration Format 이슈 뷰포인트 저장/로드 | 5일 |
| 멀티 모델 | 여러 IFC 파일 동시 로드 (Federation) | 5일 |
| contech-dx 통합 | Next.js 앱 내 뷰어 컴포넌트화, Supabase 연동 | 7일 |
| 서버사이드 캐시 | IFC → 경량 포맷 서버 변환 캐시 (대형 모델) | 7일 |
| 2D 도면 | 평면도/단면도 생성 (클리핑 기반) | 7일 |

---

## 6. 핵심 기술 결정 사항

### 6.1 web-ifc 직접 사용 vs That Open Components

| 기준 | web-ifc 직접 사용 | That Open Components |
|------|-------------------|---------------------|
| 커스터마이징 | ◎ 완전 제어 | △ 프레임워크 제약 |
| 학습 곡선 | ✕ 낮은 수준 API 직접 처리 | ◎ 고수준 API |
| 번들 크기 | ◎ 필요한 것만 | △ 전체 생태계 포함 |
| 개발 속도 | △ 모든 것 직접 구현 | ◎ 빠른 프로토타이핑 |
| contech-dx 통합 | ◎ Next.js에 깔끔 통합 | △ 별도 UI 시스템과 충돌 가능 |

**결론**: web-ifc 직접 사용을 권장. contech-dx의 기존 React/Next.js UI와의 통합이 깔끔하고, 장기적으로 BIM 도구를 자체 방식으로 확장할 수 있다.

### 6.2 Three.js vs wgpu (Rust WebGPU)

| 기준 | Three.js + R3F | wgpu (Rust → WASM) |
|------|----------------|---------------------|
| 생태계 | ◎ 거대한 생태계 | △ 아직 성숙 중 |
| React 통합 | ◎ R3F로 선언적 | ✕ Canvas 수동 관리 |
| 개발 속도 | ◎ 빠름 | ✕ 렌더러 직접 구현 |
| 성능 상한 | ○ 충분 (수십만 객체) | ◎ 이론적 최고 |
| 브라우저 호환 | ◎ WebGL 보편 지원 | △ WebGPU 아직 확산 중 |

**결론**: Phase 1~2는 Three.js + R3F로 빠르게 구현. Phase 3 이후 성능 병목 발생 시 wgpu 기반 커스텀 렌더러를 검토. 현 시점에서 wgpu로 BIM 뷰어를 처음부터 만드는 것은 ROI가 낮다.

### 6.3 WASM 서빙 설정

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['web-ifc'],  // WASM pre-bundling 제외
  },
  server: {
    headers: {
      // SharedArrayBuffer를 위한 헤더 (멀티스레드 WASM 필수)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',  // Worker를 ES module로
  },
});
```

---

## 7. 성능 최적화 전략

### 7.1 로딩 성능

| 전략 | 설명 | 적용 시점 |
|------|------|-----------|
| 스트리밍 로딩 | StreamAllMeshes로 점진적 렌더링 | Phase 1 |
| Web Worker 분리 | 파싱/지오메트리를 off-thread 처리 | Phase 1 |
| Transferable Objects | ArrayBuffer zero-copy 전송 | Phase 1 |
| 서버 캐시 | IFC → 경량 바이너리 포맷 캐시 | Phase 3 |

### 7.2 렌더링 성능

| 전략 | 설명 | 적용 시점 |
|------|------|-----------|
| Merged Geometry | IFC 타입별 geometry 병합 → draw call 최소화 | Phase 2 |
| Instanced Rendering | 동일 geometry 반복 객체 (기둥, 창) | Phase 2 |
| Frustum Culling | 카메라 밖 객체 렌더 제외 | Phase 2 |
| LOD (Level of Detail) | 거리별 디테일 조절 | Phase 3 |
| Occlusion Culling | 가려진 객체 렌더 제외 | Phase 3 |

### 7.3 메모리 관리

- web-ifc WASM 메모리: `CloseModel()` 호출로 해제
- Three.js: `geometry.dispose()`, `material.dispose()`, `texture.dispose()` 명시 호출
- Worker: 모델 언로드 시 Worker에 CLOSE_MODEL 메시지 → WASM 메모리 해제

---

## 8. contech-dx 통합 시나리오

### 8.1 Next.js 내 뷰어 컴포넌트화

```typescript
// 동적 임포트 (SSR 회피)
const IfcViewer = dynamic(() => import('@/components/ifc-viewer/IfcViewer'), {
  ssr: false,  // web-ifc WASM은 브라우저 전용
  loading: () => <ViewerSkeleton />,
});

// 페이지에서 사용
export default function ProjectBIMPage({ projectId }: Props) {
  const { ifcFileUrl } = useProjectFiles(projectId);  // Supabase Storage
  return <IfcViewer fileUrl={ifcFileUrl} />;
}
```

### 8.2 Supabase Storage 연동

```
사용자 → IFC 파일 업로드 → Supabase Storage (S3 호환)
                                    │
뷰어 페이지 접근 시 ───────────────────┘
    │
    ▼
Signed URL 발급 → fetch → ArrayBuffer → Web Worker → web-ifc → 렌더링
```

### 8.3 향후 확장: 서버사이드 IFC 처리

대형 모델의 경우 FastAPI 마이크로서비스에서 IfcOpenShell로 전처리:

```
IFC 업로드 → FastAPI (IfcOpenShell)
                │
                ├─► glTF/GLB 변환 (지오메트리)
                ├─► 메타데이터 JSON 추출 (속성/관계)
                ├─► 물량 산출 결과 DB 저장
                └─► 캐시 저장 (Redis / Supabase)
                        │
클라이언트 요청 시 ◄────┘
    │
    ▼
경량 glTF 렌더 (Three.js) + 속성은 API 쿼리
```

---

## 9. 리스크 및 대응

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| web-ifc 특정 IFC 파일 파싱 실패 | 중 | 중 | IfcOpenShell 서버 폴백, web-ifc GitHub 이슈 리포트 |
| 대형 모델(100MB+) 브라우저 OOM | 중 | 상 | 서버사이드 전처리 + 스트리밍, WASM 메모리 한도 설정 |
| SharedArrayBuffer 미지원 환경 | 하 | 중 | 싱글스레드 WASM 폴백 (web-ifc.wasm) |
| Three.js 렌더링 성능 한계 | 중 | 중 | Merged geometry, 인스턴싱, 필요시 XKT 포맷 전환 |
| WASM 파일 크기 (초기 로딩) | 하 | 중 | CDN 캐시, gzip/brotli 압축, lazy loading |

---

## 10. 참고 자료

| 자료 | URL | 용도 |
|------|-----|------|
| web-ifc GitHub | https://github.com/ThatOpen/engine_web-ifc | 코어 엔진 소스 |
| web-ifc API 문서 | https://thatopen.github.io/engine_web-ifc/docs/ | API 레퍼런스 |
| web-ifc-three | https://github.com/ThatOpen/web-ifc-three | Three.js 통합 참고 |
| That Open Components | https://docs.thatopen.com/ | 고수준 BIM 도구 참고 |
| React Three Fiber | https://docs.pmnd.rs/react-three-fiber | R3F 문서 |
| IFC 스키마 레퍼런스 | https://standards.buildingsmart.org/ | IFC 표준 |
| IFClite (Rust 참고) | https://github.com/louistrue/ifc-lite | Rust WASM 아키텍처 참고 |
| xeokit SDK | https://xeokit.io/ | 대규모 모델 렌더링 전략 참고 |

---

*문서 작성일: 2026-03-09*
*대상 프로젝트: contech-dx IFC 뷰어 모듈*
