const onig = require('./onig')

module.exports = {
  ScopeSelector: require("./scope-selector.js"),
  GrammarRegistry: require("./grammar-registry.js"),
  Grammar: require("./grammar.js"),
  get OnigScanner() {
    return onig.OnigScanner;
  },
  ready: onig.ready
};
