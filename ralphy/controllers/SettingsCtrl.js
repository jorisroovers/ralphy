const settings = require("../common/Settings").settings;
// const ipcRenderer = window.require("electron").ipcRenderer;


angular.module('ralphy').controller('SettingsController', ['$scope', '$timeout', function ($scope, $timeout) {

    // We'll have a tiny bit of delay populating the form fields with the settings, but that's ok for now.
    settings.load().then(function () {
        $scope.$apply(function () {
            $scope.userSettings = settings.settings;
        });
    });

    $scope.save = function () {
        settings.save($scope.userSettings);
        $scope.statusMessage = "Saved";
        $timeout(function () {
            $scope.statusMessage = "";
        }, 1000);
        // FUTURE: Do validation using https://github.com/hapijs/joi
    };

    $scope.reset = function () {
        settings.reset().then(function () {
            settings.load().then(function () {
                $scope.$apply(function () {
                    $scope.userSettings = settings.settings;
                    $scope.statusMessage = "Reset to defaults";
                });
                $timeout(function () {
                    $scope.statusMessage = "";
                }, 1000);
            });
        });
    };

    ipcRenderer.on('open-dialog-result', function (event, settingName, result) {
        $scope.$apply(function () {
            $scope.userSettings[settingName] = result[0];
        });
    });

    $scope.browse = function (type, settingName) {
        var properties = [];
        if (type == "dir") {
            properties.push("openDirectory");
        }
        ipcRenderer.send('open-dialog', settingName, {properties: properties});
    };

}]);