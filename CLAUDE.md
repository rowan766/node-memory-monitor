# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js memory monitoring toolkit with native V8 API integration for memory leak detection, GC statistics, and heap snapshot generation. The project demonstrates memory monitoring capabilities using only Node.js built-in APIs without external dependencies like memwatch-next or heapdump.

## Architecture

The project consists of two main files:

- `mempeyMonitor.js` - Core `MemoryMonitor` class that implements comprehensive memory tracking using Node.js native APIs (v8, perf_hooks, fs)
- `app.js` - Test application that demonstrates memory monitoring with simulated memory allocation patterns

The `MemoryMonitor` class provides:
- Real-time memory usage tracking with configurable intervals
- Automatic memory leak detection based on heap growth thresholds
- GC event monitoring using PerformanceObserver
- Heap snapshot generation using V8's native getHeapSnapshot()
- Memory trend analysis and historical tracking
- Automatic cleanup of old heap dump files

## Development Commands

```bash
# Start the monitoring application
npm start
# or
node app.js

# Development mode with auto-restart
npm run dev
# or
nodemon app.js

# Force garbage collection (requires --expose-gc flag)
node --expose-gc app.js
```

## Key Configuration Options

The MemoryMonitor accepts these configuration options:
- `heapDumpDir` - Directory for heap snapshots (default: './heapdumps')
- `maxHeapDumps` - Maximum number of heap dumps to keep (default: 5)
- `monitorInterval` - Memory check interval in ms (default: 5000)
- `leakThreshold` - Memory growth threshold in MB for leak detection (default: 10)
- `gcThreshold` - Consecutive leak detections before heap dump (default: 3)

## File Structure

- Heap dumps are saved as `.heapsnapshot` files in the configured directory
- The monitor automatically cleans up old heap dumps to maintain the specified limit
- Memory history is kept in-memory for trend analysis (limited to 100 entries)

## Dependencies

- Core functionality uses only Node.js built-in modules (v8, fs, path, perf_hooks)
- Express is included but not used in the core monitoring functionality  
- Project requires Node.js >= 12.0.0 for PerformanceObserver GC monitoring