#!/bin/bash
set -e

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Define the path to the Node.js executable
# We try to use the system node. If you use nvm, you might need to adjust this
# or ensure node is symlinked to /usr/bin or /usr/local/bin.
NODE_EXEC=$(which node)

if [ -z "$NODE_EXEC" ]; then
    if [ -x "/usr/local/bin/node" ]; then
        NODE_EXEC="/usr/local/bin/node"
    elif [ -x "/usr/bin/node" ]; then
        NODE_EXEC="/usr/bin/node"
    else
        # Final fallback, hope it's in the PATH inherited by Chrome
        NODE_EXEC="node"
    fi
fi

# Run the host script
"$NODE_EXEC" "$DIR/host.js"
