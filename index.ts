import fs from "fs";
import chalk from "chalk";
import { Interpreter } from "./interpreter/interpreter";
import { parse } from "./parser/parser";
// import { AstPrinter } from "./syntax/printer"

fs.readdirSync("tests/").forEach((filename) => {
  const path = "tests/" + filename;
  if (fs.lstatSync(path).isFile()) {
    const fileContent = fs.readFileSync(path, "utf8");
    const [source, expectedResult] = fileContent.split(/\n===+\n/m, 2);

    console.log(`=== ${path} ===`);

    const parserResponse = parse(source, path);
    if (parserResponse.syntaxNodes === null) {
      showFailedTestHeader(path, "Parse failed");
      console.log(parserResponse.parseErrors);
      return;
    }
    const ast = parserResponse.syntaxNodes;
    // console.log(ast.accept(new AstPrinter()));
    const interpreter = new Interpreter();
    try {
      interpreter.evaluate(ast)
    }
    catch (error) {
      showFailedTestHeader(path, "Runtime error");
      console.log(error);
      return;
    }

    const actualResult = interpreter.getOutput();

    if (actualResult !== expectedResult) {
      showFailedTestHeader(path, "Output does not match expected");
      console.log(`Expected:\n${expectedResult}`);
      console.log(`Actual:\n${actualResult}`);
      return;
    }

    console.log(chalk.green(` ✓ ${path}`))
  }
});

function showFailedTestHeader(path: string, reason: string) {
  console.log(chalk.redBright(drawBox(`TEST FAILED: ${path} : ${reason}`)));
}
function drawBox(title: string) {
  return `╔${"═".repeat(80)}╗\n` + `║ ${title}${" ".repeat(78 - title.length)} ║\n` + `╚${"═".repeat(80)}╝`;
}
