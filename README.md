# 千咲 · CHISA — 명조 팬 아카이브

명조(Wuthering Waves)의 공명자 **치사(千咲, Kuchiba Chisa)** 를 위한 개인 감상용 팬 페이지입니다.
빌드 도구·의존성 없이 정적 HTML/CSS/JS로만 동작합니다.

## 실행

브라우저에서 `index.html`을 바로 열어도 되지만, `data/*.json`을 `fetch`로 읽기 때문에
**로컬 서버로 여는 것을 권장**합니다.

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## 구성

| 섹션 | 내용 |
| --- | --- |
| 개요 | 중앙 대형 일러스트(전신/클로즈업/스플래시/쇼케이스 전환) 주위로 기본 정보·포르테·외형·성격·전투·일러스트 카드 배치 |
| 프로필 | 신상 기록 15항목, 4개 국어 성우, 포르테 감정 보고서, 스킬 7종 |
| 성격 | 성격 6단면, 외형 디테일, 소중한 물건 3종, 인연, 사소한 사실 |
| 이야기 | 캐릭터 스토리 5편 (6세 → 18세, 호나미 루프) 한국어 |
| 목소리 | **실제 게임 음성 30종 × 한국어/일본어/영어/중국어**, 대사 원문 동시 표시, 순차 재생·랜덤 재생 |
| 영상 | 쿠로 게임즈 공식 유튜브 7편 (캐릭터 PV, 전투 시연, EP 음악, 심야 라디오) |
| 3D 모델 | **내 PMX 모델 뷰어** (물리·의상 파츠·표정) + Sketchfab 라이브 뷰어 3종 + 배포본 5곳 |
| 갤러리 | 공식 일러스트·모션 29점 + Safebooru/Danbooru API 실시간 팬아트 (태그 조합 검색, 수위 4단계, 원본 초고화질, 다운로드, 무한 스크롤·라이트박스) |

## 데이터

- `data/chisa.json` — 프로필, 성격, 외형, 스킬, 캐릭터 스토리, 영상 목록
- `data/voicelines.json` — 음성 30종의 제목·대사·4개 국어 오디오 URL
- `data/official-art.json` — 공식 일러스트/모션 29점의 제목·URL
- `data/models.json` — 3D 모델 뷰어·배포본 목록 (형식/물리/의상 교체/라이선스)

이미지와 음성은 저장소에 담지 않고 **브라우저가 원본 서버에서 직접 불러옵니다.**

- 공식 아트·음성: Wuthering Waves Wiki (Fandom)
- 팬아트: `safebooru.org`, `danbooru.donmai.us` 공개 JSON API — 태그 `chisa_(wuthering_waves)`
- 영상: YouTube `youtube-nocookie.com` 임베드

### 갤러리 사용법

**태그 조합 검색** — `chisa_(wuthering_waves)` 는 고정이고 그 위에 태그를 더한다.
빠른 선택 칩 20종(교복·수영복·비키니·기모노·치비 …)을 누르거나, 입력창에 두 글자 이상 치면
Safebooru 태그 API로 자동완성이 뜬다(↑↓ 이동, Enter 추가, Esc 닫기). 칩의 ✕로 뺀다.

> 비로그인 Danbooru는 검색어 2개까지만 허용한다. 추가 태그가 1개면 정렬 메타태그를 자동으로 빼서
> 통과시키고(정렬은 클라이언트에서 처리), 2개 이상이면 Danbooru만 건너뛴 뒤 상태 줄에 이유를 적는다.
> Safebooru는 개수 제한이 없다.

**수위** — `general` / `sensitive` / `questionable` / `explicit` 를 각각 켜고 끈다. 기본값은 앞의 둘.
Safebooru는 전연령 미러라 `q`·`e` 는 Danbooru에서만 온다.

**화질** — *미리보기* 는 샘플, *원본 초고화질* 은 `file_url` 원본을 그대로 격자에 건다.
바꿔도 다시 받지 않고 이미 있는 카드의 `src` 만 교체한다. 라이트박스는 언제나 원본이다.

