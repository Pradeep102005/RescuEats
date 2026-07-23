const express = require("express");
const uploadRouter = express.Router();
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = require("../config/s3");

/**
 * GET /vendor/pre-signed-url
 * Generates a temporary upload URL for vendors to upload listing photos directly to AWS S3.
 * Query params: fileName, fileType
 */
uploadRouter.get("/pre-signed-url", async (req, res) => {
    try {
        const { fileName, fileType } = req.query;

        if (!fileName || !fileType) {
            return res.status(400).json({
                error: "fileName and fileType query parameters are required"
            });
        }

        // Validate that it is an image type
        if (!fileType.startsWith("image/")) {
            return res.status(400).json({
                error: "Invalid file type. Only image uploads are allowed."
            });
        }

        // Extract extension and generate a clean, collision-free S3 key
        const extension = fileName.split(".").pop();
        const uniqueKey = `listings/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: uniqueKey,
            ContentType: fileType,
        });

        // Pre-signed URL expires in 5 minutes (300 seconds)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        // The permanent public URL to access the image after upload
        const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${uniqueKey}`;

        res.status(200).json({
            uploadUrl,
            imageUrl,
            key: uniqueKey
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = uploadRouter;
