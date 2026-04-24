#!/bin/sh
set -eu

export ATMA_RUNTIME_ROLE=api
exec npm run start:api
