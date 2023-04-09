const path = require('path');
const fs = require('fs');
const oniguruma = require("vscode-oniguruma");
const onigPath = path.dirname(require.resolve("vscode-oniguruma"));
const onigWASM = path.join(onigPath, 'onig.wasm');

let PATTERN_CACHE = new Map();

function keyForRegexps (regexps) {
  return JSON.stringify(regexps)
}

function getCachedScannerForRegexps (regexps) {
  return PATTERN_CACHE.get(keyForRegexps(regexps))
}

function setCachedScannerForRegexps (regexps, scanner) {
  PATTERN_CACHE.set(keyForRegexps(regexps), scanner)
}

function patchOniguruma() {
  const originalConstructor = oniguruma.OnigScanner
  oniguruma.OnigScanner = function (regexps) {
    let scanner = getCachedScannerForRegexps(regexps)
    if (scanner) { return scanner }
    const onigObject = new originalConstructor(regexps)
    onigObject.source = regexps[0]
    setCachedScannerForRegexps(regexps, onigObject)
    return onigObject
  }

  Object.defineProperty(oniguruma.OnigString.prototype, 'length', {
    get() { return this.content.length }
  })

  oniguruma.OnigString.prototype.substring = function (start, end) {
    return this.content.substring(start, end)
  }

  oniguruma.OnigString.prototype.toString = function (start, end) {
    return this.content
  }
}

const ready = oniguruma.loadWASM(fs.readFileSync(onigWASM)).then(patchOniguruma);

module.exports = {ready, oniguruma}
