import { BinarySyntaxNode, SyntaxNode } from "../syntax/syntax"
import { Token, TokenType } from "../Token"
import { TokenReader } from "./TokenReader"

const stringBackslashSequences: Record<string, string> = {
  "n": "\n",
  "t": "\t",
  "\"": "\"",
}

export class ParserHelper {
  public constructor(
    private reader: TokenReader,
    private generateError: (token: Token, message: string) => void,
  ) { }
  parseBinaryExpression(subGrammar: () => SyntaxNode, operatorTokens: Array<TokenType>) {
    let expr: SyntaxNode = subGrammar();
    while (this.reader.matchOneOf(operatorTokens)) {
      const op = this.reader.previous();
      const right = subGrammar();
      expr = new BinarySyntaxNode(op, expr, op, right);
    }
    return expr;
  }
  parseDelimitedList<T>(separatorToken: TokenType, endOfListToken: TokenType | null, minItems: number, itemCallback: () => T): Array<T> {
    const list: Array<T> = [];
    if (endOfListToken === null || this.reader.match(endOfListToken) === false) {
      do {
        list.push(itemCallback());
      } while (this.reader.match(separatorToken))
      if (endOfListToken !== null) {
        this.reader.consume(endOfListToken, 'expected end-of-list token after delimited list')
      }
    }
    if (list.length < minItems) {
      throw this.generateError(this.reader.previous(), `delimited list must have at least ${minItems} item(s)`);
    }
    return list;
  }
  unescapeString(unescapedString: string): string {
    return unescapedString.replace(/\\./g, (substring) => {
      const char = substring.substr(1, 1);
      if (char in stringBackslashSequences) {
        return stringBackslashSequences[char];
      }
      throw this.generateError(this.reader.previous(), `string contains unnecessary backslash sequence "\\${char}"`);
    });
  }
}
