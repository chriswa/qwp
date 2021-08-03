import { ErrorWithSourcePos } from "../../ErrorWithSourcePos"

export class GenericLexerToken {
  private _path: string = "";
  private _charPos: number = -1;
  private _lexeme: string = "";
  public get path() { return this._path; }
  public get charPos() { return this._charPos; }
  public get lexeme() { return this._lexeme }
  public setInternals(path: string, charPos: number, lexeme: string) {
    this._path = path;
    this._charPos = charPos;
    this._lexeme = lexeme;
  }
}

class GenericLexerRule<T_TOKEN extends GenericLexerToken, T_STATE> {
  public constructor(
    public filter: (state: T_STATE) => boolean,
    public pattern: RegExp,
    public tokenize: (lexeme: string, state: T_STATE, matches: RegExpExecArray) => Array<T_TOKEN>,
  ) {
    // force all regexps to match the beginning of the buffer
    if (!this.pattern.source.startsWith('^')) {
      this.pattern = new RegExp('^' + this.pattern.source, this.pattern.flags);
    }
  }
}

export class GenericLexer<T_TOKEN extends GenericLexerToken, T_STATE> {
  public constructor() {
  }
  private rules: Array<GenericLexerRule<T_TOKEN, T_STATE>> = [];
  public addRule(filter: (state: T_STATE) => boolean, pattern: RegExp, tokenize: (lexeme: string, state: T_STATE, matches: RegExpExecArray) => Array<T_TOKEN>) {
    this.rules.push(new GenericLexerRule<T_TOKEN, T_STATE>(filter, pattern, tokenize));
  }
  public lex(input: string, path: string, state: T_STATE, eofToken: T_TOKEN): Array<T_TOKEN> {
    let charPos = 0;
    let currentLine = "";
    const collectedTokens: Array<T_TOKEN> = [];

    while (input.length > 0) {
      let ruleSatisfied = false;
      for (const rule of this.rules) {
        // check if this rule isn't filtered and its pattern matches
        if (rule.filter(state) == false) {
          continue;
        }
        const matches = rule.pattern.exec(input);
        if (matches == null || matches[0].length === 0) {
          continue;
        }
        const lexeme = matches[0];

        // generate tokens
        const newTokens = rule.tokenize(lexeme, state, matches);
        newTokens.forEach((token) => {
          token.setInternals(path, charPos, lexeme);
        });
        collectedTokens.push(...newTokens);

        // advance buffer
        input = input.substring(lexeme.length);

        // advance row, col, currentLine
        charPos += lexeme.length;
        ruleSatisfied = true;
        break;
      }
      if (!ruleSatisfied) {
        const remainderOfLineMatches = input.match(/^[^\n]*/);
        if (remainderOfLineMatches === null) { throw new Error("impossible, since an empty string is valid for this pattern"); } // appease typescript
        const snippet = currentLine + remainderOfLineMatches[0];
        throw new ErrorWithSourcePos("Lexer: Lexeme not recognized", path, charPos);
      }
    }
    eofToken.setInternals(path, charPos, "");
    collectedTokens.push(eofToken);
    return collectedTokens;
  }
}
