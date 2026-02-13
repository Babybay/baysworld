/**
 * Media Controller — handles file uploads for projects.
 * Supports: project images, thumbnails.
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Store = require('../services/store');
const LogService = require('../services/log.service');

// ── Upload directory setup ──
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };
ensureDir(UPLOADS_DIR);
ensureDir(path.join(UPLOADS_DIR, 'projects'));
ensureDir(path.join(UPLOADS_DIR, 'thumbnails'));

// ── Multer config ──
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function createStorage(subfolder) {
    return multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(UPLOADS_DIR, subfolder, req.params.projectId || 'general');
            ensureDir(dir);
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
            cb(null, name);
        },
    });
}

const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpg, png, gif, webp, svg)'), false);
    }
};

const uploadImages = multer({ storage: createStorage('projects'), fileFilter, limits: { fileSize: MAX_SIZE } });
const uploadThumb = multer({ storage: createStorage('thumbnails'), fileFilter, limits: { fileSize: MAX_SIZE } });

// ── Controllers ──

/**
 * POST /api/media/upload/:projectId
 * Upload multiple images to a project
 */
exports.uploadMiddleware = uploadImages.array('images', 10);
exports.upload = async (req, res) => {
    try {
        if (!req.files || !req.files.length) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const projectId = req.params.projectId;
        const urls = req.files.map(f => `/uploads/projects/${projectId}/${f.filename}`);

        // Add URLs to project images array
        for (const url of urls) {
            await Store.addProjectImage(projectId, url);
        }

        await LogService.log('upload', 'media', projectId, `${urls.length} file(s)`,
            req.user?.username || 'system', `Uploaded ${urls.length} image(s) to project`, req.ip);

        res.json({ urls, message: `${urls.length} file(s) uploaded` });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message || 'Upload failed' });
    }
};

/**
 * POST /api/media/thumbnail/:projectId
 * Upload/replace project thumbnail
 */
exports.thumbnailMiddleware = uploadThumb.single('thumbnail');
exports.uploadThumbnail = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No thumbnail file uploaded' });
        }

        const projectId = req.params.projectId;
        const url = `/uploads/thumbnails/${projectId}/${req.file.filename}`;

        // Remove old thumbnail file if exists
        const project = await Store.getProject(projectId);
        if (project?.thumbnail) {
            const oldPath = path.join(__dirname, '..', '..', project.thumbnail);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await Store.setProjectThumbnail(projectId, url);

        await LogService.log('upload', 'thumbnail', projectId, 'thumbnail',
            req.user?.username || 'system', `Updated project thumbnail`, req.ip);

        res.json({ url, message: 'Thumbnail uploaded' });
    } catch (err) {
        console.error('Thumbnail upload error:', err);
        res.status(500).json({ error: err.message || 'Thumbnail upload failed' });
    }
};

/**
 * GET /api/media/:projectId
 * List all media for a project
 */
exports.listMedia = async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const project = await Store.getProject(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        res.json({
            thumbnail: project.thumbnail || null,
            images: project.images || [],
        });
    } catch (err) {
        console.error('List media error:', err);
        res.status(500).json({ error: 'Failed to list media' });
    }
};

/**
 * DELETE /api/media/:projectId/:filename
 * Delete a specific media file from a project
 */
exports.deleteMedia = async (req, res) => {
    try {
        const { projectId, filename } = req.params;
        const url = `/uploads/projects/${projectId}/${filename}`;
        const filePath = path.join(UPLOADS_DIR, 'projects', projectId, filename);

        // Remove file from disk
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove from project images array
        await Store.removeProjectImage(projectId, url);

        await LogService.log('delete', 'media', projectId, filename,
            req.user?.username || 'system', `Deleted media file`, req.ip);

        res.json({ message: 'File deleted' });
    } catch (err) {
        console.error('Delete media error:', err);
        res.status(500).json({ error: 'Failed to delete file' });
    }
};

// ── Multer error handler middleware ──
exports.handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum 10MB allowed.' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};
