export class GenericLexerToken {
  private _path: string = "unspecified";
  private _row: number = -1;
  private _col: number = -1;
  private _lexeme: string = "";
  public get path() { return this._path; }
  public get row() { return this._row; }
  public get col() { return this._col; }
  public get lexeme() { return this._lexeme }
  public setInternals(path: string, row: number, col: number, lexeme: string) {
    this._path = path;
    this._row = row;
    this._col = col;
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
    let row = 1;
    let col = 1;
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
          token.setInternals(path, row, col, lexeme);
        });
        collectedTokens.push(...newTokens);

        // advance buffer
        input = input.substring(lexeme.length);

        // advance row, col, currentLine
        const newlineCountMatches = lexeme.match(/\n/g);
        if (newlineCountMatches === null) {
          col += lexeme.length;
          currentLine += lexeme;
        }
        else {
          const newlines = newlineCountMatches == null ? 0 : newlineCountMatches.length;
          row += newlines;
          const lastLineMatches = lexeme.match(/\n([^\n]*)$/);
          if (lastLineMatches == null) { throw new Error("impossible, since we already know there is at least 1 newline"); } // appease typescript
          col = 1 + lastLineMatches[0].length - 1 // -1 for \n at beginning of match, +1 because rows and cols are 1-indexed
          currentLine = lastLineMatches[1];
        }
        ruleSatisfied = true;
        break;
      }
      if (!ruleSatisfied) {
        const remainderOfLineMatches = input.match(/^[^\n]*/);
        if (remainderOfLineMatches === null) { throw new Error("impossible, since an empty string is valid for this pattern"); } // appease typescript
        const snippet = currentLine + remainderOfLineMatches[0];
        throw new Error(`Syntax Error: at line ${row}, col ${col}:\n  ${" ".repeat(col - 1)}v\n> ${snippet}\n  ${" ".repeat(col - 1)}^`);
      }
    }
    eofToken.setInternals(path, row, col, "");
    collectedTokens.push(eofToken);
    return collectedTokens;
  }
}
