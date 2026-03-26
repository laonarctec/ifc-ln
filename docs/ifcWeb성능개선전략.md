# IFC Web Viewer 성능 개선 전략

> 대상 프로젝트: `ifc-ln`
> 목표: 100MB+ IFC 파일에서도 초기 로드 시간, 첫 상호작용 시간, 카메라 이동 체감 FPS를 동시에 개선
> 재정리 기준일: 2026-03-25

---

## 1. 문서 목적

이 문서는 일반적인 Three.js 최적화 목록이 아니라, **현재 `ifc-ln` 코드 경로에서 실제로 비용이 큰 지점**을 기준으로 우선순위를 재정렬한 문서다.

성능 전략은 다음 **세 축**으로 나눈다.

1. **WASM / `web-ifc` 축**
   IFC 파싱, render cache 생성, geometry 추출, worker 구조
2. **Three.js / WebGL 축**
   청크 attach 비용, BVH 생성, draw call, material/light, edge 렌더링
3. **WebGPU 축**
   중장기 렌더링 경로 전환 가능성, 적용 리스크, 기대효과

이 프로젝트에서 성능을 크게 끌어올리려면, 먼저 **WASM + 메인 스레드 ingest 비용**을 줄여야 한다. `BatchedMesh`, `LOD`, `WebGPU`는 중요하지만, 현재 시점의 **즉효 카드**는 아니다.

---

## 2. 핵심 결론

### P0 결론

- **`web-ifc` 멀티스레드 WASM 활성화**가 가장 먼저 검토되어야 한다.
- **청크를 메인 스레드에 붙이는 순간의 비용**을 줄이는 것이 현재 Three.js 축의 최우선 과제다.
- **BVH 생성은 메인 스레드 즉시 실행이 아니라 worker/parallel 생성**으로 옮기는 것이 맞다.
- **edge 렌더링은 기본 경로에서 분리**해야 한다.
- **WebGPU는 검토 가치가 충분하지만 기본 렌더러 전환은 아직 P0가 아니다.**

### 한 줄 요약

현재 `ifc-ln`은 "렌더링이 느린 앱"이라기보다,  
**WASM 파싱 이후 메인 스레드에서 geometry/BVH/material/edge를 다시 만들면서 느려지는 앱**에 더 가깝다.

---

## 3. 현재 구조에서 실제 비용이 큰 경로

현재 로딩 경로는 대략 다음과 같다.

```text
파일 읽기
  -> web-ifc worker 초기화
  -> OpenModel
  -> buildRenderCache
  -> visible chunk 결정
  -> loadRenderChunks
  -> Main Thread에서 geometry 생성
  -> Main Thread에서 BVH 생성
  -> Main Thread에서 material / edge object 생성
  -> scene attach
```

### 현재 적용된 주요 최적화

| 영역 | 현재 상태 | 비고 |
|------|----------|------|
| Worker 오프로딩 | 적용 | IFC 파싱, geometry 추출, 속성 조회를 worker에서 수행 |
| Transferable Objects | 적용 | chunk mesh/edge payload 전달 |
| Chunk 기반 씬 관리 | 적용 | storey bucket + visible chunk residency |
| Dirty-flag 렌더링 | 적용 | 변경 시에만 draw |
| BVH Raycast | 적용 | `three-mesh-bvh` 기반 |
| GPU Instancing | 부분 적용 | 동일 geometry 반복 시 `InstancedMesh` 사용 |
| Frustum 기반 chunk 로딩 | 적용 | manifest 기준 visible chunk 계산 |

### 현재 구조에서 비용이 큰 지점

| 구간 | 현재 위치 | 왜 비싼가 | 비고 |
|------|----------|-----------|------|
| `web-ifc` 초기화 | `workerContext.ts` | 현재 single-thread 강제 | 프로파일링으로 실제 병목 비중 확인 필요 |
| render cache 생성 | `geometryHandler.ts` | IFC 전체 mesh 순회 + chunk 구성 | |
| chunk attach | `useChunkSceneGraph.ts` | chunk가 준비되면 바로 scene에 붙음 | |
| vertex 분해 | `geometryFactory.ts` | stride-6 → positions/normals 분리 | 단순 루프, 수만 vertex에서도 수 ms 수준. 자체 비용보다 후속 BVH가 주 비용 |
| **BVH 생성** | `geometryFactory.ts` | `computeBoundsTree()`를 메인 스레드 즉시 실행 | **chunk attach 구간에서 가장 비싼 단일 작업**. geometry 캐시 미적중 시마다 발생 |
| material 생성 | `meshManagement.ts` | chunk/mesh 단위로 `MeshPhongMaterial` 신규 생성 | JS 객체 생성 자체는 가벼움. 실제 비용은 첫 렌더 시 shader compile과 런타임 draw call 증가(GPU state switch) |
| edge 생성 | `meshManagement.ts` | `LineSegments`와 material을 다수 생성 | |

#### Geometry 캐시 적중률의 영향

`getOrCreateGeometry()`는 `geometryExpressId` 기준으로 캐시한다.
캐시 적중 시 BVH 재생성이 발생하지 않으므로, **적중률에 따라 chunk attach 비용이 크게 달라진다.**

- **적중률 높은 모델** (반복 요소 많음): BVH 비용 낮음, instancing 효율 높음
- **적중률 낮은 모델** (고유 형상 위주): mesh마다 BVH 신규 생성 → attach 시간 급증

Phase 0 계측 시 `geometryCache.size` 대비 총 mesh 수를 기록하여 적중률을 파악해야 한다.

---

## 4. 축 A: WASM / `web-ifc`

이 축은 **초기 로드 시간**과 **render cache 준비 시간**에 가장 직접적인 영향을 준다.

### 4.1 `web-ifc` 멀티스레드 WASM 활성화

**영향도: VERY HIGH (프로파일링 확인 조건부) | 구현 난이도: Medium**

현재 `ifc-ln`은 `api.Init(locator, true)`로 single-thread를 강제하고 있다.
`web-ifc@0.0.77`의 타입 정의에서 두 번째 파라미터는 `forceSingleThread?: boolean`으로 확인됨 (`web-ifc-api.d.ts:212`).

#### 현재 상태

- `workerContext.ts:26`에서 `forceSingleThread=true` 전달
- worker init 응답에서도 `singleThreaded: true` 고정
- 패키지에는 `web-ifc-mt.wasm`이 이미 포함되어 있음

#### 적용 시 필요한 조건

