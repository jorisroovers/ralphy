# Ralphy
Simple image scan organizing tool written in NodeJS using electron.
Mainly for personal use, no intention to make this distributable or production-quality at this point.

To get started:
```bash
cd ralphy
npm install
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
- Links to Google drive and local watch directory
- Notifications on new log entries
- Auto-complete tags
