# SlashRush Web

Phaser 3 기반의 모바일 가로모드 2D 액션 러너 프로토타입입니다. 논리 해상도는 1280×720이며 Phaser의 `FIT` 스케일링으로 데스크톱과 모바일 가로 화면에 대응합니다.

## 실행

```bash
npm install
npm run dev
```

검증 명령:

```bash
npm test
npm run build
npm run test:e2e
```

## 현재 플레이 루프

- `↑` / `W` 또는 화면 왼쪽 터치: 점프와 2단 점프
- `Space` / `X` 또는 화면 오른쪽 터치: 베기
- 적을 베면 콤보 배율과 점수가 올라가며 코인을 먹으면 보너스 점수를 얻습니다.
- 상단 오른쪽 버튼으로 일시정지할 수 있습니다.
- 세 번 피격되면 게임오버와 최고 점수가 표시됩니다.

## 원본 Godot 프로젝트 상태

요청받은 원본 URL `https://github.com/CodingBot000/SlashRush`는 현재 접근 시 404를 반환하며, 이 환경에도 원본 체크아웃이나 에셋이 없습니다. 따라서 현재 버전은 변환 구조와 플레이 루프를 먼저 완성한 독립 실행판입니다. 원본 저장소 접근이 복구되면 `public/assets/godot-source`와 에셋 어댑터를 통해 스프라이트·맵·사운드·규칙을 교체할 수 있습니다.

상세 판단과 다음 이식 단계는 [`docs/PHASER2D_WEBGAME_DEVELOPMENT_PLAN.md`](docs/PHASER2D_WEBGAME_DEVELOPMENT_PLAN.md)에 기록했습니다.
