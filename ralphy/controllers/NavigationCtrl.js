const ipcRenderer = window.require("electron").ipcRenderer;

angular.module('ralphy').controller("NavigationController", function () {
    this.toggleDebug = function () {
        ipcRenderer.send('toggle-dev-tools', 'ping');
    };
});
