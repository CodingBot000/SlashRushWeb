# SlashRush Phaser 2D WebGame 개발계획서

작성일: 2026-08-17  
대상 프로젝트: `SLASHRUSH`  
목표 저장소: `SlashRushWeb`  
목표 배포: Vercel

## 1. 조사 결과와 현재 확정 범위

사용자가 제공한 원본은 `https://github.com/CodingBot000/SlashRush`입니다. 조사 시점에 GitHub 웹 페이지와 GitHub API 모두 `404 Not Found`를 반환했고, HTTPS clone은 인증 오류, SSH 접근은 `Permission denied (publickey)`로 실패했습니다. 작업 폴더에도 Godot 원본이나 `docs` 사본이 없었습니다.

따라서 원본의 마지막 `docs` 상태, 실제 씬 구조, 에셋 라이선스, 게임 규칙을 확인했다고 가정하지 않습니다. 현재 구현은 원본을 임의로 복제했다고 주장하지 않고, 다음 조건을 만족하는 Phaser 변환 기반을 먼저 완성합니다.

- Phaser 3 + Vite + TypeScript
- 논리 해상도 1280×720, `Phaser.Scale.FIT`, 모바일 가로모드 우선
- 메뉴 → 런 시작 → 점프/2단 점프 → 베기 → 적/코인/콤보 → 피격/게임오버 → 재시작
- 키보드와 터치 입력을 같은 게임 명령으로 연결
- 원본 에셋이 도착하면 교체 가능한 `BootScene` 텍스처 경계와 `public/assets` 경로

## 2. 시각·UX 기준

현재의 시각 기준은 차가운 인디고 야경 위에 시안 HUD와 오렌지 슬래시 효과를 두는 아케이드 액션 방향입니다. 화면 중앙은 게임 플레이, 상단은 점수·콤보·체력·일시정지, 하단 좌우는 모바일 터치 버튼으로 고정합니다.

가독성 기준:

- 가로 화면에서 핵심 HUD가 1280×720 논리 좌표 기준으로 항상 보인다.
- 작은 모바일 화면에서는 캔버스를 비율 유지로 축소하고, 세로 화면에서는 전용 가로모드 안내를 보여준다.
- 터치 버튼은 좌측 점프, 우측 베기로 구분하며 캔버스 전체 입력도 같은 명령으로 동작한다.
- 플레이어·적·코인·지형은 원본 에셋이 없을 때도 코드 생성 텍스처로 즉시 실행 가능하다.

## 3. 시스템 설계

```text
src/main.ts
  └─ Phaser.Game
      ├─ BootScene       : 실행 시 텍스처/에셋 준비
      └─ GameScene       : 메뉴, 월드, HUD, 입력, 전투, 점수 상태

src/game/rules.ts       : 순수 점수·콤보·스폰 규칙 및 Vitest 테스트
public/assets/          : 원본 Godot 에셋 수령 후 이식 위치
```

규칙과 렌더링을 분리하는 이유는 원본 Godot 문서가 복구될 때 숫자 밸런스나 충돌 판정을 UI 코드를 건드리지 않고 교체하기 위해서입니다.

## 4. 원본 에셋 이식 절차

원본 저장소가 공개되거나 zip으로 제공되면 다음 순서로 진행합니다.

1. 원본 `docs`의 최신 커밋과 Godot `project.godot`의 메인 씬을 읽고 이 문서의 미확정 항목을 갱신한다.
2. `sprites`, `textures`, `audio`, `fonts`, `tilemaps`를 분류하고 라이선스/파일 크기를 기록한다.
3. PNG/WebP는 `public/assets/godot-source/`에 원본 보존 복사하고, 필요 시 Phaser atlas JSON으로 변환한다.
4. Godot 씬의 플레이어 상태, 적 상태, 공격 프레임, 충돌 shape, 맵 진행 규칙을 `src/game` 모듈로 매핑한다.
5. 원본과 Phaser 캡처를 같은 시나리오로 비교해 레이아웃·프레임·점수·피격 결과를 조정한다.
6. 원본 에셋을 쓸 수 없는 경우에만 현재의 코드 생성 텍스처를 대체 구현으로 유지한다.

## 5. 완료 기준

- [x] Phaser 앱 부트 및 Vite build
- [x] 가로모드 스케일링과 세로 안내
- [x] 키보드/터치 입력
- [x] 점프, 2단 점프, 베기, 적 충돌, 코인, 콤보, 체력, 게임오버, 재시작
- [x] 순수 게임 규칙 단위 테스트
- [x] Playwright smoke test 초안
- [ ] 원본 Godot docs와 실제 상태 대조
- [ ] 원본 스프라이트/맵/사운드 전체 이식
- [ ] 원본과의 프레임 단위 플레이 패리티 검증
- [ ] GitHub `SlashRushWeb` 원격 생성/푸시
- [ ] Vercel 계정 연결 후 production 배포

## 7. 1차 QA 결과

2026-08-17 기준 다음 검증을 완료했습니다.

```text
npm test       : 4 tests passed
npm run build  : Vite production build passed
npm run test:e2e: 4 tests passed
```

브라우저에서 메뉴의 `START RUN`, 플레이 진입, 점프/베기 키 입력, 모바일 가로 844×390 화면, 세로 390×844 화면의 가로모드 안내를 확인했습니다. 확인 중 발견한 메뉴 버튼 라벨 가림 문제도 수정했으며, 확인한 브라우저 콘솔 오류는 없습니다.

남은 QA 리스크는 원본 Godot와 비교할 실제 기준 플레이 영상·씬·에셋이 없다는 점입니다. 원본이 복구되면 동일 시나리오를 녹화하여 충돌, 프레임, 점수, 사운드, 에셋 라이선스를 다시 대조합니다.

## 6. 배포 계획

정적 Vite 산출물이므로 Vercel 프로젝트의 root를 `SLASHRUSH`로 설정하고 `npm run build` 결과인 `dist`를 배포합니다. 환경 변수는 필요하지 않습니다. GitHub와 Vercel CLI 인증이 연결되면 다음을 수행합니다.

```bash
git init
git add .
git commit -m "Build Phaser SlashRush web game"
git branch -M main
git remote add origin <GitHub SlashRushWeb URL>
git push -u origin main
vercel link
vercel --prod
```

현재 환경에서는 원본 저장소 접근과 GitHub/Vercel 인증 상태를 확인할 수 없으므로, 해당 두 외부 작업은 인증 복구 후 재실행해야 합니다.
