import pino from "pino";
import { trace } from "@opentelemetry/api";

const isDev = process.env.NODE_ENV === "development";

/**
 * Inject current OpenTelemetry trace/span IDs into every log record.
 * Allows correlating log lines to traces in SigNoz / Jaeger / Grafana Tempo.
 */
function getTraceContext(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

/**
 * Application logger (Pino).
 * Dev: pretty-printed with colour.
 * Prod: structured JSON with traceId + spanId for log-trace correlation.
 */
export const logger = pino(
  isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
        level: "debug",
      }
    : {
        level: "info",
        mixin() {
          return getTraceContext();
        },
      }
);
