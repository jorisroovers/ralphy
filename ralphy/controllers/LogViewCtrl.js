// const fs = require('fs');
// const storage = require('electron-json-storage');
// const path = require('path');

// const ipcRenderer = window.require("electron").ipcRenderer;

// const settings = require("../common/Settings").settings;

angular.module('ralphy').controller('LogViewController', ['$scope', '$q', function ($scope, $q) {

    $scope.settings = {};
    $scope.log = null;

    var init = function () {
        var promise = settings.load();
        promise.then(function () {
            $scope.settings = settings.settings;
        });
        return promise;
    };

    var readLogs = function () {
        var logFilePath = path.join($scope.settings.watchDirectory, $scope.settings.googleDriveLogFile);
        var log = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
        $scope.$apply(function () {
            $scope.log = log;
        });
    };

    $scope.openUrl = function (url) {
        ipcRenderer.send('open-external', url);
    };

    init().then(readLogs);

}]);