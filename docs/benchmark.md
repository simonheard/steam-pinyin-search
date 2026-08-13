# Library benchmark

Measured on 2026-08-13 on the development Windows desktop with Node.js 22.17.0, using `npm run benchmark`. The fixture cycles Chinese, English, punctuation, and numeric game names. Query time is the mean of 50 searches with a result limit of 20. Cache load is the mean of 20 JSON parse/validation runs. Serialized size is a conservative UTF-8 cache-size estimate, not a JavaScript heap measurement.

| Games | First index | Cache load | Mean query | Serialized index |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 21.900 ms | 0.657 ms | 0.679 ms | 0.236 MiB |
| 5,000 | 75.322 ms | 3.191 ms | 1.161 ms | 1.193 MiB |
| 10,000 | 141.219 ms | 6.142 ms | 2.206 ms | 2.410 MiB |

The benchmark is deliberately easy to rerun rather than a fixed claim about all hardware. The search path normalizes the query once, scans pre-normalized fields, sorts only matches, and remains comfortably below a UI frame on this machine at 10,000 entries. Startup normally reads the cache and re-indexes only added or renamed games.
