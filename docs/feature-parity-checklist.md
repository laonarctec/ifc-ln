# ifc-lite → ifc-ln 기능 반영 체크리스트

## 개요

### 목적

이 문서는 `ifc-lite`의 모든 UI 기능을 영역별로 분류하고, `ifc-ln`에서의 현재 구현 상태를 체크리스트 형태로 정리한다.

- `ifc-ln`에서 어떤 기능이 구현되었고 어떤 기능이 빠져 있는지 한눈에 파악
- 다음 구현 우선순위를 결정하기 위한 근거 자료
- `roadmap.md`의 Phase 1~4 기반 진행과 보완적으로 활용

### 비교 기준

| 항목 | ifc-lite | ifc-ln |
|------|----------|--------|
| 아키텍처 | 모노레포 (24+ 패키지) | 단일 앱 |
| 3D 엔진 | Three.js + WebGPU 지원 | Three.js (WebGL) |
| IFC 파서 | 자체 WASM 파서 | web-ifc (C++ WASM) |
| 상태 관리 | Zustand | Zustand (5 slices) |
| UI 프레임워크 | React + Radix/Shadcn | React + Tailwind |
| 빌드 | Vite (모노레포) | Vite (단일) |
| 현재 단계 | Production | Phase 1 착수 직전 |

### 상태 표기

- ✅ **구현 완료** — 핵심 동작이 동작하는 상태
- 🟡 **부분 구현** — 기본은 있으나 ifc-lite 대비 부족
- ❌ **미구현** — 아직 구현되지 않음
- ➖ **해당 없음** — ifc-ln 범위 밖이거나 의도적으로 제외

### 현재 진행 기준

이 문서는 `roadmap.md`와 1:1로 연결되는 실행 체크리스트로 사용한다.

| roadmap Phase | 체크리스트 항목 | 설명 |
|------|------|------|
| Phase 1.1 키보드 단축키 | `4.10`, `16.6` | 단축키 + 다이얼로그 |
| Phase 1.2 호버 툴팁 | `16.5` | 엔티티 hover 정보 표시 |
| Phase 1.3 컨텍스트 메뉴 | `16.4` | 우클릭 메뉴 |
| Phase 1.4 테마 전환 | `4.11`, `16.7` | 다크/라이트 테마 |
| Phase 1.5 토스트 알림 | `16.10` | 피드백 알림 |
| Phase 1.6 스크린샷 | — | 뷰포트 캡처 |
| Phase 2.1 도구 시스템 | `4.9` | Select/Measure/Section 모드 전환 |
| Phase 2.2 단면 | `6.7`~`6.10` | clipping plane, section box |
| Phase 2.3 측정 | `6.1`~`6.6` | 거리/면적/각도 측정 |
| Phase 2.5 커맨드 팔레트 | `16.1` | Ctrl+K 명령 실행 |
| Phase 3.1 내보내기 | `14.2`~`14.7` | glTF/CSV/JSON/IFC export |
| Phase 3.3 멀티모델 | `15.1`~`15.5` | 다중 모델 federation |
| Phase 3.4 2D 평면도 | `7.1`~`7.8` | 도면 생성 |
| Phase 4.1 BCF | `9.1`~`9.6` | BIM collaboration |
| Phase 4.2 데이터 테이블 | `12.1`~`12.5` | list & schedule |
| Phase 4.3 속성 편집 | `3.14`~`3.16`, `8.1`~`8.7` | property editing + mutations |
| Phase 4.4 IDS 검증 | `10.1`~`10.4` | IDS validation |
| Phase 4.5 스크립팅 | `13.1`~`13.5` | scripting & AI chat |

---

## 기능 영역별 비교 체크리스트

### 1. 3D Viewport & Rendering

