const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
require("dotenv").config();

AWS.config.update({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
    sessionToken: process.env.aws_session_token,
    region: 'ap-southeast-2',
});

const s3 = new AWS.S3();

async function checkImageStatus(userSearch) {
    // Define the key for the pre-signed URL text file
    const preSignedUrlKey = `${userSearch}_0_url.txt`;

    try {
        // Attempt to get the pre-signed URL file from S3
        const urlData = await s3.getObject({
            Bucket: process.env.BUCKET_NAME,
            Key: preSignedUrlKey
        }).promise();

        // If the file exists, get the pre-signed URL from its contents
        const preSignedUrl = urlData.Body.toString('utf-8');

        // Return the success status with the pre-signed URL
        return { success: true, url: preSignedUrl, message: 'Processing complete' };
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            // If the pre-signed URL file does not exist, assume processing is still underway
            return { success: false, message: 'Processing...' };
        } else {
            // For any other error, log it and return a generic error message
            console.error('Error retrieving pre-signed URL from S3:', error);
            return { success: false, message: 'Unable to check image status at this time.' };
        }
    }
}
// Server-side code for handling polling requests
router.get('/:userSearch', async (req, res) => {
    const { userSearch } = req.params;
    const status = await checkImageStatus(userSearch);
    res.json(status);
});

module.exports = router;
