const storage = require('electron-json-storage');

angular.module('ralphy').controller('SettingsController', ['$scope', '$timeout', function ($scope, $timeout) {
    // Use https://github.com/jviotti/electron-json-storage together with electron's remote

    DEFAULT_SETTINGS = {
        "watchDirectory": "",
        "watchFilePattern": "test-scan(.*)\.pdf",
        "googleDriveLogFile": "ralphy-automove-log.json",
        "googleDriveConfigFile": "ralphy-config.json",
    };

    storage.get('settings.user', function (error, data) {
        if (error) throw error;
        if (Object.keys(data).length === 0) {
            data = DEFAULT_SETTINGS;
        }

        $scope.$apply(function () {
            $scope.userSettings = data;
        });
    });

    $scope.save = function () {
        storage.set('settings.user', $scope.userSettings);
        $scope.statusMessage = "Saved";
        $timeout(function () {
            $scope.statusMessage = "";
        }, 1000);
    };

    $scope.reset = function () {
        storage.clear(function () {
            $scope.$apply(function () {
                $scope.statusMessage = "Reset to defaults";
                $scope.userSettings = DEFAULT_SETTINGS;
            });
            $timeout(function () {
                $scope.statusMessage = "";
            }, 1000);
        });

    };

}]);