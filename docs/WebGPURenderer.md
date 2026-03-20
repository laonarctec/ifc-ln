# ifc-ln WebGPU 렌더링 모드 추가 계획

> 작성일: 2026-03-20
> 상태: 미구현 (구현 계획 문서)

## Context

ifc-ln은 현재 `Three.js WebGLRenderer`로만 렌더링. `three@0.183.2`에는 이미 `WebGPURenderer`가 포함되어 있으며, `StandardNodeLibrary`가 기존 머티리얼/라이트/톤매핑을 모두 자동 변환함.

**목표:** WebGPU 가능 시 자동 사용, 불가 시 WebGL 폴백. 사용자 수동 전환도 지원.

---

## 핵심 호환성 확인 결과

Three.js `0.183.2` 내부 파일 직접 확인 완료:

| 항목 | 경로 / 확인 내용 | 상태 |
|------|------------------|------|
| `WebGPURenderer` | `three/src/renderers/webgpu/WebGPURenderer.js` | ✅ 존재 |
| `Renderer.init()` | async, 첫 렌더 전 `await` 필수 (`Renderer.js:745`) | ✅ 확인 |
| `MeshPhongMaterial` 매핑 | `StandardNodeLibrary.js:65` → `MeshPhongNodeMaterial` | ✅ 자동 |
| `LineBasicMaterial` 매핑 | `StandardNodeLibrary.js:73` → `LineBasicNodeMaterial` | ✅ 자동 |
| `HemisphereLight` 매핑 | `StandardNodeLibrary.js:84` → `HemisphereLightNode` | ✅ 자동 |
| `DirectionalLight` 매핑 | `StandardNodeLibrary.js:80` → `DirectionalLightNode` | ✅ 자동 |
| `ACESFilmicToneMapping` | `StandardNodeLibrary.js:92` → `acesFilmicToneMapping` | ✅ 자동 |
| `forceWebGL` 옵션 | `WebGPURenderer.js:57` — WebGL2 백엔드 강제 전환 | ✅ 지원 |
| `getFallback` | `WebGPURenderer.js:65-71` — WebGPU 미지원 시 자동 WebGL2 폴백 | ✅ 내장 |
| BVH 레이캐스팅 | CPU 사이드 → 렌더러 독립 | ✅ 변경 불필요 |
| `OrbitControls` | `domElement` 기반 → 렌더러 독립 | ✅ 변경 불필요 |
| `InstancedMesh` | Three.js 코어 클래스, 양쪽 백엔드 지원 | ✅ 변경 불필요 |

**결론:** 기존 머티리얼/지오메트리/BVH/컨트롤 코드 변경 없이 렌더러만 교체 가능.

---

## 수정 파일 목록

| # | 파일 | 변경 내용 | 예상 라인 |
|---|------|-----------|-----------|
| 1 | `src/stores/slices/uiSlice.ts` | `rendererBackend` 상태 추가 | +15줄 |
| 2 | `src/stores/index.ts` | 타입 합성에 새 필드 반영 | +2줄 |
| 3 | `src/components/viewer/viewport/createRenderer.ts` | **신규** — 렌더러 팩토리 | ~80줄 |
| 4 | `src/components/viewer/ViewportScene.tsx` | 렌더러 생성을 팩토리로 교체, async 초기화 | ~40줄 변경 |
| 5 | `src/components/viewer/StatusBar.tsx` | 활성 렌더러 백엔드 표시 | +5줄 |
| 6 | `src/components/viewer/MainToolbar.tsx` | 렌더러 모드 토글 버튼 | +25줄 |

**총 예상 변경량: ~200줄**

### 변경하지 않는 파일

| 파일 | 이유 |
|------|------|
| `viewportUtils.ts` | `MeshPhongMaterial` 인스턴스는 JS 레벨에서 그대로 유지. WebGPURenderer의 노드 시스템은 셰이더 컴파일 레벨에서 변환하므로 `instanceof` 체크 영향 없음 |
| `viewportGeometryStore.ts` | Float32Array/Uint32Array 전송 → 렌더러 무관 |
| `ifc.worker.ts` | Worker ↔ Main 통신은 렌더러와 완전 독립 |
| `OrbitControls` | `camera` + `domElement` 기반 → 렌더러 무관 |
| `three-mesh-bvh` | CPU 사이드 BVH → 렌더러 무관 |
| `globals.css` | 스타일 변경 없음 |

---

## 구현 상세