- `COOP/COEP` 헤더 설정으로 `crossOriginIsolated` 확보
- 브라우저 feature detect (`crossOriginIsolated`, `SharedArrayBuffer` 존재 여부)
- 멀티스레드 미지원 환경에서는 기존 single-thread fallback 유지

> **주의**: COOP/COEP는 5.2의 `ParallelMeshBVHWorker`에서도 필요하다.
> 두 항목이 **동일한 인프라 의존성**을 가지므로, COOP/COEP 설정을 Phase 1의
> 공통 선행 작업으로 묶어 처리하는 것이 효율적이다.

#### 권장 방향

```text
0. [공통] 배포 환경에 COOP/COEP 적용 (→ 4.1 + 5.2 동시 해제)
1. runtime에서 threads 지원 여부 확인
2. 지원 시 mt.wasm 사용
3. 미지원 시 기존 single-thread 유지
```

#### 주의: 영향도 검증 필요

멀티스레드 WASM이 가속하는 구간은 주로 `StreamAllMeshes` 내부의 C++ geometry extraction이다.
그러나 실제 병목이 여기인지, `buildRenderCache`의 JS 측 chunk 구성 로직인지는
**프로파일링 없이 단정할 수 없다.**

Phase 0 계측에서 `OpenModel` → `RENDER_CACHE_READY` 구간의 시간 분포를 먼저 확인하고,
WASM 내부 시간이 지배적인 경우에만 이 항목의 영향도가 VERY HIGH로 유지된다.

#### 판단

현재 문서 기준으로는 `Multi-Worker 병렬 처리`보다 이 항목이 먼저다.
직접 워커 풀을 새로 설계하기 전에, **이미 있는 멀티스레드 WASM 경로부터 열어야** 한다.

---

### 4.2 Worker payload 슬림화

**영향도: HIGH | 구현 난이도: Medium**

현재는 worker에서 raw mesh를 보관하고, chunk를 보낼 때 다시 복제하고, 메인에서 다시 geometry를 재구성한다.

#### 개선 방향

- vertex 포맷을 메인 스레드 친화적으로 정리해 전달
- geometry별 중복 payload 축소
- edge payload를 기본 chunk payload에서 분리
- 장기적으로는 양자화된 포맷으로 전달

#### 추천

- `positions` / `normals` / `indices` 분리 포맷을 worker에서 직접 생성
- edge는 별도 lazy request로 분리
- geometry 재사용률이 높은 경우 geometry dictionary + instance reference 형태 검토

---

### 4.3 Pre-converted Binary Format

**영향도: VERY HIGH | 구현 난이도: Medium-High**

브라우저에서 IFC를 직접 파싱하지 않고, 서버에서 사전 변환한 포맷을 로드하는 방식이다.

#### 효과

- `web-ifc` 파싱 시간 자체 제거
- 전송량 감소
- LOD/양자화/압축/streaming을 서버 파이프라인에서 통제 가능

#### 후보

| 포맷 | 장점 | 주의점 |
|------|------|--------|
| XKT | 강한 압축, geometry reuse 최적화 | xeokit 생태계 의존 |
| Fragments | BIM viewer 친화적, 빠른 로딩 | That Open 생태계 종속성 검토 필요 |
| glTF/GLB + Meshopt | 툴링 풍부 | IFC semantic 유지 전략 필요 |

#### 전제 조건과 판단

이 항목의 우선순위는 **프로젝트의 서버 인프라 허용 여부**에 따라 크게 달라진다.

| 조건 | 판단 |
|------|------|
| 서버 파이프라인 구축 가능 + IFC 편집 불필요 | **Phase 1로 승격** — 가장 강력한 카드 |
| 서버 가능 + IFC 편집 필요 | Phase 3 유지 — 원본 IFC 보존 + 변환 포맷 dual 운영 설계 필요 |
| 순수 클라이언트 앱 (서버 없음) | **제외** — IndexedDB 캐시 등 대안 검토만 |

현재 `ifc-ln`은 브라우저에서 직접 IFC를 로드/편집/저장하는 구조이므로 Phase 3에 배치했다.
서버 파이프라인이 허용되는 시점에서 재평가한다.

---

### 4.4 지금 당장 우선순위가 낮은 WASM 항목

| 항목 | 판단 |
|------|------|
| `memory64` | 현재 병목과 직접 관련 낮음 |
| Wasm GC | `web-ifc` 경로에 직접적인 ROI 낮음 |
| Component Model | 현 프로젝트에 실질 효과 거의 없음 |
| JSPI | 현재 구조상 우선도 낮음 |

---

## 5. 축 B: Three.js / WebGL

이 축은 **메인 스레드 스터터링**, **카메라 이동 체감 FPS**, **scene attach 비용**에 가장 큰 영향을 준다.

### 5.1 프레임 버짓 기반 chunk attach

**영향도: VERY HIGH | 구현 난이도: Medium**

현재는 필요한 chunk가 준비되면 scene에 즉시 올라간다.  
대형 모델에서 여러 chunk가 한 번에 attach되면 메인 스레드가 순간적으로 길게 점유된다.

#### 권장 방향

- `pendingChunkQueue` 도입
- 프레임당 attach 예산 설정
- geometry 생성, mesh 생성, edge 생성도 단계적으로 분할

```typescript
const FRAME_BUDGET_MS = 4;
```

#### 기대 효과

- 로딩 중 카메라 조작 스터터링 감소
- 첫 상호작용 체감 개선
- "chunk 준비 완료"와 "scene attach 완료"를 분리 가능

---

### 5.2 BVH 생성 비동기화

**영향도: VERY HIGH | 구현 난이도: Medium**

현재 `computeBoundsTree()`는 geometry 생성 직후 메인 스레드에서 실행된다.

이 프로젝트는 이미 `three-mesh-bvh@0.9.9`를 사용 중이며, 해당 버전은 worker 기반 BVH 생성기를 제공한다.

#### 권장 방향

- 초기 attach 시 BVH 없이 mesh를 먼저 scene에 올림
- idle 시점 또는 background worker에서 BVH 생성
- selection/hover가 필요한 geometry만 우선 BVH 부여

#### 추가 선택지 (현재 패키지에서 확인됨)

- `GenerateMeshBVHWorker` — 단일 worker로 비동기 BVH 생성. `SharedArrayBuffer` 불필요.
  (`node_modules/three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js` 에 존재)
- `ParallelMeshBVHWorker` — 다중 worker로 BVH 병렬 생성. **`SharedArrayBuffer` 필수.**
  (`node_modules/three-mesh-bvh/src/workers/ParallelMeshBVHWorker.js` 에 존재)