ifc-lite의 3D 뷰포트는 WebGPU 기반 고급 렌더링을 제공하며, ifc-ln은 Three.js 기반 기본 렌더링을 구현하고 있다.

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 1.1 | 3D geometry 렌더링 | ✅ | Three.js BufferGeometry |
| 1.2 | Progressive geometry streaming | ✅ | chunk 단위 progressive 전송 |
| 1.3 | InstancedMesh 최적화 | ✅ | 반복 geometry 인스턴싱 |
| 1.4 | BVH accelerated picking | ✅ | GPU 가속 레이캐스팅 |
| 1.5 | Geometry cache | ✅ | 중복 변환 방지 |
| 1.6 | Orbit camera controls | ✅ | OrbitControls |
| 1.7 | Camera fit all (Home) | ✅ | 전체 geometry 맞춤 |
| 1.8 | Camera fit selected | ✅ | 선택 객체 포커스 |
| 1.9 | Camera presets (Front/Right/Top/Iso) | ✅ | View 드롭다운 |
| 1.10 | Selection highlight | ✅ | 선택 시 시각적 하이라이트 |
| 1.11 | Hide/Show entity | ✅ | 개별 엔티티 가시성 |
| 1.12 | Isolate entity | ✅ | 선택 엔티티만 표시 |
| 1.13 | WebGPU 렌더링 | ❌ | WebGL만 지원 |
| 1.14 | 고급 조명/그림자 | ❌ | 기본 조명만 |
| 1.15 | Edge rendering | ❌ | 와이어프레임 모드 없음 |
| 1.16 | Transparency 모드 | ❌ | X-ray/ghosting 없음 |
| 1.17 | Animation loop 커스텀 | ❌ | 기본 render loop만 |
| 1.18 | Touch controls | ❌ | 마우스/키보드만 |
| 1.19 | WebGL fallback UX | 🟡 | 1차 대응 완료, 고도화 필요 |

---

### 2. Hierarchy Panel (좌측 패널)

ifc-lite의 하이어라키 패널은 멀티모델 대응, basket selection, 풍부한 행 메타데이터를 제공한다.

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 2.1 | Spatial tree 표시 | ✅ | Project → Site → Building → Storey → Elements |
| 2.2 | Class group tree | ✅ | IFC 클래스별 그룹 트리 |
| 2.3 | Type family tree | ✅ | 실제 IfcType 관계 기반 |
| 2.4 | 3개 탭 (Spatial/Class/Type) | ✅ | 탭 전환 |
| 2.5 | 트리 검색 (debounce) | ✅ | 검색 입력 지연 처리 |
| 2.6 | Expand/collapse | ✅ | 노드 펼치기/접기 |
| 2.7 | Selection ↔ tree 동기화 | ✅ | auto-expand, auto-scroll |
| 2.8 | 가상 리스트 렌더링 | ✅ | 대형 트리 성능 최적화 |
| 2.9 | Element count 표기 | 🟡 | 기본 표기만, ifc-ln 밀도 부족 |
| 2.10 | Type icon 체계 | 🟡 | 기본 아이콘, 풍부한 매핑 부족 |
| 2.11 | 행별 visibility eye toggle | ❌ | Phase 3.3 범위 |
| 2.12 | Hover 시 action 노출 | ❌ | Phase 3.3 범위 |
| 2.13 | Storey elevation 표시 | ❌ | Phase 3.3 범위 |
| 2.14 | Section header 구조 | ❌ | Phase 3.3 범위 |
| 2.15 | Model header UI | ❌ | Phase 5.6에서 자리만 마련, 전체 멀티모델 UX는 Phase 7 |
| 2.16 | Multi-select / basket selection | ❌ | Phase 3.3 범위 |
| 2.17 | Storey selection 고도화 | ❌ | Phase 3.3 범위 |
| 2.18 | Group isolate 규칙 | ❌ | 클릭 규칙 세분화 필요 |
| 2.19 | Row height/font density 미세 조정 | ❌ | hierarchy polish |
| 2.20 | Hierarchy split view | ❌ | 구조 검토 필요 |

---

### 3. Properties Panel (우측 패널)

ifc-lite는 속성 편집, 벌크 편집, bSDD 연동, 분류 정보까지 제공한다.

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 3.1 | Base attributes 표시 | ✅ | GlobalID, Name 등 |
| 3.2 | Property Sets 표시 | ✅ | Pset 조회 |
| 3.3 | Quantities 표시 | ✅ | 별도 탭 분리 |
| 3.4 | Type Properties | ✅ | IfcTypeObject 속성 |
| 3.5 | Materials 표시 | ✅ | 재료 정보 |
| 3.6 | Relations 표시 | ✅ | forward + inverse |
| 3.7 | On-demand property loading | ✅ | 선택 시 로드 |
| 3.8 | Property cache | 🟡 | 동일 엔티티 재선택 시 미캐시, Phase 1 선행 |
| 3.9 | Classification 정보 | ❌ | ClassificationCard |
| 3.10 | bSDD (buildingSMART Data Dictionary) | ❌ | BsddCard |
| 3.11 | Document references | ❌ | DocumentCard |
| 3.12 | Coordinate display | ❌ | CoordinateDisplay |
| 3.13 | Model metadata panel | ❌ | ModelMetadataPanel |
| 3.14 | Property 인라인 편집 | ❌ | Phase 4.3 범위 |
| 3.15 | Bulk property editing | ❌ | BulkPropertyEditor |
| 3.16 | PropertySet 추가/삭제 | ❌ | Phase 4.3 범위 |

