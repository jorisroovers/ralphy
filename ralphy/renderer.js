angular.module('ralphy', ['ngRoute'])
    .directive('focusTag', function () {
        return {
            link: function (scope, element, attrs) {
                element.bind('click', function () {
                    var tagEl = document.querySelector("#proposed-tag");
                    tagEl.focus();
                });
            }
        };
    })
    .directive("contenteditable", function () {
        return {
            restrict: "A",
            require: "ngModel",
            link: function ($scope, element, attrs, ngModel) {

                element.bind("keydown keypress", function (event) {
                    if (event.which === 13) {
                        event.preventDefault();
                        $scope.changeName();
                    }
                });

                element.bind("focus", function (event) {
                    var selection = window.getSelection();
                    var range = document.createRange();
                    range.selectNodeContents(element[0]);
                    selection.removeAllRanges();
                    selection.addRange(range);
                });

                function read() {
                    ngModel.$setViewValue(element.text());
                }

                ngModel.$render = function () {
                    element.html(ngModel.$viewValue || "");
                };

                element.bind("blur keyup change", function () {
                    $scope.$apply(read);
                });
            }
        };
    })
    .filter('values', function () {
        // Simple filter to just get the values of an object in an angular view
        // This allows for applying additional array filters after it (like sorting)
        return function (input) {
            if (!angular.isObject(input)) return input;

            return Object.values(input);
        }
    })
    .config(function ($routeProvider) {
        $routeProvider
            .when('/', {
                controller: 'TaggingController as taggingCtrl',
                templateUrl: 'tagging.html'
                // resolve: resolveProjects
            })
            .when('/logs', {
                controller: 'LogViewController as logViewCtrl',
                templateUrl: 'logs.html'
            })
            .when('/settings', {
                controller: 'SettingsController as settingsCtrl',
                templateUrl: 'settings.html'
            })
            .otherwise({
                redirectTo: '/'
            });
    });

