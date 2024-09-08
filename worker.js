const AWS = require('aws-sdk');
const sharp = require('sharp');

// Configure AWS
const s3 = new AWS.S3();

const BUCKET_NAME = process.env.BUCKET_NAME; // Ensuring this is set in Lambda environment

// Function to fetch image from URL using node-fetch
async function fetchImageFromUrl(url) {
    const { default: fetch } = await import('node-fetch');
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image. Status code: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer;
    } catch (err) {
        throw new Error(`Error fetching image from URL: ${err.message}`);
    }
}

// Function to determine image type
async function getImageType(buffer) {
    const { default: imageType } = await import('image-type');
    const type = imageType(buffer);
    if (!type) {
        throw new Error('Unsupported image format');
    }
    return type;
}

// Image resizing and processing function
async function resizeImage(imageURL, fileName, imageSize) {
    try {
        const imageBuffer = await fetchImageFromUrl(imageURL);
        const [width, height] = imageSize.split('x').map(dim => parseInt(dim, 10));

        // Validate image format
        const type = await getImageType(imageBuffer);
if (!['jpeg', 'jpg', 'png'].includes(type.ext)) {
    throw new Error(`Unsupported image format: ${type.ext}`);
}

        // Process image using Sharp
        const resizedBuffer = await sharp(imageBuffer)
            .resize(width, height)
            .rotate(0)
            .sharpen()
            .modulate({ brightness: 1, saturation: 1 })
            .withMetadata()
            .jpeg({ quality: 90 })
            .toBuffer();

        // Upload resized image to S3
        await uploadImageToS3(fileName, resizedBuffer);
    } catch (err) {
        console.error('Error processing image:', err);
        throw err;
    }
}

// S3 upload function
async function uploadImageToS3(fileName, imageBuffer) {
    const params = {
        Bucket: BUCKET_NAME,
        Key: `${fileName}.jpg`,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
    };

    try {
        const uploadResult = await s3.putObject(params).promise();
        console.log("Image upload to S3 successfully:", uploadResult);

        // Generate a pre-signed URL for the uploaded image
        const signedUrl = s3.getSignedUrl('getObject', {
            Bucket: BUCKET_NAME,
            Key: `${fileName}.jpg`,
            Expires: 60 * 1 // URL expires in 1 minute
        });

        // Save the signed URL to S3 as a text file
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: `${fileName}_url.txt`,
            Body: signedUrl,
        }).promise();

        console.log("Pre-signed URL stored in S3:", signedUrl);
    } catch (err) {
        console.error("Error uploading image to S3:", err);

        // Detailed error logging for easier debugging
        if (err.code === 'NoSuchBucket') {
            console.error(`Bucket "${BUCKET_NAME}" not found.`);
        } else if (err.code === 'AccessDenied') {
            console.error(`Access denied to bucket "${BUCKET_NAME}". Ensure correct permissions are set.`);
        }
        throw err;
    }
}

// Lambda handler function triggered by SQS
exports.handler = async (event) => {
    console.log("Lambda triggered by SQS event:", JSON.stringify(event));

    try {
        for (const record of event.Records) {
            const message = JSON.parse(record.body);
            console.log("Message received:", message);

            const { imageUrl, userSearch, imageSize } = message;
            const parsedImages = JSON.parse(imageUrl);
            const imageUrls = parsedImages.map(item => item.image);
            console.log(imageUrls[0]);

            // Process the single image
            await resizeImage(imageUrls[0], userSearch, imageSize);
        }

        console.log("Image processing complete for all records.");
    } catch (error) {
        console.error('Error processing SQS event:', error);
        throw new Error('Failed to process images');
    }
};