> **COOP/COEP 의존성**: `ParallelMeshBVHWorker`를 쓰려면 4.1과 동일하게
> `crossOriginIsolated` 환경이 필요하다. `GenerateMeshBVHWorker`는
> COOP/COEP 없이도 사용 가능하므로, 인프라 준비 전이라면 이쪽부터 적용한다.

#### 기대 효과

- chunk attach latency 감소 (BVH가 attach 경로에서 빠짐)
- 첫 렌더와 첫 상호작용 사이 공백 축소
- BVH 미생성 상태에서도 렌더링은 정상 동작 (raycast만 불가)

---

### 5.3 Edge 렌더링 기본 경로 분리

**영향도: HIGH | 구현 난이도: Low-Medium**

현재 edge는 chunk payload에 포함되고, attach 시점에 `LineSegments`가 같이 생성된다.

#### 문제

- 초기 로드 비용 증가
- draw call 증가
- 이동 중 불필요한 시각 비용 발생

#### UX 트레이드오프

BIM 뷰어에서 edge는 **형상 가독성의 핵심**이다. AutoCAD, Revit, Navisworks 등
주요 BIM 도구들은 edge가 기본 on이다.
단순히 "기본값 off"로 바꾸면 사용자가 형상 구분이 어려워지는 부작용이 있다.

#### 권장 방향 (단계적)

- **Phase A**: edge payload를 chunk 기본 응답에서 분리 (`LOAD_EDGE_CHUNKS` 별도 경로)
  → edge on 상태라도 로딩 시점만 지연, UX 변화 없음
- **Phase B**: 대형 모델(threshold 이상)에서 가까운 chunk만 edge 표시, 먼 chunk는 edge 생략
  → "거리 기반 edge LOD"로 가독성과 성능을 동시 확보
- **Phase C**: FastNav 중에는 edge 강제 off, 정지 후 복원
- **Phase D**: 사용자 설정으로 edge 기본값 선택 제공

> "edge를 끈다"가 아니라 "edge 로딩을 critical path에서 빼고 lazy로 옮긴다"가 핵심.

---

### 5.4 Material / Lighting 단순화

**영향도: HIGH | 구현 난이도: Low**

현재는 `MeshPhongMaterial`과 다중 directional light를 사용한다.

BIM 뷰어는 포토리얼리즘보다 **가독성 + 대규모 장면 처리량**이 중요하므로 더 단순한 셰이딩이 더 적합할 수 있다.

#### 권장 방향

- `MeshPhongMaterial` -> `MeshLambertMaterial` 또는 `MeshStandardMaterial` 저비용 세팅 비교
- directional light 수 축소
- material pool 적용
- selection/hover는 material clone보다 emissive/vertex color 기반 우선

#### 비용 구분

material 관련 비용은 두 단계로 나뉘며 혼동하면 안 된다.

1. **attach 시점**: `new MeshPhongMaterial()` → JS 객체 생성만 발생, 자체 비용 낮음
2. **첫 렌더 시점**: Three.js가 shader를 컴파일. 다만 동일 material 타입(Phong)은
   program이 캐시되므로, material 인스턴스가 100개여도 **shader compile은 1회**

material 수의 진짜 런타임 비용은 **draw call 증가 → GPU state switch 증가**이며,
이것은 attach 축이 아니라 **렌더링 축**의 문제다.

#### 판단

현재 문서의 `Material 공유 풀`은 유효하지만,
이 프로젝트에선 **material pool + light 단순화**를 같이 봐야 한다.
material pool의 1차 목표는 draw call 배칭 효율 향상이지, attach 시간 단축이 아니다.

---

### 5.5 FastNav 적응형 품질

**영향도: HIGH | 구현 난이도: Low**

이 항목은 여전히 ROI가 높다.

#### 이동 중 적용 후보

- pixel ratio 50~70%
- edge off
- hover/raycast 빈도 축소
- selection outline/강조 표현 완화

#### 판단

적용 비용 대비 체감 효과가 크므로 P0~P1 사이에 넣어도 된다.

---

### 5.6 BatchedMesh

**영향도: MEDIUM-HIGH | 구현 난이도: Medium**

`InstancedMesh`보다 넓은 배칭 범위를 제공하지만,  
현재 `ifc-ln`의 1차 병목은 draw call보다 **attach/BVH/edge 비용** 쪽이 더 크다.

#### 판단

- 장기적으로 유효
- 그러나 지금은 `P1` 또는 `P2`
- `geometry attach 비용`을 줄인 뒤 들어가야 효과 측정이 명확함

---

### 5.7 LOD / Storey Visibility / Occlusion

**영향도: MEDIUM-HIGH | 구현 난이도: Medium-High**

#### 추천 순서

1. storey visibility
2. IFC type 기반 간이 LOD
3. distance LOD
4. full occlusion / Hi-Z

#### 판단

`ifc-ln`은 이미 storey 정보와 chunk 구조가 있으므로,  
**간이 occlusion으로서 storey visibility**가 full Hi-Z보다 훨씬 현실적이다.

---

### 5.8 지금 당장 우선순위가 낮은 Three.js 항목

| 항목 | 판단 |
|------|------|
| Full Hi-Z occlusion | 구현비가 너무 큼 |
| OffscreenCanvas 렌더러 이전 | 리팩토링 범위 큼 |
| Texture atlas | 현재 BIM 단색 재질 비중상 우선도 낮음 |

---

## 6. 축 C: WebGPU

### 6.1 최신 현황

- Three.js는 `WebGPURenderer`를 제공하며 `three/webgpu` import 경로를 지원한다.
- Three.js 공식 가이드는 WebGPU 미지원 환경에서 **WebGL2 fallback**이 가능하다고 설명한다.
- WebKit은 **2025-09-15 Safari 26.0**에서 WebGPU shipping을 발표했다.
- 다만 MDN은 **2026-01-13 기준** 여전히 WebGPU를 `Limited availability`, `not Baseline`, `secure context only`로 분류한다.

즉, **지원은 빠르게 좋아지고 있지만 기본값 전환은 아직 보수적으로 봐야 한다.**

---

### 6.2 `ifc-ln`에 WebGPU가 맞는 이유

#### 유리한 점

- `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile`, `EffectComposer` 의존이 현재 거의 없음
- 장면이 비교적 전통적인 mesh/light/material 구조
- 장기적으로 GPU-side culling, compute 기반 전처리 확장 여지가 큼

