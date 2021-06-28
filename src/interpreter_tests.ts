import fs from "fs";
import chalk from "chalk";
import { Interpreter } from "./interpreter/Interpreter";
import { parse } from "./sourcecode/parser/parser";
import { Token } from "./sourcecode/parser/Token"
import { ParserError } from "./sourcecode/parser/ParserError"
import { InterpreterRuntimeError } from "./interpreter/InterpreterRuntimeError"
import { printPositionInSource } from "./cliUtil"
// import { AstPrinter } from "./syntax/printer"


fs.readdirSync("tests/").forEach((filename) => {
  const path = "tests/" + filename;
  if (fs.lstatSync(path).isFile()) {
    try {
      const wasSuccessful = performTest(path);
      if (!wasSuccessful) {
        process.exit(1);
      }
    }
    catch (error) {
      printFailedTestHeader(path, "Internal error performing test!");
      console.log(error);
      return;
    }
  }
});
process.exit(0); // success!

function performTest(path: string): boolean {
  // console.log(chalk.cyan(`=== ${path} ===`));
  const testInput = loadTestFile(path);
  const { source, expectedResultType, expectedResultContent } = testInput;
  const runResult = runSource(path, source);
  if (expectedResultType === "PARSER_ERROR") {
    if (runResult.parserErrors?.[0].message !== expectedResultContent.trim()) {
      reportFailedTest(path, source, testInput, runResult);
      return false;
    }
  }
  else if (expectedResultType === "RUNTIME_ERROR") {
    if (runResult.runtimeError?.message !== expectedResultContent.trim()) {
      reportFailedTest(path, source, testInput, runResult)
      return false;
    }
  }
  else if (expectedResultType === "OUTPUT") {
    if (runResult.output !== expectedResultContent) {
      reportFailedTest(path, source, testInput, runResult)
      return false;
    }
  }
  reportSuccessfulTest(path, testInput);
  return true;
}

function reportSuccessfulTest(path: string, testInput: ITestDetails) {
  console.log(chalk.green(` ✓ ${path}`));
}

function reportFailedTest(path: string, source: string, testInput: ITestDetails, runResult: IRunResult) {
  console.log(chalk.red(` X ${path}`));
  console.log();
  console.log(chalk.white(drawBox(`Expecting ${testInput.expectedResultType}`)));
  if (testInput.expectedResultType === "OUTPUT") {
    console.log(chalk.white(`${testInput.expectedResultContent}`));
  }
  else {
    console.log(chalk.white(`${testInput.expectedResultContent.trim()}`));
  }
  console.log(chalk.red(drawBox(`Result ${runResult.status}`)));
  switch (runResult.status) {
    case "PARSER_ERROR":
      const firstParserError = runResult.parserErrors?.[0] as ParserError;
      console.log(chalk.red(`${firstParserError.message}`));
      printPositionInSource(firstParserError.path, source, firstParserError.charPos);
      break;
    case "RUNTIME_ERROR":
      const runtimeError = runResult.runtimeError as InterpreterRuntimeError;
      console.log(chalk.red(`${runtimeError.message}`));
      printPositionInSource(runtimeError.token.path, source, runtimeError.token.charPos);
      break;
    case "COMPLETED":
      console.log(chalk.red(`${runResult.output}`));
      break;
  }
}

interface ITestDetails {
  source: string;
  expectedResultType: string;
  expectedResultContent: string;
}
function loadTestFile(path: string): ITestDetails {
  const fileContent = fs.readFileSync(path, "utf8");
  const lastNewlinePos = fileContent.search(/\n__(PARSER_ERROR|RUNTIME_ERROR|OUTPUT)__\n/);
  if (lastNewlinePos === -1) {
    throw new Error(`${path}: test files must contain an end-of-source marker: one of __PARSER_ERROR__, __RUNTIME_ERROR__, or __OUTPUT__`);
  }
  const source = fileContent.substr(0, lastNewlinePos + 1);
  const [expectedResultType, expectedResultContent] = fileContent.substr(lastNewlinePos + 3).split(/__\n/, 2);
  return { source, expectedResultType, expectedResultContent };
}

interface IRunResult {
  status: "PARSER_ERROR" | "RUNTIME_ERROR" | "COMPLETED";
  parserErrors: Array<ParserError> | null,
  runtimeError: InterpreterRuntimeError | null,
  output: string | null,
}
function runSource(path: string, source: string): IRunResult {
  const parserResponse = parse(source, path);
  if (parserResponse.parserErrors !== null) {
    return { status: "PARSER_ERROR", parserErrors: parserResponse.parserErrors, runtimeError: null, output: null };
  }
  if (parserResponse.topSyntaxNode === null) {
    throw new Error(`Internal logic error: either topSyntaxNode or parserErrors should be non-null`);
  }
  const interpreter = new Interpreter();
  const runtimeError = interpreter.interpret(parserResponse.topSyntaxNode);
  if (runtimeError !== null) {
    return { status: "RUNTIME_ERROR", parserErrors: null, runtimeError, output: null };
  }
  const output = interpreter.getOutput();
  return { status: "COMPLETED", parserErrors: null, runtimeError: null, output };
}

function printFailedTestHeader(path: string, reason: string) {
  console.log(chalk.redBright(drawBox(`TEST FAILED: ${path} : ${reason}`)));
}
function drawBox(title: string) {
  return `╔${"═".repeat(80)}╗\n` + `║ ${title}${" ".repeat(78 - title.length)} ║\n` + `╚${"═".repeat(80)}╝`;
}
