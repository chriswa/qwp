import { Interpreter } from './interpreter/interpreter'
import { parse } from './parser/parser'
import { Token, TokenType } from './parser/Token'
import { AstPrinter } from './syntax/printer'
import { BinarySyntaxNode, GroupingSyntaxNode, LiteralSyntaxNode, StatementBlockSyntaxNode, SyntaxNode, SyntaxNodeVisitor, UnarySyntaxNode, ValueType } from './syntax/syntax'

const input = `// sample input
import "@/quux/bar/foo" as foo
import "@/quux/bar/foo" adopt sin, cos, tan
import "@/quux/bar/foo" as foo adopt sin, cos, tan

export {
  foo: #FOO,
  bar: 123,
}

#FOO string (string x, float y) => {
}
`;

const tempInput = "2 + (3 * 7)";

const ast = parse(tempInput, "/hello.dog");
if (ast === null) {
  throw new Error("Parse failed!");
}

console.log(ast?.accept(new AstPrinter()));

const interpreter = new Interpreter();
const result = interpreter.evaluate(ast);
