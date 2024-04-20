/**
 *  Copyright (c) 2021 GraphQL Contributors
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import CodeMirror from 'codemirror';

import {
  list,
  t,
  onlineParser,
  opt,
  p,
  State,
  Token,
} from 'graphql-language-service';
import indent from '../utils/mode-indent';

/**
 * This mode defines JSON, but provides a data-laden parser state to enable
 * better code intelligence.
 */
CodeMirror.defineMode('graphql-variables', config => {
  const parser = onlineParser({
    eatWhitespace: stream => stream.eatSpace(),
    lexRules: LexRules,
    parseRules: ParseRules,
    editorConfig: { tabSize: config.tabSize },
  });

  return {
    config,
    startState: parser.startState,
    token: parser.token as unknown as CodeMirror.Mode<any>['token'], // TODO: Check if the types are indeed compatible
    indent,
    electricInput: /^\s*[}\]]/,
    fold: 'brace',
    closeBrackets: {
      pairs: '[]{}""',
      explode: '[]{}',
    },
  };
});

/**
 * The lexer rules. These are exactly as described by the spec.
 */
const LexRules = {
  // All Punctuation used in JSON.
  Punctuation: /^\[|]|\{|\}|:|,/,

  // JSON Number.
  Number: /^-?(?:0|(?:[1-9][0-9]*))(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?/,

  // JSON String.
  String: /^"(?:[^"\\]|\\(?:"|\/|\\|b|f|n|r|t|u[0-9a-fA-F]{4}))*"?/,

  // JSON literal keywords.
  Keyword: /^true|false|null/,
};

/**
 * The parser rules for JSON.
 */
const ParseRules = {
  Document: [p('{'), list('Variable', opt(p(','))), p('}')],
  Variable: [namedKey('variable'), p(':'), 'Value'],
  Value(token: Token) {
    switch (token.kind) {
      case 'Number':
        return 'NumberValue';
      case 'String':
        return 'StringValue';
      case 'Punctuation':
        switch (token.value) {
          case '[':
            return 'ListValue';
          case '{':
            return 'ObjectValue';
        }
        return null;
      case 'Keyword':
        switch (token.value) {
          case 'true':
          case 'false':
            return 'BooleanValue';
          case 'null':
            return 'NullValue';
        }
        return null;
    }
  },
  NumberValue: [t('Number', 'number')],
  StringValue: [t('String', 'string')],
  BooleanValue: [t('Keyword', 'builtin')],
  NullValue: [t('Keyword', 'keyword')],
  ListValue: [p('['), list('Value', opt(p(','))), p(']')],
  ObjectValue: [p('{'), list('ObjectField', opt(p(','))), p('}')],
  ObjectField: [namedKey('attribute'), p(':'), 'Value'],
};

// A namedKey Token which will decorate the state with a `name`
function namedKey(style: string) {
  return {
    style,
    match: (token: Token) => token.kind === 'String',
    update(state: State, token: Token) {
      state.name = token.value.slice(1, -1); // Remove quotes.
    },
  };
}
