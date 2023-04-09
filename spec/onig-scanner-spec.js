const onig = require('../lib/onig')
const chai = require('chai')
const { expect } = chai

describe("OnigScanner", () => {
  let registry = null

  beforeEach(async () => await onig.ready)

  it("caches patterns so that equivalent pattern(s) return the same instance", () => {
    let firstScanner = new onig.oniguruma.OnigScanner([/lorem/])
    for (let i = 0; i < 10; i++) {
      let scanner = new onig.oniguruma.OnigScanner([/lorem/])
      expect(scanner === firstScanner).to.be.eql(true)
    }

    let anotherScanner = new onig.oniguruma.OnigScanner([/ipsum/, /dolor/, /lorem/])
    for (let i = 0; i < 10; i++) {
      let scanner = new onig.oniguruma.OnigScanner([/ipsum/, /dolor/, /lorem/])
      expect(scanner === anotherScanner).to.be.eql(true)
    }
  })

})
