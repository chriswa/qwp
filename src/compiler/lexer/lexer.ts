import { GenericLexer } from './GenericLexer';
import { Token, TokenType } from '../Token';

class LexerState {
  // public foo: string = "";
}

type FilterType = (state: LexerState) => boolean;

const filters: Record<string, FilterType> = {
  ALWAYS: (state) => true,
}

const lexer = new GenericLexer<Token, LexerState>();

function addRule(filter: FilterType, regexp: RegExp, tokenType: TokenType | null) {
  lexer.addRule(filter, regexp, function (_lexeme, _state, _matches) {
    return tokenType === null ? [] : [ new Token(tokenType) ];
  });
}

addRule(filters.ALWAYS, /^\n/, null); // NEWLINE
addRule(filters.ALWAYS, /^[ \t]+/, null); // WHITESPACE
addRule(filters.ALWAYS, /^\/\/[^\n]*/, null); // LINE_COMMENT
addRule(filters.ALWAYS, /^\/\*.*?\*\//s, null); // BLOCK_COMMENT
addRule(filters.ALWAYS, /^"(\\.|[^"\\])*"/, TokenType.STRING);
addRule(filters.ALWAYS, /^;/, TokenType.SEMICOLON);
addRule(filters.ALWAYS, /^#[a-zA-Z][a-zA-Z0-9_]*/, TokenType.ANCHOR);
addRule(filters.ALWAYS, /^\d*(\.\d+)?/, TokenType.NUMBER);
addRule(filters.ALWAYS, /^,/, TokenType.COMMA);
addRule(filters.ALWAYS, /^{/, TokenType.OPEN_BRACE);
addRule(filters.ALWAYS, /^}/, TokenType.CLOSE_BRACE);
addRule(filters.ALWAYS, /^\(/, TokenType.OPEN_PAREN);
addRule(filters.ALWAYS, /^\)/, TokenType.CLOSE_PAREN);
addRule(filters.ALWAYS, /^\[/, TokenType.OPEN_SQUARE);
addRule(filters.ALWAYS, /^\]/, TokenType.CLOSE_SQUARE);
addRule(filters.ALWAYS, /^=>/, TokenType.ARROW);

addRule(filters.ALWAYS, /^:=/, TokenType.COLON_EQUAL);
addRule(filters.ALWAYS, /^==/, TokenType.DOUBLE_EQUAL);
addRule(filters.ALWAYS, /^!=/, TokenType.BANG_EQUAL);
addRule(filters.ALWAYS, /^</, TokenType.LESS_THAN);
addRule(filters.ALWAYS, /^<=/, TokenType.LESS_THAN_OR_EQUAL);
addRule(filters.ALWAYS, /^>/, TokenType.GREATER_THAN);
addRule(filters.ALWAYS, /^>=/, TokenType.GREATER_THAN_OR_EQUAL);
addRule(filters.ALWAYS, /^\+/, TokenType.PLUS);
addRule(filters.ALWAYS, /^-/, TokenType.MINUS);
addRule(filters.ALWAYS, /^\*/, TokenType.ASTERISK);
addRule(filters.ALWAYS, /^\//, TokenType.FORWARD_SLASH);
addRule(filters.ALWAYS, /^!/, TokenType.BANG);
addRule(filters.ALWAYS, /^&&/, TokenType.DOUBLE_AMPERSAND);
addRule(filters.ALWAYS, /^\|\|/, TokenType.DOUBLE_PIPE);

addRule(filters.ALWAYS, /^false/, TokenType.KEYWORD_FALSE);
addRule(filters.ALWAYS, /^true/, TokenType.KEYWORD_TRUE);
addRule(filters.ALWAYS, /^null/, TokenType.KEYWORD_NULL);

addRule(filters.ALWAYS, /^if/, TokenType.KEYWORD_IF);
addRule(filters.ALWAYS, /^else/, TokenType.KEYWORD_ELSE);
addRule(filters.ALWAYS, /^while/, TokenType.KEYWORD_WHILE);
addRule(filters.ALWAYS, /^const/, TokenType.KEYWORD_CONST);
addRule(filters.ALWAYS, /^let/, TokenType.KEYWORD_LET);
addRule(filters.ALWAYS, /^fn/, TokenType.KEYWORD_FN);
addRule(filters.ALWAYS, /^return/, TokenType.KEYWORD_RETURN);
addRule(filters.ALWAYS, /^type/, TokenType.KEYWORD_TYPE);

addRule(filters.ALWAYS, /^[a-zA-Z][a-zA-Z0-9_]*/, TokenType.IDENTIFIER); // must be after keywords

addRule(filters.ALWAYS, /^:/, TokenType.COLON); // must be after COLON_EQUAL
addRule(filters.ALWAYS, /^=/, TokenType.EQUAL); // must be after DOUBLE_EQUAL and ARROW


export function lex(input: string, path: string) {
  return lexer.lex(input, path, new LexerState(), new Token(TokenType.EOF));
}
