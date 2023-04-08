
const oniguruma = require("../lib/onig");

describe("These are failing on MacOS", () => {
  beforeEach(async () => {
    await oniguruma.ready;

  });

  it("Is the C++ firstLineMatch mean to macOS?", () => {

    const firstLineMatch = "-\*- C\+\+ -\*-";

    let string = new oniguruma.OnigString(firstLineMatch);

    console.log(string); // I don't actually know the proper handling, this is me attempting to figure out what's going on lol
  });

});
