const chai = require('chai')
const { expect } = chai

const path = require('path');
const _ = require('underscore-plus');
const fs = require('fs-plus');
const GrammarRegistry = require('../lib/grammar-registry');
const Grammar = require('../lib/grammar');

const { waitFor } = require('./spec-helper')

describe("Grammar tokenization", () => {
  let grammar, registry

  const loadGrammarSync = name => registry.loadGrammarSync(path.join(__dirname, 'fixtures', name));

  beforeEach(async () => {
    await require('../lib/onig').ready;
    registry = new GrammarRegistry();
    loadGrammarSync('text.json');
    loadGrammarSync('javascript.json');
    loadGrammarSync('javascript-regex.json');
    loadGrammarSync('coffee-script.json');
    loadGrammarSync('ruby.json');
    loadGrammarSync('html-erb.json');
    loadGrammarSync('html.json');
    loadGrammarSync('php.json');
    loadGrammarSync('python.cson');
    loadGrammarSync('python-regex.cson');
  });

  afterEach(() => {
    chai.spy.restore(console, 'error')
    chai.spy.restore(grammar, 'getMaxTokensPerLine')
  })

  describe("when the registry is empty", () => {
    it("allows injections into the null grammar", () => {
      registry = new GrammarRegistry();
      loadGrammarSync('hyperlink.json');

      grammar = registry.nullGrammar;
      const {line, tags} = grammar.tokenizeLine('http://github.com');
      const tokens = registry.decodeTokens(line, tags);
      expect(tokens.length).to.eql(1);
      expect(tokens[0].value).to.eql('http://github.com');
      expect(tokens[0].scopes).to.eql(['text.plain.null-grammar', 'markup.underline.link.http.hyperlink']);
    });
  });

  describe("Registry::loadGrammarSync", () => {
    it("returns a grammar for the file path specified", () => {
      grammar = loadGrammarSync('hello.cson');
      expect(fs.isFileSync(grammar.path)).to.eql(true);
      expect(grammar).to.be.ok;

      const {line, tags} = grammar.tokenizeLine('hello world!');
      const tokens = registry.decodeTokens(line, tags);
      expect(tokens.length).to.eql(4);

      expect(tokens[0].value).to.eql('hello');
      expect(tokens[0].scopes).to.eql(['source.hello', 'prefix.hello']);

      expect(tokens[1].value).to.eql(' ');
      expect(tokens[1].scopes).to.eql(['source.hello']);

      expect(tokens[2].value).to.eql('world');
      expect(tokens[2].scopes).to.eql(['source.hello', 'suffix.hello']);

      expect(tokens[3].value).to.eql('!');
      expect(tokens[3].scopes).to.eql(['source.hello', 'suffix.hello', 'emphasis.hello']);
    });
  });

  describe('::tokenizeLines(text)', () => describe('when the text is empty', () => it('returns a single line with a single token which has the global scope', () => {
    grammar = registry.grammarForScopeName('source.coffee');
    const lines = grammar.tokenizeLines('');
    expect(lines).to.eql([[{value: '',  scopes: ['source.coffee']}]]);
})));

  describe("::tokenizeLine(line, ruleStack)", () => {
    describe("when the entire line matches a single pattern with no capture groups", () => it("returns a single token with the correct scope", () => {
      grammar = registry.grammarForScopeName('source.coffee');
      const {line, tags} = grammar.tokenizeLine("return");

      expect(registry.decodeTokens(line, tags)).to.eql([
        {value: 'return', scopes: ['source.coffee', 'keyword.control.coffee']}
      ]);
  }));

    describe("when the entire line matches a single pattern with capture groups", () => it("returns a single token with the correct scope", () => {
      grammar = registry.grammarForScopeName('source.coffee');
      const {line, tags} = grammar.tokenizeLine("new foo.bar.Baz");
      expect(registry.decodeTokens(line, tags)).to.eql([
        {value: 'new', scopes: ['source.coffee', 'meta.class.instance.constructor', 'keyword.operator.new.coffee']},
        {value: ' ', scopes: ['source.coffee', 'meta.class.instance.constructor']},
        {value: 'foo.bar.Baz', scopes: ['source.coffee', 'meta.class.instance.constructor', 'entity.name.type.instance.coffee']}
      ]);
  }));

    describe("when the line doesn't match any patterns", () => it("returns the entire line as a single simple token with the grammar's scope", () => {
      const textGrammar = registry.grammarForScopeName('text.plain');
      const {line, tags} = textGrammar.tokenizeLine("abc def");
      const tokens = registry.decodeTokens(line, tags);
      expect(tokens.length).to.eql(1);
    }));

    describe("when the line matches multiple patterns", () => {
      it("returns multiple tokens, filling in regions that don't match patterns with tokens in the grammar's global scope", () => {
        grammar = registry.grammarForScopeName('source.coffee');
        const {line, tags} = grammar.tokenizeLine(" return new foo.bar.Baz ");

        expect(registry.decodeTokens(line, tags)).to.eql([
          {value: ' ', scopes: ['source.coffee']},
          {value: 'return', scopes: ['source.coffee', 'keyword.control.coffee']},
          {value: ' ', scopes: ['source.coffee']},
          {value: 'new', scopes: ['source.coffee', 'meta.class.instance.constructor', 'keyword.operator.new.coffee']},
          {value: ' ', scopes: ['source.coffee', 'meta.class.instance.constructor']},
          {value: 'foo.bar.Baz', scopes: ['source.coffee', 'meta.class.instance.constructor', 'entity.name.type.instance.coffee']},
          {value: ' ', scopes: ['source.coffee']}
        ]);
      });
    });

    describe("when the line matches a pattern with optional capture groups", () => {
      it("only returns tokens for capture groups that matched", () => {
        grammar = registry.grammarForScopeName('source.coffee');
        const {line, tags} = grammar.tokenizeLine("class Quicksort");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens.length).to.eql(3);
        expect(tokens[0].value).to.eql("class");
        expect(tokens[1].value).to.eql(" ");
        expect(tokens[2].value).to.eql("Quicksort");
      });
    });

    describe("when the line matches a rule with nested capture groups and lookahead capture groups beyond the scope of the overall match", () => {
      it("creates distinct tokens for nested captures and does not return tokens beyond the scope of the overall capture", () => {
        grammar = registry.grammarForScopeName('source.coffee');
        const {line, tags} = grammar.tokenizeLine("  destroy: ->");

        expect(registry.decodeTokens(line, tags)).to.eql([
          {value: '  ', scopes: ["source.coffee"]},
          {value: 'destro', scopes: ["source.coffee", "meta.function.coffee", "entity.name.function.coffee"]},
          // duplicated scope looks wrong, but textmate yields the same behavior. probably a quirk in the coffee grammar.
          {value: 'y', scopes: ["source.coffee", "meta.function.coffee", "entity.name.function.coffee", "entity.name.function.coffee"]},
          {value: ':', scopes: ["source.coffee", "keyword.operator.coffee"]},
          {value: ' ', scopes: ["source.coffee"]},
          {value: '->', scopes: ["source.coffee", "storage.type.function.coffee"]}
        ]);
      });
    });

    describe("when the line matches a pattern that includes a rule", () => {
      it("returns tokens based on the included rule", () => {
        grammar = registry.grammarForScopeName('source.coffee');
        const {line, tags} = grammar.tokenizeLine("7777777");
        expect(registry.decodeTokens(line, tags)).to.eql([
          {value: '7777777', scopes: ['source.coffee', 'constant.numeric.coffee']}
        ]);
      });
    });

    describe("when the line is an interpolated string", () => {
      it("returns the correct tokens", () => {
        grammar = registry.grammarForScopeName('source.coffee');
        const {line, tags} = grammar.tokenizeLine('"the value is #{@x} my friend"');

        expect(registry.decodeTokens(line, tags)).to.eql([
          {value: '"', scopes: ["source.coffee","string.quoted.double.coffee","punctuation.definition.string.begin.coffee"]},
          {value: "the value is ", scopes: ["source.coffee","string.quoted.double.coffee"]},
          {value: '#{', scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","punctuation.section.embedded.coffee"]},
          {value: "@x", scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","variable.other.readwrite.instance.coffee"]},
          {value: "}", scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","punctuation.section.embedded.coffee"]},
          {value: " my friend", scopes: ["source.coffee","string.quoted.double.coffee"]},
          {value: '"', scopes: ["source.coffee","string.quoted.double.coffee","punctuation.definition.string.end.coffee"]}
        ]);
      });
    });

    describe("when the line has an interpolated string inside an interpolated string", () => {
      it("returns the correct tokens", () => {
        grammar = registry.grammarForScopeName('source.coffee');
        const {line, tags} = grammar.tokenizeLine('"#{"#{@x}"}"');

        expect(registry.decodeTokens(line, tags)).to.eql([
          {value: '"',  scopes: ["source.coffee","string.quoted.double.coffee","punctuation.definition.string.begin.coffee"]},
          {value: '#{', scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","punctuation.section.embedded.coffee"]},
          {value: '"',  scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","string.quoted.double.coffee","punctuation.definition.string.begin.coffee"]},
          {value: '#{', scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","string.quoted.double.coffee","source.coffee.embedded.source","punctuation.section.embedded.coffee"]},
          {value: '@x', scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","string.quoted.double.coffee","source.coffee.embedded.source","variable.other.readwrite.instance.coffee"]},
          {value: '}',  scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","string.quoted.double.coffee","source.coffee.embedded.source","punctuation.section.embedded.coffee"]},
          {value: '"',  scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","string.quoted.double.coffee","punctuation.definition.string.end.coffee"]},
          {value: '}',  scopes: ["source.coffee","string.quoted.double.coffee","source.coffee.embedded.source","punctuation.section.embedded.coffee"]},
          {value: '"',  scopes: ["source.coffee","string.quoted.double.coffee","punctuation.definition.string.end.coffee"]}
        ]);
      });
    });

    describe("when the line is empty", () => {
      it("returns a single token which has the global scope", () => {
        grammar = registry.grammarForScopeName('source.coffee');
        const {line, tags} = grammar.tokenizeLine('');
        expect(registry.decodeTokens(line, tags)).to.eql([{value: '',  scopes: ["source.coffee"]}]);
      });
    });

    describe("when the line matches no patterns", () => {
      it("does not infinitely loop", () => {
        grammar = registry.grammarForScopeName('text.plain');
        const {line, tags} = grammar.tokenizeLine('hoo');
        expect(registry.decodeTokens(line, tags)).to.eql([{value: 'hoo',  scopes: ["text.plain", "meta.paragraph.text"]}]);
      });
    });

    describe("when the line matches a pattern with a 'contentName'", () => {
      it("creates tokens using the content of contentName as the token name", () => {
        grammar = registry.grammarForScopeName('text.plain');
        let {line, tags} = grammar.tokenizeLine('ok, cool');
        expect(registry.decodeTokens(line, tags)).to.eql([{value: 'ok, cool',  scopes: ["text.plain", "meta.paragraph.text"]}]);

        grammar = registry.grammarForScopeName('text.plain');
        ({line, tags} = grammar.tokenizeLine(' ok, cool'));

        expect(registry.decodeTokens(line, tags)).to.eql([
          {value: ' ',  scopes: ["text.plain"]},
          {value: 'ok, cool', scopes: ["text.plain", "meta.paragraph.text"]}
        ]);

        loadGrammarSync("content-name.json");

        grammar = registry.grammarForScopeName("source.test");
        const lines = grammar.tokenizeLines("#if\ntest\n#endif");

        expect(lines[0].length).to.eql(1);
        expect(lines[0][0].value).to.eql("#if");
        expect(lines[0][0].scopes).to.eql(["source.test", "pre"]);

        expect(lines[1].length).to.eql(1);
        expect(lines[1][0].value).to.eql("test");
        expect(lines[1][0].scopes).to.eql(["source.test", "pre", "nested"]);

        expect(lines[2].length).to.eql(1);
        expect(lines[2][0].value).to.eql("#endif");
        expect(lines[2][0].scopes).to.eql(["source.test", "pre"]);

        ({line, tags} = grammar.tokenizeLine("test"));
        let tokens = registry.decodeTokens(line, tags);
        expect(tokens.length).to.eql(1);
        expect(tokens[0].value).to.eql("test");
        expect(tokens[0].scopes).to.eql(["source.test", "all", "middle"]);

        ({line, tags} = grammar.tokenizeLine(" test"));
        tokens = registry.decodeTokens(line, tags);
        expect(tokens.length).to.eql(2);
        expect(tokens[0].value).to.eql(" ");
        expect(tokens[0].scopes).to.eql(["source.test", "all"]);
        expect(tokens[1].value).to.eql("test");
        expect(tokens[1].scopes).to.eql(["source.test", "all", "middle"]);
      });
    });

    describe("when the line matches a pattern with no `name` or `contentName`", () => {
      it("creates tokens without adding a new scope", () => {
        grammar = registry.grammarForScopeName('source.ruby');
        const {line, tags} = grammar.tokenizeLine('%w|oh \\look|');
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens.length).to.eql(5);
        expect(tokens[0]).to.eql({value: '%w|', scopes: ["source.ruby", "string.quoted.other.literal.lower.ruby", "punctuation.definition.string.begin.ruby"]});
        expect(tokens[1]).to.eql({value: 'oh ', scopes: ["source.ruby", "string.quoted.other.literal.lower.ruby"]});
        expect(tokens[2]).to.eql({value: '\\l', scopes: ["source.ruby", "string.quoted.other.literal.lower.ruby"]});
        expect(tokens[3]).to.eql({value: 'ook', scopes: ["source.ruby", "string.quoted.other.literal.lower.ruby"]});
      });
    });

    describe("when the line matches a begin/end pattern", () => {
      it("returns tokens based on the beginCaptures, endCaptures and the child scope", () => {
        grammar = registry.grammarForScopeName('source.coffee');
        const {line, tags} = grammar.tokenizeLine("'''single-quoted heredoc'''");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens.length).to.eql(3);

        expect(tokens[0]).to.eql({value: "'''", scopes: ['source.coffee', 'string.quoted.heredoc.coffee', 'punctuation.definition.string.begin.coffee']});
        expect(tokens[1]).to.eql({value: "single-quoted heredoc", scopes: ['source.coffee', 'string.quoted.heredoc.coffee']});
        expect(tokens[2]).to.eql({value: "'''", scopes: ['source.coffee', 'string.quoted.heredoc.coffee', 'punctuation.definition.string.end.coffee']});
      });

      describe("when the pattern spans multiple lines", () => {
        it("uses the ruleStack returned by the first line to parse the second line", () => {
          let line2, tags2;
          grammar = registry.grammarForScopeName('source.coffee');
          let {line: line1, tags: tags1, ruleStack} = grammar.tokenizeLine("'''single-quoted");
          ({line: line2, tags: tags2, ruleStack} = grammar.tokenizeLine("heredoc'''", ruleStack));

          const scopes = [];
          const firstTokens = registry.decodeTokens(line1, tags1, scopes);
          const secondTokens = registry.decodeTokens(line2, tags2, scopes);

          expect(firstTokens.length).to.eql(2);
          expect(secondTokens.length).to.eql(2);

          expect(firstTokens[0]).to.eql({value: "'''", scopes: ['source.coffee', 'string.quoted.heredoc.coffee', 'punctuation.definition.string.begin.coffee']});
          expect(firstTokens[1]).to.eql({value: "single-quoted", scopes: ['source.coffee', 'string.quoted.heredoc.coffee']});

          expect(secondTokens[0]).to.eql({value: "heredoc", scopes: ['source.coffee', 'string.quoted.heredoc.coffee']});
          expect(secondTokens[1]).to.eql({value: "'''", scopes: ['source.coffee', 'string.quoted.heredoc.coffee', 'punctuation.definition.string.end.coffee']});
        });
      });

      describe("when the pattern contains sub-patterns", () => {
        it("returns tokens within the begin/end scope based on the sub-patterns", () => {
          grammar = registry.grammarForScopeName('source.coffee');
          const {line, tags} = grammar.tokenizeLine('"""heredoc with character escape \\t"""');
          const tokens = registry.decodeTokens(line, tags);

          expect(tokens.length).to.eql(4);

          expect(tokens[0]).to.eql({value: '"""', scopes: ['source.coffee', 'string.quoted.double.heredoc.coffee', 'punctuation.definition.string.begin.coffee']});
          expect(tokens[1]).to.eql({value: "heredoc with character escape ", scopes: ['source.coffee', 'string.quoted.double.heredoc.coffee']});
          expect(tokens[2]).to.eql({value: "\\t", scopes: ['source.coffee', 'string.quoted.double.heredoc.coffee', 'constant.character.escape.coffee']});
          expect(tokens[3]).to.eql({value: '"""', scopes: ['source.coffee', 'string.quoted.double.heredoc.coffee', 'punctuation.definition.string.end.coffee']});
        });
      });

      describe("when applyEndPatternLast flag is set in a pattern", () => {
        it("applies end pattern after the other patterns", () => {
          grammar = loadGrammarSync('apply-end-pattern-last.cson');
          const lines = grammar.tokenizeLines(`\
last
{ some }excentricSyntax }

first
{ some }excentricSyntax }\
`
          );

          expect(lines[1][2]).to.eql({value: "}excentricSyntax", scopes: ['source.apply-end-pattern-last', 'end-pattern-last-env', 'scope', 'excentric']});
          expect(lines[4][2]).to.eql({value: "}", scopes: ['source.apply-end-pattern-last', 'normal-env', 'scope']});
          expect(lines[4][3]).to.eql({value: "excentricSyntax }", scopes: ['source.apply-end-pattern-last', 'normal-env']});
        });
      });

      describe("when the end pattern contains a back reference", () => {
        it("constructs the end rule based on its back-references to captures in the begin rule", () => {
          grammar = registry.grammarForScopeName('source.ruby');
          const {line, tags} = grammar.tokenizeLine('%w|oh|,');
          const tokens = registry.decodeTokens(line, tags);

          expect(tokens.length).to.eql(4);
          expect(tokens[0]).to.eql({value: '%w|',  scopes: ["source.ruby", "string.quoted.other.literal.lower.ruby", "punctuation.definition.string.begin.ruby"]});
          expect(tokens[1]).to.eql({value: 'oh',  scopes: ["source.ruby", "string.quoted.other.literal.lower.ruby"]});
          expect(tokens[2]).to.eql({value: '|',  scopes: ["source.ruby", "string.quoted.other.literal.lower.ruby", "punctuation.definition.string.end.ruby"]});
          expect(tokens[3]).to.eql({value: ',',  scopes: ["source.ruby", "punctuation.separator.object.ruby"]});
        });

        it("allows the rule containing that end pattern to be pushed to the stack multiple times", () => {
          grammar = registry.grammarForScopeName('source.ruby');
          const {line, tags} = grammar.tokenizeLine('%Q+matz had some #{%Q-crazy ideas-} for ruby syntax+ # damn.');
          const tokens = registry.decodeTokens(line, tags);

          expect(tokens[0]).to.eql({value: '%Q+', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby","punctuation.definition.string.begin.ruby"]});
          expect(tokens[1]).to.eql({value: 'matz had some ', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby"]});
          expect(tokens[2]).to.eql({value: '#{', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby","meta.embedded.line.ruby","punctuation.section.embedded.begin.ruby"]});
          expect(tokens[3]).to.eql({value: '%Q-', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby","meta.embedded.line.ruby","source.ruby","string.quoted.other.literal.upper.ruby","punctuation.definition.string.begin.ruby"]});
          expect(tokens[4]).to.eql({value: 'crazy ideas', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby","meta.embedded.line.ruby","source.ruby","string.quoted.other.literal.upper.ruby"]});
          expect(tokens[5]).to.eql({value: '-', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby","meta.embedded.line.ruby","source.ruby","string.quoted.other.literal.upper.ruby","punctuation.definition.string.end.ruby"]});
          expect(tokens[6]).to.eql({value: '}', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby","meta.embedded.line.ruby","punctuation.section.embedded.end.ruby", "source.ruby"]});
          expect(tokens[7]).to.eql({value: ' for ruby syntax', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby"]});
          expect(tokens[8]).to.eql({value: '+', scopes: ["source.ruby","string.quoted.other.literal.upper.ruby","punctuation.definition.string.end.ruby"]});
          expect(tokens[9]).to.eql({value: ' ', scopes: ["source.ruby"]});
          expect(tokens[10]).to.eql({value: '#', scopes: ["source.ruby","comment.line.number-sign.ruby","punctuation.definition.comment.ruby"]});
          expect(tokens[11]).to.eql({value: ' damn.', scopes: ["source.ruby","comment.line.number-sign.ruby"]});
      });
    });

      describe("when the pattern includes rules from another grammar", () => {
        describe("when a grammar matching the desired scope is available", () => {
          it("parses tokens inside the begin/end patterns based on the included grammar's rules", () => {
            loadGrammarSync('html-rails.json');
            loadGrammarSync('ruby-on-rails.json');

            grammar = registry.grammarForScopeName('text.html.ruby');
            const {line, tags} = grammar.tokenizeLine("<div class='name'><%= User.find(2).full_name %></div>");
            const tokens = registry.decodeTokens(line, tags);

            expect(tokens[0]).to.eql({value: '<', scopes: ["text.html.ruby","meta.tag.block.any.html","punctuation.definition.tag.begin.html"]});
            expect(tokens[1]).to.eql({value: 'div', scopes: ["text.html.ruby","meta.tag.block.any.html","entity.name.tag.block.any.html"]});
            expect(tokens[2]).to.eql({value: ' ', scopes: ["text.html.ruby","meta.tag.block.any.html"]});
            expect(tokens[3]).to.eql({value: 'class', scopes: ["text.html.ruby","meta.tag.block.any.html", "entity.other.attribute-name.html"]});
            expect(tokens[4]).to.eql({value: '=', scopes: ["text.html.ruby","meta.tag.block.any.html"]});
            expect(tokens[5]).to.eql({value: '\'', scopes: ["text.html.ruby","meta.tag.block.any.html","string.quoted.single.html","punctuation.definition.string.begin.html"]});
            expect(tokens[6]).to.eql({value: 'name', scopes: ["text.html.ruby","meta.tag.block.any.html","string.quoted.single.html"]});
            expect(tokens[7]).to.eql({value: '\'', scopes: ["text.html.ruby","meta.tag.block.any.html","string.quoted.single.html","punctuation.definition.string.end.html"]});
            expect(tokens[8]).to.eql({value: '>', scopes: ["text.html.ruby","meta.tag.block.any.html","punctuation.definition.tag.end.html"]});
            expect(tokens[9]).to.eql({value: '<%=', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","punctuation.section.embedded.ruby"]});
            expect(tokens[10]).to.eql({value: ' ', scopes: ["text.html.ruby","source.ruby.rails.embedded.html"]});
            expect(tokens[11]).to.eql({value: 'User', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","support.class.ruby"]});
            expect(tokens[12]).to.eql({value: '.', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","punctuation.separator.method.ruby"]});
            expect(tokens[13]).to.eql({value: 'find', scopes: ["text.html.ruby","source.ruby.rails.embedded.html"]});
            expect(tokens[14]).to.eql({value: '(', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","punctuation.section.function.ruby"]});
            expect(tokens[15]).to.eql({value: '2', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","constant.numeric.ruby"]});
            expect(tokens[16]).to.eql({value: ')', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","punctuation.section.function.ruby"]});
            expect(tokens[17]).to.eql({value: '.', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","punctuation.separator.method.ruby"]});
            expect(tokens[18]).to.eql({value: 'full_name ', scopes: ["text.html.ruby","source.ruby.rails.embedded.html"]});
            expect(tokens[19]).to.eql({value: '%>', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","punctuation.section.embedded.ruby"]});
            expect(tokens[20]).to.eql({value: '</', scopes: ["text.html.ruby","meta.tag.block.any.html","punctuation.definition.tag.begin.html"]});
            expect(tokens[21]).to.eql({value: 'div', scopes: ["text.html.ruby","meta.tag.block.any.html","entity.name.tag.block.any.html"]});
            expect(tokens[22]).to.eql({value: '>', scopes: ["text.html.ruby","meta.tag.block.any.html","punctuation.definition.tag.end.html"]});
          });

          it("updates the grammar if the included grammar is updated later", async () => {
            loadGrammarSync('html-rails.json');
            loadGrammarSync('ruby-on-rails.json');

            grammar = registry.grammarForScopeName('text.html.ruby');
            let arg
            const callback = () => { arg = "called" }
            grammar.onDidUpdate(callback);

            let {line, tags} = grammar.tokenizeLine("<div class='name'><% <<-SQL select * from users;");
            let tokens = registry.decodeTokens(line, tags);
            expect(tokens[12].value).to.eql(" select * from users;");

            loadGrammarSync('sql.json');
            await waitFor(() => arg).to.be.ok;
            ({line, tags} = grammar.tokenizeLine("<div class='name'><% <<-SQL select * from users;"));
            tokens = registry.decodeTokens(line, tags);
            expect(tokens[12].value).to.eql(" ");
            expect(tokens[13].value).to.eql("select");
          });

          it("supports including repository rules from the other grammar", () => {
            loadGrammarSync('include-external-repository-rule.cson');
            grammar = registry.grammarForScopeName('test.include-external-repository-rule');
            const {line, tags} = grammar.tokenizeLine('enumerate');
            const tokens = registry.decodeTokens(line, tags);
            expect(tokens[0]).to.eql({value: 'enumerate', scopes: ["test.include-external-repository-rule", "support.function.builtin.python"]});

            let calls = 0
            const callback = (a) => { calls++ }
            grammar.onDidUpdate(callback);
            expect(grammar.grammarUpdated('source.python')).to.eql(true);
            expect(grammar.grammarUpdated('not.included')).to.eql(false);
            expect(calls).to.eql(1);
          });
        });

        describe("when a grammar matching the desired scope is unavailable", () => {
          it("updates the grammar if a matching grammar is added later", () => {
            registry.removeGrammarForScopeName('text.html.basic');
            loadGrammarSync('html-rails.json');
            loadGrammarSync('ruby-on-rails.json');

            grammar = registry.grammarForScopeName('text.html.ruby');
            let {line, tags} = grammar.tokenizeLine("<div class='name'><%= User.find(2).full_name %></div>");
            let tokens = registry.decodeTokens(line, tags);
            expect(tokens[0]).to.eql({value: "<div class='name'>", scopes: ["text.html.ruby"]});
            expect(tokens[1]).to.eql({value: '<%=', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","punctuation.section.embedded.ruby"]});
            expect(tokens[2]).to.eql({value: ' ', scopes: ["text.html.ruby","source.ruby.rails.embedded.html"]});
            expect(tokens[3]).to.eql({value: 'User', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","support.class.ruby"]});

            loadGrammarSync('html.json');
            ({line, tags} = grammar.tokenizeLine("<div class='name'><%= User.find(2).full_name %></div>"));
            tokens = registry.decodeTokens(line, tags);
            expect(tokens[0]).to.eql({value: '<', scopes: ["text.html.ruby","meta.tag.block.any.html","punctuation.definition.tag.begin.html"]});
            expect(tokens[1]).to.eql({value: 'div', scopes: ["text.html.ruby","meta.tag.block.any.html","entity.name.tag.block.any.html"]});
            expect(tokens[2]).to.eql({value: ' ', scopes: ["text.html.ruby","meta.tag.block.any.html"]});
            expect(tokens[3]).to.eql({value: 'class', scopes: ["text.html.ruby","meta.tag.block.any.html", "entity.other.attribute-name.html"]});
            expect(tokens[4]).to.eql({value: '=', scopes: ["text.html.ruby","meta.tag.block.any.html"]});
            expect(tokens[5]).to.eql({value: '\'', scopes: ["text.html.ruby","meta.tag.block.any.html","string.quoted.single.html","punctuation.definition.string.begin.html"]});
            expect(tokens[6]).to.eql({value: 'name', scopes: ["text.html.ruby","meta.tag.block.any.html","string.quoted.single.html"]});
            expect(tokens[7]).to.eql({value: '\'', scopes: ["text.html.ruby","meta.tag.block.any.html","string.quoted.single.html","punctuation.definition.string.end.html"]});
            expect(tokens[8]).to.eql({value: '>', scopes: ["text.html.ruby","meta.tag.block.any.html","punctuation.definition.tag.end.html"]});
            expect(tokens[9]).to.eql({value: '<%=', scopes: ["text.html.ruby","source.ruby.rails.embedded.html","punctuation.section.embedded.ruby"]});
            expect(tokens[10]).to.eql({value: ' ', scopes: ["text.html.ruby","source.ruby.rails.embedded.html"]});
          });
        });
      });
    });

    it("can parse a grammar with newline characters in its regular expressions (regression)", () => {
      grammar = loadGrammarSync('imaginary.cson');
      const {line, tags, ruleStack} = grammar.tokenizeLine("// a singleLineComment");
      const tokens = registry.decodeTokens(line, tags);
      expect(ruleStack.length).to.eql(1);
      expect(ruleStack[0].scopeName).to.eql("source.imaginaryLanguage");

      expect(tokens.length).to.eql(3);
      expect(tokens[0].value).to.eql("//");
      expect(tokens[1].value).to.eql(" a singleLineComment");
      expect(tokens[2].value).to.eql("");
    });

    it("can parse multiline text using a grammar containing patterns with newlines", () => {
      grammar = loadGrammarSync('multiline.cson');
      const lines = grammar.tokenizeLines('Xy\\\nzX');

      // Line 0
      expect(lines[0][0]).to.eql({
        value: 'X',
        scopes: ['source.multilineLanguage', 'outside-x', 'start']});

      expect(lines[0][1]).to.eql({
        value: 'y',
        scopes: ['source.multilineLanguage', 'outside-x']});

      expect(lines[0][2]).to.eql({
        value: '\\',
        scopes: ['source.multilineLanguage', 'outside-x', 'inside-x']});

      expect(lines[0][3]).to.eql(undefined);

      // Line 1
      expect(lines[1][0]).to.eql({
        value: 'z',
        scopes: ['source.multilineLanguage', 'outside-x']});

      expect(lines[1][1]).to.eql({
        value: 'X',
        scopes: ['source.multilineLanguage', 'outside-x', 'end']});

      expect(lines[1][2]).to.eql(undefined);
    });

    it("does not loop infinitely (regression)", () => {
      grammar = registry.grammarForScopeName('source.js');
      let {line, tags, ruleStack} = grammar.tokenizeLine("// line comment");
      ({line, tags, ruleStack} = grammar.tokenizeLine(" // second line comment with a single leading space", ruleStack));
    });

    it("can parse a grammar that captures the same text multiple times (regression)", () => {
      grammar = loadGrammarSync('captures-patterns.cson');
      let lines = grammar.tokenizeLines('abc');
      expect(lines.length).to.eql(1);
      expect(lines[0].length).to.eql(3);
      expect(lines[0][0]).to.eql({value: 'a', scopes: ['abcabx', 'abc']});
      expect(lines[0][1]).to.eql({value: 'b', scopes: ['abcabx', 'abc', 'b']});
      expect(lines[0][2]).to.eql({value: 'c', scopes: ['abcabx', 'abc']});

      lines = grammar.tokenizeLines('abx');
      expect(lines.length).to.eql(1);
      expect(lines[0].length).to.eql(3);
      expect(lines[0][0]).to.eql({value: 'a', scopes: ['abcabx', 'abx']});
      expect(lines[0][1]).to.eql({value: 'b', scopes: ['abcabx', 'abx', 'up-to-x-outer', 'up-to-x-inner']});
      expect(lines[0][2]).to.eql({value: 'x', scopes: ['abcabx', 'abx']});
  });

    describe("when inside a C block", () => {
      beforeEach(() => {
        loadGrammarSync('c.json');
        loadGrammarSync('c-plus-plus.json');
        grammar = registry.grammarForScopeName('source.c');
      });

      it("correctly parses a method. (regression)", () => {
        const {line, tags, ruleStack} = grammar.tokenizeLine("if(1){m()}");
        const tokens = registry.decodeTokens(line, tags);
        expect(tokens[5]).to.eql({value: "m", scopes: ["source.c", "meta.block.c", "meta.function-call.c", "support.function.any-method.c"]});
      });

      it("correctly parses nested blocks. (regression)", () => {
        const {line, tags, ruleStack} = grammar.tokenizeLine("if(1){if(1){m()}}");
        const tokens = registry.decodeTokens(line, tags);
        expect(tokens[5]).to.eql({value: "if", scopes: ["source.c", "meta.block.c", "keyword.control.c"]});
        expect(tokens[10]).to.eql({value: "m", scopes: ["source.c", "meta.block.c", "meta.block.c", "meta.function-call.c", "support.function.any-method.c"]});
      });
    });

    describe("when the grammar can infinitely loop over a line", () => {
      it("aborts tokenization", () => {
        error = chai.spy.on(console, 'error', () => {});
        grammar = loadGrammarSync('infinite-loop.cson');
        const {line, tags} = grammar.tokenizeLine("abc");
        const scopes = [];
        const tokens = registry.decodeTokens(line, tags, scopes);
        expect(tokens[0].value).to.eql("a");
        expect(tokens[1].value).to.eql("bc");
        expect(scopes).to.eql([registry.startIdForScope(grammar.scopeName)]);
        expect(console.error).to.have.been.called;
      });
    });

    describe("when a grammar has a pattern that has back references in the match value", () => {
      it("does not special handle the back references and instead allows oniguruma to resolve them", () => {
        loadGrammarSync('scss.json');
        grammar = registry.grammarForScopeName('source.css.scss');
        const {line, tags} = grammar.tokenizeLine("@mixin x() { -moz-selector: whatever; }");
        const tokens = registry.decodeTokens(line, tags);
        expect(tokens[9]).to.eql({value: "-moz-selector", scopes: ["source.css.scss", "meta.property-list.scss", "meta.property-name.scss"]});
      });
    });

    describe("when a line has more tokens than `maxTokensPerLine`", () => {
      it("creates a final token with the remaining text and resets the ruleStack to match the begining of the line", () => {
        grammar = registry.grammarForScopeName('source.js');
        const originalRuleStack = grammar.tokenizeLine('').ruleStack;
        chai.spy.on(grammar, 'getMaxTokensPerLine', () => 5);
        const {line, tags, ruleStack} = grammar.tokenizeLine("var x = /[a-z]/;", originalRuleStack);
        const scopes = [];
        const tokens = registry.decodeTokens(line, tags, scopes);
        expect(tokens.length).to.eql(6);
        expect(tokens[5].value).to.eql("[a-z]/;");
        expect(ruleStack).to.eql(originalRuleStack);
        expect(ruleStack).not.to.eq(originalRuleStack);
        expect(scopes.length).to.eql(0);
      });
    });

    describe("when a grammar has a capture with patterns", () => {
      it("matches the patterns and includes the scope specified as the pattern's match name", () => {
        grammar = registry.grammarForScopeName('text.html.php');
        const {line, tags} = grammar.tokenizeLine("<?php public final function meth() {} ?>");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[2].value).to.eql("public");
        expect(tokens[2].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "source.php", "meta.function.php", "storage.modifier.php"]);

        expect(tokens[3].value).to.eql(" ");
        expect(tokens[3].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "source.php", "meta.function.php"]);

        expect(tokens[4].value).to.eql("final");
        expect(tokens[4].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "source.php", "meta.function.php", "storage.modifier.php"]);

        expect(tokens[5].value).to.eql(" ");
        expect(tokens[5].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "source.php", "meta.function.php"]);

        expect(tokens[6].value).to.eql("function");
        expect(tokens[6].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "source.php", "meta.function.php", "storage.type.function.php"]);
      });

      it("ignores child captures of a capture with patterns", () => {
        grammar = loadGrammarSync('nested-captures.cson');
        const {line, tags} = grammar.tokenizeLine("ab");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[0].value).to.eql("ab");
        expect(tokens[0].scopes).to.eql(["nested", "text", "a"]);
      });
    });

    describe("when the grammar has injections", () => {
      it("correctly includes the injected patterns when tokenizing", () => {
        grammar = registry.grammarForScopeName('text.html.php');
        const {line, tags} = grammar.tokenizeLine("<div><?php function hello() {} ?></div>");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[3].value).to.eql("<?php");
        expect(tokens[3].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "punctuation.section.embedded.begin.php"]);

        expect(tokens[5].value).to.eql("function");
        expect(tokens[5].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "source.php", "meta.function.php", "storage.type.function.php"]);

        expect(tokens[7].value).to.eql("hello");
        expect(tokens[7].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "source.php", "meta.function.php", "entity.name.function.php"]);

        expect(tokens[14].value).to.eql("?");
        expect(tokens[14].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "punctuation.section.embedded.end.php", "source.php"]);

        expect(tokens[15].value).to.eql(">");
        expect(tokens[15].scopes).to.eql(["text.html.php", "meta.embedded.line.php", "punctuation.section.embedded.end.php"]);

        expect(tokens[16].value).to.eql("</");
        expect(tokens[16].scopes).to.eql(["text.html.php", "meta.tag.block.any.html", "punctuation.definition.tag.begin.html"]);

        expect(tokens[17].value).to.eql("div");
        expect(tokens[17].scopes).to.eql(["text.html.php", "meta.tag.block.any.html", "entity.name.tag.block.any.html"]);
      });

      it("updates injections when grammars that the injection patterns use are updated", () => {
        loadGrammarSync('sql-injection.cson');
        grammar = registry.grammarForScopeName('source.sql-injection');
        let calls = 0
        const callback = (a) => { calls++ }
        grammar.onDidUpdate(callback);

        // At this point, the SQL grammar has not yet been loaded
        let {line, tags} = grammar.tokenizeLine('"SELECT something"');
        let tokens = registry.decodeTokens(line, tags);

        expect(tokens[1]).to.eql({value: 'SELECT something', scopes: ['source.sql-injection', 'string', 'meta.embedded.sql']});

        // But now it has
        loadGrammarSync('sql.json');
        expect(calls).to.eql(1);
        ({line, tags} = grammar.tokenizeLine('"SELECT something"'));
        tokens = registry.decodeTokens(line, tags);

        expect(tokens[1]).to.eql({value: 'SELECT', scopes: ['source.sql-injection', 'string', 'meta.embedded.sql', 'keyword.other.DML.sql']});
      });

      it("gives lower priority to them than other matches", () => {
        loadGrammarSync('php2.json');
        grammar = registry.grammarForScopeName('text.html.php2');
        // PHP2 is a modified PHP grammar which has a regular source.js.embedded.html injection
        const {line, tags} = grammar.tokenizeLine("<script><?php function hello() {} ?></script>");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[3].value).not.to.eql("<?php");
        expect(tokens[3].value).to.eql("<");
        expect(tokens[3].scopes).to.eql(["text.html.php2", "source.js.embedded.html", "keyword.operator.js"]);
      });
    });

    describe("when the grammar has prefixed injections", () => {
      it("correctly prioritizes them when tokenizing", () => {
        grammar = registry.grammarForScopeName('text.html.php');
        // PHP has a L:source.js.embedded.html injection
        const {line, tags} = grammar.tokenizeLine("<script><?php function hello() {} ?></script>");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[3].value).to.eql("<?php");
        expect(tokens[3].scopes).to.eql(["text.html.php", "source.js.embedded.html", "meta.embedded.line.php", "punctuation.section.embedded.begin.php"]);

        expect(tokens[5].value).to.eql("function");
        expect(tokens[5].scopes).to.eql(["text.html.php", "source.js.embedded.html", "meta.embedded.line.php", "source.php", "meta.function.php", "storage.type.function.php"]);

        expect(tokens[7].value).to.eql("hello");
        expect(tokens[7].scopes).to.eql(["text.html.php", "source.js.embedded.html", "meta.embedded.line.php", "source.php", "meta.function.php", "entity.name.function.php"]);

        expect(tokens[14].value).to.eql("?");
        expect(tokens[14].scopes).to.eql(["text.html.php", "source.js.embedded.html", "meta.embedded.line.php", "punctuation.section.embedded.end.php", "source.php"]);

        expect(tokens[15].value).to.eql(">");
        expect(tokens[15].scopes).to.eql(["text.html.php", "source.js.embedded.html", "meta.embedded.line.php", "punctuation.section.embedded.end.php"]);

        expect(tokens[16].value).to.eql("</");
        expect(tokens[16].scopes).to.eql(["text.html.php", "source.js.embedded.html", "punctuation.definition.tag.html"]);

        expect(tokens[17].value).to.eql("script");
        expect(tokens[17].scopes).to.eql(["text.html.php", "source.js.embedded.html", "entity.name.tag.script.html"]);
      });
    });

    describe("when the grammar has an injection selector", () => {
      it("includes the grammar's patterns when the selector matches the current scope in other grammars", () => {
        loadGrammarSync('hyperlink.json');
        grammar = registry.grammarForScopeName("source.js");
        const {line, tags} = grammar.tokenizeLine("var i; // http://github.com");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[0].value).to.eql("var");
        expect(tokens[0].scopes).to.eql(["source.js", "storage.modifier.js"]);

        expect(tokens[6].value).to.eql("http://github.com");
        expect(tokens[6].scopes).to.eql(["source.js", "comment.line.double-slash.js", "markup.underline.link.http.hyperlink"]);
      });

      it("gives lower priority to them than other matches", () => {
        loadGrammarSync('normal-injection-selector.cson');
        grammar = registry.grammarForScopeName("source.js");
        const {line, tags} = grammar.tokenizeLine("<!--");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[0].value).to.eql("<!--");
        expect(tokens[0].scopes).not.to.eql(["source.js", "should-not-be-matched.normal.injection-selector"]);
        expect(tokens[0].scopes).to.eql(["source.js", "comment.block.html.js", "punctuation.definition.comment.html.js"]);
      });
    });

    describe("when the grammar has a prefixed injection selector", () => {
      it("correctly prioritizes them when tokenizing", () => {
        loadGrammarSync('prefixed-injection-selector.cson');
        grammar = registry.grammarForScopeName("source.js");
        const {line, tags} = grammar.tokenizeLine("<!--");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[0].value).to.eql("<!--");
        expect(tokens[0].scopes).not.to.eql(["source.js", "comment.block.html.js", "punctuation.definition.comment.html.js"]);
        expect(tokens[0].scopes).to.eql(["source.js", "should-be-matched.prefixed.injection-selector"]);
      });
    });

    describe("when the grammar's pattern name has a group number in it", () => {
      it("replaces the group number with the matched captured text", () => {
        grammar = loadGrammarSync('hyperlink.json');
        const {line, tags} = grammar.tokenizeLine("https://github.com");
        const tokens = registry.decodeTokens(line, tags);
        expect(tokens[0].scopes).to.eql(["text.hyperlink", "markup.underline.link.https.hyperlink"]);
      });
    });

    describe("when the position doesn't advance and rule includes $self and matches itself", () => {
      it("tokenizes the entire line using the rule", () => {
        grammar = loadGrammarSync('forever.cson');
        const {line, tags} = grammar.tokenizeLine("forever and ever");
        const tokens = registry.decodeTokens(line, tags);
        expect(tokens.length).to.eql(1);
        expect(tokens[0].value).to.eql("forever and ever");
        expect(tokens[0].scopes).to.eql(["source.forever", "text"]);
      });
    });

    //describe("${capture:/command} style pattern names", () => {
    //  it("replaces the number with the capture group and translates the text", () => {
    //    loadGrammarSync('todo.json');
    //    grammar = registry.grammarForScopeName('source.ruby');
    //    const {line, tags} = grammar.tokenizeLine("# TODO be nicer");
    //    const tokens = registry.decodeTokens(line, tags);

    //    expect(tokens[2].value).to.eql("TODO");
    //    expect(tokens[2].scopes).to.eql(["source.ruby", "comment.line.number-sign.ruby", "storage.type.class.todo"]);
    //  });
    //});

    describe("$number style pattern names", () => {
      it("replaces the number with the capture group and translates the text", () => {
        loadGrammarSync('makefile.json');
        grammar = registry.grammarForScopeName('source.makefile');
        let {line, tags} = grammar.tokenizeLine("ifeq");
        let tokens = registry.decodeTokens(line, tags);
        expect(tokens.length).to.eql(1);
        expect(tokens[0].value).to.eql("ifeq");
        expect(tokens[0].scopes).to.eql(["source.makefile", "meta.scope.conditional.makefile", "keyword.control.ifeq.makefile"]);

        ({line, tags} = grammar.tokenizeLine("ifeq ("));
        tokens = registry.decodeTokens(line, tags);
        expect(tokens.length).to.eql(2);
        expect(tokens[0].value).to.eql("ifeq");
        expect(tokens[0].scopes).to.eql(["source.makefile", "meta.scope.conditional.makefile", "keyword.control.ifeq.makefile"]);
        expect(tokens[1].value).to.eql(" (");
        expect(tokens[1].scopes).to.eql(["source.makefile", "meta.scope.conditional.makefile", "meta.scope.condition.makefile"]);
      });

      it("removes leading dot characters from the replaced capture index placeholder", () => {
        loadGrammarSync('makefile.json');
        grammar = registry.grammarForScopeName('source.makefile');
        const {line, tags}  = grammar.tokenizeLine(".PHONY:");
        const tokens = registry.decodeTokens(line, tags);
        expect(tokens.length).to.eql(2);
        expect(tokens[0].scopes).to.eql(["source.makefile", "meta.scope.target.makefile", "support.function.target.PHONY.makefile"]);
        expect(tokens[0].value).to.eql(".PHONY");
      });

      it("replaces all occurences of capture index placeholders", () => {
        loadGrammarSync("scope-names-with-placeholders.cson");
        grammar = registry.grammarForScopeName("scope-names-with-placeholders");
        let {line, tags} = grammar.tokenizeLine("a b");
        let tokens = registry.decodeTokens(line, tags);
        expect(tokens.length).to.eql(1);
        expect(tokens[0].value).to.eql("a b");
        expect(tokens[0].scopes).to.eql(["scope-names-with-placeholders", "a.b"]);

        ({line, tags} = grammar.tokenizeLine("c d - e"));
        tokens = registry.decodeTokens(line, tags);
        expect(tokens.length).to.eql(3);
        expect(tokens[0].value).to.eql("c d");
        expect(tokens[0].scopes).to.eql(["scope-names-with-placeholders"]);
        expect(tokens[1].value).to.eql(" - ");
        expect(tokens[1].scopes).to.eql(["scope-names-with-placeholders", "c.d"]);
        expect(tokens[2].value).to.eql("e");
        expect(tokens[2].scopes).to.eql(["scope-names-with-placeholders"]);
      });
    });
  });

  describe("language-specific integration tests", () => {
    let lines = null;

    describe("Git commit messages", () => {
      beforeEach(() => {
        grammar = loadGrammarSync('git-commit.json');
        lines = grammar.tokenizeLines(`\
longggggggggggggggggggggggggggggggggggggggggggggggg
# Please enter the commit message for your changes. Lines starting\
`
        );
      });

      it("correctly parses a long line", () => {
        const tokens = lines[0];
        expect(tokens[0].value).to.eql("longggggggggggggggggggggggggggggggggggggggggggggggg");
        expect(tokens[0].scopes).to.eql(["text.git-commit", "meta.scope.message.git-commit", "invalid.deprecated.line-too-long.git-commit"]);
    });

      it("correctly parses the number sign of the first comment line", () => {
        const tokens = lines[1];
        expect(tokens[0].value).to.eql("#");
        expect(tokens[0].scopes).to.eql(["text.git-commit", "meta.scope.metadata.git-commit", "comment.line.number-sign.git-commit", "punctuation.definition.comment.git-commit"]);
    });
  });

    describe("C++", () => {
      beforeEach(() => {
        loadGrammarSync('c.json');
        grammar = loadGrammarSync('c-plus-plus.json');
        lines = grammar.tokenizeLines(`\
#include "a.h"
#include "b.h"\
`
        );
      });

      it("correctly parses the first include line", () => {
        const tokens = lines[0];
        expect(tokens[0].value).to.eql("#");
        expect(tokens[0].scopes).to.eql(["source.c++", "meta.preprocessor.c.include"]);
        expect(tokens[1].value).to.eql('include');
        expect(tokens[1].scopes).to.eql(["source.c++", "meta.preprocessor.c.include", "keyword.control.import.include.c"]);
    });

      it("correctly parses the second include line", () => {
        const tokens = lines[1];
        expect(tokens[0].value).to.eql("#");
        expect(tokens[0].scopes).to.eql(["source.c++", "meta.preprocessor.c.include"]);
        expect(tokens[1].value).to.eql('include');
        expect(tokens[1].scopes).to.eql(["source.c++", "meta.preprocessor.c.include", "keyword.control.import.include.c"]);
    });
  });

    describe("Ruby", () => {
      beforeEach(() => {
        grammar = registry.grammarForScopeName('source.ruby');
        lines = grammar.tokenizeLines(`\
a = {
  "b" => "c",
}\
`
        );
      });

      it("doesn't loop infinitely (regression)", () => {
        expect(_.pluck(lines[0], 'value').join('')).to.eql('a = {');
        expect(_.pluck(lines[1], 'value').join('')).to.eql('  "b" => "c",');
        expect(_.pluck(lines[2], 'value').join('')).to.eql('}');
        expect(_.pluck(lines[3], 'value').join('')).to.eql('');
      });
    });

    describe("Objective-C", () => {
      beforeEach(() => {
        loadGrammarSync('c.json');
        loadGrammarSync('c-plus-plus.json');
        loadGrammarSync('objective-c.json');
        grammar = loadGrammarSync('objective-c-plus-plus.json');
        lines = grammar.tokenizeLines(`\
void test() {
NSString *a = @"a\\nb";
}\
`
        );
      });

      it("correctly parses variable type when it is a built-in Cocoa class", () => {
        const tokens = lines[1];
        expect(tokens[0].value).to.eql("NSString");
        expect(tokens[0].scopes).to.eql(["source.objc++", "meta.function.c", "meta.block.c", "support.class.cocoa"]);
      });

      it("correctly parses the semicolon at the end of the line", () => {
        const tokens = lines[1];
        const lastToken = _.last(tokens);
        expect(lastToken.value).to.eql(";");
        expect(lastToken.scopes).to.eql(["source.objc++", "meta.function.c", "meta.block.c"]);
      });

      it("correctly parses the string characters before the escaped character", () => {
        const tokens = lines[1];
        expect(tokens[2].value).to.eql('@"');
        expect(tokens[2].scopes).to.eql(["source.objc++", "meta.function.c", "meta.block.c", "string.quoted.double.objc", "punctuation.definition.string.begin.objc"]);
      });
    });

    describe("Java", () => {
      beforeEach(() => {
        loadGrammarSync('java.json');
        grammar = registry.grammarForScopeName('source.java');
      });

      it("correctly parses single line comments", () => {
        lines = grammar.tokenizeLines(`\
public void test() {
//comment
}\
`
        );

        const tokens = lines[1];
        expect(tokens[0].scopes).to.eql(["source.java", "comment.line.double-slash.java", "punctuation.definition.comment.java"]);
        expect(tokens[0].value).to.eql('//');
        expect(tokens[1].scopes).to.eql(["source.java", "comment.line.double-slash.java"]);
        expect(tokens[1].value).to.eql('comment');
      });

      it("correctly parses nested method calls", () => {
        const {line, tags} = grammar.tokenizeLine('a(b(new Object[0]));');
        const tokens = registry.decodeTokens(line, tags);
        const lastToken = _.last(tokens);
        expect(lastToken.scopes).to.eql(['source.java', 'punctuation.terminator.java']);
        expect(lastToken.value).to.eql(';');
      });
    });

    describe("HTML (Ruby - ERB)", () => {
      it("correctly parses strings inside tags", () => {
        grammar = registry.grammarForScopeName('text.html.erb');
        const {line, tags} = grammar.tokenizeLine('<% page_title "My Page" %>');
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens[2].value).to.eql('"');
        expect(tokens[2].scopes).to.eql(["text.html.erb", "meta.embedded.line.erb", "source.ruby", "string.quoted.double.ruby", "punctuation.definition.string.begin.ruby"]);
        expect(tokens[3].value).to.eql('My Page');
        expect(tokens[3].scopes).to.eql(["text.html.erb", "meta.embedded.line.erb", "source.ruby", "string.quoted.double.ruby"]);
        expect(tokens[4].value).to.eql('"');
        expect(tokens[4].scopes).to.eql(["text.html.erb", "meta.embedded.line.erb", "source.ruby", "string.quoted.double.ruby", "punctuation.definition.string.end.ruby"]);
      });

      it("does not loop infinitely on <%>", () => {
        loadGrammarSync('html-rails.json');
        loadGrammarSync('ruby-on-rails.json');

        grammar = registry.grammarForScopeName('text.html.erb');
        const {line, tags} = grammar.tokenizeLine('<%>');
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens.length).to.eql(1);
        expect(tokens[0].value).to.eql('<%>');
        expect(tokens[0].scopes).to.eql(["text.html.erb"]);
      });
    });

    describe("Unicode support", () => {
      describe("Surrogate pair characters", () => it("correctly parses JavaScript strings containing surrogate pair characters", () => {
        grammar = registry.grammarForScopeName('source.js');
        const {line, tags} = grammar.tokenizeLine("'\uD835\uDF97'");
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens.length).to.eql(3);
        expect(tokens[0].value).to.eql("'");
        expect(tokens[1].value).to.eql("\uD835\uDF97");
        expect(tokens[2].value).to.eql("'");
      }));

      describe("when the line contains unicode characters", () => it("correctly parses tokens starting after them", () => {
        loadGrammarSync('json.json');
        grammar = registry.grammarForScopeName('source.json');
        const {line, tags} = grammar.tokenizeLine('{"\u2026": 1}');
        const tokens = registry.decodeTokens(line, tags);

        expect(tokens.length).to.eql(8);
        expect(tokens[6].value).to.eql('1');
        expect(tokens[6].scopes).to.eql(["source.json", "meta.structure.dictionary.json", "meta.structure.dictionary.value.json", "constant.numeric.json"]);
      }));

      describe("when the line contains emoji characters", () => {
        it("correctly terminates quotes & parses tokens starting after them", () => {
          grammar = registry.grammarForScopeName('source.js');

          const withoutEmoji = grammar.tokenizeLine("var emoji = 'xx http://a'; var after;");
          const withoutEmojiTokens = registry.decodeTokens(withoutEmoji.line, withoutEmoji.tags);

          const withEmoji = grammar.tokenizeLine("var emoji = '💻 http://a'; var after;");
          const withEmojiTokens = registry.decodeTokens(withEmoji.line, withEmoji.tags);

          // ignoring this value (the string containing the emoji), they should be identical
          delete withoutEmojiTokens[5].value;
          delete withEmojiTokens[5].value;

          expect(withEmojiTokens).to.eql(withoutEmojiTokens);

          expect(withoutEmojiTokens.length).to.eql(12);
          expect(withoutEmojiTokens[7].value).to.eql(';');
          expect(withoutEmojiTokens[7].scopes).to.eql([ 'source.js', 'punctuation.terminator.statement.js' ]);

          expect(withEmojiTokens.length).to.eql(12);
          expect(withEmojiTokens[7].value).to.eql(';');
          expect(withEmojiTokens[7].scopes).to.eql([ 'source.js', 'punctuation.terminator.statement.js' ]);
        });
      });
    });

    describe("python", () => {
      it("parses import blocks correctly", () => {
        grammar = registry.grammarForScopeName('source.python');
        lines = grammar.tokenizeLines("import a\nimport b");

        const line1 = lines[0];
        expect(line1.length).to.eql(3);
        expect(line1[0].value).to.eql("import");
        expect(line1[0].scopes).to.eql(["source.python", "keyword.control.import.python"]);
        expect(line1[1].value).to.eql(" ");
        expect(line1[1].scopes).to.eql(["source.python"]);
        expect(line1[2].value).to.eql("a");
        expect(line1[2].scopes).to.eql(["source.python"]);

        const line2 = lines[1];
        expect(line2.length).to.eql(3);
        expect(line2[0].value).to.eql("import");
        expect(line2[0].scopes).to.eql(["source.python", "keyword.control.import.python"]);
        expect(line2[1].value).to.eql(" ");
        expect(line2[1].scopes).to.eql(["source.python"]);
        expect(line2[2].value).to.eql("b");
        expect(line2[2].scopes).to.eql(["source.python"]);
      });

      it("closes all scopes opened when matching rules within a capture", () => {
        grammar = registry.grammarForScopeName('source.python');
        grammar.tokenizeLines("r'%d(' #foo");
      });
    }); // should not throw exception due to invalid tag sequence

    describe("HTML", () => {
      describe("when it contains CSS", () => {
        it("correctly parses the CSS rules", () => {
          loadGrammarSync("css.cson");
          grammar = registry.grammarForScopeName("text.html.basic");

          lines = grammar.tokenizeLines(`\
<html>
<head>
  <style>
    body {
      color: blue;
    }
  </style>
</head>
</html>\
`
        );

          const line4 = lines[4];
          expect(line4[4].value).to.eql("blue");
          expect(line4[4].scopes).to.eql([
            "text.html.basic",
            "source.css.embedded.html",
            "meta.property-list.css",
            "meta.property-value.css",
            "support.constant.color.w3c-standard-color-name.css"
          ]);
        });
      });

      describe("when it contains inline CSS", () => {
        it("correctly stops parsing CSS", () => {
          loadGrammarSync('css.cson');
          loadGrammarSync('html-css-inline.cson');
          grammar = registry.grammarForScopeName('text.html.basic.css');

          const {tokens} = grammar.tokenizeLine("<span style='s:'></style>");
          expect(tokens[8]).to.eql({value: "'", scopes: [
            'text.html.basic.css',
            'meta.tag.inline.any.html',
            'meta.attribute-with-value.style.html',
            'string.quoted.single.html',
            'punctuation.definition.string.end.html'
          ]});

          expect(tokens[9]).to.eql({value: ">", scopes: [
            'text.html.basic.css',
            'meta.tag.inline.any.html',
            'punctuation.definition.tag.end.html'
          ]});

          expect(tokens[10]).to.eql({value: "</", scopes: [
            'text.html.basic.css',
            'meta.tag.inline.any.html',
            'punctuation.definition.tag.begin.html'
          ]});
        });
      });
    });

    describe("Latex", () => {
      it("properly emits close tags for scope names containing back-references", () => {
        loadGrammarSync("latex.cson");
        grammar = registry.grammarForScopeName("text.tex.latex");
        const {line, tags} = grammar.tokenizeLine("\\chapter*{test}");
        registry.decodeTokens(line, tags);
      });
    });

    describe("Thrift", () => {
      it("doesn't loop infinitely when the same rule is pushed or popped based on a zero-width match", () => {
        loadGrammarSync("thrift.cson");
        grammar = registry.grammarForScopeName("source.thrift");

        lines = grammar.tokenizeLines(`\
  exception SimpleErr {
  1: string message

  service SimpleService {
  void Simple() throws (1: SimpleErr simpleErr)
  }\
  `
        );
      });
    });
  });

  describe("when the position doesn't advance", () => {
    it("logs an error and tokenizes the remainder of the line", () => {
      chai.spy.on(console, 'error', () => {});
      loadGrammarSync("loops.json");
      grammar = registry.grammarForScopeName("source.loops");
      const {line, tags, ruleStack} = grammar.tokenizeLine('test');
      const tokens = registry.decodeTokens(line, tags);

      expect(ruleStack.length).to.eql(1);
      expect(console.error).to.have.been.called.once;
      expect(tokens.length).to.eql(1);
      expect(tokens[0].value).to.eql('test');
      expect(tokens[0].scopes).to.eql(['source.loops']);
    });
  });

  describe("when the injection references an included grammar", () => {
    it("adds a pattern for that grammar", () => {
      loadGrammarSync("injection-with-include.cson");
      grammar = registry.grammarForScopeName("test.injections");
      expect(grammar).not.to.eql(null);
      expect(grammar.includedGrammarScopes).to.eql(['text.plain']);
    });
  });

  describe("when the grammar is activated/deactivated", () => {
    it("adds/removes it from the registry", () => {
      grammar = new Grammar(registry, {scopeName: 'test-activate'});

      grammar.deactivate();
      expect(registry.grammarForScopeName('test-activate')).to.eql(undefined);

      grammar.activate();
      expect(registry.grammarForScopeName('test-activate')).to.eql(grammar);

      grammar.deactivate();
      expect(registry.grammarForScopeName('test-activate')).to.eql(undefined);
    });
  });
});
