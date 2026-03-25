/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Runs once when the server starts. We use it to boot the OpenTelemetry SDK
 * before any route handlers are loaded.
 */
export async function register() {
  // Only run on the Node.js server — not in the Edge runtime or browser.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerTelemetry } = await import("./src/utils/telemetry");
    registerTelemetry();
  }
}
