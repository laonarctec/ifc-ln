# ifc-lite vs ifc-ln

## 한눈에 보는 상태

| 영역 | ifc-lite | ifc-ln 현재 상태 | 메모 |
|---|---|---|---|
| P1 코어 뷰어 | 최소 단일 모델 뷰어 | 완료 | 2점 측정은 live preview 포함 |
| 섹션 툴 | 별도 구현 예정 | 비대상 | 기존 box section 구현은 제거됨 |
| P2 federation | 없음 | 완료 | 멀티모델 동시 로드/가시성/활성 모델 관리 |
| P2 속성 편집 | 없음 | 완료 | 편집 가능한 scalar 값 즉시 수정 |
| P2 변경 추적 | 없음 | 완료 | 모델별 변경 목록과 revert |
| P2 변경 IFC export | 없음 | 완료 | web-ifc `SaveModel` 기반 |
| P2 Lens | 없음 | 완료 | 규칙 기반 hide/color |

## 범위별 비교

| 카테고리 | 비교 포인트 | ifc-lite | ifc-ln |
|---|---|---|---|
| 로딩 | 모델 수 | 단일 모델 | 멀티모델 federation |
| 로딩 | geometry residency | 기본/단일 manifest | 모델별 manifest + chunk residency |
| 모델 관리 | 활성 모델 전환 | 없음 | 지원 |
| 모델 관리 | 모델 가시성 토글 | 없음 | 지원 |
| 모델 관리 | 모델 제거 | 없음 | 지원 |
| 탐색 | hierarchy/class/type | 제한적 | spatial/class/type 모두 유지 |
| 선택 | 멀티 선택 | 제한적 | 지원 |
| 측정 | 2점 거리 | 없음 또는 부분 | 완료 |
| 측정 | live preview | 없음 | 지원 |
| 속성 | 읽기 | 기본 속성 중심 | attributes/pset/qto/type/material/document/classification/metadata |
| 속성 | 편집 | 없음 | editable scalar entry 지원 |
| 변경 | change tracking | 없음 | 모델별 변경 목록/개별 revert |
| export | IFC 저장 | 없음 | 변경 IFC export |
| export | JSON/CSV | 일부 | spatial JSON/CSV, selection properties CSV |
| Lens | 규칙 기반 hide | 없음 | 지원 |
| Lens | 규칙 기반 color | 없음 | 지원 |

## P1 정리

| 항목 | 상태 | 구현 메모 |
|---|---|---|
| 뷰포트 렌더링 | 완료 | chunk 기반 점진 로딩 유지 |
| 선택/숨김/isolate | 완료 | active model 기준 동작 |
| 속성 조회 | 완료 | 기존 worker backend 유지 |
| 2점 측정 | 완료 | 3D marker + segment + live preview |
| 섹션 툴 | 제외 | 별도 방식으로 재구현 예정 |

## P2 정리

| 항목 | 상태 | 구현 메모 |
|---|---|---|
| 멀티모델 federation | 완료 | 여러 IFC를 동시에 로드하고 동일 scene에서 렌더 |
| 모델 단위 관리 | 완료 | active/visible/remove |
| 속성 편집 | 완료 | editable entry만 inline apply |
| 변경 추적 | 완료 | 모델/엔티티/attribute 기준 추적 |
| 변경 IFC export | 완료 | active IFC 또는 changed IFC export |
| Lens | 완료 | model / ifcType / name / storey / changed 규칙 |

## 현재 제외 항목

| 항목 | 상태 | 이유 |
|---|---|---|
| Box section | 제외 | 새 방식으로 다시 구현 예정 |
| 고급 IFC authoring | 제외 | 현재 범위는 기존 line update 중심 |
| 충돌/규칙 엔진 | 제외 | Lens 범위까지만 포함 |
