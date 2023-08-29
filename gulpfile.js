'use strict'

const gulp = require('gulp')
const path = require('path')
const pkg = require('./package.json')
const colors = require('colors/safe')
const zip = require('gulp-zip')
const imagemin = require('gulp-imagemin')
const jsonEditor = require('gulp-json-editor')
const { exec } = require('child_process')
const uglify = require('gulp-uglify')
const fs = require('fs')

colors.setTheme({
  error: 'red'
})

function logMessage (message) {
  console.log(`${message}`)
}

gulp.task('update-version', function (cb) {
  const manifestPath = path.join(__dirname, 'src', 'manifest.json')
  const manifest = require(manifestPath)
  const version = manifest.version

  return gulp.src('./package.json')
    .pipe(jsonEditor({ version }))
    .pipe(gulp.dest('./'))
    .on('end', function () {
      exec('npm install', { cwd: './' }, function (error) {
        if (error) {
          logMessage(colors.error('Error running npm install: ' + error))
          return
        }
        cb()
      })
    })
    .on('error', function (err) {
      logMessage(colors.error('Error updating version in package.json: ' + err.toString()))
    })
})

gulp.task('uglify-js', function () {
  return gulp.src('src/**/*.js')
    .pipe(uglify())
    .pipe(gulp.dest('build/temp'))
})

gulp.task('build-chrome', gulp.series('update-version', 'uglify-js', function () {
  const manifestPath = path.join(__dirname, 'src', 'manifest.json')
  const manifest = require(manifestPath)
  const version = manifest.version

  return gulp.src(['build/temp/**', 'src/**'])
    .pipe(imagemin([imagemin.optipng({ optimizationLevel: 5 })]))
    .pipe(zip(`${pkg.name}-v${version}.zip`))
    .pipe(gulp.dest('build'))
    .on('end', function () {
      fs.promises.rm('build/temp', { recursive: true, force: true })
    })
}))

gulp.task('update-version', function (cb) {
  const manifestPath = path.join(__dirname, 'src', 'manifest.json')
  const manifest = require(manifestPath)
  const version = manifest.version

  return gulp.src('./package.json')
    .pipe(jsonEditor({ version }))
    .pipe(gulp.dest('./'))
    .on('end', function () {
      exec('npm install', { cwd: './' }, function (error) {
        if (error) {
          logMessage(colors.error('Error running npm install: ' + error))
          return
        }
        cb()
      })
    })
    .on('error', function (err) {
      logMessage(colors.error('Error updating version in package.json: ' + err.toString()))
    })
})

gulp.task('build', gulp.series('update-version', 'build-chrome'))