### Step 1: `uiSlice.ts` — 렌더러 백엔드 상태

```typescript
export type RendererBackend = 'auto' | 'webgpu' | 'webgl';

// UISlice 인터페이스에 추가:
rendererBackend: RendererBackend;                       // 사용자 선호 (기본: 'auto')
activeRendererBackend: 'webgpu' | 'webgl' | null;      // 런타임 실제 사용 중인 백엔드
setRendererBackend: (backend: RendererBackend) => void;
setActiveRendererBackend: (backend: 'webgpu' | 'webgl' | null) => void;
```

### Step 2: `createRenderer.ts` — 렌더러 팩토리 (신규 파일)

```typescript
import * as THREE from 'three';
import type { RendererBackend } from '@/stores/slices/uiSlice';

export type RendererMode = 'webgpu' | 'webgl';

export interface RendererResult {
  renderer: THREE.WebGLRenderer | /* WebGPURenderer */ any;
  mode: RendererMode;
  dispose: () => void;
}

// --- 감지 ---
export async function detectRendererMode(
  preference: RendererBackend
): Promise<RendererMode> {
  if (preference === 'webgl') return 'webgl';

  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    } catch { /* fallback */ }
  }

  if (preference === 'webgpu') {
    console.warn('WebGPU requested but unavailable, falling back to WebGL');
  }
  return 'webgl';
}

// --- 생성 ---
export async function createViewportRenderer(
  mode: RendererMode
): Promise<RendererResult> {
  if (mode === 'webgpu') {
    // dynamic import → WebGPU 미사용 시 번들에서 제외
    const { default: WebGPURenderer } = await import(
      'three/src/renderers/webgpu/WebGPURenderer.js'
    );
    const renderer = new WebGPURenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    await renderer.init();  // ← 핵심: async 초기화 필수

    applyCommonSettings(renderer);
    return {
      renderer,
      mode: 'webgpu',
      dispose: () => renderer.dispose(),
    };
  }

  // WebGL 경로 (기존 코드 그대로)
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  applyCommonSettings(renderer);
  return {
    renderer,
    mode: 'webgl',
    dispose: () => {
      renderer.forceContextLoss();
      renderer.dispose();
    },
  };
}

function applyCommonSettings(renderer: {
  outputColorSpace: string;
  toneMapping: number;
  toneMappingExposure: number;
  autoClear: boolean;
}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.autoClear = false;
}
```

### Step 3: `ViewportScene.tsx` — async 초기화 리팩토링

현재 코드 (300-322줄):
```typescript
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({...});
} catch (error) { ... }
renderer.setPixelRatio(...);
// ...
```

변경 패턴:
```typescript
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  let cancelled = false;
  let cleanup: (() => void) | null = null;

  (async () => {
    setRendererError(null);

    const mode = await detectRendererMode(rendererBackend);
    if (cancelled) return;

    let result: RendererResult;
    try {
      result = await createViewportRenderer(mode);
    } catch (error) {
      setRendererError(
        error instanceof Error ? error.message : 'Renderer 초기화 실패'
      );
      return;
    }
    if (cancelled) { result.dispose(); return; }

    setActiveRendererBackend(mode);  // Zustand에 활성 백엔드 저장
    setSceneGeneration((g) => g + 1);

    const renderer = result.renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // ... 이하 기존 scene/camera/controls/lights/renderLoop 코드 변경 없음 ...

    cleanup = () => {
      // 기존 cleanup 코드 (이벤트 리스너, 지오메트리 dispose 등)
      result.dispose();  // forceContextLoss() 분기는 팩토리가 처리
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  })();

  return () => {
    cancelled = true;
    cleanup?.();
  };
}, [manifest, projectionMode, onVisibleChunkIdsChange, rendererBackend]);
//                                                      ↑ 새 의존성 추가
```

**핵심 포인트:**
- `renderer` 타입: 공통 API만 사용하므로 union 또는 `Renderer` 베이스 타입
- `forceContextLoss()`는 팩토리의 `dispose()` 래퍼가 분기 처리
- `cancelled` 플래그로 async 초기화 중 cleanup 요청 시 안전 처리

### Step 4: `StatusBar.tsx` — 활성 백엔드 표시

```tsx
const activeRendererBackend = useViewerStore((s) => s.activeRendererBackend);

// 기존 엔진 상태 옆에 배지 추가:
{activeRendererBackend && (
  <span className="status-bar__badge">
    {activeRendererBackend === 'webgpu' ? 'WebGPU' : 'WebGL'}
  </span>
)}
```

