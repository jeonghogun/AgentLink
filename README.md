# 🚀 AgentLink – 초경량 주문 네트워크 (MVP for Demo)

**한 줄 정의**  
AgentLink는 사람이 앱을 뒤적이지 않아도, AI가 가게와 직접 거래를 붙여주는 초경량 주문 네트워크다.  
플랫폼을 거치지 않고 다이렉트로 주문·예약·결제 흐름을 완성한다.  


## ✨ 왜 필요한가
  기존 플랫폼의 UI/텍스트를 전부 읽느라 모델이 비효율적으로 작동.  
  → AgentLink는 표준화된 “한 줄(title)”로 80% 결정을 끝낸다.
  데이터와 손님이 모두 플랫폼 지갑에 묶이는 구조를 깨고, 가게가 자기 카탈로그를 직접 가진다.
  로고/브랜드 대신 **X-마커와 검증키**로 데이터 진위를 판단한다.


## 🛠️ 로컬 개발 가이드

### 사전 준비
1. Node.js 20 LTS 환경을 준비합니다.
2. 프로젝트 루트에서 Firebase CLI를 설치합니다.
   ```bash
   npm i -g firebase-tools
   ```
3. Firebase 계정으로 로그인합니다.
   ```bash
   firebase login
   ```
4. 사용할 Firebase 프로젝트를 지정합니다.
   ```bash
   firebase use <PROJECT_ID>
   ```

### 개발 서버 실행
  ```bash
  npm run dev
  ```
  - `web-dashboard` 워크스페이스: Vite 개발 서버 (`http://localhost:5173`)
  - Firebase Emulator Suite (`firebase emulators:start`)
    - Hosting: http://localhost:5000
    - Functions (Express API 포함): http://localhost:5001
    - Firestore: http://localhost:8080
    - Storage: http://localhost:9199
    - Auth: http://localhost:9099
    - Emulator UI: http://localhost:4000 (자동 활성화)

### 기타 스크립트

## 🏗️ 아키텍처 개요

### Firebase 구성 요소
  - `/dashboard/*`: 업체 대시보드 (React SPA)
  - `/ai/*`: AI 전용 JSON-LD 페이지


## 📁 Firestore 스키마

### 접근 제어 & 인덱스

### stores/{storeId}
```json
{
  "name": "호건치킨",
  "region": "seoul_gangnam",
  "status": "open",
  "delivery": {
    "available": true,
    "base_fee": 3000,
    "rules": [
      { "distance_km": 3, "fee": 2000 },
      { "distance_km": 5, "fee": 3000 }
    ]
  },
  "rating": { "score": 4.7, "count": 124 },
  "owner_uid": "firebaseAuthUid",
  "created_at": "2024-03-01T09:00:00+09:00",
  "updated_at": "2024-03-01T09:10:00+09:00"
}
```

`delivery.rules`가 비어 있으면 `base_fee`만 적용합니다. 규칙 배열은 가까운 순으로 정렬하면 ETA 계산에 유리합니다.

### menus/{menuId}
```json
{
  "store_id": "store_001",
  "name": "후라이드치킨",
  "price": 18000,
  "currency": "KRW",
  "stock": 35,
  "option_groups": [
    {
      "group_name": "부위",
      "type": "single_choice",
      "options": [
        { "id": "fillet", "name": "순살", "extra_price": 2000 },
        { "id": "bone", "name": "뼈", "extra_price": 0 }
      ]
    },
    {
      "group_name": "추가",
      "type": "multi_select",
      "options": [{ "id": "spicy", "name": "양념추가", "extra_price": 1000 }]
    }
  ],
  "rating": { "score": 4.5, "count": 87 },
  "images": ["gs://demo-bucket/images/store_001/menu_001.jpg"],
  "description": "바삭바삭",
  "title_v": "hogun-fried-18000",
  "title": "서울_호건치킨_후라이드치킨_18000_3000_KRW_4.5_open",
  "created_at": "2024-03-01T09:00:00+09:00",
  "updated_at": "2024-03-01T09:05:00+09:00"
}
```

