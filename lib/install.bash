#!/usr/bin/env bash

# Save the directory of where the CLI was
last=`pwd`

# cd to the directory of this script
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

# TODO: Update the CLI title to "Configuring - Uniview Dependencies"
cmake -S . -B build -G Ninja
# TODO: Update the CLI title to "Building - Uniview Dependencies"
cmake --build build
# TODO: Update the CLI title to "Installing - Uniview Dependencies"
cmake --build build --target install

# cd back to where the cli started this script from
cd $last