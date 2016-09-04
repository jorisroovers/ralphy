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

        $scope.tags = [{displayName: "ING", tag: "ing"}, {displayName: "Breda", tag: "breda"}];
        $scope.activeFile = null;

        readFiles = function () {
            storage.get('settings.user', function (error, data) {
                $scope.watchDirectory = data.watchDirectory
                files = fs.readdirSync(data.watchDirectory);
                $scope.$apply(function () {
                    // Only show pdf files (for now we just say a file is a PDF if it has the .pdf extension).
                    $scope.files = files.filter(function (file) {
                        return /\.pdf$/.test(file);
                    });

                    // make the first file active if no file is active yet
                    if ($scope.activeFile == null && $scope.files.length > 0) {
                        $scope.activate($scope.files[0]);
                    }
                });
            });
        };
        readFiles();


        $scope.changeName = function () {
            var newFilePath = path.join($scope.activeFile.dirPath, $scope.fileNameField);
            console.log($scope.activeFile.path, "==>", newFilePath);
            // only save when the new file path is actually different!
            if ($scope.activeFile.path != newFilePath) {
                fs.rename($scope.activeFile.path, newFilePath, function (err) {
                    if (err) throw err;
                    console.log("[RENAMED]", newFilePath);
                    readFiles(); // reload files so that the list shows updated versions
                });
            }
        };

        $scope.applyTag = function (tag) {
            $scope.fileNameField = "[" + tag.tag + "] " + $scope.fileNameField;
        };

        $scope.activate = function (fileName) {
            var filePath = path.join($scope.watchDirectory, fileName);
            $scope.activeFile = {path: filePath, dirPath: $scope.watchDirectory, name: fileName};
            $scope.fileNameField = fileName;
            renderPdf($scope.activeFile.path)
        }

        renderPdf = function (file) {
            var data = new Uint8Array(fs.readFileSync(file));
            PDFJS.getDocument(data).then(function (pdfDocument) {
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



