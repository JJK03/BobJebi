# 오늘 뭐 먹지?

현재 위치, 음식 종류, 예산, 이동 방식과 예상 시간을 바탕으로 주변 착한가격업소 한 곳을 제비뽑기로 추천하는 React 정적 웹 앱입니다.

## 배포

Vercel에 배포되어 있으며 아래 주소에서 바로 사용할 수 있습니다.

**[randommenurecs.vercel.app](https://randommenurecs.vercel.app/)**

## 기술 구성

- React + TypeScript + Vite
- Vercel 정적 배포
- Vercel Web Analytics + Speed Insights
- 브라우저 Geolocation API
- 카카오 지도 JavaScript API 장소·주소 검색
- Haversine 직선거리 계산
- 정적 JSON 데이터 9,407건
- Vitest 단위 테스트
- 백엔드와 데이터베이스 없음

카카오 REST API 키는 웹 앱에서 사용하지 않으며 저장소에도 보관하지 않습니다. 주소 좌표 변환이 끝난 정적 데이터만 사용합니다. 원하는 위치 검색에는 브라우저용 카카오 JavaScript 키를 사용하며, 카카오 개발자 콘솔의 JavaScript SDK 허용 도메인으로 사용 범위를 제한합니다.

## 카카오 위치 검색 설정

`.env.example`을 `.env.local`로 복사하고 카카오 JavaScript 키를 입력합니다. 이미 `.env.local`이 있다면 아래 항목만 추가합니다.

```env
VITE_KAKAO_JAVASCRIPT_KEY=발급받은_JavaScript_키
```

카카오 개발자 콘솔의 `앱 → 플랫폼 키 → JavaScript 키 → JavaScript SDK 도메인`에 다음 주소를 등록합니다.

```text
http://localhost:5173
https://randommenurecs.vercel.app
```

Vercel 프로젝트의 `Settings → Environment Variables`에도 `VITE_KAKAO_JAVASCRIPT_KEY`를 추가하고 Production에 적용한 뒤 다시 배포합니다. 이 키는 브라우저에서 사용하는 공개 키이므로 REST API 키를 대신 입력하면 안 됩니다.

## VS Code + CMD에서 실행

```cmd
cd /d C:\workspace\Menu_recs
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다. 개발 서버를 종료할 때는 CMD에서 `Ctrl+C`를 누릅니다.

## 검증 명령

```cmd
npm test
npm run lint
npm run build
```

앱용 식당 JSON에서 검수용 `geocoding` 필드를 제거하고 파일을 압축하려면 다음 명령을 실행합니다. 원본 전처리 파일은 별도로 보존하고 `public/data/restaurants.json`에 복사한 뒤 실행합니다.

```cmd
npm run data:optimize
```

카카오 장소 ID와 업체 상세 URL을 보강하려면 `.env.example`을 `.env.local`로 복사하고 REST API 키를 입력한 뒤 실행합니다. `.env.local`은 Git에 포함되지 않습니다.

```cmd
copy .env.example .env.local
npm run data:enrich-kakao
```

식당명 정규화 결과가 완전히 같고 저장 좌표에서 500m 안에 있는 장소만 연결합니다. 결과는 50건마다 저장되며, 중단 후 같은 명령을 실행하면 이어서 처리합니다. 소량만 시험하려면 다음처럼 실행할 수 있습니다.

```cmd
npm run data:enrich-kakao -- --limit=10
```

프로덕션 빌드 결과는 `dist` 폴더에 생성됩니다. 로컬에서 빌드 결과를 확인하려면 다음 명령을 실행합니다.

```cmd
npm run preview
```

## 주요 구조

```text
public/data/restaurants.json  앱에서 불러오는 식당 데이터
src/components/              화면 구성 요소
src/data/                    정적 데이터 로더
src/domain/                  거리·필터·추첨 순수 로직과 테스트
src/hooks/                   데이터 및 현재 위치 상태 관리
```

## 거리 기준

이동 시간은 실제 경로 탐색 결과가 아니라 두 좌표 사이의 직선거리와 평균 속도(도보 시속 4km, 자차 시속 24km)로 계산한 예상값입니다. 주변 추천의 범위를 벗어나지 않도록 넓게 보기에도 도보 2km, 자차 20km의 최대 검색 범위를 적용합니다. 식당은 선택한 예산 이하 메뉴가 하나 이상 있을 때만 추천 후보에 포함됩니다.
