const fs = require('fs');
const storage = require('electron-json-storage');
const path = require('path');

const ipcRenderer = window.require("electron").ipcRenderer;

angular.module('ralphy').controller('LogViewController', ['$scope', '$q', function ($scope, $q) {

    var settings = {};
    var init = function () {
        var deferred = $q.defer();
        storage.get('settings.user', function (error, data) {
            settings = data;
            deferred.resolve();
        });
        return deferred.promise;
    };
    $scope.log = [];

    var readLogs = function () {
        var logFilePath = path.join(settings.watchDirectory, settings.googleDriveLogFile);
        var log = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
        $scope.log = log;
    };

    $scope.openUrl = function (url) {
        console.log("test " + url);
        ipcRenderer.send('open-external', url);
    };

    init().then(readLogs);

}]);