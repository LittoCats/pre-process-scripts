#!/usr/local/bin/node

/**
 * 将 assets 目录下的 .if.svg 结尾的 svg 图片，转换为 iconfont 格式
 * 生成 以文件名为 class 选择器的样式表文件
 * 输出 app.svg.wxss 文件
 */

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var Writable = require('stream').Writable;


// TODO: 添加 依赖库检查，如果不存在，自动下载到缓存目录中，并加载
var SvgIcons2SvgFont = require('svgicons2svgfont');
var svg2ttf = require('svg2ttf');
var ttf2woff = require('ttf2woff');

var ASSETS_DIR = path.resolve(__dirname, '../assets');

// 字体名，使用前缀加随机字符串，防止与其它字体冲突
var FONT_NAME = "ICONFONT"+Math.random().toString(16).slice(2, 7);

function main() {
  var svgs = queryIfSvg();
  svgsToTtf(svgs)
    .then(({buffer, metadata})=> generateWxss(buffer, metadata))
    .then(wxss=> {

      // 添加所有的文件到 app.svg.wxss 结尾，用于核查 debug
      wxss += '\n\n/** svg files\n  ' + svgs.map(file=> path.relative(ASSETS_DIR, file)).join('\n  ') + '\n*/';

      fs.writeFileSync(
        path.resolve(__dirname, '../app.svg.wxss'),
        wxss
      )
    });
}


//TODO: 使用 纯 node api ，兼容 window，需测试
function queryIfSvg() {
  return walk(ASSETS_DIR, /\.if\.svg$/);

  function walk(dir, filter) {
    return fs.readdirSync(dir).map(file=> {
      var absolute = path.resolve(dir, file);
      var stat = fs.statSync(absolute);
      var files = [];
      if (stat.isFile()) {
        if (filter.test(absolute)) files.push(absolute);
      } else if (stat.isDictionary()) {
        files = files.concat(walk(absolute, filter));
      }
      return files;
    })
    .concat([[]])
    .reduceRight((files, file)=> files.concat(file));
  }
}

function svgsToTtf(svgs) {
  var buffer = Buffer.alloc(0);
  var metadata = {};
  var codePoint = 0xe400;

  class OutPutStream extends Writable {
    _write (chunk, enc, done) {
      buffer = Buffer.concat([buffer, chunk]);
      process.nextTick(done);
    }
  }
  var outStream = new OutPutStream({});
  var fontStream = new SvgIcons2SvgFont({
    fontName: FONT_NAME,
    normalize: true,
    fontHeight: 1000
  });

  fontStream.pipe(outStream);

  svgs.map(svg=> {
    var glyph = fs.createReadStream(svg);

    var name = path.basename(svg).replace(/\.if\.svg$/, '');
    var unicode = codePoint++;

    metadata[name] = {
      unicode: [String.fromCodePoint((codePoint += 16))],
      name: name
    };

    glyph.metadata = metadata[name];

    fontStream.write(glyph);
  });


  var promise = new Promise((resolve, reject)=> {
    outStream.on('finish', ()=> resolve({buffer, metadata}))
  });

  fontStream.end();

  return promise;
}

function generateWxss(buffer, metadata) {

  var ttf = svg2ttf(buffer.toString(), {});
  var woff = ttf2woff(ttf.buffer, {});

  var fontFace = [
    '@font-face {',
    ['  font-family: "', FONT_NAME, '";'].join(''),
    ["  src: url('data:application/x-font-woff;charset=utf-8;base64,", Buffer.from(woff.buffer).toString('base64') ,"') format('woff');"].join(''),
    '}'
  ].join('\n')

  var iconfont = [
    'icon.font {',
    ['  font-family: "', FONT_NAME ,'" !important;'].join(''),
    '  font-size: 16px;',
    '  font-style: normal;',
    '  -webkit-font-smoothing: antialiased;',
    '  -moz-osx-font-smoothing: grayscale;',
    '  display: flex;',
    '  align-content: center;',
    '}'
  ].join('\n');

  var iconclass = Object.keys(metadata).map((name)=> {
    var unicode = +metadata[name].unicode[0].codePointAt(0);
    return `icon.font.${name}::before {content: "\\${unicode.toString(16)}"}`;
  }).join('\n');

  var wxss = [fontFace, iconfont, iconclass].join('\n');

  return wxss;
}


if (module == require.main) {
  main();
}else{
  exports.main = main;
}