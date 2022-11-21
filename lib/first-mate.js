
module.exports = {
  ScopeSelector: require("./scope-selector.js"),
  GrammarRegistry: require("./grammar-registry.js"),
  Grammar: require("./grammar.js")
};

Object.defineProperty(module.exports, 'OnigRegExp', {
  get: function() {
    return require('oniguruma').OnigRegExp;
  }
});
