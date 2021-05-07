# Installation

There are only three main requirements to install uniview.
1. Clang++ v12 or greater
2. Having NPM installed
3. NodeJS v12 or greater


## Checking Prerequisites

### Checking Clang Install
To check you have the correct version of clang installed, simply run the command:
```
clang++ --version
```
And check the version number is greater than 12

### Checking NPM install
Run the command:
```
npm -v
```

### Checking Node install
Run the command:
```
node -v
```


## Installing Uniview
Simply run:
```
npm install -g @qupa/uniview
```
This will install uniview, bind the compile command, and pre-build the standard libraries.

## Installing IDE Tools
There is a VSCode extension called `Uniview Language` which is the offical VSCode extension for the language.

## Checking Installation
```
uvc --version
```
