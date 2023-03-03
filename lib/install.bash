#!/bin/bash

# Save the directory of where the CLI was
last=`pwd`

# cd to the directory of this script
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

# TODO: Update the CLI title to "Uniview Dependencie Setup - Configuring..."
cmake -S . -B build -G Ninja --install-prefix="$SCRIPT_DIR/install"
# TODO: Update the CLI title to "Uniview Dependencie Setup - Building..."
cmake --build build
# TODO: Update the CLI title to "Uniview Dependencie Setup - Installing..."
cmake --build build --target install

# cd back to where the cli started this script from
cd $last