# MEDVIS Herb Library

증상/병증에서 출발해 전통 문헌 기반 약재와 처방 연결을 탐색하는 데스크톱 웹 시각화 프로토타입입니다.

이 전달용 폴더에는 이미 생성된 JSON 데이터가 포함되어 있어 공공데이터 API 키나 재수집 없이 바로 실행할 수 있습니다.

## 실행

```bash
npm install
npm run dev -- --port 5173
```

브라우저에서 열기:

```text
http://127.0.0.1:5173/
```

한약재 화면으로 바로 열기:

```text
http://127.0.0.1:5173/#library
```

## 빌드

```bash
npm run build
```

빌드 결과는 `dist/`에 생성됩니다.

## 포함된 데이터

프론트엔드는 아래 정적 JSON을 읽습니다.

```text
public/data/herbs.json
public/data/prescriptions.json
public/data/symptoms.json
public/data/edges.json
public/data/term_mapping.json
```

이 화면은 전통 문헌의 연결 관계를 탐색하기 위한 시각화이며, 진단/처방/복용 권고가 아닙니다.
