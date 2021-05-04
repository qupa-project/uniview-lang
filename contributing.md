# Contributing

We are currently not looking for any core contributors until version 1.0 is release, but until then your feedback and bug reports would be greatly appreciated.

## Code of Conduct

Please refer to [code-of-conduct.md](./code-of-conduct.md) for details.

## Running from source

First of all ensure you have all of the pre-requisites for installing already setup.  
Then while in the directory of the repo run the command:
```
npm install . -g
```
This will bind the source versions of the uniview commands to your global commands.  
Then you can just run ``uvc`` as normal.

### Rebuilding Static Components

When any changes are made to the `runtime.cpp` or the `syntax.bnf` the following command must be ran to experience the changes
```
npm run build
```
