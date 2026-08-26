import type { NodeType } from "@prisma/client";
import type { NodeExecutor } from "../types";
import { triggerExecutor, transformExecutor, delayExecutor, outputExecutor } from "./simple";
import { conditionExecutor } from "./condition";
import { loopExecutor } from "./loop";
import { approvalExecutor } from "./approval";
import { agentExecutor } from "./agent";
import { toolExecutor } from "./tool";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const executorRegistry: Record<NodeType, NodeExecutor<any>> = {
  TRIGGER: triggerExecutor,
  AGENT: agentExecutor,
  TOOL: toolExecutor,
  CONDITION: conditionExecutor,
  TRANSFORM: transformExecutor,
  LOOP: loopExecutor,
  DELAY: delayExecutor,
  APPROVAL: approvalExecutor,
  OUTPUT: outputExecutor,
};
