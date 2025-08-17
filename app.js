const MemoryMonitor = require('./mempeyMonitor');

console.log('🚀 启动内存监控测试...');

// 初始化内存监控
const memoryMonitor = new MemoryMonitor({
  heapDumpDir: './heapdumps',
  maxHeapDumps: 3,
  monitorInterval: 3000, // 3秒监控间隔
  leakThreshold: 5 // 降低到5MB用于测试
});

// 显示初始内存状态
console.log('\n📈 初始内存状态:');
console.log(memoryMonitor.getMemoryUsage());

// 每10秒显示内存趋势
setInterval(() => {
  const trend = memoryMonitor.getMemoryTrend();
  console.log('\n📊 内存趋势分析:', trend);
}, 10000);

// 简单的模拟内存使用
let testArray = [];

console.log('\n⚡ 可用命令:');
console.log('- 按 Ctrl+C 退出');
console.log('- 程序将自动监控内存使用情况');

// 模拟一些内存活动
setInterval(() => {
  // 添加一些数据
  for (let i = 0; i < 100; i++) {
    testArray.push({
      id: Date.now() + i,
      data: new Array(100).fill('test-data'),
      timestamp: new Date()
    });
  }
  
  // 随机清理一些数据
  if (Math.random() > 0.7 && testArray.length > 500) {
    testArray = testArray.slice(0, Math.floor(testArray.length / 2));
  }
}, 2000);

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 正在停止内存监控...');
  memoryMonitor.stop();
  process.exit(0);
});