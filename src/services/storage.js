const B2 = require('backblaze-b2');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// B2 credentials from environment variables
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID;

// Initialize B2 client
const b2 = new B2({
    applicationKeyId: B2_KEY_ID,
    applicationKey: B2_APPLICATION_KEY
});

// Authentication state
let isAuthenticated = false;
let authToken = null;
let apiUrl = null;
let downloadUrl = null;
let bucket = null;

/**
 * Authenticate with Backblaze B2
 */
async function authenticateB2() {
    try {
        const auth = await b2.authorize();
        
        // Store authentication data
        authToken = auth.authorizationToken;
        apiUrl = auth.apiUrl;
        downloadUrl = auth.downloadUrl;
        isAuthenticated = true;
        
        console.log('Successfully authenticated with Backblaze B2');
        return auth;
    } catch (error) {
        console.error('B2 Authentication error:', error);
        isAuthenticated = false;
        authToken = null;
        apiUrl = null;
        downloadUrl = null;
        throw new Error('Failed to authenticate with B2 storage');
    }
}

/**
 * Get bucket information
 */
async function getBucket() {
    if (!isAuthenticated) {
        await authenticateB2();
    }
    
    try {
        // If we already have bucket info, return it
        if (bucket) return bucket;
        
        // If B2_BUCKET_ID is provided, use that directly
        if (B2_BUCKET_ID) {
            bucket = {
                bucketId: B2_BUCKET_ID,
                bucketName: B2_BUCKET_NAME
            };
            return bucket;
        }
        
        // Otherwise, list buckets to find the one to use
        const response = await b2.listBuckets();
        
        bucket = response.buckets.find(b => b.bucketName === B2_BUCKET_NAME);
        
        if (!bucket) {
            throw new Error(`Bucket "${B2_BUCKET_NAME}" not found. Available buckets: ${response.buckets.map(b => b.bucketName).join(', ')}`);
        }
        
        console.log(`Found bucket: ${bucket.bucketName} (${bucket.bucketId})`);
        return bucket;
    } catch (error) {
        console.error('Error getting bucket info:', error);
        bucket = null;
        throw new Error('Failed to get bucket info');
    }
}

/**
 * Upload file to B2
 * @param {Object} file - File object from multer middleware
 * @param {string} [category='products'] - File category for organization
 * @returns {Object} - Upload result with fileUrl
 **/
async function uploadFile(file, category = 'products') {
    if (!file) {
        throw new Error('No file provided');
    }

    try {
        // Ensure we're authenticated
        if (!isAuthenticated) {
            await authenticateB2();
        }

        // Get bucket info
        const bucketInfo = await getBucket();
        
        // Read the file into a buffer
        const fileBuffer = fs.readFileSync(file.path);
        
        // Generate a unique file name with original extension
        const fileExtension = path.extname(file.originalname);
        const fileName = `${category}/${uuidv4()}${fileExtension}`;
        
        // Get the MIME type
        const contentType = mime.lookup(file.originalname) || 'application/octet-stream';

        console.log(`Uploading file: ${fileName} (${contentType}, ${file.size} bytes)`);
        
        // Get upload URL and token
        const uploadUrlResponse = await b2.getUploadUrl({
            bucketId: bucketInfo.bucketId
        });
        
        // Debug the response structure
        console.log('Upload URL Response structure:', JSON.stringify({
            hasData: !!uploadUrlResponse.data,
            keys: Object.keys(uploadUrlResponse)
        }));
        
        // Correctly access properties based on response structure
        const uploadUrl = uploadUrlResponse.data ? uploadUrlResponse.data.uploadUrl : uploadUrlResponse.uploadUrl;
        const uploadAuthToken = uploadUrlResponse.data ? uploadUrlResponse.data.authorizationToken : uploadUrlResponse.authorizationToken;
        
        if (!uploadUrl || !uploadAuthToken) {
            console.error('Invalid upload URL response:', uploadUrlResponse);
            throw new Error('Could not get valid upload URL and authorization token');
        }
        
        // Upload the file with correct URL and token
        const uploadResponse = await b2.uploadFile({
            uploadUrl: uploadUrl,
            uploadAuthToken: uploadAuthToken,
            fileName: fileName,
            data: fileBuffer,
            contentType: contentType,
            onUploadProgress: (event) => {
                if (event && event.bytesUploaded && event.totalBytes) {
                    const percentComplete = Math.round((event.bytesUploaded / event.totalBytes) * 100);
                    console.log(`Upload progress: ${percentComplete}%`);
                }
            }
        });

        // Debug the upload response structure
        console.log('Upload Response structure:', JSON.stringify({
            hasData: !!uploadResponse.data,
            keys: Object.keys(uploadResponse)
        }));
        
        // Correctly get the file ID from the response
        const fileId = uploadResponse.data ? uploadResponse.data.fileId : uploadResponse.fileId;

        // For public buckets, construct the public URL
        const publicUrl = `https://f003.backblazeb2.com/file/${B2_BUCKET_NAME}/${fileName}`;
        
        console.log(`File uploaded successfully: ${fileName}`);
        
        // Clean up the temporary file
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting temporary file:', err);
        });

        return {
            success: true,
            fileUrl: publicUrl,
            fileName: fileName,
            fileId: fileId,
            size: file.size,
            mimeType: contentType
        };
    } catch (error) {
        console.error('File upload error:', error);
        
        // Clean up the temporary file if it exists
        if (file && file.path) {
            fs.unlink(file.path, (err) => {
                if (err) console.error('Error deleting temporary file:', err);
            });
        }
        
        // Reset authentication state on error
        isAuthenticated = false;
        authToken = null;
        apiUrl = null;
        downloadUrl = null;
        bucket = null;
        
        throw new Error('Failed to upload file to storage');
    }
}

/**
 * Delete a file from B2
 * @param {string} fileName - Full file name including path
 **/
async function deleteFile(fileName) {
    try {
        // Ensure we're authenticated
        if (!isAuthenticated) {
            await authenticateB2();
        }
        
        // Get bucket info
        const bucketInfo = await getBucket();
        
        // Find the file ID
        const response = await b2.listFileNames({
            bucketId: bucketInfo.bucketId,
            prefix: fileName,
            maxFileCount: 1
        });

        if (response.files.length === 0) {
            throw new Error(`File "${fileName}" not found`);
        }

        const fileId = response.files[0].fileId;

        // Delete the file
        await b2.deleteFileVersion({
            fileName: fileName,
            fileId: fileId
        });
        
        console.log(`File deleted successfully: ${fileName}`);

        return {
            success: true,
            message: `File ${fileName} deleted successfully`
        };
    } catch (error) {
        console.error('File deletion error:', error);
        
        // Reset authentication state on error
        isAuthenticated = false;
        authToken = null;
        apiUrl = null;
        downloadUrl = null;
        bucket = null;
        
        throw new Error('Failed to delete file from storage');
    }
}

module.exports = {
    uploadFile,
    deleteFile,
    authenticateB2
};