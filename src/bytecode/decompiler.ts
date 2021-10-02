import { builtinsById } from "../builtins/builtins"
import { OpCode } from "./opcodes"
import { ByteBuffer } from "./ByteBuffer"
import { InternalError } from "../util"

export function dumpDecompile(buffer: ByteBuffer) {
  buffer.setByteCursor(0); // redundant, we're about to "jump" to whatever is in [0]
  const pendingDecompilation: Array<number> = []; // constantIndexes
  pendingDecompilation.push(buffer.peekUint32At(0));

  let isFirst = true;
  while (pendingDecompilation.length > 0) {
    const codeStartConstantIndex = pendingDecompilation.shift()!;
    buffer.setByteCursor(codeStartConstantIndex * 4) // constant elements are (at least) 32 bits
    if (isFirst === false) {
      console.log(`=================================`);
    }
    isFirst = false;
    decompileCodeEntry();
  }

  function decompileCodeEntry() {
    while (true) {
      const isMoreInstructions = decompileOneInstruction(buffer, pendingDecompilation);
      if (!isMoreInstructions) { return }
    }
  }
}

export function decompileOneInstruction(buffer: ByteBuffer, pendingDecompilation: Array<number>) {
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
    case OpCode.DEREF:
    case OpCode.ALLOC_SCALAR:
      break;
    case OpCode.PROMOTE_PARAM_TO_HEAP:
      line += ` call_frame[ ${buffer.readUint8()} ]`;
      break;
    case OpCode.PUSH_CONSTANT:
      const constantIndex = buffer.readUint32();
      line += ` constant[ ${(constantIndex * 4).toString(16).padStart(4, "0")} ] => (float?) ${buffer.peekFloat32At(constantIndex * 4)}`;
      break;
    case OpCode.POP_N:
      line += ` count = ${buffer.readUint8()}`;
      break;
    case OpCode.JUMP_FORWARD_IF_POP_FALSE:
    case OpCode.JUMP_FORWARD:
      const delta0 = buffer.readUint16();
      line += ` ${delta0} (to ${(buffer.byteCursor + delta0).toString(16).padStart(4, "0")})`;
      break;
    case OpCode.JUMP_BACKWARD:
      const delta1 = buffer.readUint16();
      line += ` ${delta1} (to ${(buffer.byteCursor - delta1).toString(16).padStart(4, "0")})`;
      break;
    case OpCode.JUMP_BOOLEAN_OR:
    case OpCode.JUMP_BOOLEAN_AND:
      line += ` ${buffer.readUint16()}`;
      break;
    case OpCode.ASSIGN_CALLFRAME_VALUE:
    case OpCode.FETCH_CALLFRAME_VALUE:
      line += ` call_frame[ ${buffer.readUint8()} ]`;
      break;
    case OpCode.ASSIGN_PTR:
      line += ` (pops 2)`
      break;
    case OpCode.DEFINE_FUNCTION:
      const functionConstantIndex = buffer.readUint32()
      pendingDecompilation.push(functionConstantIndex);
      const closedVarCount = buffer.readUint8();
      line += ` at constant[ ${(functionConstantIndex * 4).toString(16).padStart(4, "0")} ]`;
      if (closedVarCount > 0) {
        line += ` capturing call_frame[`;
        for (let i = 0; i < closedVarCount; i += 1) {
          if (i > 0) {
            line += `,`;
          }
          line += ` ${buffer.readUint8()}`;
        }
        line += ` ]`;
      }
      break;
    case OpCode.CALL:
      const argCount = buffer.readUint8();
      line += ` with ${argCount} args`;
      break;
    case OpCode.RETURN:
      break;
    case OpCode.PUSH_BUILTIN:
      const builtInId = buffer.readUint16();
      const builtin = builtinsById.get(builtInId)!;
      line += ` ${builtInId.toString(16).padStart(4, "0")} => ${builtin.name} : ${builtin.getTypeWrapper().toString()}`;
      break;
    case OpCode.CODESTOP:
      return false;
    default:
      console.log(line)
      throw new InternalError(`unknown opcode ${opCode}`);
  }
  console.log(line);
  return true;
}
