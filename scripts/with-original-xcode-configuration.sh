#!/bin/bash

export RP_ORIGINAL_XCODE_CONFIGURATION="${CONFIGURATION-}"
exec /bin/bash -l "$@"
