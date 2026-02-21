#!/bin/bash
cd /home/runner/workspace
rm -rf .next/lock 2>/dev/null
npx next build && npx next start -p 5000
