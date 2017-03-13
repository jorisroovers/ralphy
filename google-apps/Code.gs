// Future:
// - Create directory if it does not exist

// Enable DEBUG to only log what's going to happen but not actually move files
var DEBUG = true;

var CONFIG = {tags: {}};

var SCANS_FOLDER_NAME = "/Scans";
var LOGFILE_PATH = "ralphy-automove-log.json";
var CONFIGFILE = "ralphy-config.json";

var LOG = {};
var LOGFILE = null;

function start(){
 startLog();
 readConfig();
 detectNewScans();
 finishLog();
 Logger.log("DONE");
}

function readConfig(){
  var scansFolder = getFolder(SCANS_FOLDER_NAME);
  var fileIterator = scansFolder.getFilesByName(CONFIGFILE);
  if (fileIterator.hasNext()){
    configFile = fileIterator.next();
    debug("Reading config file %s/%s", SCANS_FOLDER_NAME, CONFIGFILE);
    CONFIG = JSON.parse(configFile.getBlob().getDataAsString());
  }
  debug("CONFIG: " +  JSON.stringify(CONFIG));
}

function detectNewScans() {
  Logger.log("Detecting scanned objects");
  var folder = getFolder(SCANS_FOLDER_NAME);
  var files = folder.getFiles();
  while (files.hasNext()){
    var file = files.next();
    debug('Processing "' + file.getName()+ '"');
    renameFile(file);
    moveFile(file);
  }
}

// given a file and its tag, get the corresponding destination folder
function getTagFolder(tag, file){
  // If we can't find the tag in the list of known tags, try to parse it by splitting it on "-", it might be a special tag
  if (!(tag in CONFIG.tags)) {
    var tagParts = tag.replace(" ", "").split("-");
    var yearString = null;
    // for now we assume that if there's a hyphen in the tag, that the second part is a year
    if (tagParts.length > 1){
      tag = tagParts[0];
      tag = tagParts.slice(0, Math.max(tagParts.length-1, 0)).join("-");

      yearString = tagParts.slice(-1);
    }
  }

  if (tag in CONFIG.tags) {
    var date = file.getDateCreated();
    // if we didn't find a year in the tag, we use the current year
    if (yearString == null){
      yearString = Utilities.formatDate(date, date.getTimezoneOffset(), "yyyy");
    }
    var mapping =  CONFIG.tags[tag].dest;
    mapping = mapping.replace("%{year}", yearString);
    return mapping;
  }

  return false;
}

function moveFile(file){
  var name = file.getName();
  var originalTag = name.match(/(\[.*\])(.*)/);
  if (originalTag) {
    var tag = originalTag[1].replace(/\[|\]/g,"").toLowerCase();
    var folderPath = getTagFolder(tag, file);
    if (folderPath) {
      var folder = getFolder(folderPath);
      if (folder) {
        // remove the original tag and any leading spaces from the filename
        var newName = name.replace(originalTag[1], "").replace(/^ /,"");

        // Copy the file to it's destination and trash the current file
        var copyUrl = null;
        var folderUrl = null;
        if (!DEBUG) { // Don't actually perform the move if debugging
          const copy = file.makeCopy(newName, folder);
          copyUrl = copy.getUrl();
          folderUrl = folder.getUrl();
          file.setTrashed(true); // alternatively, use originalFolder.removeFile()
        }
        logToFile(tag, name, newName, folderPath, copyUrl, folderUrl);
      }
    } else {
      Logger.log("No path for tag '%s'", tag);
    }
  }
}

function renameFile(file){
  var date = file.getDateCreated();
  var dateString = Utilities.formatDate(date, date.getTimezoneOffset(), "yyyy-MM-dd");
  var currentFileName = file.getName();
  newFileName =  currentFileName.replace("%{date}", dateString);
  file.setName(newFileName);
  if (currentFileName != newFileName) {
    Logger.log("RENAME: %s -> %s", currentFileName, newFileName);
  }
}

function startLog(){
  var scansFolder = getFolder(SCANS_FOLDER_NAME);
  var fileIterator = scansFolder.getFilesByName(LOGFILE_PATH);
  LOGFILE = null;
  LOG = null;
  var date = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd HH:mm:ss");
  if (fileIterator.hasNext()){
    LOGFILE = fileIterator.next();
    try {
      LOG = JSON.parse(LOGFILE.getBlob().getDataAsString());
      LOG.lastRun = date;
      debug("Reusing old logfile %s/%s", SCANS_FOLDER_NAME, LOGFILE_PATH);
      return;
    } catch(e) {
        // e.g.: when parsing fails.
        error(e.message);
    }
  }
  // fallback to creating new log file
  LOG = { created: date, updated: date, lastRun:date, logs: [] };
  LOGFILE = scansFolder.createFile(LOGFILE_PATH, JSON.stringify(LOG));
  debug("Created new logfile %s/%s:%s", SCANS_FOLDER_NAME, LOGFILE_PATH, JSON.stringify(LOG));
}

function finishLog(){
  LOGFILE.setContent(JSON.stringify(LOG));
}

function logToFile(tag, name, newName, folderPath, url, folderUrl){
  var date = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd HH:mm:ss");
  var logEntry = {
    created : date,
    action: "moved",
    tag: tag,
    folderPath: folderPath,
    oldName: name,
    newName: newName,
    url: url,
    folderUrl: folderUrl,
    debug: DEBUG
  };
  LOG.logs.push(logEntry);
  LOG.updated = date;

  Logger.log("MOVED: " + JSON.stringify(logEntry));

}

var FOLDER_CACHE = {};
function getFolder(path){
  if (path in FOLDER_CACHE){
    debug("Returning cached version of %s", path);
    return FOLDER_CACHE[path];
  }
  debug("Cache miss. Finding %s", path);
  var folder = findFolder(path);
  FOLDER_CACHE[path] = folder;
  return folder;
}

// Given a path, get's the Drive folder object
function findFolder(path, root){
  if (!root){
    root = DriveApp.getRootFolder();
  }

  // remove leading slash. Context is defined by root directory
  if (path.indexOf("/") == 0) {
    path = path.substring(1);
  }
  var pathParts = path.split("/");
  var foundFolders = root.getFoldersByName(pathParts[0]);
  var currentFolder = null;
  if (foundFolders.hasNext()) {
    currentFolder =  foundFolders.next();
  }

  if (pathParts.length > 1) {
     pathParts.shift();
     return findFolder(pathParts.join("/"), currentFolder)
  } else if (pathParts.length == 1){
    return currentFolder;
  }

}


function debug(format){
  if (DEBUG) {
    arguments[0] = "[DEBUG] " + arguments[0];
    Logger.log.apply(Logger, arguments);
  }
}

function error(format) {
  arguments[0] = "[ERROR] " + arguments[0];
  Logger.log.apply(Logger, arguments);
}
