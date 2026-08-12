# Library benchmark

Measured on 2026-08-12 on the development Windows desktop with Node.js, using `npm run benchmark`. The fixture cycles Chinese, English, punctuation, and numeric game names. Query time is the mean of 50 searches with a result limit of 20. Cache load is the mean of 20 JSON parse/validation runs. Serialized size is a conservative UTF-8 cache-size estimate, not a JavaScript heap measurement.

| Games | First index | Cache load | Mean query | Serialized index |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 22.487 ms | 0.676 ms | 0.568 ms | 0.236 MiB |
| 5,000 | 79.098 ms | 3.260 ms | 0.894 ms | 1.193 MiB |
| 10,000 | 142.845 ms | 6.258 ms | 1.857 ms | 2.410 MiB |

The benchmark is deliberately easy to rerun rather than a fixed claim about all hardware. The search path normalizes the query once, scans pre-normalized fields, sorts only matches, and remains comfortably below a UI frame on this machine at 10,000 entries. Startup normally reads the cache and re-indexes only added or renamed games.

