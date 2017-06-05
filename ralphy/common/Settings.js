const storage = require('electron-json-storage');
// Use https://github.com/jviotti/electron-json-storage together with electron's remote


function Settings() {
    var self = {};

    // FUTURE: Do validation using https://github.com/hapijs/joi
    var DEFAULT_SETTINGS = {
        "initialSetup": true,
        "watchDirectory": "",
        "watchFilePattern": "test-scan(.*)\.pdf",
        "googleDriveLogFile": "ralphy-automove-log.json",
        "googleDriveConfigFile": "ralphy-config.json"
    };

    var STORAGE_KEY = 'settings.user';

    self.settings = {};

    self.load = function () {
        // let's use ES6 native promises:
        // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise
        var promise = new Promise(function (resolve) {
            storage.get(STORAGE_KEY, function (error, data) {
                if (error) throw error;
                if (Object.keys(data).length === 0) {
                    // deepcopy: https://stackoverflow.com/questions/6089058/nodejs-how-to-clone-a-object
                    data = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                }
                self.settings = data;
                resolve();
            });
        });
        return promise;
    };

    self.save = function (newSettings) {
        self.settings.initialSetup = false; // Since we're saving, it's not the intialSetup anymore
        storage.set(STORAGE_KEY, self.settings);
    };

    self.reset = function () {
        var promise = new Promise(function (resolve) {
            storage.clear(function () {
                // deepcopy: https://stackoverflow.com/questions/6089058/nodejs-how-to-clone-a-object
                self.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
                resolve();
            });
        });
        return promise;
    };

    return self;
}

module.exports = {settings: Settings()};