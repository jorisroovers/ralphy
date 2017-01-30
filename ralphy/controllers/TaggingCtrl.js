const ipcRenderer = window.require("electron").ipcRenderer;
const fs = require('fs');
const storage = require('electron-json-storage');
const path = require('path');
const chokidar = require('chokidar');
// http://mozilla.github.io/pdf.js/examples/learning/helloworld.html
const pdf = require('pdfjs-dist');

PDFJS.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.js';


angular.module('ralphy').controller('TaggingController', ['$scope', '$q', '$filter', function ($scope, $q, $filter) {

    // all the available tags
    $scope.tags = {};

    // the file currently being shown/active
    $scope.activeFile = null;

    // the tag that is active, i.e. being edited
    $scope.activeTag = null;

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
        // first, let's reread the configfile as this can influence what we do next
        readConfigFile();

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

        // convert the files to proper objects that have extra metadata
        var fileObjs = [];
        angular.forEach(files, function (fileName) {
            var tagObj = getTagFromFileName(fileName);
            var fileObj = {name: fileName, tag: tagObj, nameTagless: stripTag(fileName, tagObj)};
            fileObjs.push(fileObj);
        });
        $scope.files = fileObjs;

        // make the first file active if no file is active yet
        if ($scope.files.length > 0 && $scope.activeFile == null) {
            $scope.activate($scope.files[0].name);
        }
    };

    /**
     * Read the ralphy configuration file and extract settings, tags, etc from it.
     **/
    readConfigFile = function () {
        var configFilePath = path.join(settings.watchDirectory, settings.googleDriveConfigFile);
        var config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        angular.forEach(config.tags, function (obj, key) {
            var tagData = {tag: key, displayName: key};
            tagData = angular.extend(tagData, obj); // add the tag data from the config tag
            $scope.tags[key] = tagData;
        });
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
            newName = "[" + $scope.proposed.tag.tag.toLowerCase() + "] " + $scope.proposed.name;
        }
        // add .pdf extension if it's not part of the filename yet
        if (!newName.match(/\.pdf$/)) {
            newName = newName + ".pdf";
        }

        var newFilePath = path.join($scope.activeFile.dirPath, newName);

        // only save when the new file path is actually different!
        if ($scope.activeFile.path != newFilePath) {
            console.log($scope.activeFile.path, "==>", newFilePath);
            fs.rename($scope.activeFile.path, newFilePath, function (err) {
                if (err) throw err;
                console.log("[RENAMED]", newFilePath);
                // activate the new filename, no need to reload the file list, that will automatically be picked up
                // by chokidar
                $scope.activate(newName);
            });
        }
    };

    $scope.applyTag = function (tag) {
        $scope.proposed.tag = tag;
    };

    $scope.applyFilename = function (filename) {
        $scope.proposed.name = filename;
    };

    $scope.activate = function (fileName) {
        var filePath = path.join(settings.watchDirectory, fileName);

        $scope.activeFile = {
            path: filePath,
            dirPath: settings.watchDirectory,
            name: fileName,
            currentPage: 1,
            pdfDocument: null,
            tag: getTagFromFileName(fileName),
            suggestedTags: [],
            suggestedFilenames: []
        };

        var proposedName = stripTag($scope.activeFile.name, $scope.activeFile.tag)
        proposedName = proposedName.replace(/\.pdf$/, "");

        $scope.proposed = {
            name: proposedName,
            tag: $scope.activeFile.tag
        };
        renderPdf($scope.activeFile, suggestMetadata);
        $scope.activeTag = $scope.activeFile.tag; // activate the tag of the current file
    };

    $scope.pdfNextPage = function () {
        var newPage = Math.min($scope.activeFile.currentPage + 1, $scope.activeFile.pdfDocument.numPages);
        // don't re-render the same page
        if (newPage != $scope.activeFile.currentPage) {
            $scope.activeFile.currentPage = newPage;
            renderPdf($scope.activeFile, suggestMetadata);
        }

    };

    $scope.pdfPrevPage = function () {
        var newPage = Math.max($scope.activeFile.currentPage - 1, 1);
        // don't re-render the same page
        if (newPage != $scope.activeFile.currentPage) {
            $scope.activeFile.currentPage = newPage;
            renderPdf($scope.activeFile, suggestMetadata);
        }
    };

    $scope.editTag = function (tag) {
        $scope.activeTag = tag;
    };

    $scope.saveTags = function () {
        var configFilePath = path.join(settings.watchDirectory, settings.googleDriveConfigFile);
        var config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

        // only save the tags that we know, i.e. those that we previously loaded from file.
        config.tags = {};
        angular.forEach($scope.tags, function (tag, tagName) {
            if (tag.hasOwnProperty("dest")) {
                config.tags[tagName] = tag;
                tag.unknown = false; // if a tag has a destination, it becomes a known tag
            }
        });

        fs.writeFile(configFilePath, angular.toJson(config, 4), 'utf-8');
    };

    $scope.deleteTag = function (tag) {
        if (tag == $scope.activeTag) {
            $scope.activeTag = null;
        }
        delete $scope.tags[tag.tag];
        $scope.saveTags();
    };

    /**
     * Given a filename, get the tag from the filename.
     * If the tag that is extracted from the filename is not found in the list of known tags, then create a new tag.
     **/
    getTagFromFileName = function (fileName) {
        var originalTagStr = fileName.match(/(\[.*\])(.*)/);
        var tagStr = "";
        if (originalTagStr) {
            var tagStr = originalTagStr[1].replace(/\[|\]/g, "").toLowerCase();
        }
        if (tagStr == "") {
            return null;
        }
        return getTag(tagStr);
    };

    /**
     * Given a tag in string format, return the corresponding tag object. If no such tag exists, create it.
     */
    getTag = function (tagStr) {
        var tag = $scope.tags[tagStr];
        if (!tag) {
            tag = {tag: tagStr, displayName: tagStr, unknown: true};
            $scope.tags[tagStr] = tag;
        }
        return tag;
    };

    /* Given a filename and a tag, strip the tag from the filename */
    stripTag = function (fileName, tagObj) {
        if (!tagObj) {
            return fileName;
        }
        var tag = tagObj.tag;
        return fileName.replace("[" + tag + "] ", "");
    };

    suggestMetadata = function (pdfDocument, pageNr, page) {
        console.log(page);
        page.getTextContent().then(function (textContent) {
            // cleanup the text
            var pageText = "";
            angular.forEach(textContent.items, function (item) {
                // cleanup the text content of the page
                // replace spaces between individual letters but not words
                // http://stackoverflow.com/a/19801470/381010
                line = item.str.replace(/([A-Z])\s(?=[A-Z]\b)/gi, "$1");
                // replace multiple spaces with a single one
                line = line.replace(/ ( )+/g, " ");
                pageText += line + "\n";
            });


            console.log(pageText.toLowerCase());

            // try to determine the filename from the title
            const regex = /((onderwerp|betreft)(:|;)?\s)(.*)/i;
            const matches = pageText.match(regex);
            if (matches) {
                $scope.activeFile.suggestedFilenames.push(matches[4]);
                console.log("SUGGESTED FILENAME:", matches[4]);
            }

            // try to determine the year that is mentioned in the pagetext to make a smart suggestion
            var foundYears = [];
            for (var year = 2008; year <= parseInt(new Date().getFullYear()); year++) {
                if (pageText.indexOf(year) > -1) {
                    foundYears.push(year);
                }
            }
            console.log("FOUND YEARS:", foundYears);

            // try to determine the tag from the text
            $scope.$apply(function () {
                angular.forEach($scope.tags, function (tag, tagName) {
                    // Search on word boundary, not within words
                    // http://stackoverflow.com/questions/2951915/javascript-reg-ex-to-match-whole-word-only-bound-only-by-whitespace
                    // We also have to double escape \s and \n in double quotes
                    var keywords = angular.copy(tag.keywords || []);
                    keywords.push(tagName);
                    angular.forEach(keywords, function (keyword) {
                        const regex = new RegExp("(^|\\s|\\n|'|\")" + keyword.toLowerCase() + "(\\s|$|\\n|'|\")");
                        const index = pageText.toLowerCase().search(regex);
                        if (index != -1) {
                            console.log("SUGGESTED TAG", tag);
                            $scope.activeFile.suggestedTags.push(tag);

                            // for each recent year that we found in the text, suggest a tag
                            angular.forEach(foundYears, function (year) {
                                var yearTag = angular.copy(tag);
                                yearTag.tag = tag.tag + "-" + year;
                                yearTag.displayName = tag.displayName + "-" + year;
                                yearTag.unknown = false;
                                console.log("SUGGESTED TAG", yearTag);
                                $scope.activeFile.suggestedTags.push(yearTag);
                            });
                        }
                    });
                });
            });

        });
    };

    renderPdfDocument = function (pdfDocument, pageNr, pageProcessor) {
        pdfDocument.getPage(pageNr).then(function (page) {
            if (pageProcessor) {
                pageProcessor(pdfDocument, pageNr, page);
            }

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

    renderPdf = function (file, pageProccessor) {
        // if we've read the pdf document before, just reuse it, otherwise load it first.
        if (file.pdfDocument != null) {
            renderPdfDocument(file.pdfDocument, file.currentPage, pageProccessor);
        } else {
            var data = new Uint8Array(fs.readFileSync(file.path));
            PDFJS.getDocument(data).then(function (pdfDocument) {
                // set the max page now that we know it
                $scope.$apply(function () {
                    file.pdfDocument = pdfDocument;
                });
                renderPdfDocument(pdfDocument, file.currentPage, pageProccessor);
            });
        }
    };

}]);