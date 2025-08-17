const fs = require('fs');
const path = require('path');
const v8 = require('v8');
const { performance } = require('perf_hooks');

class MemoryMonitor {
  constructor(options = {}) {
    this.options = {
      heapDumpDir: options.heapDumpDir || './heapdumps',
      maxHeapDumps: options.maxHeapDumps || 5,
      monitorInterval: options.monitorInterval || 5000, // 5秒监控间隔
      leakThreshold: options.leakThreshold || 10, // MB增长阈值
      gcThreshold: options.gcThreshold || 3, // 连续GC检测次数
      ...options
    };
    
    this.previousMemory = null;
    this.memoryHistory = [];
    this.gcCount = 0;
    this.leakDetectionCount = 0;
    this.monitorTimer = null;
    
    this.init();
  }

  init() {
    // 确保heapdump目录存在
    this.ensureHeapDumpDir();
    
    // 启动内存监控
    this.startMemoryMonitoring();
    
    // 设置性能观察器（如果支持）
    this.setupPerformanceObserver();
    
    console.log('🔍 Node.js内置API内存监控已启动...');
    console.log(`📊 监控间隔: ${this.options.monitorInterval}ms`);
    console.log(`🚨 泄漏阈值: ${this.options.leakThreshold}MB`);
  }

  ensureHeapDumpDir() {
    if (!fs.existsSync(this.options.heapDumpDir)) {
      fs.mkdirSync(this.options.heapDumpDir, { recursive: true });
      console.log(`📁 创建heapdump目录: ${this.options.heapDumpDir}`);
    }
  }

