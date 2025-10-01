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
    - Functions 에뮬레이터(기본 5001)에 자동 프록시: `/api`, `/ai`, `/dashboard`
      - `.firebaserc`의 기본 프로젝트 ID(`agentlink-391f7`)를 사용하며, 다른 프로젝트를 쓰려면 `FIREBASE_EMULATOR_PROJECT_ID`를 지정하세요.
  - Firebase Emulator Suite (`firebase emulators:start`)
    - Hosting: http://localhost:5002
    - Functions (Express API 포함): http://localhost:5001
    - Firestore: http://localhost:8080
    - Storage: http://localhost:9199
    - Auth: http://localhost:9099
    - Emulator UI: http://localhost:4000 (자동 활성화)

### 기타 스크립트
- `npm run lint` / `npm run typecheck` / `npm run build`: 워크스페이스별 ESLint, 타입검사, 빌드 실행
- `npm run test`: Functions 워크스페이스의 단위 테스트(Node 20 `node:test` 기반)
- `npm run seed`: Firestore/Storage 에뮬레이터 시드 데이터 12건 메뉴 + 기본 문서 투입
- `npm run test:rules`: `firebase emulators:exec` 기반 Firestore/Storage 보안 규칙 테스트
- `npm run -w web-dashboard test`: Vitest + React Testing Library 기반 대시보드 단위 테스트
- `npm run -w web-dashboard test:e2e`: Playwright 기반 대시보드 E2E (사전 `npm run dev` 실행 및 `VITE_BYPASS_AUTH=true` 환경 필요)

### Dashboard 환경 구성

1. `cp web-dashboard/.env.example web-dashboard/.env.local`로 Vite 환경 변수를 복사하고 Firebase 프로젝트/에뮬레이터 값을 입력합니다.
2. 로컬 실행 시 `VITE_BYPASS_AUTH=true npm run dev`를 사용하면 Firebase Auth 없이 테스트 계정으로 자동 로그인하여 개발과 Playwright 시나리오를 빠르게 검증할 수 있습니다.
3. 에뮬레이터가 아닌 실 서비스 계정으로 로그인하려면 `.env.local`의 `VITE_BYPASS_AUTH` 값을 `false`로 유지하고 Firebase Auth 사용자 자격을 이용합니다.

## ⚙️ Functions 자동화

- `functions/src/lib/title.ts`: 메뉴·스토어 데이터를 받아 `__hogun` 마커가 붙은 표준화된 타이틀 생성
- `functions/src/triggers/menus.ts`: Firestore `menus` 문서 생성/업데이트 시 타이틀 재계산 및 `title_v` 증가
  - 누락 필드가 있어도 기본값을 채워 일관된 텍스트를 생성하며, Functions를 통한 쓰기 시 항상 `__hogun`으로 끝납니다.
  - `scripts/seed.ts` 시드 실행 시 12개 메뉴 모두 `__hogun` 마커가 포함된 타이틀로 삽입됩니다.

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
  },
  "token_savings": {
    "latest": {
      "baseline_tokens": 9800,
      "optimized_tokens": 2400,
      "savings_ratio": 0.7551,
      "savings_percent": 75.51,
      "captured_at": "2024-03-01T09:05:00+09:00"
    }
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
  "payment_status": "paid"
}

주문 상태
GET /api/order/:id/status
→ {
  "order_id": "order_123",
  "status": "preparing"
}

예외 코드 표준화
{ "code": "E01", "message": "품절", "alternatives": ["menu_002","menu_003"] }
{ "code": "E02", "message": "영업 종료", "alternatives": [] }
{ "code": "E03", "message": "배달 불가 지역", "alternatives": [] }

오케스트레이터 (단일 호출)
POST /api/orchestrate
{ "region": "서울", "keyword": "후라이드" }
→ {
  "store": "호건치킨",
  "menu": "서울_호건치킨_후라이드치킨_18000_3000_KRW_4.5_open__hogun",
  "price_total": 19000,
  "eta_minutes": 25,
  "summary": [
    "호건치킨에서 후라이드치킨을 주문했습니다.",
    "선택 옵션과 배달비를 포함한 총액은 19,000원입니다.",
    "도착 예상 시간은 약 25분입니다."
  ]
}

AI 인덱스
GET /ai/index.json
→ {
  "version": 1,
  "updated_at": "2024-03-01T09:00:00Z",
  "stores": [
    { "store_id": "store_001", "region": "seoul_gangnam", "name": "호건치킨" }
  ]
}

GET /ai/store/:id.json
→ {
  "version": 1,
  "updated_at": "2024-03-01T09:00:00Z",
  "store": { "store_id": "store_001", "name": "호건치킨", "region": "seoul_gangnam" },
  "menus": [
    {
      "menu_id": "menu_001",
      "title": "서울_호건치킨_후라이드치킨_18000_3000_KRW_4.5_open__hogun",
      "content": {
        "description": "바삭바삭",
        "price": 18000,
        "currency": "KRW"
      }
    }
  ]
}

두 엔드포인트 모두 CDN 캐시 헤더(`s-maxage=60, must-revalidate`)가 설정되어 검색봇 및 LLM 크롤러가 최신 데이터를 받아갈 수 있습니다.

🗺️ 6주 실행 플랜

1주차: 데이터 모델링, 타이틀 생성기, 기본 API

2주차: 주문 생성/상태 전환, Storage 업로드, 예외 코드

3주차: 오케스트레이터(/api/orchestrate), AI 인덱스(/ai/index.json)

4주차: 업체 대시보드, CRUD/품절/영업 토글

5주차: 관측/메트릭, 토큰 절감 계산, Rate limit

6주차: 데모 리허설, 모의 응답 백업, 문서화

📊 측정 & 관측성

/api/metrics: 호출 수, 평균 응답(ms), 실패율, token_savings 샘플 (헤더 `Authorization: Bearer $API_METRICS_TOKEN`)

토큰 절감률 = string.length / 4 근사(estimateTokens)

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