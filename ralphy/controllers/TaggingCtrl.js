const ipcRenderer = window.require("electron").ipcRenderer;
const fs = require('fs');
const storage = require('electron-json-storage');
const path = require('path');
const chokidar = require('chokidar');

const pdflib = require('pdf-lib');

const pdfjsLib = require('pdfjs-dist'); // http://mozilla.github.io/pdf.js/examples/learning/helloworld.html

const settings = require("../common/Settings").settings;

pdfjsLib.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.js';


angular.module('ralphy').controller('TaggingController', ['$scope', '$q', '$filter', function ($scope, $q, $filter) {

    // all the available tags
    $scope.tags = {};

    // the file currently being shown/active
    $scope.activeFile = null;

    // the tag that is active, i.e. being edited
    $scope.activeTag = null;

    // whether we're showing the merge file selector dialog or not
    // TODO: move these variables into the mergeSelector object
    $scope.mergeSelectorActive = false;
    $scope.mergeSelectedFile = null;

    $scope.mergeSelector = {
        deleteMerged: true
    };

    $scope.settings = null;

    var init = function () {
        var promise = settings.load();
        promise.then(function () {
            $scope.settings = settings.settings;
        });
        return promise;
    };

    readFiles = function () {
        // first, let's reread the configfile as this can influence what we do next
        readConfigFile();

        files = fs.readdirSync($scope.settings.watchDirectory);
        // Only show pdf files (for now we just say a file is a PDF if it has the .pdf extension).
        files = files.filter(function (file) {
            return /\.pdf$/.test(file);
        });

        files.sort(function (a, b) {
            var fileAPath = path.join($scope.settings.watchDirectory, a);
            var fileBPath = path.join($scope.settings.watchDirectory, b);
            return fs.statSync(fileBPath).mtime.getTime() - fs.statSync(fileAPath).mtime.getTime();
        });

        // convert the files to proper objects that have extra metadata
        var fileObjs = [];
        angular.forEach(files, function (fileName) {
            fileObjs.push(createFileObj(fileName));
        });
        $scope.files = fileObjs;

        // Intelligently decide what file to make active
        if ($scope.files.length > 0) {
            // make  the first file active if no file is active yet or if the currently active file no longer exists
            if ($scope.activeFile == null || (!fs.existsSync($scope.activeFile.path))) {
                $scope.activate($scope.files[0].name);
            }
        }
    };

    /**
     * Given a filename, create a fileObj with a bunch of meta-info.
     */
    createFileObj = function (fileName) {
        let filePath = path.join($scope.settings.watchDirectory, fileName);
        let tagObj = getTagFromFileName(fileName);
        return fileObj = {
            path: filePath,
            dirPath: $scope.settings.watchDirectory,
            name: fileName,
            nameTagless: stripTag(fileName, tagObj),
            currentPage: 1,
            pdfDocument: null,
            tag: tagObj,
            suggestedTags: {},
            suggestedFilenames: []
        };
    };

    /**
     * Read the ralphy configuration file and extract settings, tags, etc from it.
     **/
    readConfigFile = function () {
        var configFilePath = path.join($scope.settings.watchDirectory, $scope.settings.googleDriveConfigFile);
        var config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        angular.forEach(config.tags, function (obj, key) {
            var tagData = {
                tag: key,
                displayName: key
            };
            tagData = angular.extend(tagData, obj); // add the tag data from the config tag
            $scope.tags[key] = tagData;
        });
    };

    watchScansDirectory = function () {
        var pdfGlob = path.join($scope.settings.watchDirectory, "*.pdf");
        var watcher = chokidar.watch(pdfGlob, {
            ignoreInitial: true
        });
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
        if ($scope.proposed.tag != null && $scope.proposed.tag.tag.trim() != "") {
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

        $scope.activeFile = createFileObj(fileName);
        let proposedName = $scope.activeFile.nameTagless.replace(/\.pdf$/, "");

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
        var configFilePath = path.join($scope.settings.watchDirectory, $scope.settings.googleDriveConfigFile);
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
            tagStr = originalTagStr[1].replace(/\[|\]/g, "").toLowerCase();
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
            tag = {
                tag: tagStr,
                displayName: tagStr,
                unknown: true
            };
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
                // drop punctuation and whitespace from beginning and end of title
                var title = matches[4].replace(/(\.|:|;|!|\s|\?)*$/, "").replace(/^(\.|:|;|!|\s|\?)*/, "");
                // replace slashes with dashes (no slashes allowed in filenames)
                title = title.replace("/", "-");
                if (title != "") {
                    title = title.charAt(0).toUpperCase() + title.slice(1); // capitalize string
                    $scope.activeFile.suggestedFilenames.push(title);
                    console.log("SUGGESTED FILENAME: '%s'", title);
                }
            }

            // try to determine the year that is mentioned in the pagetext to make a smart suggestion
            var foundYears = [];
            for (var year = 2008; year <= parseInt(new Date().getFullYear()); year++) {
                // also search for years that contains spaces like: 2 0 1 4
                const strYear = year.toString();
                const yearWithSpaces = " " + strYear[0] + " " + strYear[1] + " " + strYear[2] + " " + strYear[3];
                if (pageText.indexOf(year) > -1 || pageText.indexOf(yearWithSpaces) > -1) {
                    foundYears.push(year);
                }
            }
            console.log("FOUND YEARS:", foundYears);

            // TODO: try http://fusejs.io/

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
                            $scope.activeFile.suggestedTags[tag.tag] = tag;

                            // for each recent year that we found in the text, suggest a tag
                            angular.forEach(foundYears, function (year) {
                                var yearTag = angular.copy(tag);
                                yearTag.tag = tag.tag + "-" + year;
                                yearTag.displayName = tag.displayName + "-" + year;
                                yearTag.unknown = false;
                                console.log("SUGGESTED TAG", yearTag);
                                $scope.activeFile.suggestedTags[yearTag.tag] = yearTag;
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

    renderPdf = function (file, pageProccessor, forceReload) {
        forceReload = (typeof forceReload !== 'undefined') ? forceReload : false;
        // if we've read the pdf document before, just reuse it, otherwise load it first.
        if (!forceReload && file.pdfDocument != null) {
            renderPdfDocument(file.pdfDocument, file.currentPage, pageProccessor);
        } else {
            var data = new Uint8Array(fs.readFileSync(file.path));
            pdfjsLib.getDocument(data).then(function (pdfDocument) {
                // set the max page now that we know it
                $scope.$apply(function () {
                    file.pdfDocument = pdfDocument;
                });
                renderPdfDocument(pdfDocument, file.currentPage, pageProccessor);
            });
        }
    };

    $scope.openPdfNative = function () {
        ipcRenderer.send('open-external', "file://" + $scope.activeFile.path);
    };


    $scope.openPdfInFolder = function () {
        ipcRenderer.send('open-item-in-folder', $scope.activeFile.path);
    };

    $scope.rotatePageRight = async function () {

        // load pdf, read pages
        const pdfBytes = fs.readFileSync($scope.activeFile.path);
        const pdfDoc = await pdflib.PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        var pageIndexToChange = $scope.activeFile.currentPage - 1;

        // rotate
        const oldRotation = pages[pageIndexToChange].getRotation().angle;
        var desiredRotation = (oldRotation + 90) % 360;
        pages[pageIndexToChange].setRotation(pdflib.degrees(desiredRotation));

        // save to file, reload pdf page
        const modifiedPdfBytes = await pdfDoc.save()
        fs.writeFileSync($scope.activeFile.path, modifiedPdfBytes);

        renderPdf($scope.activeFile, suggestMetadata, true);

    };

    $scope.deletePage = async function () {

        // load pdf, read pages
        const pdfBytes = fs.readFileSync($scope.activeFile.path);
        const pdfDoc = await pdflib.PDFDocument.load(pdfBytes);

        console.log("pages", pdfDoc.getPages());

        // remove page
        let pageIndexToDelete = $scope.activeFile.currentPage - 1;
        pdfDoc.removePage(pageIndexToDelete);

        // save to file, reload pdf page
        const modifiedPdfBytes = await pdfDoc.save()
        fs.writeFileSync($scope.activeFile.path, modifiedPdfBytes);

        // Since we just deleted a page, we need to make sure to put the current page one back in case we deleted
        //  the last page
        $scope.activeFile.currentPage = Math.min($scope.activeFile.currentPage, $scope.activeFile.pdfDocument.numPages - 1);
        renderPdf($scope.activeFile, suggestMetadata, true);

    };

    $scope.deletePdf = function () {
        fs.unlinkSync($scope.activeFile.path);
    };

    $scope.showPdfChooser = function () {
        $scope.mergeSelectorActive = true;
    };

    $scope.selectPdf = function (selectedPdf) {
        $scope.mergeSelectedFile = selectedPdf;
    };

    $scope.appendPdf = async function () {
        // var pdfWriter = hummus.createWriterToModify($scope.activeFile.path, {
        //     modifiedFilePath: $scope.activeFile.path
        // });
        // pdfWriter.appendPDFPagesFromPDF($scope.mergeSelectedFile.path);
        // pdfWriter.end();

        // load both pdf
        const targetPdfBytes = fs.readFileSync($scope.activeFile.path);
        const targetPdfDoc = await pdflib.PDFDocument.load(targetPdfBytes);

        const sourcePdfBytes = fs.readFileSync($scope.mergeSelectedFile.path);
        const sourcePdfDoc = await pdflib.PDFDocument.load(sourcePdfBytes);

        // copy pages
        console.log(sourcePdfDoc.getPages().length);
        // generate range() array: https://stackoverflow.com/a/10050831/381010
        const pageNumbers = [...Array(sourcePdfDoc.getPages().length).keys()];
        console.log("pages aarray", pageNumbers);
        const copiedPages = await targetPdfDoc.copyPages(sourcePdfDoc, pageNumbers);
        copiedPages.forEach(function (page) {
            targetPdfDoc.addPage(page);
        });

        // save to file, reload pdf page
        const modifiedPdfBytes = await targetPdfDoc.save()
        fs.writeFileSync($scope.activeFile.path, modifiedPdfBytes);


        if ($scope.mergeSelector.deleteMerged) {
            fs.unlinkSync($scope.mergeSelectedFile.path);
        }

        $scope.mergeSelectedFile = null;
        $scope.mergeSelectorActive = false;
        renderPdf($scope.activeFile, suggestMetadata, true);
    };

}]);