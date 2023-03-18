const path = require('path');
const fs = require('fs');
const oniguruma = require("vscode-oniguruma");
const onigPath = path.dirname(require.resolve("vscode-oniguruma"));
const onigWASM = path.join(onigPath, 'onig.wasm');

function patchOniguruma() {
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
