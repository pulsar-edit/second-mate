const onig = require('./onig')

module.exports = {
  ScopeSelector: require("./scope-selector.js"),
  GrammarRegistry: require("./grammar-registry.js"),
  Grammar: require("./grammar.js"),
  OnigScanner(): onig.oniguruma.OnigScanner,
  ready: onig.ready
};
