const { v4: uuidv4 } = require('uuid');
const store = require('../services/store');

const COLLECTION = 'projects';

exports.getAll = (req, res) => {
    try {
        let projects = store.findAll(COLLECTION);

        // Filter by status
        if (req.query.status) {
            projects = projects.filter(p => p.status === req.query.status);
        }

        // Filter by tag
        if (req.query.tag) {
            projects = projects.filter(p => p.tags && p.tags.includes(req.query.tag));
        }

        // Search by name/description
        if (req.query.q) {
            const q = req.query.q.toLowerCase();
            projects = projects.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.description && p.description.toLowerCase().includes(q))
            );
        }

        // Sort by updatedAt descending
        projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        res.json(projects);
    } catch (err) {
        console.error('Error fetching projects:', err);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

exports.getById = (req, res) => {
    try {
        const project = store.findById(COLLECTION, req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (err) {
        console.error('Error fetching project:', err);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
};

exports.create = (req, res) => {
    try {
        const { name, description, techStack, status, githubUrl, liveUrl, tags, notes } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        const now = new Date().toISOString();
        const project = {
            id: uuidv4(),
            name: name.trim(),
            description: description || '',
            techStack: techStack || [],
            status: status || 'active',
            githubUrl: githubUrl || '',
            liveUrl: liveUrl || '',
            tags: tags || [],
            notes: notes || '',
            createdAt: now,
            updatedAt: now,
        };

        store.create(COLLECTION, project);
        res.status(201).json(project);
    } catch (err) {
        console.error('Error creating project:', err);
        res.status(500).json({ error: 'Failed to create project' });
    }
};

exports.update = (req, res) => {
    try {
        const updated = store.update(COLLECTION, req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Project not found' });
        res.json(updated);
    } catch (err) {
        console.error('Error updating project:', err);
        res.status(500).json({ error: 'Failed to update project' });
    }
};

exports.remove = (req, res) => {
    try {
        const deleted = store.remove(COLLECTION, req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Project not found' });
        res.json({ message: 'Project deleted' });
    } catch (err) {
        console.error('Error deleting project:', err);
        res.status(500).json({ error: 'Failed to delete project' });
    }
};
