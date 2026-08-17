# SlashRush Phaser 2D WebGame 개발계획서

작성일: 2026-08-17  
기준 원본: `/Users/switch/Downloads/SlashRush-main`  
목표 저장소: `SlashRushWeb`  
배포 대상: Vercel

## 1. 조사 결론

다운로드된 Godot 4.x 프로젝트를 기준 소스로 확정했다. 기존 Phaser 프로토타입의 점프/네온 러너 루프는 원본과 달라 폐기하고, 원본의 모바일 가로형 액션 러너 구조를 Phaser 3 + Vite + TypeScript로 변환한다.

원본에서 확인한 씬 흐름은 다음과 같다.

```text
IntroScene → MainMenu → CharacterSelect / HowTo
                         ↓
                   RunnerStage (60초)
                         ↓
                   BossStage (로봇 사무라이)
                         ↓
                     ResultScene
```

원본의 핵심 설계:

- 논리 해상도 1280×720, 모바일 가로모드, CanvasItems stretch
- 플레이어는 화면 왼쪽에 고정되고 배경·지형·오브젝트가 왼쪽으로 이동
- 러너 제한 시간 60초, 시작 HP 3, Fever 게이지 100
- 입력은 탭, 빠른 두 번 탭, 길게 누르기, 무입력 통과의 네 종류
- 일반 적은 탭, 빠른 적은 두 번 탭, 갑옷 적은 홀드로 처리
- 코인·회복 아이템·Fever Orb는 베지 않고 통과해 자동 수집
- 러너 종료 후 로봇 사무라이 보스전으로 전환
- 보스 HP 10, 탭/두 번 탭/홀드/대기 패턴을 순서대로 수행

## 2. 원본 규칙 매핑

| 오브젝트 | 입력 | 점수 | Fever | Phaser 키 |
| --- | --- | ---: | ---: | --- |
| 기본 적 | TAP | 100 | 6 | `scarecrow2.png` |
| 빠른 적 | TAP TAP | 150 | 10 | `red_ghost2.png` |
| 갑옷 적 | HOLD | 150 | 10 | `drum2.png` |
| 폭탄 | TAP | 80 | 4 | `apple_rotten.png` |
| 코인 | 무입력 통과 | 20 | 0 | `coin.png` |
| 회복 아이템 | 무입력 통과 | 0 | 0 | `apple.png` |
| Fever Orb | 무입력 통과 | 50 | 25 | `fever_orb.png` |

잘못된 공격은 보상 없이 콤보를 끊고 HP를 감소시킨다. 성공 공격은 콤보와 Fever를 올리며, Fever 중에는 공격 가능한 적을 넓게 처리한다.

보스 패턴은 원본 데이터의 phase 1/2 구조를 반영한다. TAP, TAP TAP, HOLD는 성공 시 200점과 Fever 25를 주고, WAIT는 자동 통과한다. 보스 처치 시 500점 클리어 보너스를 지급한다.

## 3. 에셋 이식

원본 `assets/` 전체를 다음 위치에 보존 복사했다.

```text
public/assets/godot-source/assets/
```

포함 범위:

- 인트로·스테이지·보스 배경
- 로고·메뉴 버튼·설정 아이콘·HUD 이미지
- 플레이어 idle/run/damage/dead/slash 스프라이트
- scarecrow, ghost, drum, apple, coin, Fever Orb
- 로봇 사무라이 body/head/arms/sword/core/scraps
- lobby/running/boss 음악과 UI·slash·pickup·error 효과음

Godot의 배경 셰이더가 처리하던 밝은 무채색 매트 제거는 `GameScene.prepareAlphaKeyTexture()`로 옮겼다. 이 처리는 WebGL 파이프라인이 없는 브라우저 CanvasRenderer에서도 동일하게 보이도록 로드 후 Canvas 픽셀 알파를 생성한다. `sky_static.png`는 다운로드본에 흰색 매트가 포함되어 있어 원본 색상에 맞춘 녹색→금색 그라디언트를 하늘 바탕으로 사용한다.

## 4. Phaser 구조

```text
src/main.ts
  └─ Phaser.Game
      ├─ BootScene       : 원본 PNG/오디오 로드
      └─ GameScene       : Intro/Menu/Select/HowTo/Runner/Boss/Result

src/game/rules.ts        : 입력 판정, 점수, 오브젝트 규칙, 스폰 일정
src/game/config.ts       : 1280×720 FIT 및 모바일 스케일
public/assets/godot-source/assets/
                         : 원본 에셋 보존 영역
```

