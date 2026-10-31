#!/bin/sh
# keyword-draw.html(Artifact용, <html>·<head>·<body> 없음)로 배포용 index.html을 만들고, 스크립트 문법을 검사함
set -e
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  # 머리: 스타일시트 링크 줄까지 (Artifact 전용 meta는 뺌)
  awk '{print} /^<link rel="stylesheet" href="style.css">$/{exit}' keyword-draw.html | grep -v 'claude:viewport-fit-sides'
  printf '</head>\n<body>\n'
  awk 'f{print} /^<link rel="stylesheet" href="style.css">$/{f=1}' keyword-draw.html
  printf '</body>\n</html>\n'
} > index.html
for f in js/*.js; do node --check "$f"; done
echo "index.html 만듦, js 문법 검사 통과"
