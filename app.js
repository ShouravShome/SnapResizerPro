var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const AWS = require('aws-sdk');
require("dotenv").config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const flickrAPI = require('./routes/flickrAPI');
const checkImage = require('./routes/checkImage');
const displayImage = require('./routes/displayImage');


var app = express();

//Create s3 bucket
AWS.config.update({
  accessKeyId: process.env.aws_access_key_id,
  secretAccessKey: process.env.aws_secret_access_key,
  sessionToken: process.env.aws_session_token,
  region: 'ap-southeast-2',
});

const s3 = new AWS.S3();
const sqs = new AWS.SQS();

global.bucketName = 'shomeimagebucket';
global.queueName = 'shome-queue';

async function createS3bucket() {
  try {
    console.log(bucketName);
    await s3.createBucket({ Bucket: bucketName }).promise()
    console.log(`Created bucket: ${bucketName}`);
  } catch (err) {
    if (err.statusCode === 409) {
      console.log(`Bucket already exists: ${bucketName}`);
    } else {
      console.log(`Error creating bucket: ${err}`);
    }
  }
}


async function createSQSQueue() {
  try {
    const params = {
      QueueName: queueName,
      Attributes: {
      }
    };
    await sqs.createQueue(params).promise();
    console.log(`Success: Created SQS Queue URL: ${queueName}`);
  } catch (err) {
    if (err.statusCode === 409) {
      console.log(`Queue already exists: ${queueName}`);
    }
    else {
      console.log(`Error creating SQS queue: ${err}`);
    }
  }
}

createSQSQueue();
createS3bucket();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/flickr', flickrAPI);
app.use('/check-image', checkImage);
app.use('/display-image', displayImage);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
