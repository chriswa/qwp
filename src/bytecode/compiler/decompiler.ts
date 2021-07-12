import { OpCode } from "../opcodes"
import { ByteBuffer } from "./ByteBuffer"

export function dumpDecompile(buffer: ByteBuffer) {
  buffer.setByteCursor(0);
  const pendingDecompilation: Array<number> = []; // constantIndexes
  pendingDecompilation.push(buffer.peekUint32());

  while (pendingDecompilation.length > 0) {
    const codeStartConstantIndex = pendingDecompilation.shift()!;
    buffer.setByteCursor(codeStartConstantIndex * 4); // constant elements are (at least) 32 bits
    decompileCodeEntry();
  }

  function decompileCodeEntry() {
    console.log(`=================================`);
    while (true) {
      let line = `${buffer.byteCursor.toString(16).padStart(4, "0")} : `;
      const opCode = buffer.readUint8();
      const opCodeName = OpCode[opCode];
      line += `${opCodeName}`;
      switch (opCode) {
        case OpCode.NEGATE:
        case OpCode.LOGICAL_NOT:
        case OpCode.ADD:
        case OpCode.SUBTRACT:
        case OpCode.MULTIPLY:
        case OpCode.DIVIDE:
        case OpCode.LT:
        case OpCode.LTE:
        case OpCode.GT:
        case OpCode.GTE:
        case OpCode.EQ:
        case OpCode.NEQ:
        case OpCode.LOGICAL_OR:
        case OpCode.LOGICAL_AND:
          break;
        case OpCode.PUSH_CONSTANT:
          const constantIndex = buffer.readUint32();
          line += ` constant[ ${(constantIndex * 4).toString(16).padStart(4, "0")} ] (as float? ${buffer.peekFloat32At(constantIndex * 4)})`;
          break;
        case OpCode.POP:
          break;
        case OpCode.CLOSE_VAR:
          break;
        case OpCode.JUMP_FORWARD_IF_POP_FALSE:
        case OpCode.JUMP_FORWARD:
        case OpCode.JUMP_BACKWARD:
        case OpCode.JUMP_BOOLEAN_OR:
        case OpCode.JUMP_BOOLEAN_AND:
          line += ` ${buffer.readUint16()}`;
          break;
        case OpCode.ASSIGN_CALLFRAME_VALUE:
        case OpCode.PUSH_CALLFRAME_VALUE:
          line += ` call_frame[ ${buffer.readUint8()} ]`;
          break;
        case OpCode.PUSH_CLOSURE:
          const functionConstantIndex = buffer.readUint32();
          pendingDecompilation.push(functionConstantIndex);
          const closedVarCount = buffer.readUint8();
          line += ` at constant[ ${(functionConstantIndex * 4).toString(16).padStart(4, "0")} ]`;
          if (closedVarCount > 0) {
            line += ` capturing call_frame[`;
            for (let i = 0; i < closedVarCount; i += 1) {
              if (i > 0) {
                line += `,`
              }
              line += ` ${buffer.readUint8()}`;
            }
            line += ` ]`;
          }
        case OpCode.CALL:
          break;
        case OpCode.RETURN:
          break;
        case OpCode.PUSH_EXTERNAL:
          line += ` ${buffer.readUint16().toString(16).padStart(4, "0")}`;
          break;
        case OpCode.CODESTOP:
          return;
        default:
          throw new Error(`unknown opcode ${opCode}`)
      }
      console.log(line);
    }
  }
}
