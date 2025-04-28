const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storageService = require('../services/storage');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for temporary file storage
const upload = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, uploadsDir);
        },
        filename: function(req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function(req, file, cb) {
        // Accept only images
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed!'));
    }
});

// Endpoint to upload a single image
router.post('/upload', upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        // Get the category from the request body or default to 'products'
        const category = req.body.category || 'products';
        
        // Upload the file to B2
        const result = await storageService.uploadFile(req.file, category);
        
        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: result
        });
    } catch (error) {
        console.error('Upload route error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload file'
        });
    }
});

// Endpoint to upload multiple images
router.post('/upload-multiple', upload.array('images', 10), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No image files provided'
            });
        }

        // Get the category from the request body or default to 'products'
        const category = req.body.category || 'products';
        
        // Upload each file to B2
        const uploadPromises = req.files.map(file => 
            storageService.uploadFile(file, category)
        );
        
        const results = await Promise.all(uploadPromises);
        
        res.json({
            success: true,
            message: `${results.length} files uploaded successfully`,
            data: results
        });
    } catch (error) {
        console.error('Upload multiple route error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload files'
        });
    }
});

// Endpoint to delete a file
router.delete('/delete/:fileName', async (req, res, next) => {
    try {
        const fileName = req.params.fileName;
        
        if (!fileName) {
            return res.status(400).json({
                success: false,
                message: 'File name is required'
            });
        }
        
        // Delete the file from B2
        const result = await storageService.deleteFile(fileName);
        
        res.json({
            success: true,
            message: 'File deleted successfully',
            data: result
        });
    } catch (error) {
        console.error('Delete route error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete file'
        });
    }
});

module.exports = router;