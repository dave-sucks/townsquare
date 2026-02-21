#!/bin/bash
cd /home/runner/workspace
fuser -k 5000/tcp 2>/dev/null
rm -rf .next/lock 2>/dev/null
npx next build && npx next start -p 5000
