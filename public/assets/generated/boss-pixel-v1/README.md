# Boss Pixel Layer Package v1

이 폴더는 640×725 기준 보스 이미지를 애니메이션 가능한 레이어로 분리한 런타임 에셋이다. `BootScene`에서 로드하고 `BossVisualController`에서 조립·애니메이션한다.

## 레이어 순서

뒤에서 앞으로 다음 순서로 배치한다.

1. `spiritAura`
2. `spiritBody`
3. `armorWaist`
4. `armorHead`
5. `armorRightArmShoulder`
6. `armorLeftArmShoulderSword`

정확한 파일, 크기, 좌표, 회전축은 `boss-layout.json`을 기준으로 한다.

## 배치 규칙

- 마스터 좌표계는 좌상단 `(0, 0)`, 크기는 `640×725`다.
- 정적 배치는 각 레이어의 `placement.x`, `placement.y`에 `origin(0, 0)`으로 배치한다.
- 회전 애니메이션을 적용할 때는 `pivot.originX`, `pivot.originY`를 origin으로 사용하고 `pivot.positionX`, `pivot.positionY`에 배치한다.
- 갑옷 관절 경계에는 2px 겹침을 남겨 작은 회전에서 투명 틈이 보이지 않게 했다.
- 전체 보스 크기 변경은 각 부위를 따로 스케일하지 말고 부모 컨테이너 하나만 스케일한다.

## 불꽃 스프라이트

- `sprites/spirit_body_sheet.png`: 3열×1행, 3개 고유 프레임, 권장 루프 `0 → 1 → 2 → 1`, 프레임당 220ms
- `sprites/spirit_aura_sheet.png`: 2열×2행, 4프레임, 권장 루프 `0 → 1 → 2 → 3`, 프레임당 120ms
- 시트 프레임 좌표와 원본 캔버스 offset은 `boss-layout.json`의 `animations`에 기록되어 있다.
- 런타임에서는 정적 `layers/spirit_body.png`, `layers/spirit_aura.png`와 시트를 동시에 로드할 필요가 없다. 정적 파일은 확인 및 폴백용이다.

## 갑옷 회전축

- 머리: 마스터 `(286, 285)`
- 오른쪽 팔·어깨: 마스터 `(377, 220)`
- 왼쪽 팔·어깨·칼: 마스터 `(210, 345)`
- 허리: 마스터 `(392, 390)`

`preview/boss_layout_debug.png`에서 색상 사각형은 부위 경계, 십자 표시는 회전축이다. `preview/boss_layer_composite.png`는 모든 레이어를 기본 좌표로 합친 검증 이미지다.

## 재생성

외부 Python 패키지 없이 다음 명령으로 동일한 결과를 재생성할 수 있다.

```bash
python3 scripts/build_boss_pixel_assets.py \
  --armor public/assets/generated/boss-pixel-v1/source/boss_armor_master_640x725.png \
  --spirit public/assets/generated/boss-pixel-v1/source/boss_spirit_master_640x725.png \
  --output public/assets/generated/boss-pixel-v1
```
