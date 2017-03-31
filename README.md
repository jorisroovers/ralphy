# Ralphy
Simple image scan organizing tool written in NodeJS using electron. Mainly for personal use,
no intention to make this distributable or production-quality at this point.
Ralphy works together with a google apps script (see ```google-apps/Code.gs```) that does
automatic file moving based on filename conventions applied by ralphy.


To get started:
```bash
cd ralphy
npm install
# Rebuild node modules, see here:
# http://stackoverflow.com/questions/42616008/node-module-version-conflict-when-installing-modules-for-electron
# https://github.com/electron/electron-rebuild
node_modules/.bin/electron-rebuild
npm start
```


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
- Simple PDF modification: rotate, merge