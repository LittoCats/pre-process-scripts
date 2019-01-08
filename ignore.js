#!/usr/local/bin/node

/**
 *  以 .gitignore 的格式书写 小程序的 .mpignore
 *  
 *  目前，支持可能不很完善
 */

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var cwd = process.cwd();

// Step 1. 读取 .mpignore 文件
// Step 2. 生成查找命令
// Step 3. 查找所有被忽略的文件
// Step 4. 注入到 project.config.json
function main() {

  var PROJ_DIR = path.resolve(__dirname, '../');

  var ignore = compile(fs.readFileSync(path.resolve(PROJ_DIR, '.mpignore'), 'utf8'));

  var denyList = walk(PROJ_DIR, ignore.denies);

  var mpignore = denyList.map(rule).filter(item=> !!item);

  var projectConfigPath = path.resolve(PROJ_DIR, 'project.config.json');
  var projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));

  projectConfig.packOptions.ignore = mpignore;

  fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 4));

  return;
  
  function rule(file) {
    var type = undefined;
    var stat = fs.statSync(path.resolve(PROJ_DIR, file));
    if (stat.isDirectory()) type = "folder";
    if (stat.isFile()) type = "file";

    return !type ? undefined : {
      type, value: file
    };
  }


  // 遍历文件夹，使用纯 node api, 兼容 windows
  function walk(dir, filter) {
    var files = fs.readdirSync(dir);
    var results = files.filter(filter) || [];

    var children = files.map(file=> {
      if (results.indexOf(file) >= 0) return [];

      file = path.resolve(dir, file);
      if (fs.statSync(file).isDirectory()) return walk(file, filter);
      return [];
    });

    results = results.map(item=> path.relative(PROJ_DIR, path.resolve(dir, item)));

    return results.concat.apply(results, children);
  }
}


if (module == require.main) {
  main();
}else{
  exports.main = main;
}


/**
 * Compile the given `.gitignore` content (not filename!)
 * and return an object with `accepts`, `denies` and `maybe` methods.
 * These methods each accepts a single filename and determines whether
 * they are acceptable or unacceptable according to the `.gitignore` definition.
 *
 *
 * @param  {String} content The `.gitignore` content to compile.
 * @return {Object}         The helper object with methods that operate on the compiled content.
 */
function compile(content) {
  var parsed = parse(content),
      positives = parsed[0],
      negatives = parsed[1];
  return {
    accepts: function (input) {
      if (input[0] === '/') input = input.slice(1);
      return negatives[0].test(input) || !positives[0].test(input);
    },
    denies: function (input) {
      if (input[0] === '/') input = input.slice(1);
      return !(negatives[0].test(input) || !positives[0].test(input));
    },
    maybe: function (input) {
      if (input[0] === '/') input = input.slice(1);
      return negatives[1].test(input) || !positives[1].test(input);
    }
  };
};

/**
 * Parse the given `.gitignore` content and return an array
 * containing two further arrays - positives and negatives.
 * Each of these two arrays in turn contains two regexps, one
 * strict and one for 'maybe'.
 *
 * @param  {String} content  The content to parse,
 * @return {Array[]}         The parsed positive and negatives definitions.
 */
function parse(content) {
  return content.split('\n')
  .map(function (line) {
    line = line.trim();
    return line;
  })
  .filter(function (line) {
    return line && line[0] !== '#';
  })
  .reduce(function (lists, line) {
    var isNegative = line[0] === '!';
    if (isNegative) {
      line = line.slice(1);
    }
    if (line[0] === '/')
      line = line.slice(1);
    if (isNegative) {
      lists[1].push(line);
    }
    else {
      lists[0].push(line);
    }
    return lists;
  }, [[], []])
  .map(function (list) {
    return list
    .sort()
    .map(prepareRegexes)
    .reduce(function (list, prepared) {
      list[0].push(prepared[0]);
      list[1].push(prepared[1]);
      return list;
    }, [[], [], []]);
  })
  .map(function (item) {
    return [
      item[0].length > 0 ? new RegExp('^((' + item[0].join(')|(') + '))') : new RegExp('$^'),
      item[1].length > 0 ? new RegExp('^((' + item[1].join(')|(') + '))') : new RegExp('$^')
    ]
  });
};

function prepareRegexes (pattern) {
  return [
    // exact regex
    prepareRegexPattern(pattern),
    // partial regex
    preparePartialRegex(pattern)
  ];
};

function prepareRegexPattern (pattern) {
  return escapeRegex(pattern).replace('**', '(.+)').replace('*', '([^\\/]+)');
}

function preparePartialRegex (pattern) {
  return pattern
  .split('/')
  .map(function (item, index) {
    if (index)
      return '([\\/]?(' + prepareRegexPattern(item) + '\\b|$))';
    else
      return '(' + prepareRegexPattern(item) + '\\b)';
  })
  .join('');
}

function escapeRegex (pattern) {
  return pattern.replace(/[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g, "\\$&");
}