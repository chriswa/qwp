import chalk from 'chalk'
import { ErrorWithSourcePos } from './ErrorWithSourcePos'
import { InternalError, throwExpr } from './util'

class SourceReporter {
  private registeredSources: Map<string, string> = new Map()
  registerSource(path: string, source: string) {
    this.registeredSources.set(path, source)
  }
  unregisterSource(path: string) {
    this.registeredSources.delete(path)
  }
  getSource(path: string) {
    return this.registeredSources.get(path) ?? throwExpr(new InternalError(`SourceReporter could not find registered source for path "${path}"`))
  }
  
  generateErrorMessageWithLineNumber(path: string, errorWithSourcePos: ErrorWithSourcePos) {
    const { row, col } = this.getPositionInSource(path, errorWithSourcePos.charPos)
    return `${errorWithSourcePos.message} at line ${row}, col ${col}`
  }
  getLineNumberAndLineBeginning(path: string, charPos: number) {
    const source = this.getSource(path)
    const precedingSource = source.substr(0, charPos)
    const newlineCountMatches = precedingSource.match(/\n/g)
    let lineNumber = 1
    let lineBeginning = ''
    if (newlineCountMatches !== null) {
      lineNumber = newlineCountMatches.length + 1
      lineBeginning = precedingSource.substr(precedingSource.lastIndexOf('\n') + 1)
    }
    else {
      lineBeginning = precedingSource
    }
    return { lineNumber, lineBeginning }
  }

  getPositionInSource(path: string, charPos: number) {
    const { lineNumber, lineBeginning } = this.getLineNumberAndLineBeginning(path, charPos)
    return { row: lineNumber, col: lineBeginning.length + 1 }
  }

  printPositionInSource(path: string, charPos: number, label?: string | undefined) {
    const source = this.getSource(path)
    const { lineNumber, lineBeginning } = this.getLineNumberAndLineBeginning(path, charPos)

    const nextNewlinePos = source.indexOf('\n', charPos)
    const lineEnding = nextNewlinePos === -1 ? source.substr(charPos) : source.substr(charPos, nextNewlinePos - charPos)
    
    const pathAndLineIdentificationString = `${path} ${lineNumber}: `

    // two line strategy (arrow below charPos)
    // console.log(chalk.red(pathAndLineIdentificationString) + chalk.bgWhite.black(`${lineBeginning}${lineEnding}`));
    // console.log(chalk.white(`${" ".repeat(pathAndLineIdentificationString.length + lineBeginning.length)}▲`));

    // one line strategy (charPos character is inverted)
    let line = ''
    if (label !== undefined) {
      line += chalk.cyan(label + ': ')
    }
    line += chalk.red(pathAndLineIdentificationString)
    line += chalk.whiteBright(`${lineBeginning}`) + chalk.bgWhite.black(`${lineEnding.substr(0, 1)}`) + chalk.whiteBright(`${lineEnding.substr(1)}`)
    console.log(line)
  }

}

export const sourceReporter = new SourceReporter()
