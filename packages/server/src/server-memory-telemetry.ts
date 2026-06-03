import type { ObservableGauge, ObservableResult } from '@opentelemetry/api';
import { captureServerMemorySnapshot } from './perf-measurement.ts';
import { getMeter, onTelemetryShutdown } from './telemetry.ts';

let cachedGauge: ObservableGauge | null = null;

onTelemetryShutdown(() => {
  cachedGauge = null;
});

export function installServerMemoryGauge(): void {
  if (cachedGauge) return;
  const gauge = getMeter().createObservableGauge('ok.server.memory.usage_megabytes', {
    description:
      'Server process memory by section. Bounded labels: section ∈ {heap_used, heap_total, rss}.',
    unit: 'MB',
  });
  gauge.addCallback((result: ObservableResult) => {
    const { snapshot } = captureServerMemorySnapshot();
    result.observe(snapshot.heapUsedMb, { section: 'heap_used' });
    result.observe(snapshot.heapTotalMb, { section: 'heap_total' });
    result.observe(snapshot.rssMb, { section: 'rss' });
  });
  cachedGauge = gauge;
}

export function __resetServerMemoryGaugeForTests(): void {
  cachedGauge = null;
}
