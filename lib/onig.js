const path = require('path');
const fs = require('fs');
const oniguruma = require("vscode-oniguruma");
const onigPath = path.dirname(require.resolve("vscode-oniguruma"));
const onigWASM = path.join(onigPath, 'onig.wasm');

const ready = oniguruma.loadWASM(fs.readFileSync(onigWASM));

module.exports = {ready, oniguruma}
