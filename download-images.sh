#!/bin/bash
# Descarga imágenes del sitio Durable actual a assets/images/
# Uso: ./download-images.sh

set -e
DEST="$(cd "$(dirname "$0")" && pwd)/assets/images"
mkdir -p "$DEST"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

download() {
  local name="$1"
  local url="$2"
  local enc
  enc=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$url', safe=''))")
  if curl -fsSL -A "$UA" -H "Referer: https://oxyhyperbaric.com/" \
    -o "$DEST/$name" "https://oxyhyperbaric.com/_next/image?url=${enc}&w=1920&q=90"; then
    echo "OK: $name"
  else
    echo "FAIL: $name — try manual download from $url"
  fi
}

echo "Downloading facility & stock images to $DEST"
echo "---"

download "facility-1.jpg" "https://cdn.durable.co/blocks/82NYLEWbSOWJsRlZsAY9DMg1HgK5hCArYiDSeRSIUR3cGZvnztctCqojGFu9Tx40.jpg"
download "facility-2.jpg" "https://cdn.durable.co/blocks/38OGplizWlTlpkGaeqdj5J2JTTknNSYYJ7PpWB7mC52EYe9iGedqIQYRcxdSp4Lw.jpg"
download "facility-3.jpg" "https://cdn.durable.co/blocks/2cVJfMA47KjMpiweF9qlHYfoRdAu0Oq3ZYtbRRDEWvlEohE8fUHw8WJtkp2NW7Zz.jpg"
download "benefit-athletic-recovery.jpg" "https://cdn.durable.co/getty/20gwmvZIdBfVeRmAuYNPYXEyaNPrb7IeisPL6c7TSDImy7soevXNafC1qKzh5JsW.jpeg"
download "benefit-inflammation.jpg" "https://cdn.durable.co/getty/d6pWceVQAiU5WgUQwBpv2ORoeqjhjEbMzXKaVFzWgXF24if8U5GFRNHmZGZPZkxu.jpeg"
download "benefit-cognitive.jpg" "https://cdn.durable.co/getty/bQRSNJbYyGgbm7SDBJUJfG6UHKedk1DwqFy4pPbtHy4FQC3EU1jFbJYMVO1nnHgE.jpeg"
download "benefit-mental-clarity.jpg" "https://cdn.durable.co/getty/1aKOdyxeF7iQAAkeREdX84rxtbNh2SdtWFr7jTTM86Sfo8bLH3aZcovCfvlFdQ9e.jpeg"
download "benefit-stress.jpg" "https://cdn.durable.co/getty/21lHo7mGdK2FeFlGl8bgORE6DjFEmWgcOAVGGlYc6cmpsTuhiVxgSfpTVv39HWyu.jpeg"
download "benefit-anti-aging.jpg" "https://cdn.durable.co/getty/21LgtXsriyI1k8Lf3lfaLRVwil1LDQewKe1gP8Oe9Pmw8j7WZaSBnrQ11EG7N3sM.jpeg"
download "benefit-sleep.jpg" "https://cdn.durable.co/getty/1dVbkcnnIqB1jwSbDlFSkT4zFkTlGOfzvs3k9tU6UlE7F4hs5IQuodWylif5hRzq.jpeg"
download "service-healing.jpg" "https://cdn.durable.co/getty/2d6RUmZBjdadHWpRvkEBQHnFAsx2AY92Hnycf6Buy6GhNB8AigkTW9WQkReeNk4F.jpeg"

VIDEOS="$(cd "$(dirname "$0")" && pwd)/assets/videos"
mkdir -p "$VIDEOS"
echo "Downloading hero background video..."
if curl -fsSL -o "$VIDEOS/hero-bg.mov" \
  "https://cdn.durable.co/getty-videos/1ahOcZdN9VhO0SXiJGcVyi45mzBe0Q1v3QRUvvroihMJjpV5yLBNG5XXZmcFXJhh.mov"; then
  echo "OK: assets/videos/hero-bg.mov"
else
  echo "FAIL: hero-bg.mov — site will use CDN fallback until downloaded"
fi

echo "---"
echo "Done."