---

### 4. Toolbar & Navigation

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 4.1 | 패널 토글 (좌/우) | ✅ | 좌측/우측 패널 열기/닫기 |
| 4.2 | 엔진 초기화 | ✅ | Init Engine 버튼 |
| 4.3 | IFC 파일 열기 | ✅ | .ifc/.ifcz 지원 |
| 4.4 | 세션 초기화 (Reset) | ✅ | 모델 언로드 + 엔진 재시작 |
| 4.5 | Fit Selected / Home | ✅ | 카메라 조작 |
| 4.6 | View preset 드롭다운 | ✅ | Front/Right/Top/Iso |
| 4.7 | Isolate / Show All | ✅ | 가시성 제어 |
| 4.8 | Engine status badge | ✅ | idle/initializing/ready/error |
| 4.9 | 도구 모드 전환 | ❌ | Select/Measure/Section 등 |
| 4.10 | Keyboard shortcuts | ❌ | KeyboardShortcutsDialog |
| 4.11 | Theme switch (Light/Dark) | ❌ | ThemeSwitch |
| 4.12 | Undo/Redo 버튼 | ❌ | Phase 4.3 범위 |

---

### 5. Visibility & Filtering

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 5.1 | 개별 엔티티 hide/show | ✅ | |
| 5.2 | Isolate | ✅ | |
| 5.3 | Show All (reset) | ✅ | |
| 5.4 | Class filter | ✅ | Architecture/Structure/MEP 등 |
| 5.5 | Type filter | ✅ | IfcType 기반 |
| 5.6 | Storey filter | ✅ | 층별 필터 |
| 5.7 | Filter-selection 충돌 해제 | ✅ | 필터로 숨겨진 selection 자동 해제 |
| 5.8 | Hidden entity count 표시 | ✅ | StatusBar |
| 5.9 | Multi-selection visibility | ❌ | 다중 선택 기반 조작 없음 |
| 5.10 | Group visibility toggle | ❌ | 그룹 단위 가시성 |
| 5.11 | Transparency/ghosting 필터 | ❌ | |

---

### 6. Measurement & Section

ifc-lite는 거리/면적/각도 측정과 클리핑 플레인을 지원한다.

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 6.1 | 거리 측정 (point-to-point) | ❌ | MeasurePanel |
| 6.2 | 면적 측정 (polygon area) | ❌ | computePolygonArea |
| 6.3 | 각도 측정 | ❌ | |
| 6.4 | Snap to vertex/edge/face | ❌ | |
| 6.5 | 측정값 오버레이 표시 | ❌ | MeasurementVisuals |
| 6.6 | 거리 단위 포맷 | ❌ | formatDistance |
| 6.7 | Clipping plane (Section cut) | ❌ | SectionPanel |
| 6.8 | Multiple clipping planes | ❌ | |
| 6.9 | Section box | ❌ | |
| 6.10 | Section visualization | ❌ | SectionVisualization |

---

### 7. 2D Drawing Generation

ifc-lite는 평면도, 단면도, SVG 생성, 도면 시트 편집을 제공한다.

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 7.1 | 2D 평면도 생성 | ❌ | @ifc-ln/drawing-2d |
| 7.2 | 2D 단면도 생성 | ❌ | Section2DPanel |
| 7.3 | SVG 기반 2D 캔버스 | ❌ | Drawing2DCanvas |
| 7.4 | 도면 시트 설정 | ❌ | SheetSetupPanel |
| 7.5 | Title block 편집 | ❌ | TitleBlockEditor |
| 7.6 | Text annotation | ❌ | TextAnnotationEditor |
| 7.7 | Drawing settings | ❌ | DrawingSettingsPanel |
| 7.8 | 도면 내보내기 (SVG/PDF) | ❌ | |

---

