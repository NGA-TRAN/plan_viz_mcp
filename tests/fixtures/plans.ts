export const samplePlan = `ProjectionExec: expr=[id, name, age]
  FilterExec: age > 18
    DataSourceExec: file_groups={1 groups: [[data.parquet]]}`;

function explain(label: string): string {
  return [
    '+-------------------+--------------------------------------------------------------------+',
    '| plan_type         | plan                                                               |',
    '+-------------------+--------------------------------------------------------------------+',
    ...samplePlan
      .split('\n')
      .map(
        (line, index) =>
          `| ${(index === 0 ? label : '').padEnd(17)} | ${line.padEnd(66)} |`,
      ),
    '+-------------------+--------------------------------------------------------------------+',
  ].join('\n');
}
export const explainPlan = explain('physical_plan');
export const analyzePlan = explain('Plan with Metrics');