### orders/{orderId}
```json
{
  "user_id": "demo_user_or_anon",
  "items": [
    {
      "menu_id": "menu_001",
      "name": "후라이드치킨",
      "quantity": 1,
      "price": 18000,
      "options": [
        { "group_id": "부위", "option_id": "fillet" },
        { "group_id": "추가", "option_id": "spicy" }
      ]
    }
  ],
  "status": "pending",
  "payment_status": "paid",
  "receipt_id": "demo123",
  "eta_minutes": 25,
  "timeline": [
    { "status": "pending", "at": "2024-03-01T09:01:00+09:00" },
    { "status": "paid", "at": "2024-03-01T09:02:00+09:00" }
  ],
  "store_id": "store_001",
  "created_at": "2024-03-01T09:00:00+09:00",
  "updated_at": "2024-03-01T09:02:00+09:00"
}
```

### api_keys/{clientId}
```json
{
  "name": "웹 대시보드",
  "key_hash": "hashed-api-key",
  "role": "dashboard",
  "created_at": "2024-03-01T09:00:00+09:00"
}
```

### metrics/{dateOrShard}
```json
{
  "api": {
    "/api/search": { "count": 1200, "avg_ms": 80, "fail": 4 },
    "/api/order": { "count": 340, "avg_ms": 120, "fail": 7 }
  }
}
```

### settings/runtime
```json
{
  "x_marker": "2024-03-01T09:00:00+09:00",
  "weights": {
    "price": 0.3,
    "rating": 0.5,
    "fee": 0.2
  }
}
```

🔌 주요 API
검색
GET /api/search?region=&keyword=
→ [
  "서울_호건치킨_후라이드치킨_18000_3000_KRW_4.5_open",
  ...
]

Firestore 인덱스 필요

stores.region + stores.status 조합으로 복합 인덱스 생성.

firebase firestore:indexes로 내보내고 firebase deploy --only firestore:indexes로 동기화.

메뉴 상세
GET /api/menu/:id
→ {
  "title": "...",
  "description": "...",
  "option_groups": [...],
  "rating": { "score": 4.5, "count": 87 },
  "delivery": { "base_fee": 3000, "rules": [...] }
}

주문 생성
POST /api/order
{
  "user_id": "demo_user",
  "items": [{ "menu_id": "menu_001", "qty": 1, "selected_options": ["순살"] }]
}
→ {
  "order_id": "order_123",
  "status": "pending",
  "total_price": 20000
}

주문 상태
GET /api/order/:id/status
→ { "status": "preparing", "eta_minutes": 20 }

예외 코드 표준화
{ "code": "E01", "message": "품절", "alternatives": ["menu_002","menu_003"] }
{ "code": "E02", "message": "영업 종료", "alternatives": [] }
{ "code": "E03", "message": "배달 불가 지역", "alternatives": [] }

오케스트레이터 (단일 호출)
POST /api/orchestrate
{ "region": "서울", "keyword": "후라이드" }
→ { "summary": "호건치킨 후라이드 주문 완료, ETA 25분" }

🗺️ 6주 실행 플랜

1주차: 데이터 모델링, 타이틀 생성기, 기본 API

2주차: 주문 생성/상태 전환, Storage 업로드, 예외 코드

3주차: 오케스트레이터(/api/orchestrate), AI 인덱스(/ai/index.json)

4주차: 업체 대시보드, CRUD/품절/영업 토글

5주차: 관측/메트릭, 토큰 절감 계산, Rate limit

6주차: 데모 리허설, 모의 응답 백업, 문서화

📊 측정 & 관측성

/api/metrics: 호출 수, 평균 응답(ms), 실패율, 주문 전환률

토큰 절감률 = string.length / 4 근사

목표: 기존 플랫폼 대비 ~68% 절감

🔐 보안 규칙 요약

stores: 쓰기 → request.auth.uid == owner_uid

menus: 쓰기 → 상위 store.owner_uid 검증

읽기: Functions 프록시만 허용

Storage: images/{uid}/** 쓰기 → request.auth.uid == uid

🚀 로드맵

중기: PG 결제 연동, 프랜차이즈 제휴, 업종 확장

장기: AI 네이티브 결제, 글로벌 API 네트워크, 분산 거버넌스

📌 요약

이 프로젝트는 Firebase 기반으로 작동하는 최소 버전을 6주 내 구현하여,
투자자와 파트너에게 효율성 + 신뢰성 + 확장성을 시연하는 것을 목표로 한다.
“한 줄(title) → 한 클릭(order)”로 토큰 절감, 플랫폼 탈피, 신뢰 레이어를 동시에 증명한다.