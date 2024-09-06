const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const AWS = require('aws-sdk');
require("dotenv").config();


AWS.config.update({
  accessKeyId: process.env.aws_access_key_id,
  secretAccessKey: process.env.aws_secret_access_key,
  sessionToken: process.env.aws_session_token,
  region: 'ap-southeast-2',
});

const sqs = new AWS.SQS();

async function sendRequestsToQueue(queueUrl, imageUrl, userSearch, numImages, imageSize) {
  try {

    const messageBody = JSON.stringify({ imageUrl, userSearch, numImages, imageSize });
    console.log(messageBody);
    const params = {
      QueueUrl: queueUrl,
      //MessageBody: imageUrl
      MessageBody: messageBody, // Send both imageUrl and userSearch
    };
    const data = await sqs.sendMessage(params).promise();
    console.log(`Message sent successfully. Message ID: ${data.MessageId}`);
    return { success: true }; // Return a success response
  } catch (err) {
    console.log(`Error sending message to SQS queue: ${err}`);
    return { success: false, error: err }; // Return a success response
  }
}

router.get("/:userSearch", async function (req, res) {
  const { userSearch } = req.params;
  let numImages = req.query.numImages || '20'; // Set default number of images if not provided
  const imageSize = req.query.imageSize || '640x480'; // default size if not specified
  //const [width, height] = imageSize.split('x').map(dim => parseInt(dim, 10));
  const FLICKR_API_KEY = process.env.FLICKR_API_KEY;
  console.log(FLICKR_API_KEY);


  const response = await fetch(
    `https://api.flickr.com/services/rest?method=flickr.photos.search&api_key=${FLICKR_API_KEY}&tags=${userSearch}&per-page=${numImages}&format=json&nojsoncallback=1&media=photos`
  );

  const data = await response.json();
  const photos = data.photos;
  const formattedPhotoData = [];

  for (let i = 0; i < photos.photo.length; i++) {
    const photo = photos.photo[i];
    const image = `http://farm${photo.farm}.static.flickr.com/${photo.server}/${photo.id}_${photo.secret}_t.jpg`;
    const url = `http://www.flickr.com/photos/${photo.owner}/${photo.id}`;
    const title = photo.title;
    formattedPhotoData.push({ image, url, title });
  }

  console.log(formattedPhotoData.length);
  if (formattedPhotoData.length < numImages) {
    numImages = formattedPhotoData.length;
  }
  if (formattedPhotoData.length > 0) {
    const formattedMessage = [];
    for (let i = 0; i < numImages; i++) {
      const imageURL = formattedPhotoData[i].image;
      formattedMessage.push({ image: imageURL });
    }

    // Combine the URLs into a single message
    const messageBody = JSON.stringify(formattedMessage);
    try {
      const queueName = global.queueName;
      const queueUrl = `https://sqs.ap-southeast-2.amazonaws.com/901444280953/${queueName}`;
      const queueResponse = await sendRequestsToQueue(queueUrl, messageBody, userSearch, numImages, imageSize);
      //Check if message was sent to SQS
      if (queueResponse.success) {
        // Respond with a success message if message was sent to SQS successfully
        res.json({ success: true, message: 'Image processing initiated.' });
      } else {
        // Respond with an error message if there was a failure sending to SQS
        console.error('Error sending to SQS:', queueResponse.error);
        res.status(500).json({ success: false, message: 'Failed to initiate image processing. Please try again.' });
      }

    } catch (error) {
      console.error('Error during sendRequestsToQueue or processMsg:', error);
      res.status(500).render('error', { message: 'Error processing your request' });
    }
  }
  else {
    res.json({ success: false, message: 'No images found.' });
  }

});

module.exports = router;