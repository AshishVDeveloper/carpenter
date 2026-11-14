#!/usr/bin/env bash
# Tells Bing, Yandex, Seznam and other IndexNow search engines about every page in sitemap.xml.
set -e
KEY=311642c9c9c58cb99ff31ed8084e6e73
HOST=$(grep -o '<loc>https://[^/]*' sitemap.xml | head -1 | sed 's#<loc>https://##')
URLS=$(grep -o '<loc>[^<]*' sitemap.xml | sed 's#<loc>##' | head -9000 | python3 -c 'import sys,json;print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
curl -s -o /dev/null -w "IndexNow: %{http_code}\n" -X POST https://api.indexnow.org/indexnow -H 'Content-Type: application/json; charset=utf-8' \
  -d "{\"host\":\"$HOST\",\"key\":\"$KEY\",\"keyLocation\":\"https://$HOST/$KEY.txt\",\"urlList\":$URLS}"
