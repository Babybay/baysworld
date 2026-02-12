const { v4: uuidv4 } = require('uuid');
const store = require('../services/store');

const COLLECTION = 'notes';

exports.getAll = (req, res) => {
    try {
        let notes = store.findAll(COLLECTION);

        // Filter by category
        if (req.query.category) {
            notes = notes.filter(n => n.category === req.query.category);
        }

        // Filter by tag
        if (req.query.tag) {
            notes = notes.filter(n => n.tags && n.tags.includes(req.query.tag));
        }

        // Filter pinned only
        if (req.query.pinned === 'true') {
            notes = notes.filter(n => n.pinned);
        }

        // Search by title/content
        if (req.query.q) {
            const q = req.query.q.toLowerCase();
            notes = notes.filter(n =>
                n.title.toLowerCase().includes(q) ||
                (n.content && n.content.toLowerCase().includes(q))
            );
        }

        // Sort: pinned first, then by updatedAt descending
        notes.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        res.json(notes);
    } catch (err) {
        console.error('Error fetching notes:', err);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
};

exports.getById = (req, res) => {
    try {
        const note = store.findById(COLLECTION, req.params.id);
        if (!note) return res.status(404).json({ error: 'Note not found' });
        res.json(note);
    } catch (err) {
        console.error('Error fetching note:', err);
        res.status(500).json({ error: 'Failed to fetch note' });
    }
};

exports.create = (req, res) => {
    try {
        const { title, content, category, tags, pinned } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Note title is required' });
        }

        const now = new Date().toISOString();
        const note = {
            id: uuidv4(),
            title: title.trim(),
            content: content || '',
            category: category || 'General',
            tags: tags || [],
            pinned: pinned || false,
            createdAt: now,
            updatedAt: now,
        };

        store.create(COLLECTION, note);
        res.status(201).json(note);
    } catch (err) {
        console.error('Error creating note:', err);
        res.status(500).json({ error: 'Failed to create note' });
    }
};

exports.update = (req, res) => {
    try {
        const updated = store.update(COLLECTION, req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Note not found' });
        res.json(updated);
    } catch (err) {
        console.error('Error updating note:', err);
        res.status(500).json({ error: 'Failed to update note' });
    }
};

exports.remove = (req, res) => {
    try {
        const deleted = store.remove(COLLECTION, req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Note not found' });
        res.json({ message: 'Note deleted' });
    } catch (err) {
        console.error('Error deleting note:', err);
        res.status(500).json({ error: 'Failed to delete note' });
    }
};

exports.getCategories = (req, res) => {
    try {
        const notes = store.findAll(COLLECTION);
        const categories = [...new Set(notes.map(n => n.category).filter(Boolean))];
        res.json(categories);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};
