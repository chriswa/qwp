import { lex } from './parser/lexer'

const input = `// sample input
import "@/quux/bar/foo" as foo
import "@/quux/bar/foo" adopt sin, cos, tan
import "@/quux/bar/foo" as foo adopt sin, cos, tan

export {
  foo: #FOO,
  bar: 123,
}
foo %%% bar

#FOO string (string x, float y) => {
}
`;

console.log(input);

const tokens = lex(input, "/path/to/file/for/reporting.myl");

console.log(tokens);
