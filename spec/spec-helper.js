require('grim').includeDeprecatedAPIs = false

const chai = require('chai')

const chaiWaitFor = require('chai-wait-for')
chai.use(chaiWaitFor)
const waitFor = chaiWaitFor.bindWaitFor({
  timeout: 1000,
  retryInterval: 50,
})

spies = require('chai-spies');
chai.use(spies);

module.exports = { waitFor }
