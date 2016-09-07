const ipcRenderer = window.require("electron").ipcRenderer;
const fs = require('fs');
const storage = require('electron-json-storage');
const path = require('path');
const chokidar = require('chokidar');


// http://mozilla.github.io/pdf.js/examples/learning/helloworld.html
const pdf = require('pdfjs-dist');

PDFJS.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.js';


angular.module('ralphy', ['ngRoute'])
    .directive('focusTag', function () {
        return {
            link: function (scope, element, attrs) {
                element.bind('click', function () {
                    var tagEl = document.querySelector("#proposed-tag");
                    tagEl.focus();
                    // tagEl.setSelectionRange(0, tagEl.value.length);
                    // tagEl.select();
                    var selection = window.getSelection();
                    var range = document.createRange();
                    range.selectNodeContents(tagEl);
                    selection.removeAllRanges();
                    selection.addRange(range);
                });
            }
        };
    })
    .directive("contenteditable", function () {
        return {
            restrict: "A",
            require: "ngModel",
            link: function (scope, element, attrs, ngModel) {

                element.bind("keydown keypress", function (event) {
                    if (event.which === 13) {
                        event.preventDefault();
                    }
                });

                function read() {
                    ngModel.$setViewValue(element.text());
                }

                ngModel.$render = function () {
                    element.html(ngModel.$viewValue || "");
                };

                element.bind("blur keyup change", function () {
                    scope.$apply(read);
                });
            }
        };
    })
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
    .controller('TaggingController', ['$scope', '$q', function ($scope, $q) {


        $scope.tags = [
            {displayName: "CZ", tag: "cz"},
            {displayName: "ING", tag: "ing"},
            {displayName: "Breda", tag: "breda"}
        ];

        $scope.activeFile = null;
        var settings = {};

        var init = function () {
            var deferred = $q.defer();
            storage.get('settings.user', function (error, data) {
                settings = data;
                deferred.resolve();
            });
            return deferred.promise;
        };

        readFiles = function () {
            files = fs.readdirSync(settings.watchDirectory);
            // Only show pdf files (for now we just say a file is a PDF if it has the .pdf extension).
            files = files.filter(function (file) {
                return /\.pdf$/.test(file);
            });

            files.sort(function (a, b) {
                var fileAPath = path.join(settings.watchDirectory, a);
                var fileBPath = path.join(settings.watchDirectory, b);
                return fs.statSync(fileBPath).mtime.getTime() - fs.statSync(fileAPath).mtime.getTime();
            });

            $scope.files = files;

            // make the first file active if no file is active yet
            if ($scope.files.length > 0) {
                $scope.activate($scope.files[0]);
            }
        };

        watchScansDirectory = function () {
            var pdfGlob = path.join(settings.watchDirectory, "*.pdf");
            var watcher = chokidar.watch(pdfGlob, {ignoreInitial: true});
            watcher.on('all', function (event, file) {
                $scope.$apply(function () {
                    readFiles();
                    // make sure the window is visible if this is a new scan
                    if (event == "add") {
                        ipcRenderer.send('show-main-window', 'ping');
                    }
                });
            });
        };

        // let's get the party started
        init().then(readFiles).then(watchScansDirectory);

        $scope.changeName = function () {
            // only apply tag if there is one
            var newName = $scope.proposed.name;
            if ($scope.proposed.tag.tag.trim() != "") {
                newName = "[" + $scope.proposed.tag.tag + "] " + $scope.proposed.name;
            }
            var newFilePath = path.join($scope.activeFile.dirPath, newName);

            // only save when the new file path is actually different!
            if ($scope.activeFile.path != newFilePath) {
                console.log($scope.activeFile.path, "==>", newFilePath);
                fs.rename($scope.activeFile.path, newFilePath, function (err) {
                    if (err) throw err;
                    console.log("[RENAMED]", newFilePath);
                    readFiles(); // reload files so that the list shows updated versions
                });
            }
        };

        $scope.applyTag = function (tag) {
            $scope.proposed.tag = tag;
        };

        $scope.activate = function (fileName) {
            var filePath = path.join(settings.watchDirectory, fileName);
            var originalTag = fileName.match(/(\[.*\])(.*)/);
            var tag = "";
            if (originalTag) {
                var tag = originalTag[1].replace(/\[|\]/g, "").toLowerCase();
            }

            $scope.activeFile = {
                path: filePath,
                dirPath: settings.watchDirectory,
                name: fileName,
                currentPage: 1,
                pdfDocument: null,
                tag: {displayName: tag, tag: tag}
            };

            var proposedName = $scope.activeFile.name.replace("[" + $scope.activeFile.tag.tag + "] ", "")

            $scope.proposed = {
                name: proposedName,
                tag: $scope.activeFile.tag
            };
            renderPdf($scope.activeFile);
        };

        $scope.pdfNextPage = function () {
            var newPage = Math.min($scope.activeFile.currentPage + 1, $scope.activeFile.pdfDocument.numPages);
            // don't re-render the same page
            if (newPage != $scope.activeFile.currentPage) {
                $scope.activeFile.currentPage = newPage;
                renderPdf($scope.activeFile);
            }

        };

        $scope.pdfPrevPage = function () {
            var newPage = Math.max($scope.activeFile.currentPage - 1, 1);
            // don't re-render the same page
            if (newPage != $scope.activeFile.currentPage) {
                $scope.activeFile.currentPage = newPage;
                renderPdf($scope.activeFile);
            }
        };


        renderPdfDocument = function (pdfDocument, page) {
            pdfDocument.getPage(page).then(function (page) {

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
        };

        renderPdf = function (file) {
            // if we've read the pdf document before, just reuse it, otherwise load it first.
            if (file.pdfDocument != null) {
                renderPdfDocument(file.pdfDocument, file.currentPage);
            } else {
                var data = new Uint8Array(fs.readFileSync(file.path));
                PDFJS.getDocument(data).then(function (pdfDocument) {
                    // set the max page now that we know it
                    $scope.$apply(function () {
                        file.pdfDocument = pdfDocument;
                    });
                    renderPdfDocument(pdfDocument, file.currentPage);
                });
            }

        };

    }
    ])
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