입력은 터치와 키보드를 같은 명령으로 통합한다.

- 화면 탭 / `Space`: TAP
- 짧은 두 번 탭 / `Space` 두 번: TAP TAP
- 0.45초 이상 누르기: HOLD
- `B`: QA용 러너→보스 전환
- `R`: 현재 진행 재시작
- `Esc`: 일시정지 또는 이전 화면

## 5. 모바일 가로모드 기준

- 게임 논리 화면은 1280×720으로 고정한다.
- `Phaser.Scale.FIT`와 중앙 정렬로 비율을 유지한다.
- 세로 화면에서는 게임 입력을 막고 `#orientation-lock` 가로모드 안내를 표시한다.
- 세로 화면에서는 Phaser 캔버스를 숨겨 안내 카드가 게임 화면과 겹치지 않게 한다.
- 터치 이벤트의 press duration으로 TAP/HOLD를 구분하고, 더블 탭 시간창은 0.25초로 둔다.
- HUD와 보스 게이지는 1280×720 기준 안전 영역 안에 배치한다.

## 6. 구현 상태

- [x] 원본 Godot 프로젝트의 씬 흐름·입력·점수·보스 패턴 조사
- [x] 원본 에셋 전체를 `public/assets/godot-source/assets`로 이식
- [x] Intro / MainMenu / CharacterSelect / HowTo / Runner / Boss / Result 구현
- [x] 원본 플레이어·오브젝트·보스·배경·오디오 연결
- [x] 60초 러너, HP 3, 콤보, Fever, 코인, 로컬 최고 점수
- [x] 모바일 터치와 데스크톱 키보드 입력 통합
- [x] 원본 배경 매트 제거 셰이더를 Canvas 픽셀 처리로 변환
- [x] 적 처리 시 원본 스프라이트 제거 후 분할 조각만 0.62초 표시
- [x] 웹판 플레이어 기준에 맞춰 베기 칼 표시 크기 조정
- [x] 인플레이 우측 접이식 Sword Debug 패널에서 칼 상시 표시·X/Y 이동·크기 조정 제공
- [x] 허수아비·불꽃 유령·주전자 중갑옷·폭탄을 신규 픽셀 에셋으로 교체
- [x] 메인 플레이어 러닝·대기·피격·사망 스프라이트를 픽셀 에셋으로 적용하고 원본 백업 보존
- [x] 설정에서 러너/보스 무적모드 ON/OFF 제공
- [x] Vitest 규칙 테스트 및 Vite production build
- [x] 브라우저 인트로/메뉴/러너/보스 진입과 콘솔 오류 점검
- [x] 모바일 가로 844×390 16:9 FIT 및 세로 390×844 안내/캔버스 숨김 확인
- [ ] 원본 Godot와 프레임 단위 플레이 패리티 비교
- [x] GitHub 원격 `SlashRushWeb` 신규 생성 및 push
- [x] Vercel production 배포 최신본 확인

## 7. QA 체크리스트

```text
npm test       : rules 단위 테스트
npm run build  : TypeScript + Vite production build
npm run test:e2e: Playwright smoke / orientation test
npm run dev    : http://127.0.0.1:4173/
```

브라우저에서 확인할 시나리오:

1. 인트로 탭/Space → 원본 로고 메뉴 표시
2. PLAY → 원본 배경, 고정 플레이어, 오브젝트 입력 안내 표시
3. TAP/TAP TAP/HOLD 및 아이템 무입력 통과 판정, 적 원본 제거·분할 조각 소멸
4. `B` → 보스 배경, 로봇 사무라이, 보스 HP/패턴 HUD 표시
5. 결과 화면 RETRY/MENU, 최고 점수·코인 저장
6. 가로 모바일 화면 스케일링과 세로 화면 가로모드 안내

## 8. 알려진 변환 차이

Godot의 개별 AnimationPlayer 타이밍과 보스 파츠별 원본 모션은 Phaser에서 동일한 입력·상태·시각 자산을 유지하는 범위로 근사했다. 원본의 물리 충돌 shape와 프레임 단위 모션 데이터가 추가로 필요하면 동일 시나리오 녹화 비교를 통해 수치를 조정한다. 배포 전에는 반드시 `npm run build`, `npm test`, `npm run test:e2e`를 다시 실행한다.
