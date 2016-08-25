const ipcRenderer = window.require("electron").ipcRenderer;
const fs = require('fs');


// http://mozilla.github.io/pdf.js/examples/learning/helloworld.html
const pdf = require('pdfjs-dist');

PDFJS.workerSrc = '../node_modules/pdfjs-dist/build/pdf.worker.js';


angular.module('ralphy', ['ngRoute'])
    .config(function ($routeProvider) {
        // var resolveProjects = {
        //     projects: function (Projects) {
        //         return ['project1', 'rpoject2'];
        //     }
        // };

        $routeProvider
            .when('/', {
                controller: 'ProjectListController as homeCtrl',
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
    .controller('ProjectListController', function () {

        var watchDirectory = "ADD DIRECTORY HERE";
        fs.watch(watchDirectory, function (event, filename) {
            console.log('event is: ' + event);
            if (filename) {
                console.log('filename provided: ' + filename);
            } else {
                console.log('filename not provided');
            }
        });


        // render PDF
        var file = "ADD PDF FILE HERE";
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
    })
    .controller('SettingsController', function () {
        console.log("settings");
    });



