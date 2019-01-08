#!/usr/local/bin/node

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');



function main() {
  if (checkENV()) {
    require('./env').main();
    require('./ignore').main();
    require('./svg-to-wxss').main();
  }else{
    // 等待一段时间，会在控制台输出一些提示信息
    console.warn('Dependencies is not installed, please run `node install` in ' + __dirname);
    setTimeout(()=> console.log('exit'), 10000);
  }
}


function checkENV() {
  
  var dependencies = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).dependencies;

  var shouldUpdate = Object.keys(dependencies).map(dependence=> {
    try {
      require.resolve(dependence);
      return false;
    }catch(e) {
      return true
    }
  })
    .concat(false)
    .reduceRight((shouldUpdate, module)=> shouldUpdate || module);

  if (!shouldUpdate) return true;
    
  return false;
}


if (module == require.main) {
  main();
}