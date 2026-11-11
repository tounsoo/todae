# Benchmark records

Each JSON file here is one saved benchmark run. `pnpm bench compare <a> <b>` and `pnpm bench --compare <name>` read them, and `pnpm bench list` lists them. [The bench README](../README.md) says how to add one.

Keep one record per release, taken by the Bench workflow on the GitHub runner, so release records compare with each other on timings as well as counts. A record from another machine still compares on counts.
