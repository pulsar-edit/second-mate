# first mate

TextMate helpers

## Installing

```shc
npm install first-mate
```

## Using

```coffeescript
{ScopeSelector} = require 'first-mate'
selector = new ScopeSelector('a | b')
selector.matches(['c']) # false
selector.matches(['a']) # true
```