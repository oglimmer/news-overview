#!/bin/bash

set -eu

source ./.env

lastItemInProcess=

setStatus() {
  if [ -n "$lastItemInProcess" ]; then
    curl -s "${URL}/api/v1/feed-item-to-process/$lastItemInProcess" \
      -H "Content-Type: application/json" \
      -u "$USERNAME:$PASSWORD" -d '{"processState": "NEW"}' -X PATCH
    lastItemInProcess=
  fi
}

trap 'setStatus' SIGINT
trap 'setStatus' ERR

wait_until_http_status() {
  local max_attempts=10
  local sleep_time=5

  for ((attempt=0; attempt<max_attempts; attempt++))
  do
    if curl -s -w "%{http_code}" \
      -u "$USERNAME:$PASSWORD" \
      "${URL}/actuator/health" | grep 200 > /dev/null
    then
      echo "HTTP status code 200 received after $(($attempt+1)) attempts"
      return
    fi

    echo "Attempt $attempt/$max_attempts: Could not reach "${URL}/actuator/health". Retrying in $sleep_time seconds..."
    sleep $sleep_time # Wait before checking again
  done

  echo "Maximum attempts exceeded. Could not reach "${URL}/actuator/health""
}

wait_until_http_status


while true; do

  responseBodyAndStatus=$(curl -s -w "%{http_code}" "${URL}/api/v1/feed-item-to-process/next" \
    -H "Content-Type: application/json" \
    -u "$USERNAME:$PASSWORD")
  
  if [[ $responseBodyAndStatus == *200 ]]; then
      body=$(echo "$responseBodyAndStatus" | sed 's/...$//')

      id=$(echo "$body" | jq -r '.id')
      refId=$(echo "$body" | jq -r '.refId')
      url=$(echo "$body" | jq -r '.url')
      title=$(echo "$body" | jq -r '.title')
      feed_id=$(echo "$body" | jq -r '.feed.id')
      cookie=$(echo "$body" | jq -r '.feed.cookie')
      lastItemInProcess=$id

      trap 'setStatus' RETURN

      if [ "$cookie" = "null" ]; then
        cookie=""
      fi
      
      start_time=$(date +%s)
      echo "********************************************************"

      echo "Fetching URL: $url with refId: $refId"

      curl -s "$url" \
          -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0' \
          -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
          --cookie "$cookie" > page.html

      # Convert HTML to text based on the operating system
      if [[ "$OSTYPE" == "darwin"* ]]; then
        # textutil -convert txt page.html
        cat page.html | node html2txt.js | node shrink.js > page.txt
      else
        cat page.html | node html2txt.js | node shrink.js > page.txt
      fi

      cat page.txt | node generateAiSummary.js | node pushToDB.js $feed_id $id

      lastItemInProcess=

      end_time=$(date +%s)
      total_time=$((end_time - start_time))
      echo "Fetching, text generation and upload completed in $total_time seconds."
  elif [ "$responseBodyAndStatus" = "404" ]; then
    lastItemInProcess=
    
    responseAllFeeds=$(curl -s "${URL}/api/v1/feed" -H "Content-Type: application/json" -u "$USERNAME:$PASSWORD")
    # we need to remove the cookie from the response because it contains " and it will break the jq command when retrieving id/url
    echo "$responseAllFeeds" | jq -c 'del(.[].cookie) | .[]' | while read item; do
      id=$(echo "$item" | jq -r '.id')
      url=$(echo "$item" | jq -r '.url')
      node fetch_atom.js "$url" $id
    done

    echo "No more items to process. Sleeping for 60 seconds."
    sleep 60
  else
    lastItemInProcess=
    echo "An unexpected HTTP status code was returned: $responseBodyAndStatus"
  fi
done
