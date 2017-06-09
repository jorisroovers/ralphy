const settings = require("../common/Settings").settings;
// change the settings key so we can mess around with it and not affect the app
settings.STORAGE_KEY = "test-key";


beforeEach(function (done) {
    settings.reset().then(done);
});

test("settings.load() should load default settings on first try", function (testDone) {
    // No data before loading
    expect(settings.settings).toEqual({});

    expect(settings.load().then(function () {
        // since it's the first load, we should get the previous settings
        expect(settings.settings).toEqual({
            "initialSetup": true,
            "watchDirectory": "",
            "watchFilePattern": "test-scan(.*)\.pdf",
            "googleDriveLogFile": "ralphy-automove-log.json",
            "googleDriveConfigFile": "ralphy-config.json"
        });
        testDone();
    }));
});

test("settings.save() should save the settings", function (testDone) {
    settings.load().then(function () {
        // change existing setting, add new setting
        settings.settings['watchDirectory'] = "foobar";
        settings.settings['foo'] = "bar";

        settings.save().then(function () {
            const expected_settings = {
                "foo": "bar",
                "initialSetup": false,
                "watchDirectory": "foobar",
                "watchFilePattern": "test-scan(.*)\.pdf",
                "googleDriveLogFile": "ralphy-automove-log.json",
                "googleDriveConfigFile": "ralphy-config.json"
            };
            expect(settings.settings).toEqual(expected_settings);

            // Let's make sure the settings are still the same after reloading
            settings.load().then(function () {
                expect(settings.settings).toEqual(expected_settings);
                testDone();
            });

        });
    });


});