#### 기대 가능한 효과

- 대형 장면 steady-state 렌더링 성능 개선 가능성
- modern GPU backend 활용
- 차후 compute 기반 visibility/culling 실험 기반 확보

---

### 6.3 그런데 왜 P0는 아닌가

#### 이유 1: 현재 병목이 WebGPU만으로 해결되지 않음

- `web-ifc` 파싱
- chunk attach
- geometry 재구성
- BVH 생성

이 네 가지는 renderer만 바꿔도 그대로 남는다.

#### 이유 2: 현재 코드에서 구조 변경이 필요함

- `WebGLRenderer` 타입 고정 참조 다수
- cleanup에서 `forceContextLoss()` 사용
- 렌더 루프가 `requestAnimationFrame` 직접 관리
- WebGPU 경로는 `await renderer.init()` 또는 `setAnimationLoop()` 고려 필요

#### 이유 3: 브라우저 커버리지

프로덕션 기본 경로로 쓰기엔 아직 브라우저 편차를 고려해야 한다.

---

### 6.4 권장 전략

**결론: 전면 전환이 아니라 실험형 backend로 도입**

#### 추천 방식

```text
1. renderer 추상화 계층 추가
2. feature flag로 WebGPU backend 선택 가능하게 구현
3. WebGPU 미지원 시 자동 fallback
4. 동일 모델에서 WebGL / WebGPU A/B 비교
5. 결과가 확실할 때만 기본값 승격 검토
```

#### 도입 시 체크리스트

- `three` import를 `three/webgpu` 경로로 분리할지 검토
- renderer 공통 인터페이스 정리
- `await renderer.init()` 반영
- `forceContextLoss()` 제거 또는 분기 처리
- screenshot / input / resize 코드가 공통 renderer API만 쓰도록 정리

---

### 6.5 WebGPU 적용 판단

| 질문 | 판단 |
|------|------|
| 지금 당장 기본 렌더러로 바꿔야 하나? | 아니오 |
| 실험 브랜치로 붙여볼 가치가 있나? | 예 |
| 장기적으로 가치가 큰가? | 예 |
| 현 시점 P0인가? | 아니오 |

---

## 7. 권장 구현 순서

### Phase 0. 계측 먼저

반드시 아래 지표를 기록한 뒤 비교한다.

#### 계측 지표

| 지표 | 측정 방법 |
|------|----------|
| 파일 선택 → `MODEL_LOADED` | `performance.now()` 구간 측정 |
| `MODEL_LOADED` → `RENDER_CACHE_READY` | worker 메시지 타이밍 |
| 첫 chunk attach 완료 시간 | scene에 첫 chunk가 올라간 시점 |
| 첫 selection 가능 시간 | BVH 생성 완료 후 raycast 가능 시점 |
| 카메라 이동 중 평균 FPS | `useRenderLoop`의 기존 FPS 카운터 활용 |
| visible chunk 전환 시 long task | Performance API `longtask` 또는 `performance.measure()` |
| geometry 캐시 적중률 | `geometryCache.size` / 총 mesh 수 |

#### 수용 기준 (100MB IFC 기준, 조정 가능)

| 지표 | 목표 |
|------|------|
| 첫 렌더까지 시간 | 15초 이내 |
| 첫 selection 가능 시간 | 20초 이내 |
| 카메라 이동 중 FPS | 최소 30fps (p5 기준) |
| chunk 전환 시 long task | 50ms 초과 발생 0건 |
| 로딩 중 UI 응답성 | 입력 지연 100ms 이내 |

> 수용 기준은 실제 테스트 모델로 baseline 측정 후 조정한다.
> Phase 1 완료 시점에서 baseline 대비 개선 폭이 목표에 미달하면
> Phase 2 진입 전에 원인을 분석하고 Phase 1을 보강한다.

---

### Phase 1. 즉효 구간

| 순서 | 항목 | 축 | 영향도 | 난이도 | 상태 |
|:----:|------|----|:------:|:------:|:----:|
| 1 | `web-ifc` 멀티스레드 WASM 활성화 | WASM | VERY HIGH | Medium | **Phase 3 이동** |
| 2 | 프레임 버짓 기반 chunk attach | Three.js | VERY HIGH | Medium | **완료** |
| 3 | BVH 비동기/worker 생성 | Three.js | VERY HIGH | Medium | **완료** |
| 4 | edge 기본 경로 분리 | Three.js | HIGH | Low-Medium | **완료** |
| 5 | FastNav | Three.js | HIGH | Low | **완료** |

#### Phase 1 구현 메모 (2026-03-25)

- **#1 Phase 3 이동**: web-ifc MT 모드가 내부 pthread worker를 스폰하는데, Vite dev server에서 이 worker 파일 경로를 해석하지 못함. Windows에서 "Cannot use import statement outside a module" 에러 연쇄 발생. COOP/COEP 헤더도 `credentialless`로는 `SharedArrayBuffer` 활성화가 불완전한 환경 존재. 상세 구현 전략은 Phase 3 구현 전략 섹션 참조.
- **#2 구현**: `useChunkSceneGraph.ts`에 `pendingChunksRef` + RAF 루프 도입. 6ms 예산 내에서 chunk를 1개씩 attach. chunk 제거는 여전히 즉시 실행.
- **#3 구현**: `bvhScheduler.ts` (신규) — `requestIdleCallback`으로 유휴 시간에 sync `computeBoundsTree()` 1개씩 실행. `GenerateMeshBVHWorker`는 Vite dev에서 내부 worker 번들링 실패하여 사용하지 않음. BVH 완료 시 re-render 트리거 제거 (BVH는 시각적 변화 없음, raycasting만 활성화).
- **#4 구현**: `useChunkSceneGraph.ts`에서 edge 데이터를 `pendingEdgeData`로 저장하고 `requestIdleCallback`으로 지연 생성. chunk attach 경로에서 `appendEdgesToGroup()` 호출 제거.
- **#5 구현**: `useThreeScene.ts`에서 OrbitControls `change` 이벤트 시 pixelRatio 50%로 감소 + edge 숨김. 200ms debounce 후 원래 품질 복원.

---

### Phase 2. 구조 최적화

