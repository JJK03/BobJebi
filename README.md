# 밥제비

현재 위치나 원하는 지역 주변에서 음식 종류, 한 사람 예산, 이동 조건에 맞는 식당을 추린 뒤 제비뽑기로 한 곳을 추천합니다.

## 바로 사용하기

**[bobjebi.vercel.app](https://bobjebi.vercel.app/)**

설치 없이 모바일과 PC 브라우저에서 이용할 수 있습니다.

1. `착한가격업소` 또는 `인천 스마트음식관광` 탭을 고릅니다.
2. 현재 위치를 허용하거나 원하는 위치를 검색합니다.
3. 음식 종류, 한 사람 예산, 이동 방식과 예상 시간을 선택합니다.
4. 제비를 뽑고 추천 식당과 메뉴를 확인합니다.
5. 결과 카드에서 카카오맵으로 식당 위치를 엽니다.

## 주요 기능

- 현재 위치와 검색한 위치를 기준으로 주변 식당 추천
- 음식 종류, 1인 예산, 도보·자차, 예상 시간 필터
- 착한가격업소와 인천 스마트음식관광 데이터 전환
- 한 사이클 안에서 같은 식당이 반복되지 않는 제비뽑기
- 조건에 맞는 식사 메뉴와 예상 거리·시간 표시
- 조건에 맞는 후보가 없을 때 빠른 조건 완화
- 카카오맵 장소 또는 식당 검색 연결

## 데이터와 거리 안내

- 착한가격업소: 행정안전부 공공데이터
- 인천 스마트음식관광: 인천관광공사 스마트음식관광 DB
- 이동 시간은 실제 길찾기가 아니라 두 좌표 사이의 직선거리와 평균 속도로 계산한 예상값입니다.
- 메뉴와 가격은 원천 데이터의 갱신 시점에 따라 실제 매장 정보와 다를 수 있습니다. 방문 전 매장 정보를 다시 확인해 주세요.

## 로컬에서 실행하기

Node.js가 설치된 VS Code의 CMD 터미널에서 실행합니다.

```cmd
cd /d C:\workspace\Menu_recs
npm install
copy .env.example .env.local
npm run dev
```

`.env.local`의 `VITE_KAKAO_JAVASCRIPT_KEY`에 카카오 JavaScript 키를 입력하면 위치 검색을 사용할 수 있습니다. 실제 인증키가 든 `.env.local`은 Git에 올리지 않습니다.

검증 명령은 다음과 같습니다.

```cmd
npm test
npm run lint
npm run build
```

## 개발 문서

프로젝트 구조, 핵심 로직, 환경변수, 데이터 갱신, 배포와 장애 대응은 [밥제비 개발 문서](https://app.notion.com/p/3c09b106d5f281c59cbedc15f8eab751?source=copy_link)에서 관리합니다.

## 기술 구성

- React 19 + TypeScript + Vite
- 가벼운 Feature-Sliced Design 구조
- 위치별 정적 JSON shard와 브라우저 메모리 캐시
- 카카오 지도 JavaScript API
- Vercel 정적 배포, Analytics, Speed Insights
- Vitest + Testing Library
- 런타임 백엔드와 데이터베이스 없음
