const AWS = require('aws-sdk');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const gm = require('gm').subClass({ imageMagick: '7+' });
const path = require('path');
require("dotenv").config();

BUCKET_NAME = 'shomeimagebucket';

// Configure AWS
AWS.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
    sessionToken: process.env.aws_session_token,
    region: 'ap-southeast-2',
});

const s3 = new AWS.S3();
const sqs = new AWS.SQS();
const queueUrl = 'https://sqs.ap-southeast-2.amazonaws.com/337909779947/shome-queue';

// Define your image processing functions here...
async function resizeImage(firstImageURL, userSearch, imageSize) {
    return new Promise(async (resolve, reject) => {
        try {
            const imageResponse = await axios.get(firstImageURL, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            const [width, height] = imageSize.split('x').map(dim => parseInt(dim, 10));

            // Use Sharp to perform multiple operations on the image and get the output as a buffer
            const resizedBuffer = await sharp(imageBuffer)
                .resize(width, height) // Resize
                .rotate(360) // Rotate by 45 degrees
                .sharpen() // Sharpen
                .blur(2) // Slight blur
                .modulate({ brightness: 1.1, saturation: 1.5 }) // Increase brightness and saturation
                .withMetadata() // Retain EXIF metadata
                .jpeg({ quality: 90 }) // Set JPEG quality
                .toBuffer();
            console.log("Resized image buffer:", resizedBuffer);
            // Now, upload the resized image directly to S3 using the buffer
            console.log(userSearch);
            await uploadImageToS3(userSearch, resizedBuffer);

            resolve();

        } catch (err) {
            console.error('Error processing image:', err);
            reject(err);
        }

    });
}


async function uploadImageToS3(userSearch, imageBuffer) {
    console.log(userSearch);
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: `${userSearch}.jpg`,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
    };

    try {
        const uploadResult = await s3.upload(params).promise();
        console.log("Image uploaded to S3 successfully.", uploadResult);

        // Generate a pre-signed URL for the uploaded image
        const signedUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.BUCKET_NAME,
            Key: `${userSearch}.jpg`,
            Expires: 60 * 1 // The URL will expire in 1 minutes
        });

        await s3.putObject({
            Bucket: process.env.BUCKET_NAME,
            Key: `${userSearch}_url.txt`,
            Body: signedUrl
        }).promise();

        console.log("Pre-signed URL stored in S3.", signedUrl);
    } catch (err) {
        console.error("Error uploading image to S3:", err);
    }
}


async function pollSQS() {
    const params = {
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 180,
    };

    try {
        const data = await sqs.receiveMessage(params).promise();
        if (data.Messages) {
            const rawMessage = data.Messages[0].Body;
            console.log("Raw message body:", rawMessage);


            const message = JSON.parse(data.Messages[0].Body);
            console.log(message);
            const { imageUrl, userSearch, numImages, imageSize } = message; // Extract imageUrl and userSearch
            const parsedImages = JSON.parse(imageUrl);
            const imageUrls = parsedImages.map(item => item.image);
            console.log(imageUrls[0]);

            let counter = 0;

            let promises = [];
            const batchSize = numImages; // Number of images to resize together

            for (let i = 0; i < imageUrls.length; i += batchSize) {
                const batch = imageUrls.slice(i, i + batchSize);

                promises = batch.map(async (imageUrl, index) => {
                    const fileName = `${userSearch}_${i + index}`;
                    try {
                        await resizeImage(imageUrl, fileName, imageSize);
                    } catch (error) {
                        console.error(`Error during image resizing for ${fileName}:`, error);
                    }
                });

                try {
                    await Promise.all(promises);
                } catch (error) {
                    console.error('Error during batch image resizing:', error);
                }
            }
            console.log("All three functions executed successfully.");

            const deleteParams = {
                QueueUrl: queueUrl,
                ReceiptHandle: data.Messages[0].ReceiptHandle,
            };

            await sqs.deleteMessage(deleteParams).promise();
            console.log('Message Deleted', data);
        } else {
            console.log('No messages in the queue.');
        }
    } catch (error) {
        console.log('Error', error);
    }
}

// Set an interval to poll the queue continuously
setInterval(pollSQS, 5000);