| 순서 | 항목 | 축 | 영향도 | 난이도 | 상태 |
|:----:|------|----|:------:|:------:|:----:|
| 6 | worker payload 슬림화 | WASM | HIGH | Medium | **완료** |
| 7 | material pool + 조명 단순화 | Three.js | HIGH | Low | **완료** |
| 8 | storey visibility | Three.js | MEDIUM-HIGH | Medium | **완료** |
| 9 | geometry 양자화 | WASM/Three.js | MEDIUM-HIGH | Medium | **Phase 3 이동** |

#### Phase 2 구현 메모 (2026-03-25)

- **#6 완료**:
  - `RENDER_CHUNKS` 응답에서 edge 데이터 제거. `LOAD_EDGE_CHUNKS` / `EDGE_CHUNKS` 요청/응답 타입 신규 추가.
  - `cloneEdgePayload()` (ifcGeometryUtils.ts) — edge + meshRef만 포함하는 경량 payload.
  - `handleLoadEdgeChunks()` (geometryHandler.ts) — 별도 edge 전송 핸들러.
  - `loadEdgeChunks()` (IfcWorkerClient.ts) — 클라이언트 메서드 추가.
  - `useChunkSceneGraph.ts` — mesh attach 완료 후 edge를 비동기 요청. 응답 후 `requestIdleCallback`으로 지연 생성.
  - `EdgeMeshRef` 타입 도입 — edge 위치 지정에 필요한 최소 필드만 포함 (expressId, modelId, geometryExpressId, transform).
- **#7 완료**:
  - `materialPool.ts` (신규) — 색상+투명도 키 기반 `MeshPhongMaterial` / `LineBasicMaterial` 풀링. 동일 파라미터의 material을 chunk 간 공유.
  - 단일 Mesh는 selection 시 `material.color`를 직접 변경하므로 pool에서 clone하여 사용. InstancedMesh와 Edge material은 pool에서 직접 공유 (per-instance color 또는 변경 불필요).
  - chunk 제거 시 cloned material만 dispose, pooled material은 `disposeMaterialPool()`로 scene teardown 시 일괄 정리.
  - 조명 4개 → 3개: fill + rim DirectionalLight를 1개로 합침. position `(-0.3, 0.25, -0.7)`, intensity `0.6`.
- **#8 완료**:
  - `useAutoStoreyTracking.ts` (신규) — 카메라 orbit target의 Y좌표로 가장 가까운 storey를 500ms 간격 추론.
  - `uiSlice.ts`에 `autoStoreyTracking` 상태 + `toggleAutoStoreyTracking()` 추가. 기본값 `false` (수동 활성화 필요).
  - 카메라 거리가 모델 높이의 2배 이상이면 자동으로 storey 필터 해제 (전체 뷰).
  - 비활성화 시 storey 필터를 자동 해제하여 전체 모델 표시 복원.
- **#9 보류 사유**: Int16 양자화는 shader 변경 + vertex 파이프라인 전체 수정 필요. 메모리 33% 절감 가능하나 Phase 2 범위로는 과도. Phase 3 이후 검토.

---

### Phase 3. 중기 투자

| 순서 | 항목 | 축 | 영향도 | 난이도 | 상태 |
|:----:|------|----|:------:|:------:|:----:|
| 1-r | `web-ifc` 멀티스레드 WASM 활성화 | WASM | VERY HIGH | Medium | **완료** |
| 9 | geometry 양자화 (Float32→Int16) | WASM/Three.js | MEDIUM-HIGH | Medium | **Phase 2에서 이동** |
| 10 | BatchedMesh 전환 | Three.js | MEDIUM-HIGH | Medium | **완료** |
| 11 | WebGPU experimental backend | WebGPU | MEDIUM-HIGH | Medium-High | |
| 12 | Pre-converted binary format (.ifcb) | WASM | VERY HIGH | Medium-High | **완료** |

#### Phase 3 구현 메모 (2026-03-26)

- **#1-r 완료**:
  - `vite.config.ts` — COOP/COEP 헤더 활성화 (`same-origin` + `require-corp`). preview 설정도 동일 적용.
  - `vite.config.ts` — `web-ifc-iife` alias 추가 (package.json exports에 미포함된 IIFE 빌드 참조용).
  - `workerContext.ts` 전면 재작성:
    - `canAttemptMT()` — `crossOriginIsolated` + `SharedArrayBuffer` 런타임 검사.
    - `createPthreadBlobUrl()` — IIFE를 `importScripts()`로 로드하는 Blob URL 생성. IIFE 모듈 레벨의 `isPthread && WebIFCWasm2()` auto-invocation이 pthread 프로토콜 셋업.
    - `patchWorkerForPthreads()` — Worker 생성자 패치. `{ name: "em-pthread" }` worker만 Blob URL로 리다이렉트, 나머지는 기존 경로 유지.
    - `ensureApi()` — canAttemptMT() 통과 시 Worker 패치 → `api.Init(locateFile, false)` → finally에서 패치 복원. 실패 시 에러 전파 (WebIFCWasm 모듈 레벨 캐싱으로 MT→ST 전환 불가).
    - `isSingleThreaded()` — 런타임 상태 반환 (하드코딩 `true` 제거).
    - `locateFile()` — `web-ifc-mt.wasm` / `web-ifc.wasm` 모두 처리.
  - COOP/COEP 미설정 환경에서는 기존과 동일하게 ST fallback.
- **#10 완료**:
  - `appendMeshesToGroup()` (meshManagement.ts) — Opaque mesh를 chunk당 `BatchedMesh` 1개로 합침. draw call 대폭 감소.
  - Transparent mesh는 개별 `Mesh` 유지 (per-instance opacity 미지원).
  - `setEntryVisualState()` — BatchedMesh 경로 추가. `setVisibleAt()` / `setColorAt()`으로 per-instance selection/hiding.
  - `RenderEntry.geometryBounds` 필드 추가 — BatchedMesh에서 per-entry bounds 계산용.
  - `resolveHit()` (raycasting.ts) — `intersection.batchId`로 BatchedMesh instance → entity 매핑.
  - `pickEntitiesInBox()` — BatchedMesh `getBoundingBoxAt()` + `getVisibleAt()` 기반 box selection.
  - BVH는 개별 geometry 캐시에 유지 (transparent Mesh 및 향후 커스텀 raycast용).
  - `ChunkRenderGroup.batchedMeshes` 필드 추가, chunk 제거 시 `bm.dispose()` 호출.
