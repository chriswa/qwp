import { GenericLexer } from './GenericLexer';
import { Token, TokenType } from './Token';

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

addRule(filters.ALWAYS, /^:=/, TokenType.OP_ASSIGN);
addRule(filters.ALWAYS, /^==/, TokenType.OP_EQ);
addRule(filters.ALWAYS, /^!=/, TokenType.OP_NEQ);
addRule(filters.ALWAYS, /^</, TokenType.OP_LT);
addRule(filters.ALWAYS, /^<=/, TokenType.OP_LTE);
addRule(filters.ALWAYS, /^>/, TokenType.OP_GT);
addRule(filters.ALWAYS, /^>=/, TokenType.OP_GTE);
addRule(filters.ALWAYS, /^\+/, TokenType.OP_PLUS);
addRule(filters.ALWAYS, /^-/, TokenType.OP_MINUS);
addRule(filters.ALWAYS, /^\*/, TokenType.OP_MULT);
addRule(filters.ALWAYS, /^\//, TokenType.OP_DIV);
addRule(filters.ALWAYS, /^!/, TokenType.OP_BANG);
addRule(filters.ALWAYS, /^&&/, TokenType.OP_AND);
addRule(filters.ALWAYS, /^\|\|/, TokenType.OP_OR);

addRule(filters.ALWAYS, /^false/, TokenType.LITERAL_FALSE);
addRule(filters.ALWAYS, /^true/, TokenType.LITERAL_TRUE);
addRule(filters.ALWAYS, /^null/, TokenType.LITERAL_NULL);

addRule(filters.ALWAYS, /^if/, TokenType.KEYWORD_IF);
addRule(filters.ALWAYS, /^else/, TokenType.KEYWORD_ELSE);
addRule(filters.ALWAYS, /^while/, TokenType.KEYWORD_WHILE);
addRule(filters.ALWAYS, /^const/, TokenType.KEYWORD_CONST);
addRule(filters.ALWAYS, /^let/, TokenType.KEYWORD_LET);
addRule(filters.ALWAYS, /^fn/, TokenType.KEYWORD_FN);
addRule(filters.ALWAYS, /^return/, TokenType.KEYWORD_RETURN);

addRule(filters.ALWAYS, /^[a-zA-Z][a-zA-Z0-9_]*/, TokenType.IDENTIFIER); // must be after keywords

addRule(filters.ALWAYS, /^:/, TokenType.COLON); // must be after OP_ASSIGN


export function lex(input: string, path: string) {
  return lexer.lex(input, path, new LexerState(), new Token(TokenType.EOF));
}
