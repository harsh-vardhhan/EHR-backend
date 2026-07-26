import 'dotenv/config';

async function main() {
  const url = process.argv[2] || process.env.API_URL;
  if (!url) {
    console.error('Error: Please provide your deployed API URL.');
    console.error('Usage: bun run src/scripts/test-kill-switch.ts <API_URL>');
    console.error(
      'Example: bun run src/scripts/test-kill-switch.ts https://xyz.lambda-url.ap-south-1.on.aws',
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
  console.log(`Simulating a request spike of 50 requests/second.`);
  console.log(`Targeting >${targetThreshold} requests within 1 minute to trigger alarm.`);
  console.log(`Press Ctrl+C to abort at any time.`);
  console.log(`==================================================\n`);

  let requestCount = 0;
  let lastLogTime = Date.now();
  const statusCounts: Record<number, number> = {};
  let isThrottled = false;
  const maxRequestsLimit = targetThreshold + 500; // Cap to prevent infinite loop

  await new Promise<void>((resolve) => {
    const intervalId = setInterval(() => {
      if (isThrottled) return;

      if (requestCount >= maxRequestsLimit) {
        clearInterval(intervalId);
        clearInterval(probeIntervalId);
        console.log(
          `\n[⚠️ MAX REQUEST LIMIT REACHED] Sent ${requestCount} requests without triggering 429 throttle.`,
        );
        console.log(
          `Check CloudWatch Alarms or SNS subscription to confirm alarm state.`,
        );
        resolve();
        process.exit(1);
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
          `[Progress] Sent ${requestCount}/${targetThreshold} requests... Status breakdown:`,
          JSON.stringify(statusCounts),
        );
        lastLogTime = now;
      }
    }, 100); // 10 batches per second of size 5 = 50 req/sec

    // Send a slow probe request every 2 seconds.
    // If it returns 429, the kill switch has set concurrency to 0.
    const probeIntervalId = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(rootEndpoint, {
            method: 'GET',
            headers: {
              'x-api-key': process.env.VITE_API_KEY || 'dummy-key',
            },
          });
          if (res.status === 429) {
            isThrottled = true;
            clearInterval(intervalId);
            clearInterval(probeIntervalId);
            console.log(
              `\n[🚨 KILL SWITCH ACTIVE] Probe request returned 429 Too Many Requests!`,
            );
            console.log(`Total Requests Sent: ${requestCount}`);
            console.log(`Response breakdown:`, statusCounts);
            console.log(
              `\n🎉 SUCCESS! The CloudWatch Traffic Alarm fired and the Kill Switch throttled the Lambda reserved concurrency to 0!`,
            );
            resolve();
            process.exit(0);
          }
        } catch {
          // Ignore network errors on probe
        }
      })();
    }, 2000);
  });
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
