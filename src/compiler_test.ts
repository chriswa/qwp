import chalk from "chalk"
import fs from "fs";
import { compile } from "./bytecode/compiler/compiler"
import { dumpDecompile } from "./bytecode/decompiler"
import { printPositionInSource } from "./cliUtil"
import { Interpreter } from "./interpreter/Interpreter"
import { parse } from "./sourcecode/parser/parser"

// var myArgs = process.argv.slice(2);
// 
// const path = myArgs.shift();
// if (path === undefined) {
//   console.log("must specify script filename as first argv");
//   process.exit(1);
// }
// const source = fs.readFileSync(path, "utf8");

const path = "sample.dog";
const source = `
const foo := 123;
println(foo + foo);

const f := fn(a, b) {
  // return a + b;
  return a + b + foo;
  // return fn() {
  //   return a + b + foo;
  // };
};

println(f(1, 2));
println(f(3, 4));
println(456);
`.trim() + "\n";

const parserResponse = parse(source, path);
if (parserResponse.kind === "SYNTAX_ERROR") {
  const firstSyntaxError = parserResponse.syntaxErrors[0];
  console.log(chalk.red(`PARSER ERROR: ${firstSyntaxError.message}`));
  printPositionInSource(firstSyntaxError.path, source, firstSyntaxError.charPos);
  process.exit(1);
}

const buffer = compile(parserResponse.topSyntaxNode, parserResponse.closedVarsByFunctionNode);
dumpDecompile(buffer);
