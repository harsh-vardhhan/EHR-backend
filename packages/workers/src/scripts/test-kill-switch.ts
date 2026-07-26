import 'dotenv/config';

async function main() {
  const url = process.argv[2] || process.env.API_URL;
  if (!url) {
    console.error('Error: Please provide your deployed API URL.');
    console.error('Usage: bun run --filter workers test:kill-switch <API_URL>');
    console.error(
      'Example: bun run --filter workers test:kill-switch https://xyz.lambda-url.ap-south-1.on.aws',
    );
    process.exit(1);
  }

  const targetThreshold = parseInt(
    process.env.DDOS_REQUEST_THRESHOLD || '2000',
    10,
  );
  // Ensure url ends with /
  const targetUrl = url.endsWith('/') ? url : `${url}/`;
  const rootEndpoint = targetUrl; // test root endpoint to avoid DB charges

  console.log(`==================================================`);
  console.log(`   DDoS / DoW Kill Switch Simulation Script      `);
  console.log(`==================================================`);
  console.log(`Target URL: ${rootEndpoint}`);
  console.log(`Phase 1: Generating >${targetThreshold} requests at 50 req/sec...`);
  console.log(`Phase 2: Draining load & requiring 3 consecutive isolated probes with Concurrency = 0.`);
  console.log(`Press Ctrl+C to abort at any time.`);
  console.log(`==================================================\n`);

  let requestCount = 0;
  let lastLogTime = Date.now();
  const statusCounts: Record<number, number> = {};

  // --- Phase 1: High-Throughput Burst to Breach Alarm Threshold ---
  await new Promise<void>((resolve) => {
    const intervalId = setInterval(() => {
      if (requestCount >= targetThreshold + 100) {
        clearInterval(intervalId);
        console.log(
          `\n[Phase 1 Complete] Sent ${requestCount} requests. Status breakdown:`,
          JSON.stringify(statusCounts),
        );
        resolve();
        return;
      }

      // Send a batch of 5 requests every 100ms = 50 req/sec
      const batchSize = 5;
      const promises = Array.from({ length: batchSize }).map(async () => {
        try {
          requestCount++;
          const res = await fetch(rootEndpoint, {
            method: 'GET',
            headers: {
              'x-api-key': process.env.VITE_API_KEY || 'dummy-key',
            },
          });

          statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
        } catch {
          statusCounts[500] = (statusCounts[500] || 0) + 1;
        }
      });

      void Promise.all(promises);

      // Log progress every 5 seconds
      const now = Date.now();
      if (now - lastLogTime >= 5000) {
        console.log(
          `[Phase 1 Progress] Sent ${requestCount}/${targetThreshold} requests...`,
          JSON.stringify(statusCounts),
        );
        lastLogTime = now;
      }
    }, 100);
  });

  // --- Phase 2: Isolated Probing with Multi-Probe Verification ---
  console.log(
    `\n[Phase 2] Waiting 10s for active connections to drain completely...`,
  );
  await new Promise((r) => setTimeout(r, 10000));

  console.log(
    `Polling isolated single requests every 2s. Requiring 3 consecutive AWS infrastructure 429s to confirm Concurrency = 0...`,
  );

  const pollStartTime = Date.now();
  const maxPollDurationMs = 90000; // 90 seconds polling window for CloudWatch/SNS propagation
  let consecutiveInfraThrottles = 0;

  while (Date.now() - pollStartTime < maxPollDurationMs) {
    try {
      // Send a single, isolated probe request with ZERO background traffic
      const res = await fetch(rootEndpoint, {
        method: 'GET',
        headers: {
          'x-api-key': process.env.VITE_API_KEY || 'dummy-key',
        },
      });

      if (res.status === 429) {
        const bodyText = await res.text().catch(() => '');
        // Differentiate application-level IP rate limit vs AWS Lambda Infrastructure Concurrency=0
        if (bodyText.includes('Rate limit exceeded. Please try again later.')) {
          consecutiveInfraThrottles = 0;
          console.log(
            `[Probe] Application IP rate limit responded. Waiting for AWS Infrastructure Kill Switch...`,
          );
        } else {
          consecutiveInfraThrottles++;
          console.log(
            `[Probe] AWS Infrastructure returned 429 (${consecutiveInfraThrottles}/3 consecutive checks)...`,
          );

          if (consecutiveInfraThrottles >= 3) {
            console.log(
              `\n[🚨 KILL SWITCH VERIFIED] 3 consecutive isolated probes returned 429 with zero active traffic!`,
            );
            console.log(`Total Requests Sent in Phase 1: ${requestCount}`);
            console.log(
              `\n🎉 SUCCESS! CloudWatch Alarm fired and Kill Switch set Lambda reserved concurrency to 0!`,
            );
            process.exit(0);
          }
        }
      } else {
        consecutiveInfraThrottles = 0;
        console.log(
          `[Probe] Isolated request returned status ${res.status}. Waiting for alarm propagation...`,
        );
      }
    } catch (err) {
      consecutiveInfraThrottles = 0;
      console.log(`[Probe Error] Network issue during probe:`, err);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  console.error(
    `\n[❌ KILL SWITCH NOT ACTIVATED] Isolated requests failed to sustain 3 consecutive AWS 429s within 90s.`,
  );
  console.error(
    `Confirm CloudWatch Alarm threshold (>2000 req/1m) and SNS topic subscription.`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
