const ScopeSelector = require('../lib/scope-selector');
const chai = require('chai')
const { expect } = chai

describe("ScopeSelector", function() {
  beforeEach(async () => {
    await require('../lib/onig').ready;
  })

  describe(".matches(scopes)", () => {
    it("matches the asterisk", function() {
      expect(new ScopeSelector('*').matches(['a'])).to.be.ok;
      expect(new ScopeSelector('*').matches(['b', 'c'])).to.be.ok;
      expect(new ScopeSelector('a.*.c').matches(['a.b.c'])).to.be.ok;
      expect(new ScopeSelector('a.*.c').matches(['a.b.c.d'])).to.be.ok;
      expect(new ScopeSelector('a.*.c').matches(['a.b.d.c'])).to.not.be.ok;
    });

    it("matches segments", () => {
      expect(new ScopeSelector('a').matches(['a'])).to.be.ok;
      expect(new ScopeSelector('a').matches(['a.b'])).to.be.ok;
      expect(new ScopeSelector('a.b').matches(['a.b.c'])).to.be.ok;
      expect(new ScopeSelector('a').matches(['abc'])).to.not.be.ok;
      expect(new ScopeSelector('a.b-c').matches(['a.b-c.d'])).to.be.ok;
      expect(new ScopeSelector('a.b').matches(['a.b-d'])).to.not.be.ok;
      expect(new ScopeSelector('c++').matches(['c++'])).to.be.ok;
      expect(new ScopeSelector('c++').matches(['c'])).to.not.be.ok;
      expect(new ScopeSelector('a_b_c').matches(['a_b_c'])).to.be.ok;
      expect(new ScopeSelector('a_b_c').matches(['a_b'])).to.not.be.ok;
    });

    it("matches prefixes", function() {
      expect(new ScopeSelector('R:g').matches(['g'])).to.be.ok;
      expect(new ScopeSelector('R:g').matches(['R:g'])).to.not.be.ok;
    });

    it("matches disjunction", function() {
      expect(new ScopeSelector('a | b').matches(['b'])).to.be.ok;
      expect(new ScopeSelector('a|b|c').matches(['c'])).to.be.ok;
      expect(new ScopeSelector('a|b|c').matches(['d'])).to.not.be.ok;
    });

    it("matches negation", function() {
      expect(new ScopeSelector('a - c').matches(['a', 'b'])).to.be.ok;
      expect(new ScopeSelector('a - c').matches(['a'])).to.be.ok;
      expect(new ScopeSelector('-c').matches(['b'])).to.be.ok;
      expect(new ScopeSelector('-c').matches(['c', 'b'])).to.not.be.ok;
      expect(new ScopeSelector('a-b').matches(['a', 'b'])).to.not.be.ok;
      expect(new ScopeSelector('a -b').matches(['a', 'b'])).to.not.be.ok;
      expect(new ScopeSelector('a -c').matches(['a', 'b'])).to.be.ok;
      expect(new ScopeSelector('a-c').matches(['a', 'b'])).to.not.be.ok;
    });

    it("matches conjunction", function() {
      expect(new ScopeSelector('a & b').matches(['b', 'a'])).to.be.ok;
      expect(new ScopeSelector('a&b&c').matches(['c'])).to.not.be.ok;
      expect(new ScopeSelector('a&b&c').matches(['a', 'b', 'd'])).to.not.be.ok;
      expect(new ScopeSelector('a & -b').matches(['a', 'b', 'd'])).to.not.be.ok;
      expect(new ScopeSelector('a & -b').matches(['a', 'd'])).to.be.ok;
    });

    it("matches composites", function() {
      expect(new ScopeSelector('a,b,c').matches(['b', 'c'])).to.be.ok;
      expect(new ScopeSelector('a, b, c').matches(['d', 'e'])).to.not.be.ok;
      expect(new ScopeSelector('a, b, c').matches(['d', 'c.e'])).to.be.ok;
      expect(new ScopeSelector('a,').matches(['a', 'c'])).to.be.ok;
      expect(new ScopeSelector('a,').matches(['b', 'c'])).to.not.be.ok;
    });

    it("matches groups", function() {
      expect(new ScopeSelector('(a,b) | (c, d)').matches(['a'])).to.be.ok;
      expect(new ScopeSelector('(a,b) | (c, d)').matches(['b'])).to.be.ok;
      expect(new ScopeSelector('(a,b) | (c, d)').matches(['c'])).to.be.ok;
      expect(new ScopeSelector('(a,b) | (c, d)').matches(['d'])).to.be.ok;
      expect(new ScopeSelector('(a,b) | (c, d)').matches(['e'])).to.not.be.ok;
    });

    it("matches paths", function() {
      expect(new ScopeSelector('a b').matches(['a', 'b'])).to.be.ok;
      expect(new ScopeSelector('a b').matches(['b', 'a'])).to.not.be.ok;
      expect(new ScopeSelector('a c').matches(['a', 'b', 'c', 'd', 'e'])).to.be.ok;
      expect(new ScopeSelector('a b e').matches(['a', 'b', 'c', 'd', 'e'])).to.be.ok;
    });

    it("accepts a string scope parameter", function() {
      expect(new ScopeSelector('a|b').matches('a')).to.be.ok;
      expect(new ScopeSelector('a|b').matches('b')).to.be.ok;
      expect(new ScopeSelector('a|b').matches('c')).to.not.be.ok;
      expect(new ScopeSelector('test').matches('test')).to.be.ok;
    });
  });

  describe(".getPrefix(scopes)", () => {
    it("returns the prefix if it exists and if it matches the scopes", function() {
      expect(new ScopeSelector('L:a').getPrefix('a')).to.eql('L');
      expect(new ScopeSelector('B:a').getPrefix('a')).to.eql('B');
      expect(new ScopeSelector('R:a').getPrefix('a')).to.eql('R');
      expect(() => new ScopeSelector('Q:a').getPrefix('a')).to.throw();
      expect(new ScopeSelector('L:a').getPrefix('b')).to.eql(undefined);
      expect(new ScopeSelector('a').getPrefix('a')).to.eql(undefined);
      expect(new ScopeSelector('L:a b').getPrefix(['a', 'b'])).to.eql('L');
      expect(() => new ScopeSelector('a L:b').getPrefix(['a', 'b'])).to.throw();
      expect(new ScopeSelector('L:(a | b)').getPrefix('a')).to.eql('L');
      expect(new ScopeSelector('L:(a | b)').getPrefix('b')).to.eql('L');
      expect(new ScopeSelector('L:a & b').getPrefix(['a', 'b'])).to.eql('L');
      expect(new ScopeSelector('a & L:b').getPrefix(['a', 'b'])).to.eql(undefined);
      expect(new ScopeSelector('L:a - b').getPrefix('a')).to.eql('L');
      expect(new ScopeSelector('L:a - b').getPrefix(['a', 'b'])).to.be.eql(undefined);
      expect(new ScopeSelector('L:a - b').getPrefix('b')).to.eql(undefined);
      expect(new ScopeSelector('a - L:b').getPrefix('a')).to.eql(undefined);
      expect(new ScopeSelector('a - L:b').getPrefix(['a', 'b'])).to.eql(undefined);
      expect(new ScopeSelector('L:*').getPrefix('a')).to.eql('L');
      expect(new ScopeSelector('L:a, b').getPrefix('a')).to.eql('L');
      expect(new ScopeSelector('L:a, b').getPrefix('b')).to.eql(undefined);
      expect(new ScopeSelector('L:a, R:b').getPrefix('a')).to.eql('L');
      expect(new ScopeSelector('L:a, R:b').getPrefix('b')).to.eql('R');
    });
  });

  describe(".toCssSelector()", () => {
    it("converts the TextMate scope selector to a CSS selector", function() {
      expect(new ScopeSelector('a b c').toCssSelector()).to.eql('.a .b .c');
      expect(new ScopeSelector('a.b.c').toCssSelector()).to.eql('.a.b.c');
      expect(new ScopeSelector('*').toCssSelector()).to.eql('*');
      expect(new ScopeSelector('a - b').toCssSelector()).to.eql('.a:not(.b)');
      expect(new ScopeSelector('a & b').toCssSelector()).to.eql('.a .b');
      expect(new ScopeSelector('a & -b').toCssSelector()).to.eql('.a:not(.b)');
      expect(new ScopeSelector('a | b').toCssSelector()).to.eql('.a, .b');
      expect(new ScopeSelector('a - (b.c d)').toCssSelector()).to.eql('.a:not(.b.c .d)');
      expect(new ScopeSelector('a, b').toCssSelector()).to.eql('.a, .b');
      expect(new ScopeSelector('c++').toCssSelector()).to.eql('.c\\+\\+');
    });
  });

  describe(".toCssSyntaxSelector()", () => {
    it("converts the TextMate scope selector to a CSS selector prefixing it `syntax--`", function() {
      expect(new ScopeSelector('a b c').toCssSyntaxSelector()).to.eql('.syntax--a .syntax--b .syntax--c');
      expect(new ScopeSelector('a.b.c').toCssSyntaxSelector()).to.eql('.syntax--a.syntax--b.syntax--c');
      expect(new ScopeSelector('*').toCssSyntaxSelector()).to.eql('*');
      expect(new ScopeSelector('a - b').toCssSyntaxSelector()).to.eql('.syntax--a:not(.syntax--b)');
      expect(new ScopeSelector('a & b').toCssSyntaxSelector()).to.eql('.syntax--a .syntax--b');
      expect(new ScopeSelector('a & -b').toCssSyntaxSelector()).to.eql('.syntax--a:not(.syntax--b)');
      expect(new ScopeSelector('a | b').toCssSyntaxSelector()).to.eql('.syntax--a, .syntax--b');
      expect(new ScopeSelector('a - (b.c d)').toCssSyntaxSelector()).to.eql('.syntax--a:not(.syntax--b.syntax--c .syntax--d)');
      expect(new ScopeSelector('a, b').toCssSyntaxSelector()).to.eql('.syntax--a, .syntax--b');
      expect(new ScopeSelector('c++').toCssSyntaxSelector()).to.eql('.syntax--c\\+\\+');
    });
  });
});
