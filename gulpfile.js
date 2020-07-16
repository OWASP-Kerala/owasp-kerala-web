
'use strict';
var gulp = require('gulp'),
    cp = require('child_process'),
    mgulpLoadPlugins = require('gulp-load-plugins'),
    browserSync = require('browser-sync').create(),
    del = require('del'),
    wiredep = require('wiredep').stream,
    runSequence = require('run-sequence'),
    debug = require('gulp-debug'),
    reload = browserSync.reload
;
const gulpLoadPlugins = require('gulp-load-plugins');
const $ = gulpLoadPlugins();

var jekyll      = process.platform === 'win32' ? 'jekyll.bat' : 'jekyll';
var bundle      = 'bundle';

let dev = true;

// -->
// Build the Jekyll Site
// <--
function jekyllBuild() {
  return cp.spawn("bundle", ["exec", "jekyll", "build"], { stdio: "inherit" });
}

function minifyCss() {
  return gulp.src('.jekyllbuild/styles/*.scss')
    .pipe($.plumber())
    .pipe($.if(dev, $.sourcemaps.init()))
    .pipe($.sass.sync({
      outputStyle: 'expanded',
      precision: 10,
      includePaths: ['.']
    }).on('error', $.sass.logError))
    .pipe($.autoprefixer({browsers: ['> 1%', 'last 2 versions', 'Firefox ESR']}))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('.tmp/styles'))
    .pipe(reload({stream: true}));
}

function minifyJs() {
  return gulp.src('.jekyllbuild/scripts/**/*.js')
    .pipe($.plumber())
    .pipe($.if(dev, $.sourcemaps.init()))
    .pipe($.babel())
    .pipe($.if(dev, $.sourcemaps.write('.')))
    .pipe(gulp.dest('.tmp/scripts'))
    .pipe(reload({stream: true}));
}

function lint(files) {
  return gulp.src(files)
    .pipe($.eslint({ fix: true }))
    .pipe(reload({stream: true, once: true}))
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
}

function lintJs() {
  return lint('.jekyllbuild/scripts/**/*.js')
    .pipe(gulp.dest('app/scripts'));
}

function moveCss() {
  return gulp.src('.tmp/styles/**.css')
    .pipe(gulp.dest('app/styles'));
}


function html() {
  return gulp.src(['.jekyllbuild/*.html', '.jekyllbuild/**/*.html', '.jekyllbuild/**/*.xml', '.jekyllbuild/**/**/**/**/*.html', '.jekyllbuild/**/**/*.html'])
    .pipe($.useref({searchPath: ['.tmp', '.jekyllbuild', '.jekyllbuild/blog/', '.jekyllbuild/blog/**/**/**/', '.jekyllbuild/tag/**/', '.']}))
    .pipe($.if(/\.js$/, $.uglify({compress: {drop_console: true}})))
    .pipe($.if(/\.css$/, $.cssnano({safe: true, autoprefixer: false})))
    .pipe($.if(/\.html$/, $.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: {compress: {drop_console: true}},
      processConditionalComments: true,
      removeComments: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true
    })))
    .pipe(gulp.dest('dist'));
}

function images() {
  return gulp.src('.jekyllbuild/images/**/*')
    // .pipe($.cache($.imagemin()))
    .pipe(gulp.dest('dist/images'));
}

function fonts() {
  return gulp.src(require('main-bower-files')('**/*.{eot,svg,ttf,woff,woff2}', function (err) {})
    .concat('.jekyllbuild/fonts/**/*'))
    .pipe($.if(dev, gulp.dest('.tmp/fonts'), gulp.dest('dist/fonts')));
}

function extras() {
  return gulp.src([
    './*vendor/*.php',
    './*vendor/composer/*.php',
    './*vendor/sendgrid/**/lib/**/*.php',
    './*vendor/sendgrid/**/lib/**/**/*.php',
    '.jekyllbuild/*',
    '!.jekyllbuild/index.js',
    '!.jekyllbuild/*.html',
    '!.jekyllbuild/**/*.html',
    '!.jekyllbuild/**/*.xml',
    '!.jekyllbuild/**/**/**/**/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));
}

function clean() {
  return del(["dist", ".tmp", ".jekyllbuild"]);
}

function watch() {
  return gulp.watch([
      'app/**/*.markdown',
      'app/*.html',
      'app/**/*.html',
      'app/images/**/*',
      '.tmp/fonts/**/*'
    ]).on('change', reload);

    return gulp.watch('app/styles/**/*.scss',  gulp.series(minifyCss));
    return gulp.watch('app/scripts/**/*.js', gulp.series(minifyJs, lintJs));
    return gulp.watch('app/fonts/**/*', gulp.series(fonts));
    return gulp.watch('bower.json', gulp.series(wiredepStyle, fonts));
}

function serveJekyll() {
  return browserSync.init({
    notify: false,
    port: 9000,
    server: {
        baseDir: ['dist'],
        routes: {
          '/bower_components': 'bower_components'
        }
      }
  });
}

function wiredepStyle() {
  return gulp.src('.jekyllbuild/styles/*.scss')
    .pipe($.filter(file => file.stat && file.stat.size))
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)+/
    }))
    .pipe(gulp.dest('.jekyllbuild/styles'));

    return gulp.src(['.jekyllbuild/*.html', '.jekyllbuild/**/*.html', '.jekyllbuild/**/**/**/**/*.html'])
    .pipe(wiredep({
      exclude: ['bootstrap'],
      ignorePath: /^(\.\.\/)*\.\./
    }))
    .pipe(gulp.dest('.jekyllbuild/'));
}

const minifyImagesAndFonts = gulp.series(images, fonts, extras);
const js = gulp.series(minifyJs, lintJs);
const style = gulp.series(minifyCss, moveCss, js);
const minifyHtml = gulp.series( html);
const minifyBaseComponent = gulp.series( minifyHtml, style, minifyImagesAndFonts);

const build = gulp.series(clean, jekyllBuild, minifyBaseComponent);
const serveAndWatch = gulp.parallel(serveJekyll, watch);
const serve = gulp.series(clean, jekyllBuild, wiredepStyle, minifyBaseComponent, serveAndWatch);

// export tasks
exports.minifyHtml = minifyHtml;
exports.jekyllBuild = jekyllBuild;

exports.serve = serve;

exports.build = build;
exports.default = build;