### 8. Property Editing & Mutations

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 8.1 | 속성 인라인 편집 | ❌ | PropertyEditor |
| 8.2 | 벌크 속성 편집 | ❌ | BulkPropertyEditor |
| 8.3 | Dirty state 추적 | ❌ | Phase 4.3 범위 |
| 8.4 | Undo/Redo stack | ❌ | Phase 4.3 범위 |
| 8.5 | Mutation command 패턴 | ❌ | @ifc-ln/mutations |
| 8.6 | IFC 파일 저장/내보내기 | ❌ | Phase 4.3 범위 |
| 8.7 | 변경 사항 내보내기 | ❌ | ExportChangesButton |

---

### 9. BCF (BIM Collaboration Format)

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 9.1 | BCF topic 목록 | ❌ | BCFTopicList |
| 9.2 | BCF topic 상세 | ❌ | BCFTopicDetail |
| 9.3 | BCF topic 생성 | ❌ | BCFCreateTopicForm |
| 9.4 | BCF viewpoint 저장/복원 | ❌ | 카메라 + 가시성 상태 |
| 9.5 | BCF comment 작성 | ❌ | |
| 9.6 | BCF 파일 가져오기/내보내기 | ❌ | @ifc-ln/bcf |

---

### 10. IDS Validation (Information Delivery Specification)

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 10.1 | IDS 규격 검증 | ❌ | IDSPanel |
| 10.2 | IDS 검증 결과 표시 | ❌ | |
| 10.3 | IDS → BCF 내보내기 | ❌ | IDSExportDialog |
| 10.4 | IDS 파일 불러오기 | ❌ | @ifc-ln/ids |

---

### 11. Lens (Visual Query / Rule-based Filtering)

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 11.1 | 규칙 기반 필터 | ❌ | LensPanel |
| 11.2 | 조건별 색상 채색 | ❌ | @ifc-ln/lens |
| 11.3 | 다중 규칙 조합 | ❌ | |
| 11.4 | 필터 결과 하이라이트 | ❌ | |

---

### 12. List & Schedule

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 12.1 | 동적 테이블 생성 | ❌ | ListPanel |
| 12.2 | 리스트 빌더 | ❌ | ListBuilder |
| 12.3 | 결과 테이블 표시 | ❌ | ListResultsTable |
| 12.4 | 스케줄/수량 산출 | ❌ | @ifc-ln/lists |
| 12.5 | 테이블 내보내기 | ❌ | |

---

### 13. Scripting & Chat (LLM)

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 13.1 | 코드 에디터 (CodeMirror) | ❌ | CodeEditor, ScriptPanel |
| 13.2 | 스크립트 실행 (QuickJS) | ❌ | @ifc-ln/sandbox |
| 13.3 | AI 채팅 인터페이스 | ❌ | ChatPanel |
| 13.4 | 실행 가능 코드 블록 | ❌ | ExecutableCodeBlock |
| 13.5 | 모델 선택기 (LLM) | ❌ | ModelSelector |

---

### 14. Export & Import

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 14.1 | IFC 파일 로드 | ✅ | .ifc/.ifcz 지원 |
| 14.2 | glTF 내보내기 | ❌ | ExportDialog |
| 14.3 | CSV 내보내기 | ❌ | |
| 14.4 | JSON 내보내기 | ❌ | |
| 14.5 | Parquet 내보내기 | ❌ | |
| 14.6 | IFC 내보내기 (수정된 모델) | ❌ | Phase 4.3 범위 |
| 14.7 | 변경 사항만 내보내기 | ❌ | ExportChangesButton |
| 14.8 | 외부 데이터 연결 | ❌ | DataConnector |

---

### 15. Multi-Model Federation

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 15.1 | 다중 IFC 모델 로딩 | ❌ | Phase 3.3 범위 |
| 15.2 | 모델별 가시성 토글 | ❌ | |
| 15.3 | 모델 제거 (unload) | ❌ | 현재 1모델 기준 CLOSE_MODEL만 |
| 15.4 | 모델 간 정합 (alignment) | ❌ | |
| 15.5 | 통합 spatial tree | ❌ | |

---

### 16. UX Components

ifc-lite는 풍부한 UX 컴포넌트를 제공한다.