- **#12 완료**:
  - `ifcbFormat.ts` (신규) — `.ifcb` 포맷 정의. JSON header (manifest, spatialTree, geometryDict, chunkInstances) + binary geometry blob.
  - `encodeIfcb()` — worker에서 RenderCache → .ifcb ArrayBuffer 직렬화.
  - `decodeIfcb()` — .ifcb 파일 파싱 (header JSON + blob 분리).
  - `loadChunksFromIfcb()` / `loadEdgeChunksFromIfcb()` — binary blob에서 chunk/edge 데이터 복원.
  - `handleExportIfcb()` (geometryHandler.ts) — worker 핸들러. geometry + edge + spatial tree를 .ifcb로 내보내기.
  - `useWebIfc.loadFile()` — `.ifcb` 확장자 자동 감지. web-ifc 초기화 없이 즉시 로드.
  - `useChunkResidency` / `useChunkSceneGraph` — `viewportGeometryStore.getIfcbFile()` 확인 후 IFCB 경로 분기.
  - Export 메뉴에 "Pre-converted Binary (IFCB)" 항목 추가.
- **#9 보류 사유 (Phase 2에서 이동)**:
  - 현재 vertex는 Float32 stride-6 (`x,y,z,nx,ny,nz`). Int16 양자화 시 메모리 ~33% 절감 가능.
  - **shader 변경 필수**: Int16 vertex를 GPU에서 dequantize하는 커스텀 `ShaderMaterial` 또는 `onBeforeCompile` 패치 필요.
    `MeshPhongMaterial`의 기본 vertex shader는 Float position/normal만 처리하므로 직접 수정해야 함.
  - **vertex 파이프라인 전체 수정**: worker 인코딩(Float32→Int16 + bounding box 기반 quantization factor) →
    main 디코딩(attribute 타입 변경) → Three.js `BufferAttribute(Int16Array, 3, true)` 설정.
  - **BatchedMesh 호환성 검증 필요**: `addGeometry()`가 Int16 attribute를 올바르게 내부 버퍼에 복사하는지 확인.
  - **BVH, raycasting, edge extraction** 모두 양자화된 좌표 기준으로 재검증 필요.
  - Phase 2 시점에서는 attach 비용 감소가 급선무였으므로 범위 초과로 판단. BatchedMesh + IFCB 완료 후가 적절한 시점.

#### Phase 3 미완료 항목 구현 전략

##### #1-r. `web-ifc` 멀티스레드 WASM 활성화

> Phase 1에서 보류된 항목. 초기 IFC 파싱 시간을 가속하는 가장 직접적인 카드.

**문제 분석**

web-ifc MT 모드(`forceSingleThread=false`)는 Emscripten이 생성하는 pthread worker를 스폰한다.
내부적으로 `allocateUnusedWorker()`가 `_scriptName`(= 현재 실행 중인 JS 파일 URL)을 그대로
`new Worker(pthreadMainJs, { name: "em-pthread" })`에 전달한다.

문제가 되는 이유:

1. **Vite dev server**: ifc.worker.ts가 ESM으로 번들된다 (`worker.format: "es"`).
   web-ifc 내부가 이 ESM worker URL을 pthread worker에 넘기면, pthread worker가
   같은 ESM을 `importScripts()`로 로드하려 하여 `"Cannot use import statement outside a module"` 실패.
2. **COOP/COEP 요구**: `SharedArrayBuffer`가 필요하므로 `crossOriginIsolated === true`여야 한다.
   `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` 조합이 필요하며,
   `credentialless` COEP는 일부 환경에서 `SharedArrayBuffer`를 활성화하지 못한다.
3. **외부 리소스 제약**: `require-corp` COEP를 적용하면 외부 CDN 리소스에 `Cross-Origin-Resource-Policy` 헤더가
   없으면 로드 실패. 현재 프로젝트의 외부 의존성(폰트, CDN 등)에 영향을 줄 수 있다.

**구현 단계**

```text
Step 1. COOP/COEP 인프라 구축
  ├─ vite.config.ts: dev server headers에 COOP/COEP 활성화
  │   headers: {
  │     "Cross-Origin-Opener-Policy": "same-origin",
  │     "Cross-Origin-Embedder-Policy": "require-corp",
  │   }
  ├─ production 배포 환경(Nginx/Cloudflare 등)에도 동일 헤더 적용
  └─ 외부 리소스 로드 실패 여부 검증, crossorigin 속성 추가

Step 2. web-ifc pthread worker 번들링 해결
  ├─ 방법 A: Module["mainScriptUrlOrBlob"]에 Blob 전달
  │   web-ifc-api.js의 `allocateUnusedWorker()`는 `Module["mainScriptUrlOrBlob"]`이
  │   설정되면 _scriptName 대신 이 값을 사용한다.
  │   → workerContext.ts에서 web-ifc-api.js를 `?url` import로 가져와
  │     fetch → Blob → URL.createObjectURL()로 변환 후 Module에 주입.
  ├─ 방법 B: Vite 플러그인으로 web-ifc 내부 worker를 별도 chunk로 추출
  │   vite-plugin-wasm-pack 또는 커스텀 플러그인으로 web-ifc-api.js를
  │   non-ESM (IIFE) 형태로 별도 빌드하여 pthread가 importScripts()로 로드 가능하게 설정.
  └─ 방법 C: web-ifc-api-iife.js 사용
     web-ifc 패키지에 `web-ifc-api-iife.js`가 포함되어 있음. IIFE 빌드이므로
     pthread worker가 importScripts()로 로드 가능. 단, ESM import 대신
     dynamic import + globalThis 접근 방식으로 workerContext.ts를 수정해야 함.

Step 3. runtime feature detection + graceful fallback
  ├─ workerContext.ts의 ensureApi()에서:
  │   const canMT = typeof SharedArrayBuffer !== "undefined"
  │                 && (globalThis as any).crossOriginIsolated === true;
  │   api.Init(locator, !canMT);  // canMT이면 forceSingleThread=false
  ├─ MT 지원 시: web-ifc-mt.wasm 로드 (locator에서 분기)
  └─ MT 미지원 시: 기존 web-ifc.wasm 유지 (현재 동작 그대로)

Step 4. 검증
  ├─ Vite dev server에서 MT 모드 동작 확인 (SharedArrayBuffer 존재, worker 스폰 성공)
  ├─ production 빌드에서 동일 검증
  ├─ 성능 계측: OpenModel → RENDER_CACHE_READY 구간 ST vs MT 비교
  └─ MT 미지원 브라우저에서 graceful fallback 확인
```

**영향 범위**: `workerContext.ts`, `vite.config.ts`, 배포 환경 헤더 설정.
앱 로직(useChunkSceneGraph, meshManagement 등)은 변경 불필요.

