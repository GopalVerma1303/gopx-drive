/**
 * Entry shim: suppress "Running application" console log before loading the app.
 * Must run before expo-router/entry so the AppRegistry.runApplication log is filtered.
 */
(function () {
  if (
    typeof __DEV__ !== "undefined" &&
    __DEV__ &&
    typeof console !== "undefined" &&
    console.log
  ) {
    const orig = console.log;
    console.log = function (...args) {
      const first = args[0];
      if (typeof first === "string" && first.includes("Running application")) return;
      return orig.apply(console, args);
    };
  }
})();

module.exports = require("expo-router/entry");
