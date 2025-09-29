# 🐔 만물의 API (MVP) – Firebase 버전

**만물의 API**는 AI 에이전트가 기존 배달앱(배민 등)과 같은 중앙 플랫폼을 거치지 않고,  
업체별 데이터를 직접 API로 연결하여 **토큰 효율적이고 신뢰 가능한 주문/예약 경험**을 제공하기 위한 프로젝트입니다.  
이 저장소는 Firebase를 기반으로 한 **치킨집 도메인 MVP** 구현을 목표로 합니다.

---

## 🎯 프로젝트 비전

- **토큰 절감**: AI는 긴 메뉴판 대신, 압축된 `title` 필드만 읽고 판단 → 필요할 때만 상세 호출
- **탈중앙화**: 특정 플랫폼 종속이 아닌, 누구나 참여 가능한 표준 JSON 구조
- **신뢰 확보**: `_hogun` 마커 → 변동 마커 → 암호학적 서명으로 진화
- **자동화**: 업체가 대시보드에 정보를 입력하면 API와 AI 인덱스가 자동 생성

---

## 🏗️ 아키텍처 개요

### Firebase 구성 요소
- **Firestore**: 데이터 저장 (`stores`, `menus`, `orders`, `metrics`, `settings`)
- **Cloud Functions**: `/api/*` 엔드포인트, 주문 상태 전환, 타이틀 생성기
- **Firebase Hosting**: 
  - `/dashboard/*`: 업체 대시보드 (React)
  - `/ai/*`: AI 전용 JSON-LD 페이지
- **Firebase Auth**: 업체 로그인/권한 제어
- **Cloud Storage**: 메뉴 사진 저장
- **Security Rules**: 접근 제어
- **Cloud Logging/Monitoring**: 관측/메트릭
- **Cloud Scheduler**: 주문 상태 자동 전환

---

## 📁 Firestore 스키마

### stores/{storeId}
```json
{
  "name": "호건치킨",
  "region": "서울_강남구",
  "status": "open", 
  "delivery": { "available": true, "base_fee": 3000 },
  "rating": { "score": 4.7, "count": 124 },
  "owner_uid": "firebaseAuthUid"
}

menus/{menuId}
{
  "store_id": "store_001",
  "name": "후라이드치킨",
  "price": 18000,
  "currency": "KRW",
  "stock": "in_stock",
  "option_groups": [
    { "group_name": "부위", "type": "single_choice",
      "options": [{ "name": "순살", "extra_price": 2000 }, { "name": "뼈", "extra_price": 0 }] }
  ],
  "rating": { "score": 4.5, "count": 87 },
  "title": "서울_호건치킨_후라이드치킨_18000_3000_KRW_4.5_open_in_stock__hogun"
}

orders/{orderId}
{
  "user_id": "demo_user",
  "items": [{ "menu_id": "menu_001", "qty": 1, "total_price": 21000 }],
  "status": "pending",
  "payment_status": "paid",
  "receipt_id": "demo123"
}

🔌 주요 API
검색
GET /api/search?region=&keyword=
→ [ "서울_호건치킨_후라이드치킨_18000_3000_KRW_4.5_open_in_stock__hogun", ... ]

메뉴 상세
GET /api/menu/:id
→ { title, description, option_groups, rating, delivery }

주문 생성
POST /api/order
{ "items":[{ "menu_id":"menu_001", "qty":1 }], "user_id":"demo" }
→ { "order_id":"...", "status":"pending" }

주문 상태
GET /api/order/:id/status
→ { "status":"preparing", "eta_minutes":20 }

오케스트레이터 (단일 호출)
POST /api/orchestrate
{ "region":"서울", "keyword":"후라이드" }
→ 최종 주문 요약

🗺️ 6주 실행 플랜

1주차: 데이터 모델링, 타이틀 생성기, 기본 API(/api/search, /api/menu/:id)

2주차: 주문 생성/상태 전환, Storage 업로드, 예외 코드 처리

3주차: 오케스트레이터(/api/orchestrate), AI 인덱스(/ai/index.json)

4주차: 업체 대시보드 CRUD, 실시간 업데이트, 권한 제어

5주차: Metrics 수집, 토큰 절감 계산기, Rate limit

6주차: 데모 리허설, Mock 응답, 문서화

👥 세 주체별 UX

사용자: GPT에 “치킨 주문해줘” → AI가 API 호출 → 주문 결과 안내

업체: 대시보드 로그인 → 메뉴 입력/수정 → 자동으로 API 반영

AI: /api/search로 후보 추림 → /api/menu/:id로 상세 → /api/order 생성 및 상태 추적

🔐 보안 규칙 요약

stores: 쓰기 권한 = owner_uid == request.auth.uid

menus: 쓰기 권한 = 해당 store.owner_uid

orders: 누구나 생성 가능, 수정은 내부 함수만

storage/images/{uid}/**: request.auth.uid == uid만 쓰기 가능

📊 측정 & 관측성

호출 수, 평균 응답(ms), 실패율, 주문 전환율

토큰 절감률 계산 (string.length/4 근사)

/api/metrics 엔드포인트로 실시간 모니터링

⚖️ 법적/윤리적 고려

MVP 단계에서는 개인정보 저장 없음

실제 결제 없음 (플래그 payment_status=paid)

데이터 소유권 = 업체에게 귀속

장기적으로는 투명성/공정성/국제 규제 준수

🚀 로드맵

중기: PG 결제 연동, 프랜차이즈 제휴, 다중 업종 확장

장기: AI 네이티브 결제, 글로벌 API 네트워크, 분산 거버넌스

📌 요약

이 프로젝트는 **“작동하는 최소 버전”**을 Firebase 위에서 구현하여,
투자자와 파트너에게 효율성 + 신뢰성 + 확장성을 동시에 시연하는 것을 목표로 합니다.