**권장 진입 순서**: 방법 C (IIFE 빌드) → 실패 시 방법 A (Blob 주입) → 최후 수단 방법 B (Vite 플러그인).

---

##### #9. Geometry 양자화 (Float32 → Int16)

> 메모리 ~33% 절감 + transfer 속도 향상. Phase 2에서 범위 초과로 이동.

**현재 상태**

- vertex: `Float32Array` stride-6 (`x,y,z,nx,ny,nz`)
- `createRenderableGeometry()` (geometryFactory.ts)에서 positions/normals를 `Float32` `BufferAttribute`로 분리
- worker에서 `TransferableMeshData.vertices`로 전달, main에서 재구성
- edge extractor도 Float32 position 기준으로 동작

**양자화 전략: Position은 Int16 + 스케일, Normal은 Oct16**

Position 양자화:
- geometry별 AABB를 기준으로 `[min, max]` → `[-32767, 32767]` 범위로 매핑
- quantization factor = `(max - min) / 65534`
- Int16Array로 인코딩, GPU에서 `attribute * scale + offset`으로 복원
- Three.js `BufferAttribute(Int16Array, 3, false)` + `onBeforeCompile`에서 dequantize uniform 주입

Normal 양자화:
- Octahedral encoding: unit normal (3 float) → 2 Int16 (oct16)
- GPU에서 oct16 → vec3 복원 (vertex shader에서 간단한 수학)
- vertex attribute 3 float → 2 int16으로 축소 (50% 절감)

**구현 단계**

```text
Step 1. Worker 측 인코딩
  ├─ ifcGeometryUtils.ts에 quantizeGeometry() 함수 추가:
  │   입력: Float32 vertices (stride-6), geometry AABB
  │   출력: { positions: Int16Array, normals: Int16Array,
  │           posScale: [sx, sy, sz], posOffset: [ox, oy, oz] }
  ├─ TransferableMeshData 타입 확장:
  │   quantizedPositions?: Int16Array
  │   quantizedNormals?: Int16Array
  │   quantizationParams?: { posScale: number[], posOffset: number[] }
  └─ buildRenderCache에서 양자화 수행, 원본 Float32도 보관 (edge extractor용)

Step 2. Main 측 디코딩 (geometryFactory.ts)
  ├─ createRenderableGeometry() 분기:
  │   quantized data 있으면 → Int16 attribute 사용
  │   없으면 → 기존 Float32 경로 유지 (backward compat)
  ├─ geometry.setAttribute("position", new BufferAttribute(int16Positions, 3, false))
  └─ geometry.userData에 quantizationParams 저장

Step 3. Shader 수정
  ├─ materialPool.ts의 MeshPhongMaterial에 onBeforeCompile 추가:
  │   uniform vec3 u_posScale, u_posOffset;
  │   position = position * u_posScale + u_posOffset; (vertex shader 삽입)
  ├─ oct16 normal → vec3 변환도 vertex shader에서 수행
  └─ BatchedMesh 호환: BatchedMesh가 onBeforeCompile material을 공유하므로
     per-geometry quantization params를 uniform이 아닌 다른 방식으로 전달해야 함
     → 방법 1: geometry별 동일 AABB로 통일 (chunk 단위 quantization)
     → 방법 2: instance attribute로 scale/offset 전달

Step 4. Edge extractor 호환
  ├─ edge extractor는 원본 Float32 좌표가 필요 (dihedral angle 계산)
  ├─ worker 측에서 원본 Float32 유지 or quantized에서 역변환
  └─ IFCB 포맷에 양자화 파라미터 추가 (ifcbFormat.ts header 확장)

Step 5. BatchedMesh 호환 검증
  ├─ BatchedMesh.addGeometry()에 Int16 attribute geometry 전달 시 동작 확인
  ├─ 내부 merged buffer에 Int16이 올바르게 복사되는지 검증
  └─ 실패 시: BatchedMesh 전에 Float32로 임시 변환 후 addGeometry(), 메모리 절감은 transfer 구간에만 적용
```

**핵심 트레이드오프**: chunk 단위 quantization (모든 geometry가 chunk AABB 공유)이면
shader uniform 1벌로 충분하지만 precision이 떨어짐.
geometry 단위 quantization이면 precision 좋지만 per-instance uniform 관리가 복잡함.

**권장**: chunk 단위 quantization부터 시작. BIM 모델에서 chunk는 storey 기준이므로
한 chunk 내 좌표 범위가 크지 않아 Int16 precision으로 충분 (±3.2cm @ 100m span).

---

##### #11. WebGPU Experimental Backend

> 대형 장면 steady-state 렌더링 성능 개선. 기본값 전환이 아닌 실험형 도입.

**현재 상태**

- `THREE.WebGLRenderer` 고정 사용 (`useThreeScene.ts`)
- `forceContextLoss()`, `setPixelRatio()`, `setSize()` 등 WebGL 전용 API 호출
- `ShaderMaterial`, `RawShaderMaterial`, `EffectComposer` 미사용 → WebGPU 전환 장벽 낮음
- `MeshPhongMaterial` + `LineBasicMaterial` + `MeshBasicMaterial` 사용 → WebGPU 호환
- Three.js 0.183.2는 `WebGPURenderer` 지원 (`three/webgpu` import 경로)

**구현 단계**