| # | ifc-lite 기능 | ifc-ln 상태 | 비고 |
|---|-----------|-----------|------|
| 16.1 | Command Palette (Ctrl+K) | ❌ | CommandPalette |
| 16.2 | ViewCube (3D 네비게이션 큐브) | ❌ | Phase 1 |
| 16.3 | Axis Helper | ❌ | AxisHelper |
| 16.4 | Entity Context Menu (우클릭) | ❌ | Phase 1 |
| 16.5 | Hover Tooltip | ❌ | HoverTooltip |
| 16.6 | Keyboard Shortcuts Dialog | ❌ | Phase 1 |
| 16.7 | Theme Switch (Light/Dark) | ❌ | ThemeSwitch |
| 16.8 | Status Bar | ✅ | 기본 정보 표시 구현 |
| 16.9 | Resizable panels | ✅ | react-resizable-panels |
| 16.10 | Toast notifications | ❌ | Shadcn toast |
| 16.11 | Progress indicator (file load) | 🟡 | 기본 로딩 상태만, Phase 1 선행 |
| 16.12 | Viewport overlays | ❌ | ViewportOverlays, ToolOverlays |
| 16.13 | Upgrade page | ➖ | 상업 기능, ifc-ln 범위 외 |

---

## 종합 현황

| 영역 | ifc-lite 기능 수 | ✅ 완료 | 🟡 부분 | ❌ 미구현 | 구현율 |
|------|-------------|--------|---------|---------|--------|
| 3D Viewport & Rendering | 19 | 12 | 1 | 6 | 63% |
| Hierarchy Panel | 20 | 8 | 2 | 10 | 40% |
| Properties Panel | 16 | 7 | 1 | 8 | 44% |
| Toolbar & Navigation | 12 | 8 | 0 | 4 | 67% |
| Visibility & Filtering | 11 | 8 | 0 | 3 | 73% |
| Measurement & Section | 10 | 0 | 0 | 10 | 0% |
| 2D Drawing | 8 | 0 | 0 | 8 | 0% |
| Property Editing | 7 | 0 | 0 | 7 | 0% |
| BCF | 6 | 0 | 0 | 6 | 0% |
| IDS Validation | 4 | 0 | 0 | 4 | 0% |
| Lens | 4 | 0 | 0 | 4 | 0% |
| List & Schedule | 5 | 0 | 0 | 5 | 0% |
| Scripting & Chat | 5 | 0 | 0 | 5 | 0% |
| Export & Import | 8 | 1 | 0 | 7 | 13% |
| Multi-Model | 5 | 0 | 0 | 5 | 0% |
| UX Components | 13 | 2 | 1 | 9 | 15% |
| **합계** | **153** | **46** | **5** | **101** | **30%** |

---

## 우선순위 — Phase 매핑

### Phase 1: Quick Wins

사용자 체감이 크고 구현 비용이 낮은 항목.

| 순위 | 기능 | 체크리스트 항목 |
|------|------|---------------|
| 1 | 키보드 단축키 | `4.10`, `16.6` |
| 2 | 호버 툴팁 | `16.5` |
| 3 | 컨텍스트 메뉴 (우클릭) | `16.4` |
| 4 | 다크/라이트 테마 | `4.11`, `16.7` |
| 5 | 토스트 알림 | `16.10` |
| 6 | 스크린샷 캡처 | — |

### Phase 2: Core BIM Tools

BIM 뷰어 핵심 도구 기능.

| 순위 | 기능 | 체크리스트 항목 |
|------|------|---------------|
| 7 | 활성 도구 시스템 | `4.9` |
| 8 | 단면 (Clipping/Section) | `6.7`~`6.10` |
| 9 | 측정 (거리/면적/각도) | `6.1`~`6.6` |
| 10 | 걷기 모드 | — |
| 11 | 커맨드 팔레트 | `16.1` |

### Phase 3: Advanced Features

뷰어 활용 범위 확장.

| 순위 | 기능 | 체크리스트 항목 |
|------|------|---------------|
| 12 | 내보내기 (glTF/CSV/JSON/IFC) | `14.2`~`14.7` |
| 13 | 뷰포인트 저장/복원 | — |
| 14 | 멀티모델 페더레이션 | `15.1`~`15.5` |
| 15 | 2D 평면도 생성 | `7.1`~`7.8` |

### Phase 4: Enterprise

전문 BIM 도구 수준. 도메인 전문 지식과 상당한 구현 비용이 필요.

