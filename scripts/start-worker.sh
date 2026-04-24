#!/bin/sh
set -eu

export ATMA_RUNTIME_ROLE=worker
exec npm run start:worker