```text
Step 1. Renderer 추상화 계층 (useThreeScene.ts)
  ├─ createRenderer() 팩토리 함수 도입:
  │   async function createRenderer(container, preferWebGPU):
  │     if (preferWebGPU && navigator.gpu) {
  │       const { WebGPURenderer } = await import("three/webgpu");
  │       const renderer = new WebGPURenderer({ antialias: true, ... });
  │       await renderer.init();  // WebGPU는 비동기 초기화 필요
  │       return renderer;
  │     }
  │     return new THREE.WebGLRenderer({ antialias: true, ... });
  ├─ 공통 인터페이스:
  │   setPixelRatio(), setSize(), render(), dispose()는 양쪽 동일
  │   forceContextLoss()는 WebGL 전용 → WebGPU에서는 no-op으로 처리
  └─ renderer 타입을 THREE.WebGLRenderer | WebGPURenderer union으로 변경

Step 2. Feature flag + UI 토글
  ├─ uiSlice.ts에 rendererBackend: "webgl" | "webgpu" 상태 추가
  ├─ 기본값: "webgl" (안정성 우선)
  ├─ 툴바 또는 설정에서 전환 가능 → scene 재생성 트리거
  └─ WebGPU 미지원 브라우저에서는 토글 비활성화 + 이유 표시

Step 3. WebGPU 전환 시 코드 분기
  ├─ forceContextLoss(): WebGPU에서는 호출하지 않음 (cleanup에서 분기)
  ├─ setAnimationLoop() vs requestAnimationFrame:
  │   WebGPURenderer는 setAnimationLoop()을 권장하지만
  │   현재 useRenderLoop.ts가 직접 RAF를 관리하므로 그대로 유지 가능.
  │   WebGPURenderer.render()는 RAF 내에서 호출해도 동작함.
  ├─ screenshot: renderer.domElement은 WebGPU에서도 canvas이므로 동일
  ├─ resize: setSize()는 동일
  └─ material: MeshPhongMaterial은 WebGPU에서 NodeMaterial로 자동 변환됨 (Three.js 내부)

Step 4. 성능 A/B 비교
  ├─ 동일 모델에서 WebGL / WebGPU steady-state FPS 비교
  ├─ chunk attach 시 GPU 비용 비교 (shader compile 차이)
  ├─ 대형 장면 (1000+ draw call) 시나리오에서 특히 중점 비교
  └─ 결과가 유의미하게 나올 때만 기본값 승격 검토

Step 5. 장기: compute 기반 확장
  ├─ WebGPU compute shader로 frustum culling → CPU 부하 경감
  ├─ GPU-driven rendering pipeline 실험 기반 확보
  └─ 이 단계는 Phase 4에 배치
```

**핵심 리스크**:
- Three.js WebGPURenderer가 아직 `experimental` 상태이며, 일부 기능 미구현 가능
- Safari 26.0(2025-09)부터 WebGPU shipping이나, 구형 브라우저 커버리지 고려 필요
- `BatchedMesh` + `WebGPURenderer` 조합의 안정성 검증 필요

**권장**: Step 1~2까지 먼저 구현하여 A/B 비교 인프라 확보.
성능 결과를 보고 Step 3~4 진입 여부 결정.

---

### Phase 4. 장기 과제

| 순서 | 항목 | 축 | 영향도 | 난이도 |
|:----:|------|----|:------:|:------:|
| 13 | type/storey 기반 LOD | Three.js | MEDIUM-HIGH | Medium |
| 14 | full occlusion / Hi-Z | Three.js/WebGPU | HIGH | Very High |
| 15 | compute 기반 GPU culling | WebGPU | HIGH | Very High |

---

## 8. 의사결정 요약

섹션 7의 Phase 테이블과 동일한 우선순위를 다른 관점에서 정리한 것이다.
모순이 발생하면 Phase 테이블이 정본이다.

### 공통 선행 작업

- **COOP/COEP 헤더 설정** — 4.1(WASM MT)과 5.2(ParallelMeshBVHWorker) 모두에 필요. 현재 보류 중.

### Phase 1: 완료 (2026-03-25)

- ~~`web-ifc` 멀티스레드 경로 열기~~ → **Phase 3 이동** (Vite dev worker 번들링 미해결, 상세 전략은 §7 Phase 3 참조)
- ~~chunk attach budget~~ → **완료** (`useChunkSceneGraph.ts`, 6ms RAF 루프)
- ~~BVH async화~~ → **완료** (`bvhScheduler.ts`, requestIdleCallback 기반 sync)
- ~~edge lazy화~~ → **완료** (`useChunkSceneGraph.ts`, pendingEdgeData + requestIdleCallback)
- ~~FastNav~~ → **완료** (`useThreeScene.ts`, pixelRatio 50% + edge 숨김)

### Phase 2: 완료 (2026-03-25)

- ~~worker payload 슬림화~~ → **완료** (edge 별도 요청 `LOAD_EDGE_CHUNKS`)
- ~~material pool + 조명 단순화~~ → **완료** (`materialPool.ts` 신규, 조명 4→3개)
- ~~storey visibility~~ → **완료** (`useAutoStoreyTracking.ts`, 카메라 높이 기반 자동 전환)
- ~~geometry 양자화~~ → **Phase 3 이동** (shader 변경 필요)

### Phase 3: 진행 중 (2026-03-26)

- ~~BatchedMesh~~ → **완료** (opaque → BatchedMesh 1개/chunk, transparent → 개별 Mesh)
- ~~Pre-converted binary format~~ → **완료** (`.ifcb` 포맷, 브라우저 내보내기/로드)
- ~~`web-ifc` 멀티스레드~~ → **완료** (Worker 생성자 패치 + IIFE Blob URL로 pthread 호환성 해결)
- geometry 양자화 (Float32→Int16) → **미착수** (Phase 2에서 이동. chunk 단위 quantization + onBeforeCompile 전략)
- WebGPU backend → **미착수** (renderer 추상화 + feature flag로 실험형 도입 예정)

### Phase 4: 장기 프로젝트

- type/storey 기반 LOD
- full occlusion / Hi-Z
- compute 기반 WebGPU culling

---

## 9. 참고 자료

### WebAssembly / `web-ifc`

- [That Open Engine `web-ifc` docs](https://thatopen.github.io/engine_web-ifc/docs/)
- [web.dev: Using WebAssembly threads from C, C++ and Rust](https://web.dev/articles/webassembly-threads)
- [web.dev: WebAssembly feature detection](https://web.dev/articles/webassembly-feature-detection)
- [MDN: WebAssembly `instantiateStreaming()`](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static)
- [WebAssembly.org: Wasm 3.0 Completed (2025-09-17)](https://webassembly.org/news/2025-09-17-wasm-3.0/)

### Three.js / Rendering

- [Three.js manual: Rendering on Demand](https://threejs.org/manual/en/rendering-on-demand.html)
- [Three.js docs: BatchedMesh](https://threejs.org/docs/pages/BatchedMesh.html)
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh)
- [Three.js manual: WebGPURenderer](https://threejs.org/manual/en/webgpurenderer)

### WebGPU

- [MDN: WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)

---

## 10. 최종 판단

`ifc-ln`의 성능을 크게 올리려면,  
우선순위는 **WASM 병렬화 -> 메인 스레드 attach 비용 제거 -> Three.js 렌더 비용 축소 -> WebGPU 실험** 순서로 가는 것이 맞다.

이 프로젝트에서 WebGPU는 중요한 축이지만,  
**지금 당장 성능을 가장 크게 올리는 첫 번째 카드가 아니라, 중기 투자 가치가 큰 세 번째 축**이다.