**다운로드** — 카드 우상단 버튼, 라이트박스의 *원본 다운로드* 버튼, 또는 라이트박스에서 `S` 키.
`fetch → Blob → a[download]` 로 바로 저장하고, 파일명은 `chisa_<소스>_<id>.<확장자>` 가 된다.
원본 서버가 CORS를 막으면 Safebooru 게시물은 같은 md5의 Danbooru CDN 사본으로 자동 재시도하고,
그것도 막히면 새 탭에 원본을 띄운 뒤 안내 토스트를 보여준다.
*URL 목록 복사* 는 현재 불러온 원본 주소 전부를 클립보드에 넣는다.

**그 밖에** 정렬(인기·최신·무작위), 소스(Safebooru / Danbooru / 둘 다) 선택.
Danbooru는 접속 환경에 따라 봇 검사(Cloudflare)로 차단될 수 있으며, 이때는 Safebooru 결과만 표시되고
상태 줄에 안내가 뜬다.

## 3D 모델

### 내 모델 뷰어 (MMD · PMX)

받아 둔 모델 zip을 드롭하면 브라우저가 직접 열어 **Bullet 물리까지 그대로** 돌린다.
three.js `MMDLoader` + `MMDAnimationHelper` + Ammo(WASM) 조합이고, zip 해제와 GBK 파일명 디코딩,
텍스처 경로 매핑은 `assets/js/viewer.js` 안에서 직접 처리한다.

- **모델 파일은 저장소에 없다.** 제작자(鸣潮 / 1010浣)가 개조 여부와 무관하게 재배포를 금지했고,
  용량도 100MB를 넘는다. 파일은 브라우저 메모리에서만 blob URL로 살아 있다가 탭을 닫으면 사라진다.
- zip 여러 개를 한 번에 넣으면 안에 든 `.pmx` 를 모두 찾아 **모델 전환 버튼**으로 만든다
  (기본 교복 ↔ 수영복).
- **의상 · 파츠** 패널에서 재질을 끄고 켜서 갈아입힌다. 재질 이름 앞부분(`Cloth_`, `Up_`, `Down_`,
  `Hair_`, `Face_`, `Eye_`)으로 자동 그룹화하고 그룹 단위 토글도 된다.
- **표정** 패널은 모프를 검색해 슬라이더로 조절한다.
- 물리 on/off, 흔들림, 회전, 한 번 흔들기, 시점 초기화, PNG 스크린샷.

검증한 모델 (Aplaybox 배포본):

| 모델 | 정점 | 삼각형 | 본 | 모프 | 강체 | 조인트 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 鳴潮_千咲 1.02 / 1.03 (교복) | 65,156 | 97,048 | 1,117 | 176 | 922 | 1,428 |
| 千咲 泳装 (수영복) | 78,917 | 96,951 | 564 | 116 | 417 | 658 |

### Sketchfab 뷰어

브라우저에서 바로 돌려볼 수 있는 Sketchfab 모델 3종(모두 CC-BY, 다운로드 가능)을 지연 로딩으로 임베드하고,
그 아래에 배포본을 물리·의상 교체 기준으로 정리했다.

| 배포본 | 형식 | 물리 | 의상 교체 |
| --- | --- | --- | --- |
| [Aplaybox 초정밀 리깅 모델](https://www.aplaybox.com/details/model/7KkisVs42Ofv) | PMX | 최상급 (머리카락 한 가닥까지 강체·조인트) | 모프로 파츠 전환 |
| [OZ-Sys MMD](https://www.deviantart.com/oz-sys/art/MMD-Wuthering-Waves-Chisa-DL-1271648960) | PMX | 있음 (머리·치마·재킷) | 가능 |
| [NekoPixil FBX](https://www.deviantart.com/nekopixil/art/FBX-Chisa-Wuthering-Waves-3D-Model-DL-1280835622) | FBX + PSK | 리깅만 (직접 구성) | 파츠 분리로 가장 쉬움 |
| [Garry's Mod 애드온](https://steamcommunity.com/sharedfiles/filedetails/?id=3594900996) | GMod PM/NPC | 래그돌 + 지글본 | Bodygroups |
| [Sketchfab 3종](https://sketchfab.com/search?q=chisa+wuthering&type=models) | glTF/FBX/USDZ | 없음 | 메시에 따라 |

## 저작권

치사와 명조의 모든 저작권은 **KURO GAMES**에 있습니다. 팬아트의 저작권은 각 원작자에게 있습니다.
이 페이지는 비상업적 개인 감상 목적이며, 어떤 이미지·음성·영상도 재배포하지 않고 원본 출처로 링크·표시만 합니다.
