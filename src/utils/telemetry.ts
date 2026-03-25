import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";

/**
 * Initialise the OpenTelemetry SDK.
 * Called once at server startup via instrumentation.ts.
 *
 * In development: traces are printed to console.
 * In production: traces are exported to OTEL_EXPORTER_OTLP_ENDPOINT if set.
 *
 * Security notes:
 * - No PII is added to spans — user messages are never included.
 * - The OTLP endpoint and auth header are read from env vars, never hardcoded.
 * - Set OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <token>" for secured endpoints.
 */
export function registerTelemetry(): void {
  const isDev = process.env.NODE_ENV === "development";
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  // Use console exporter in dev or when no OTLP endpoint is configured
  const traceExporter =
    !isDev && endpoint
      ? new OTLPTraceExporter({
          url: `${endpoint}/v1/traces`,
          headers: parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
        })
      : new ConsoleSpanExporter();

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "stickler",
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
    }),
    spanProcessor: new SimpleSpanProcessor(traceExporter),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation — extremely noisy in Next.js
        "@opentelemetry/instrumentation-fs": { enabled: false },
        // Capture DB query text but never bind parameters (may contain PII)
        "@opentelemetry/instrumentation-pg": {
          enhancedDatabaseReporting: false,
        },
        "@opentelemetry/instrumentation-http": {
          // Suppress noisy Next.js internal routes
          ignoreIncomingRequestHook: (req) => {
            const url = req.url ?? "";
            return url.includes("/_next/") || url.includes("/__nextjs");
          },
        },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown on SIGTERM / SIGINT
  process.on("SIGTERM", () => { sdk.shutdown().catch(() => {}); });
  process.on("SIGINT",  () => { sdk.shutdown().catch(() => {}); });
}

/**
 * Parse "Key=Value,Key2=Value2" header string into a record.
 * Used for OTEL_EXPORTER_OTLP_HEADERS env var.
 */
function parseOtlpHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  return Object.fromEntries(
    raw.split(",").map((pair) => {
      const idx = pair.indexOf("=");
      return [pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()];
    })
  );
}
