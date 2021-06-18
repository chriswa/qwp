import { BasicLexer, BasicLexerToken } from './BasicLexer';

class LexerToken extends BasicLexerToken {
  public constructor(public type: string) {
    super();
  }
}

class LexerState {
  // public foo: string = "";
}

type FilterType = (state: LexerState) => boolean;

const filters: Record<string, FilterType> = {
  ALWAYS: (state) => true,
}

const lexer = new BasicLexer<LexerToken, LexerState>();

function addLexerTokenRule(filter: FilterType, regexp: RegExp, tokenId: string) {
  lexer.addRule(filter, regexp, function (_matches) {
    return [ new LexerToken(tokenId) ];
  });
}

addLexerTokenRule(filters.ALWAYS, /^\n/, "NEWLINE");
addLexerTokenRule(filters.ALWAYS, /^[ \t]+/, "WHITESPACE");
addLexerTokenRule(filters.ALWAYS, /^\/\/[^\n]*/, "LINE_COMMENT");
addLexerTokenRule(filters.ALWAYS, /^\/\*.*?\*\//, "BLOCK_COMMENT");
addLexerTokenRule(filters.ALWAYS, /^"(\\.|[^"\\])*"/, "STRING");
addLexerTokenRule(filters.ALWAYS, /^;/, "SEMICOLON");
addLexerTokenRule(filters.ALWAYS, /^#[a-zA-Z][a-zA-Z0-9_]*/, "ANCHOR");
addLexerTokenRule(filters.ALWAYS, /^[a-zA-Z][a-zA-Z0-9_]*/, "WORD");
addLexerTokenRule(filters.ALWAYS, /^-?\d*(\.\d+)?/, "NUMBER");
addLexerTokenRule(filters.ALWAYS, /^,/, "COMMA");
addLexerTokenRule(filters.ALWAYS, /^:/, "COLON");
addLexerTokenRule(filters.ALWAYS, /^{/, "BRACE_OPEN");
addLexerTokenRule(filters.ALWAYS, /^}/, "BRACE_CLOSE");
addLexerTokenRule(filters.ALWAYS, /^\(/, "PAREN_OPEN");
addLexerTokenRule(filters.ALWAYS, /^\)/, "PAREN_CLOSE");
addLexerTokenRule(filters.ALWAYS, /^\[/, "SQUARE_OPEN");
addLexerTokenRule(filters.ALWAYS, /^\]/, "SQUARE_CLOSE");
addLexerTokenRule(filters.ALWAYS, /^=>/, "ARROW");
addLexerTokenRule(filters.ALWAYS, /^(=|\+|-|\*|\/|)/, "OPERATOR");

export function lex(input: string, path: string) {
  return lexer.lex(input, path, new LexerState());
}
