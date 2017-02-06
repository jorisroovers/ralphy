const ipcRenderer = window.require("electron").ipcRenderer;

angular.module('ralphy').controller("NavigationController", ['$scope', '$location', function ($scope, $location) {

    $scope.consoleOpen = false;

    var test = ipcRenderer.send('register-for-devtools-updates', 'ping');
    ipcRenderer.on('devtools-toggle', function (event, args) {
        $scope.$apply(function () {
            if (args == "open") {
                $scope.consoleOpen = true;
            } else {
                $scope.consoleOpen = false;
            }
        });
    });

    $scope.toggleDebug = function () {
        ipcRenderer.send('toggle-dev-tools', 'ping');
    };

    $scope.isActive = function (viewLocation) {
        // For root the paths must match exeactly, for everything else we do prefix match so that we can also
        // match query params. Note that we have to do exact match for root because all of our URLs start with / and
        // without the exact match this would lead to the root/home nav always being active.
        if (viewLocation == "/") {
            return $location.path() == viewLocation;
        }
        return $location.path().indexOf(viewLocation) == 0;
    };

}]);
