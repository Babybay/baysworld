const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(collection) {
    return path.join(DATA_DIR, `${collection}.json`);
}

function readCollection(collection) {
    const filePath = getFilePath(collection);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]', 'utf-8');
        return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function writeCollection(collection, data) {
    const filePath = getFilePath(collection);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function findAll(collection) {
    return readCollection(collection);
}

function findById(collection, id) {
    const items = readCollection(collection);
    return items.find(item => item.id === id) || null;
}

function create(collection, item) {
    const items = readCollection(collection);
    items.push(item);
    writeCollection(collection, items);
    return item;
}

function update(collection, id, updates) {
    const items = readCollection(collection);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    writeCollection(collection, items);
    return items[index];
}

function remove(collection, id) {
    const items = readCollection(collection);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    writeCollection(collection, items);
    return true;
}

module.exports = { findAll, findById, create, update, remove };