  setupPerformanceObserver() {
    try {
      // Node.js 14+ 支持PerformanceObserver监控GC
      const { PerformanceObserver } = require('perf_hooks');
      
      const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'gc') {
            this.handleGCEvent(entry);
          }
        });
      });
      
      obs.observe({ entryTypes: ['gc'] });
      console.log('✅ GC性能监控已启用');
    } catch (error) {
      console.log('⚠️  GC性能监控不支持，使用基础监控');
    }
  }

  handleGCEvent(gcEntry) {
    this.gcCount++;
    console.log(`🗑️  GC事件 #${this.gcCount}:`, {
      kind: this.getGCKind(gcEntry.kind),
      duration: `${gcEntry.duration.toFixed(2)}ms`,
      timestamp: new Date().toISOString()
    });

    // GC后检查内存使用情况
    setTimeout(() => {
      this.checkMemoryAfterGC();
    }, 100);
  }

  getGCKind(kind) {
    const gcKinds = {
      1: 'Scavenge',
      2: 'MarkSweepCompact',
      4: 'IncrementalMarking',
      8: 'ProcessWeakCallbacks'
    };
    return gcKinds[kind] || `Unknown(${kind})`;
  }

  startMemoryMonitoring() {
    this.monitorTimer = setInterval(() => {
      this.collectMemoryStats();
    }, this.options.monitorInterval);
  }

  collectMemoryStats() {
    const currentMemory = this.getDetailedMemoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    // 检测内存泄漏
    if (this.previousMemory) {
      this.detectMemoryLeak(currentMemory, this.previousMemory);
    }
    
    // 保存历史记录
    this.memoryHistory.push({
      timestamp: Date.now(),
      memory: currentMemory,
      heap: heapStats
    });
    
    // 保持历史记录在合理范围内
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift();
    }
    
    this.previousMemory = currentMemory;
    
    // 定期输出统计信息
    if (this.memoryHistory.length % 12 === 0) { // 每分钟输出一次
      this.logMemoryStats(currentMemory, heapStats);
    }
  }

  detectMemoryLeak(current, previous) {
    const heapGrowth = current.heapUsed - previous.heapUsed;
    const heapGrowthMB = heapGrowth / (1024 * 1024);
    
    if (heapGrowthMB > this.options.leakThreshold) {
      this.leakDetectionCount++;
      console.warn(`⚠️  检测到可能的内存泄漏 #${this.leakDetectionCount}:`, {
        heapGrowth: this.formatBytes(heapGrowth),
        heapGrowthMB: `${heapGrowthMB.toFixed(2)}MB`,
        currentHeap: this.formatBytes(current.heapUsed),
        timestamp: new Date().toISOString()
      });
      
      // 连续检测到泄漏时生成heap dump
      if (this.leakDetectionCount >= this.options.gcThreshold) {
        this.generateHeapDump('leak-detected');
        this.leakDetectionCount = 0;
      }
    } else if (heapGrowthMB < -this.options.leakThreshold) {
      // 内存显著减少，重置泄漏计数
      this.leakDetectionCount = Math.max(0, this.leakDetectionCount - 1);
    }
  }

  checkMemoryAfterGC() {
    const currentMemory = this.getDetailedMemoryUsage();
    console.log('📈 GC后内存状态:', {
      heapUsed: this.formatBytes(currentMemory.heapUsed),
      heapTotal: this.formatBytes(currentMemory.heapTotal),
      external: this.formatBytes(currentMemory.external)
    });
  }

  logMemoryStats(memory, heap) {
    console.log('📊 内存监控报告:', {
      process: {
        rss: this.formatBytes(memory.rss),
        heapUsed: this.formatBytes(memory.heapUsed),
        heapTotal: this.formatBytes(memory.heapTotal),
        external: this.formatBytes(memory.external)
      },
      v8Heap: {
        totalSize: this.formatBytes(heap.total_heap_size),
        usedSize: this.formatBytes(heap.used_heap_size),
        limit: this.formatBytes(heap.heap_size_limit),
        mallocedMemory: this.formatBytes(heap.malloced_memory)
      },
      gc: {
        count: this.gcCount,
        leakDetections: this.leakDetectionCount
      }
    });
  }

  generateHeapDump(reason = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `heapdump-${reason}-${timestamp}.heapsnapshot`;
    const filepath = path.join(this.options.heapDumpDir, filename);
    
    console.log(`🔍 生成heap dump: ${filename}`);
    
    try {
      // 使用V8内置API生成heap snapshot
      const heapSnapshot = v8.getHeapSnapshot();
      const writeStream = fs.createWriteStream(filepath);
      
      heapSnapshot.pipe(writeStream);
      
      writeStream.on('finish', () => {
        console.log(`✅ Heap dump已保存: ${filepath}`);
        this.cleanOldHeapDumps();
      });
      
      writeStream.on('error', (error) => {
        console.error('保存heap dump失败:', error);
      });
      
    } catch (error) {
      console.error('生成heap dump时出错:', error);
    }
  }

  cleanOldHeapDumps() {
    try {
      const files = fs.readdirSync(this.options.heapDumpDir)
        .filter(file => file.endsWith('.heapsnapshot'))
        .map(file => ({
          name: file,
          path: path.join(this.options.heapDumpDir, file),
          mtime: fs.statSync(path.join(this.options.heapDumpDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // 删除超过最大数量的旧文件
      if (files.length > this.options.maxHeapDumps) {
        files.slice(this.options.maxHeapDumps).forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`🗑️  删除旧的heap dump: ${file.name}`);
        });
      }
    } catch (error) {
      console.error('清理旧heap dump文件时出错:', error);
    }
  }

  getDetailedMemoryUsage() {
    return process.memoryUsage();
  }

  getMemoryUsage() {
    const usage = this.getDetailedMemoryUsage();
    return {
      rss: this.formatBytes(usage.rss),
      heapTotal: this.formatBytes(usage.heapTotal),
      heapUsed: this.formatBytes(usage.heapUsed),
      external: this.formatBytes(usage.external),
      arrayBuffers: this.formatBytes(usage.arrayBuffers || 0)
    };
  }

  getHeapStatistics() {
    const stats = v8.getHeapStatistics();
    return {
      totalHeapSize: this.formatBytes(stats.total_heap_size),
      totalHeapSizeExecutable: this.formatBytes(stats.total_heap_size_executable),
      totalPhysicalSize: this.formatBytes(stats.total_physical_size),
      totalAvailableSize: this.formatBytes(stats.total_available_size),
      usedHeapSize: this.formatBytes(stats.used_heap_size),
      heapSizeLimit: this.formatBytes(stats.heap_size_limit),
      mallocedMemory: this.formatBytes(stats.malloced_memory),
      peakMallocedMemory: this.formatBytes(stats.peak_malloced_memory),
      doesZapGarbage: stats.does_zap_garbage
    };
  }

  getMemoryTrend() {
    if (this.memoryHistory.length < 2) {
      return { trend: 'insufficient_data' };
    }
    
    const recent = this.memoryHistory.slice(-10);
    const heapValues = recent.map(h => h.memory.heapUsed);
    const avgGrowth = heapValues.reduce((sum, val, idx) => {
      if (idx === 0) return sum;
      return sum + (val - heapValues[idx - 1]);
    }, 0) / (heapValues.length - 1);
    
    return {
      trend: avgGrowth > 0 ? 'increasing' : avgGrowth < 0 ? 'decreasing' : 'stable',
      avgGrowthBytes: avgGrowth,
      avgGrowth: this.formatBytes(Math.abs(avgGrowth)),
      samples: heapValues.length
    };
  }

  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // 手动触发heap dump
  takeSnapshot(reason = 'manual') {
    this.generateHeapDump(reason);
  }

  // 手动触发GC（如果可用）
  forceGC() {
    if (global.gc) {
      console.log('🗑️  手动触发垃圾回收...');
      global.gc();
      return true;
    } else {
      console.log('⚠️  垃圾回收不可用，请使用 --expose-gc 参数启动Node.js');
      return false;
    }
  }

  // 停止监控
  stop() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
      console.log('🛑 内存监控已停止');
    }
  }
}

module.exports = MemoryMonitor;