const path = require('path')
const GrammarRegistry = require('../lib/grammar-registry')
const onig = require('../lib/onig')
const chai = require('chai')
const { expect } = chai

const chaiWaitFor = require('chai-wait-for')
chai.use(chaiWaitFor)
const waitFor = chaiWaitFor.bindWaitFor({
  timeout: 1000,
  retryInterval: 50,
})

// const spies = require('chai-spies');
// chai.use(spies)
//
describe("GrammarRegistry", () => {
  let registry = null

  beforeEach(async () => await onig.ready)

  function loadGrammarSync (name) {
    return registry.loadGrammarSync(path.join(__dirname, 'fixtures', name))
  }

  describe("when the grammar has no scope name", () => {
    it("throws an error", async () => {
      grammarPath = path.join(__dirname, 'fixtures', 'no-scope-name.json')
      registry = new GrammarRegistry()
      expect(() => registry.loadGrammarSync(grammarPath)).to.throw()

      let resolve
      let called = new Promise(r => resolve = r)
      registry.loadGrammar(grammarPath, resolve)
      let err = await called
      expect(err.message.length).to.be.above(0)
    })
  })

  describe("maxTokensPerLine option", () => {
    it("limits the number of tokens created by the parser per line", () => {
      registry = new GrammarRegistry({maxTokensPerLine: 2})
      loadGrammarSync('json.json')

      const grammar = registry.grammarForScopeName('source.json')
      const {line, tags} = grammar.tokenizeLine("{ }")
      const tokens = registry.decodeTokens(line, tags)
      expect(tokens.length).to.be.eql(2)
    })
  })

  describe("maxLineLength option", () => {
    it("limits the number of characters scanned by the parser per line", () => {
      registry = new GrammarRegistry({maxLineLength: 10});
      loadGrammarSync('json.json');
      const grammar = registry.grammarForScopeName('source.json');

      const {ruleStack: initialRuleStack} = grammar.tokenizeLine('[');
      const {line, tags, ruleStack} = grammar.tokenizeLine('{"foo": "this is a long value"}', initialRuleStack);
      const tokens = registry.decodeTokens(line, tags);

      expect(ruleStack.map(entry => entry.scopeName)).to.eql(initialRuleStack.map(entry => entry.scopeName));
      expect(tokens.map(token => token.value)).to.eql([
        '{',
        '"',
        'foo',
        '"',
        ':',
        ' ',
        '"',
        'this is a long value"}'
      ]);
    });

    it("does not apply if the grammar's limitLineLength option is set to false", () => {
      registry = new GrammarRegistry({maxLineLength: 10});
      loadGrammarSync('no-line-length-limit.cson');
      const grammar = registry.grammarForScopeName('source.long-lines');

      const {tokens} = grammar.tokenizeLine("hello goodbye hello goodbye hello");
      return expect(tokens.length).to.be.eql(5);
    });
  });
})
