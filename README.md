# SlashRush Web

`/Users/switch/Downloads/SlashRush-main` Godot 프로젝트를 기준으로 변환한 Phaser 3 모바일 가로모드 2D 액션 러너입니다. 논리 해상도는 1280×720이며 Phaser의 `FIT` 스케일링으로 데스크톱과 모바일 가로 화면에 대응합니다.

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

- Intro → Main Menu → Runner 60초 → Robot Samurai Boss → Result
- 탭: 기본 적/폭탄 공격
- 빠른 두 번 탭: 빠른 적 공격
- 0.45초 이상 누르기: 갑옷 적 공격
- 코인·Heal·Fever Orb는 베지 않고 통과 수집
- `Space`는 탭 입력, `R`은 재시작, `Esc`는 일시정지/뒤로가기
- `B`는 QA용 보스전 진입 단축키

## 원본 에셋

Godot 에셋은 [`public/assets/godot-source/assets`](public/assets/godot-source/assets)에 보존했고 `BootScene`에서 직접 로드합니다. 상세 조사 결과와 Phaser 매핑은 [`docs/PHASER2D_WEBGAME_DEVELOPMENT_PLAN.md`](docs/PHASER2D_WEBGAME_DEVELOPMENT_PLAN.md)에 기록했습니다.
