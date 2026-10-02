# 도르단 워터마크

그림과 사진에 원하는 문구를 반복해서 넣고 PNG, JPG 또는 움직이는 GIF로 저장하는 워터마크 생성기입니다.

- 여러 줄 / 한 줄 반복, 색상, 크기, 간격, 기울기, 불투명도 조절
- 좌우로 흐르는 워터마크 미리보기와 반복 재생 GIF 저장
- GIF 속도와 크기 선택, 저장 진행률 및 취소
- 이미지는 브라우저 안에서 처리하며 서버로 업로드하지 않습니다.
- 별도 설치나 빌드 없이 동작합니다.

## GitHub Pages 배포

파일과 vendor 폴더를 공개 저장소의 최상위에 올린 뒤, Settings → Pages에서 Deploy from a branch, main, /(root)를 선택하고 Save를 누르세요.

## 로컬 실행

이 폴더에서 `python -m http.server 8000`을 실행한 뒤 브라우저에서 `http://localhost:8000`을 여세요.

## 오픈소스

GIF 인코딩에 gifenc 1.0.3 (MIT)을 사용합니다. 라이선스는 vendor/gifenc-LICENSE.md에 포함되어 있습니다.

