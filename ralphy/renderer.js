const ipcRenderer = window.require("electron").ipcRenderer;
const fs = require('fs');
const storage = require('electron-json-storage');
const path = require('path');


// http://mozilla.github.io/pdf.js/examples/learning/helloworld.html
const pdf = require('pdfjs-dist');

PDFJS.workerSrc = '../node_modules/pdfjs-dist/build/pdf.worker.js';


angular.module('ralphy', ['ngRoute'])
    .config(function ($routeProvider) {

        $routeProvider
            .when('/', {
                controller: 'TaggingController as taggingCtrl',
                templateUrl: 'home.html'
                // resolve: resolveProjects
            })
            .when('/settings', {
                controller: 'SettingsController as settingsCtrl',
                templateUrl: 'settings.html'
            })
            .otherwise({
                redirectTo: '/'
            });
    })
    .controller("NavigationController", function () {
        this.toggleDebug = function () {
            ipcRenderer.send('toggle-dev-tools', 'ping');
        };
    })
    .controller('TaggingController', ['$scope', function ($scope) {

        // var watchDirectory = "ADD DIRECTORY HERE";
        // fs.watch(watchDirectory, function (event, filename) {
        //     console.log('event is: ' + event);
        //     if (filename) {
        //         console.log('filename provided: ' + filename);
        //     } else {
        //         console.log('filename not provided');
        //     }
        // });

        storage.get('settings.user', function (error, data) {
            $scope.watchDirectory = data.watchDirectory
            files = fs.readdirSync(data.watchDirectory);
            $scope.$apply(function () {
                $scope.files = files;
            });
        });

        $scope.renderPdf = function (fileName) {
            console.log("rendering!");
            // render PDF
            var file = path.join($scope.watchDirectory, fileName);
            if (file != "") {
                var data = new Uint8Array(fs.readFileSync(file));
                PDFJS.getDocument(data).then(function (pdfDocument) {
                    console.log('Number of pages: ' + pdfDocument.numPages);

                    pdfDocument.getPage(1).then(function getPageHelloWorld(page) {
                        var scale = 1.5;
                        var viewport = page.getViewport(scale);

                        // Prepare canvas using PDF page dimensions
                        var canvas = document.getElementById('pdf-canvas');
                        var context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        // Render PDF page into canvas context
                        var renderContext = {
                            canvasContext: context,
                            viewport: viewport
                        };
                        page.render(renderContext);
                    });
                });
            }
        };

    }])
    .controller('SettingsController', ['$scope', '$timeout', function ($scope, $timeout) {
        // Use https://github.com/jviotti/electron-json-storage together with electron's remote

        DEFAULT_SETTINGS = {
            "watchDirectory": "",
            "watchFilePattern": "test-scan(.*)\.pdf"
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



