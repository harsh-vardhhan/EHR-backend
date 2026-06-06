import 'dotenv/config';

async function main() {
  const url = process.argv[2] || process.env.API_URL;
  if (!url) {
    console.error('Error: Please provide your deployed API URL.');
    console.error('Usage: npm run test:kill-switch <API_URL>');
    console.error(
      'Example: npm run test:kill-switch https://xyz.lambda-url.ap-south-1.on.aws',
    );
    process.exit(1);
  }

  // Ensure url ends with /
  const targetUrl = url.endsWith('/') ? url : `${url}/`;
  const rootEndpoint = targetUrl; // test root endpoint to avoid DB charges

  console.log(`==================================================`);
  console.log(`   DDoS / DoW Kill Switch Simulation Script      `);
  console.log(`==================================================`);
  console.log(`Target URL: ${rootEndpoint}`);
  console.log(`Simulating a request spike of 20 requests/second.`);
  console.log(`We need to reach ~5,000 requests to trigger the alarm.`);
  console.log(`This run may take up to 5-6 minutes.`);
  console.log(`Press Ctrl+C to abort at any time.`);
  console.log(`==================================================\n`);

  let requestCount = 0;
  let lastLogTime = Date.now();
  const statusCounts: Record<number, number> = {};
  let isThrottled = false;

  await new Promise<void>((resolve) => {
    const intervalId = setInterval(() => {
      if (isThrottled) return;

      // Send a batch of 2 requests
      const batchSize = 2;
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
          `[Progress] Sent ${requestCount} requests... Status breakdown:`,
          JSON.stringify(statusCounts),
        );
        // Reset periodic log timer
        lastLogTime = now;
      }
    }, 100); // 10 batches per second of size 2 = 20 req/sec

    // Send a slow probe request every 2 seconds. A slow single request should always succeed (200)
    // if the concurrency limit is 5. If it returns 429, the kill switch has set concurrency to 0.
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
