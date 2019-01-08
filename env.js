#!/usr/local/bin/node

// 检测环境配制, 覆写 app.env.js 模块
// 需根据具体项目情况，实现 env 方法

var fs = require('fs');
var path = require('path');

function main() {
  fs.writeFileSync(
    path.resolve(__dirname, '../app.env.js'),
    [
      '// 编译时自动生成，请勿手动更改',
      '',
      'module.exports = "' + env() + '";'
    ].join('\n')
  )
}

function env()/* -> String*/ {
  return process.env.NODE_ENV ||  'develop';
}

if (module === require.main) {
  main();
}else{
  exports.main = main;
}