### Step 5: `MainToolbar.tsx` — 렌더러 모드 토글

기존 투영 모드 토글 (`perspective`/`orthographic`) 옆에 렌더러 백엔드 토글 추가:
- `auto` → `webgpu` → `webgl` 순환
- 변경 시 `setRendererBackend()` 호출 → useEffect 재실행 → 씬 재생성

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| `WebGPURenderer.init()` async → useEffect 복잡도 | 중 | cancelled 플래그 패턴 (검증된 React 패턴) |
| WebGL ↔ WebGPU 시각적 차이 | 낮음 | 동일 톤매핑/컬러스페이스 설정. Phong 노드 변환은 동등성 보장 |
| `forceContextLoss()` 미존재 (WebGPU) | 낮음 | dispose 래퍼에서 분기 처리 |
| 브라우저 WebGPU 미지원 (Firefox/Safari) | 없음 | `'auto'` 모드에서 자동 WebGL 폴백. WebGPURenderer 자체도 내장 폴백 있음 |
| 청크 로딩 중 렌더러 전환 | 낮음 | useEffect cleanup에서 cancelled 체크 → 안전 취소 |
| Three.js WebGPU 불안정성 | 중 | `'auto'` 기본값이므로 문제 시 `'webgl'`로 즉시 전환 가능 |

---

## 검증 방법

1. Chrome에서 `'auto'` → StatusBar에 "WebGPU" 표시 확인
2. Firefox에서 `'auto'` → StatusBar에 "WebGL" 표시 확인 (폴백)
3. 수동 `'webgl'` 전환 → Chrome에서도 WebGL 사용 확인
4. IFC 파일 로드 후 양쪽 모드에서 동일 시각적 결과 비교
5. 모드 전환 시 씬 정상 재생성 (메모리 누수 없음)
6. 레이캐스팅(엔티티 선택) 양쪽 모드 정상 동작
7. 인스턴스 메시 색상/변환 양쪽 모드 정상
8. 엣지 렌더링 양쪽 모드 정상
9. `npx tsc --noEmit` 통과

---

## 향후 확장 (Phase 2+)

현재 계획은 Three.js `WebGPURenderer` 드롭인 교체에 집중. 추후 WebGPU 고유 최적화 가능:

| 기능 | 설명 |
|------|------|
| GPU 피킹 | `r32uint` 렌더 타겟으로 CPU 레이캐스팅 대체 → 대형 모델 피킹 성능 향상 |
| Storage Buffer 인스턴싱 | `InstancedMesh.setMatrixAt` 대신 스토리지 버퍼 → 더 큰 인스턴스 수 지원 |
| 컴퓨트 셰이더 | Frustum culling, LOD 계산을 GPU에서 처리 |
| Post-processing | TSL(Three.js Shading Language) 노드로 contact shading, separation lines 추가 |
| Reverse-Z 깊이 | `reversedDepthBuffer: true` 옵션으로 깊이 정밀도 향상 |

---

## 참고: ifc-lite WebGPU 렌더러 구조

ifc-lite는 Three.js를 사용하지 않는 완전 커스텀 WebGPU 렌더러 (~3000줄):

```
packages/renderer/src/
  ├── index.ts              (~1200줄) 메인 Renderer API
  ├── pipeline.ts           (~850줄)  4개 GPURenderPipeline (opaque/selection/transparent/overlay)
  ├── scene.ts              (~600줄)  색상별 배칭 (200K+ → 50-200 draw calls)
  ├── camera.ts             (~490줄)  Reverse-Z, 듀얼 프로젝션
  ├── picker.ts             (~300줄)  GPU 피킹 (r32uint) + CPU 폴백
  ├── geometry-manager.ts   (~300줄)  지오메트리 배칭/업로드
  ├── post-processor.ts     (~500줄)  Contact shading, separation lines
  ├── device.ts             (~150줄)  WebGPU 디바이스 관리
  ├── zero-copy-uploader.ts (~100줄)  WASM → GPU zero-copy
  └── shaders/main.wgsl.ts  (~240줄)  PBR WGSL 셰이더
```

ifc-ln이 향후 ifc-lite 수준의 성능이 필요하면 커스텀 렌더러로 마이그레이션 가능하나, 현재 Three.js `WebGPURenderer`로 충분한 성능 개선 기대.
