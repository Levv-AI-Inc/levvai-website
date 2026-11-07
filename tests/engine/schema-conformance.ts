import type { z } from 'zod';
import type { ApprovalRule, Condition, DigitalWorkers, HistoryRecord, Presets, Row, SampleRecord, Systems, TestActors } from '@flow-studio/model';
import {
  ApprovalRuleSchema,
  ConditionSchema,
  HistoryRecordSchema,
  RowSchema,
  SampleRecordSchema,
  SEED_FILE_SCHEMAS,
  WfNodeSchema,
  WorkflowSchema,
  type SeedCatalog,
  type SeedNode,
  type SeedPeople,
  type SeedWorkflow,
} from '@flow-studio/model/schemas';

/*
 * Compile-time only: what each Zod schema accepts must fit the hand-written type of 02, so the two cannot drift.
 * It lives under tests/ because Zod's inference needs `strict`, which only `npm run typecheck` turns on (notes, decision 4).
 */
type Parses<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

export const rowSchema: Parses<Row> = RowSchema;
export const conditionSchema: Parses<Condition> = ConditionSchema;
export const nodeSchema: Parses<SeedNode> = WfNodeSchema;
export const workflowSchema: Parses<SeedWorkflow> = WorkflowSchema;
export const ruleSchema: Parses<ApprovalRule> = ApprovalRuleSchema;
export const sampleSchema: Parses<SampleRecord> = SampleRecordSchema;
export const historySchema: Parses<HistoryRecord> = HistoryRecordSchema;
export const catalogSchema: Parses<SeedCatalog> = SEED_FILE_SCHEMAS.catalog;
export const peopleSchema: Parses<SeedPeople> = SEED_FILE_SCHEMAS['people-and-authority'];
export const workersSchema: Parses<DigitalWorkers> = SEED_FILE_SCHEMAS['digital-workers'];
export const presetsSchema: Parses<Presets> = SEED_FILE_SCHEMAS['onboarding-presets'];
export const systemsSchema: Parses<Systems> = SEED_FILE_SCHEMAS.systems;
export const actorsSchema: Parses<TestActors> = SEED_FILE_SCHEMAS['test-actors'];
