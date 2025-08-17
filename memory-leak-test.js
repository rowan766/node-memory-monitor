const MemoryMonitor = require('./mempeyMonitor');

console.log('🔥 启动内存泄漏测试...');

// 初始化内存监控，更敏感的设置
const memoryMonitor = new MemoryMonitor({
  heapDumpDir: './heapdumps',
  maxHeapDumps: 5,
  monitorInterval: 2000, // 2秒监控间隔
  leakThreshold: 3, // 降低到3MB用于快速触发
  gcThreshold: 2 // 连续2次检测到泄漏就生成dump
});

// 模拟内存泄漏的数组
let memoryLeakArray = [];
let bigDataArray = [];

console.log('\n📈 初始内存状态:');
console.log(memoryMonitor.getMemoryUsage());

// 内存泄漏模拟器
function simulateMemoryLeak() {
  console.log('\n🔥 开始模拟内存泄漏...');
  
  let counter = 0;
  const leakInterval = setInterval(() => {
    counter++;
    
    // 每次创建大量对象但不释放
    for (let i = 0; i < 2000; i++) {
      memoryLeakArray.push({
        id: `leak_${counter}_${i}`,
        data: new Array(500).fill(`large-data-${Date.now()}`),
        timestamp: new Date(),
        nested: {
          moreData: new Array(200).fill('nested-data'),
          evenMore: {
            deepData: new Array(100).fill('deep-nested-data')
          }
        }
      });
    }
    
    // 创建一些大的Buffer对象
    for (let j = 0; j < 5; j++) {
      bigDataArray.push(Buffer.alloc(1024 * 100, 'memory-leak-buffer')); // 100KB per buffer
    }
    
    console.log(`💥 第${counter}轮内存泄漏模拟:`, {
      leakArraySize: memoryLeakArray.length,
      bigDataArraySize: bigDataArray.length,
      currentMemory: memoryMonitor.getMemoryUsage().heapUsed
    });
    
    // 模拟20轮后停止
    if (counter >= 20) {
      clearInterval(leakInterval);
      console.log('\n🛑 内存泄漏模拟结束');
      
      // 5秒后开始清理测试
      setTimeout(() => {
        startCleanupTest();
      }, 5000);
    }
  }, 3000); // 每3秒创建一轮泄漏
}

// 清理测试
function startCleanupTest() {
  console.log('\n🧹 开始内存清理测试...');
  
  // 手动生成一次heap dump
  memoryMonitor.takeSnapshot('before-cleanup');
  
  setTimeout(() => {
    // 清理大部分内存
    console.log('🗑️  清理内存泄漏数组...');
    memoryLeakArray = [];
    bigDataArray = [];
    
    // 手动触发GC（如果可用）
    if (global.gc) {
      console.log('🗑️  手动触发垃圾回收...');
      global.gc();
    }
    
    setTimeout(() => {
      console.log('\n✅ 清理完成，最终内存状态:');
      console.log(memoryMonitor.getMemoryUsage());
      
      // 生成清理后的heap dump
      memoryMonitor.takeSnapshot('after-cleanup');
      
      // 显示内存趋势
      setTimeout(() => {
        console.log('\n📊 最终内存趋势:');
        console.log(memoryMonitor.getMemoryTrend());
        
        console.log('\n🎯 测试完成！查看 ./heapdumps 目录中的heap dump文件');
        console.log('💡 提示: 可以使用Chrome DevTools的Memory面板分析.heapsnapshot文件');
        
        // 停止监控
        setTimeout(() => {
          memoryMonitor.stop();
          process.exit(0);
        }, 3000);
      }, 2000);
      
    }, 2000);
  }, 2000);
}

// 显示内存趋势
setInterval(() => {
  const trend = memoryMonitor.getMemoryTrend();
  const stats = memoryMonitor.getHeapStatistics();
  
  console.log('\n📊 实时内存分析:', {
    trend: trend.trend,
    avgGrowth: trend.avgGrowth,
    heapUsage: `${stats.usedHeapSize} / ${stats.totalHeapSize}`,
    arrays: {
      leakArray: memoryLeakArray.length,
      bigDataArray: bigDataArray.length
    }
  });
}, 8000);

// 5秒后开始泄漏测试
setTimeout(() => {
  simulateMemoryLeak();
}, 5000);

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 正在停止内存监控...');
  memoryMonitor.stop();
  process.exit(0);
});

console.log('\n⏳ 5秒后开始内存泄漏测试...');
console.log('💡 观察控制台输出，等待内存泄漏检测和heap dump生成');
console.log('🎯 目标: 触发内存泄漏警告并自动生成heap dump文件');