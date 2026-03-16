# ifc-ln

C++ WASM([web-ifc](https://github.com/IFCjs/web-ifc)) 기반 IFC 뷰어. IFC 파일을 브라우저에서 직접 파싱·렌더링하며, 공간 구조 탐색 및 속성 조회를 지원한다.

## 기술 스택

### Core

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | TypeScript (strict) | ^5.3 |
| 프레임워크 | React | ^18.2 |
| 빌드 | Vite | ^5.0 |
| 패키지 매니저 | pnpm | 10.8.1 |

### 3D 렌더링

| 항목 | 기술 | 버전 |
|------|------|------|
| 렌더링 엔진 | Three.js | ^0.183 |
| 공간 인덱싱 | three-mesh-bvh | ^0.9.9 |

### IFC 처리

| 항목 | 기술 | 버전 |
|------|------|------|
| IFC 파서 | web-ifc (C++ → WASM) | ^0.0.77 |

### 상태관리 & UI

| 항목 | 기술 | 버전 |
|------|------|------|
| 상태관리 | Zustand (슬라이스 패턴) | ^4.5 |
| 아이콘 | lucide-react | ^0.577 |
| 레이아웃 | react-resizable-panels | ^4.7 |

## 프로젝트 구조

```
src/
├── main.tsx                         # 엔트리포인트
├── App.tsx                          # 루트 컴포넌트
├── globals.css
├── components/
│   ├── ui/
│   │   └── Toast.tsx
│   └── viewer/
│       ├── ViewerLayout.tsx         # 메인 레이아웃 (리사이즈 패널)
│       ├── ViewportContainer.tsx    # 뷰포트 컨테이너
│       ├── ViewportScene.tsx        # Three.js 씬 관리
│       ├── ViewportOverlays.tsx     # 뷰포트 오버레이
│       ├── MainToolbar.tsx          # 상단 툴바
│       ├── StatusBar.tsx            # 하단 상태바
│       ├── HierarchyPanel.tsx       # 공간 구조 트리 패널
│       ├── PropertiesPanel.tsx      # 속성 조회 패널
│       ├── ContextMenu.tsx          # 우클릭 컨텍스트 메뉴
│       ├── HoverTooltip.tsx         # 호버 툴팁
│       ├── AxisHelper.tsx           # 축 표시기
│       ├── ViewCube.tsx             # 뷰 큐브
│       ├── ThemeSwitch.tsx          # 테마 전환
│       ├── KeyboardShortcutsDialog.tsx
│       ├── hierarchy/
│       │   └── useHierarchyPanelData.ts
│       └── properties/
│           └── usePropertiesPanelData.ts
├── hooks/
│   ├── useWebIfc.ts                 # web-ifc Worker 연동
│   ├── useWebIfcPropertySync.ts     # 속성 동기화
│   └── useKeyboardShortcuts.ts      # 키보드 단축키
├── services/
│   ├── IfcWorkerClient.ts           # Worker 메시지 RPC 클라이언트
│   └── viewportGeometryStore.ts     # 청크 기반 지오메트리 외부 스토어
├── stores/
│   ├── index.ts                     # Zustand 스토어 (슬라이스 합성)
│   └── slices/
│       ├── dataSlice.ts             # IFC 데이터 (공간트리, 타입트리)
│       ├── loadingSlice.ts          # 로딩 상태
│       ├── selectionSlice.ts        # 요소 선택
│       ├── uiSlice.ts              # UI 상태 (패널, 테마)
│       └── visibilitySlice.ts       # 요소 가시성
├── types/
│   └── worker-messages.ts           # Worker 메시지 타입 정의
├── utils/
│   ├── ifc-class.ts                 # IFC 클래스 유틸
│   └── screenshot.ts               # 스크린샷
└── workers/
    └── ifc.worker.ts                # IFC 파싱/지오메트리 추출 Worker
```

## 아키텍처 특징

- **Web Worker 분리** — IFC 파싱과 지오메트리 추출은 `ifc.worker.ts`에서 수행. `IfcWorkerClient`가 요청/응답을 Promise 기반 RPC로 래핑한다.
- **청크 렌더링** — Worker가 메시 데이터를 청크 단위로 분할 전송(`RenderManifest` → `RenderChunk`). `viewportGeometryStore`가 `useSyncExternalStore`로 청크 상태를 관리하여 점진적 로딩을 구현한다.
- **BVH 가속** — `three-mesh-bvh`를 활용한 레이캐스트 가속으로 대규모 모델에서도 빠른 피킹을 지원한다.
- **Zustand 슬라이스 패턴** — 스토어를 `data`, `loading`, `selection`, `ui`, `visibility` 5개 슬라이스로 분리하여 관심사를 격리한다.
- **경로 별칭** — `@/*` → `src/*` (tsconfig paths + Vite alias)

## 개발 명령어

```bash
pnpm dev          # 개발 서버 (port 3333)
pnpm build        # 타입 체크 + 프로덕션 빌드
pnpm typecheck    # 타입 체크만
pnpm preview      # 빌드 결과 미리보기
```

## 설정 요약

| 파일 | 내용 |
|------|------|
| `tsconfig.json` | `strict: true`, `target: ES2020`, `module: ESNext`, `moduleResolution: Bundler` |
| `vite.config.ts` | `web-ifc` optimizeDeps 제외, `@/` alias, Worker format `es` |