| 순위 | 기능 | 체크리스트 항목 |
|------|------|---------------|
| 16 | BCF collaboration | `9.1`~`9.6` |
| 17 | 데이터 테이블 (List & Schedule) | `12.1`~`12.5` |
| 18 | 속성 편집 + Mutations | `3.14`~`3.16`, `8.1`~`8.7` |
| 19 | IDS 검증 | `10.1`~`10.4` |
| 20 | 스크립팅 & AI 채팅 | `13.1`~`13.5` |

---

## 기술 스택 차이점 매핑

ifc-lite와 ifc-ln은 같은 목표(IFC 뷰어)를 다른 기술 접근으로 구현하고 있다. 기능을 옮길 때 이 차이를 고려해야 한다.

### 아키텍처 차이

| 관점 | ifc-lite | ifc-ln | 반영 전략 |
|------|----------|--------|----------|
| 프로젝트 구조 | 모노레포 (24+ 패키지) | 단일 앱 | 기능별 모듈 분리로 점진적 확장 |
| IFC 파싱 | 자체 WASM 파서 | web-ifc (C++ WASM) | web-ifc API 범위 내 구현 |
| 3D 렌더러 | Three.js + WebGPU 옵션 | Three.js (WebGL) | WebGL 기반으로 충분, 필요 시 WebGPU 검토 |
| Worker 구조 | 멀티 패키지 의존 | 단일 worker | worker 메시지 확장으로 기능 추가 |
| 상태 관리 | Zustand (패키지별 분리) | Zustand (5 slices) | slice 추가로 대응 |

### UI 컴포넌트 차이

| 관점 | ifc-lite | ifc-ln | 반영 전략 |
|------|----------|--------|----------|
| UI 라이브러리 | Radix UI + Shadcn/ui | 순수 Tailwind | 필요 시 Radix/Shadcn 도입 검토 |
| 아이콘 | Lucide React | Lucide React | 동일 |
| 패널 시스템 | react-resizable-panels | react-resizable-panels | 동일 |
| 코드 에디터 | CodeMirror | 없음 | 필요 시 CodeMirror 도입 |
| 인증 | Clerk | 없음 | 범위 외 |

### 데이터 처리 차이

| 관점 | ifc-lite | ifc-ln | 반영 전략 |
|------|----------|--------|----------|
| Geometry streaming | 자체 파이프라인 | web-ifc StreamAllMeshes | chunk 정책 최적화 |
| Property 조회 | @ifc-lite/query 패키지 | worker GET_PROPERTIES | worker 메시지 확장 |
| Mutation | @ifc-lite/mutations 패키지 | 없음 | web-ifc API 기반 mutation 설계 |
| Export | @ifc-lite/export 패키지 | 없음 | 포맷별 변환 로직 추가 |
| 캐시 | @ifc-lite/cache 패키지 | geometry cache만 | property/query 캐시 추가 |

### 기능 구현 난이도 예상

| 기능 그룹 | 난이도 | 이유 |
|----------|--------|------|
| Quick Wins (Phase 1) | 🟢 낮음 | UI 추가 위주, 기존 구조에 부담 없음 |
| Measurement | 🟡 중간 | 스냅 알고리즘, 오버레이 렌더링 |
| Section / Clipping | 🟡 중간 | Three.js clipping plane 활용 |
| Property editing | 🟡 중간 | web-ifc mutation API 검증 필요 |
| Export (glTF/CSV) | 🟡 중간 | 포맷별 변환 로직 |
| Multi-model | 🟡 중간 | 상태 관리 복잡도 증가 |
| BCF | 🔴 높음 | 전용 포맷 파싱/생성 필요 |
| 2D Drawing | 🔴 높음 | 기하 연산 + SVG 렌더링 파이프라인 |
| IDS | 🔴 높음 | 규격 검증 로직 |
| Lens | 🔴 높음 | 규칙 엔진 + 시각화 |
| Scripting | 🔴 높음 | 샌드박스 실행 환경 구축 |

---

## 참고

- 이 문서는 `roadmap.md`의 Phase 1~4 기반 진행과 보완적으로 활용한다.
- Phase 1은 Quick Wins에 집중하며, 영역 4, 16 항목과 직접 대응된다.
- Phase 2는 Core BIM Tools에 집중하며, 영역 6 항목과 대응된다.
- Phase 3은 Advanced Features에 집중하며, 영역 14, 15 항목과 대응된다.
- Phase 4는 Enterprise에 집중하며, 영역 8, 9, 10, 12, 13 항목과 대응된다.
