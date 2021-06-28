import chalk from "chalk";

export function printPositionInSource(path: string, source: string, charPos: number) {
  const precedingSource = source.substr(0, charPos);
  const newlineCountMatches = precedingSource.match(/\n/g);
  let lineNumber = 1;
  let lineBeginning = "";
  if (newlineCountMatches !== null) {
    lineNumber = newlineCountMatches.length + 1
    lineBeginning = precedingSource.substr(precedingSource.lastIndexOf("\n") + 1);
  }
  else {
    lineBeginning = precedingSource;
  }
  let nextNewlinePos = source.indexOf("\n", charPos);
  const lineEnding = nextNewlinePos === -1 ? source.substr(charPos) : source.substr(charPos, nextNewlinePos - charPos);
  const line = lineBeginning + lineEnding;
  
  const pathAndLineIdentificationString = `${path} ${lineNumber}: `
  console.log(chalk.red(pathAndLineIdentificationString) + chalk.bgWhite.black(`${lineBeginning}${lineEnding}`));
  console.log(chalk.white(`${" ".repeat(pathAndLineIdentificationString.length + lineBeginning.length)}▲`));
}