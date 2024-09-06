const express = require('express');
const router = express.Router();

router.get('/:userSearch', (req, res) => {
    const { userSearch } = req.params;
    const uploadedImageUrl = `https://${global.bucketName}.s3.ap-southeast-2.amazonaws.com/${userSearch}_0.jpg`;
    res.render('teste', { resizedImage: uploadedImageUrl });
});

module.exports = router;