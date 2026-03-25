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

| 순서 | 항목 | 축 | 영향도 | 난이도 |
|:----:|------|----|:------:|:------:|
| 1 | `web-ifc` 멀티스레드 WASM 활성화 | WASM | VERY HIGH | Medium |
| 2 | 프레임 버짓 기반 chunk attach | Three.js | VERY HIGH | Medium |
| 3 | BVH 비동기/worker 생성 | Three.js | VERY HIGH | Medium |
| 4 | edge 기본 경로 분리 | Three.js | HIGH | Low-Medium |
| 5 | FastNav | Three.js | HIGH | Low |

---

### Phase 2. 구조 최적화

| 순서 | 항목 | 축 | 영향도 | 난이도 |
|:----:|------|----|:------:|:------:|
| 6 | worker payload 슬림화 | WASM | HIGH | Medium |
| 7 | material pool + 조명 단순화 | Three.js | HIGH | Low |
| 8 | storey visibility | Three.js | MEDIUM-HIGH | Medium |
| 9 | geometry 양자화 | WASM/Three.js | MEDIUM-HIGH | Medium |

---

### Phase 3. 중기 투자

| 순서 | 항목 | 축 | 영향도 | 난이도 |
|:----:|------|----|:------:|:------:|
| 10 | BatchedMesh 전환 검토 | Three.js | MEDIUM-HIGH | Medium |
| 11 | WebGPU experimental backend | WebGPU | MEDIUM-HIGH | Medium-High |
| 12 | Pre-converted binary format | WASM | VERY HIGH | Medium-High |

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

- **COOP/COEP 헤더 설정** — 4.1(WASM MT)과 5.2(ParallelMeshBVHWorker) 모두에 필요

### Phase 1: 반드시 먼저 할 것

- `web-ifc` 멀티스레드 경로 열기 (프로파일링으로 효과 확인 후 유지/롤백)
- chunk attach budget
- BVH async화 (COOP/COEP 전이면 `GenerateMeshBVHWorker`, 후면 `ParallelMeshBVHWorker`)
- edge lazy화 (critical path에서 분리)
- FastNav (난이도 Low, 체감 효과 즉시)

### Phase 2: 구조 최적화

- material pool + 조명 단순화 (draw call 배칭 효율 향상)
- worker payload 슬림화
- storey visibility
- geometry 양자화

### Phase 3: 실험적으로 붙일 것

- WebGPU backend (feature flag 기반)
- BatchedMesh (Phase 1 완료 후 draw call이 실제 병목인지 확인 후 진입)
- Pre-converted binary format (서버 파이프라인 허용 여부에 따라 Phase 1로 승격 가능)

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
