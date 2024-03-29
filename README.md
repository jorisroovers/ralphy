# Ralphy
[![Build Status](https://travis-ci.org/jorisroovers/ralphy.svg?branch=master)](https://travis-ci.org/jorisroovers/ralphy)

Simple image scan organizing tool written in NodeJS using electron. Mainly for personal use,
no intention to make this distributable or production-quality at this point.
Ralphy works together with a google apps script (see ```google-apps/Code.gs```) that does
automatic file moving based on filename conventions applied by ralphy.


To get started:
```bash
cd ralphy
npm install
npm start
```

It used to be required to use electron-rebuild, but as of 2023-03-16, that doesn't seem to be required anymore:
```sh
# Rebuild node modules, see here:
# http://stackoverflow.com/questions/42616008/node-module-version-conflict-when-installing-modules-for-electron
# https://github.com/electron/electron-rebuild
node_modules/.bin/electron-rebuild
npm start
```

https://github.com/astefanutti/decktape/issues/201


# Upgrading packages #

Packages can easily be upgrades to the lastest version using [npm-check-updates](https://www.npmjs.com/package/npm-check-updates).
 ```bash
 # Show what upgrades are avaialable:
 ncu -u
 # Update versions in package.json
 ncu -a
 # Actually perform the updates
 npm update
 ```


# Wishlist #
Ralphy development is just getting started. Some of the things we'd like:
- Sass
- Unit and Integration tests
- Bugfix: support slashes in tags
- Notifications on new log entries
- Auto-complete tags
- Simple PDF modification: delete pages, merge
- Fuzzy tag matching using http://fusejs.io/ or similar library