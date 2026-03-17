import { openDB } from 'idb';

const DB_NAME = 'weeky-offline';
const DB_VERSION = 1;

export async function initDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('tracks')) {
                db.createObjectStore('tracks');
            }
            if (!db.objectStoreNames.contains('lyrics')) {
                db.createObjectStore('lyrics');
            }
        },
    });
}

// Manage Offline Audio Chunks/Blobs
export async function saveTrackOffline(trackId, responseClone) {
    try {
        const db = await initDB();
        const blob = await responseClone.blob();
        await db.put('tracks', blob, trackId);
        return true;
    } catch (error) {
        console.error('Failed to save track offline:', error);
        return false;
    }
}

export async function getOfflineTrack(trackId) {
    try {
        const db = await initDB();
        const blob = await db.get('tracks', trackId);
        if (blob) {
            return new Response(blob, {
                headers: { 'Content-Type': blob.type || 'audio/mpeg' }
            });
        }
        return null;
    } catch (error) {
        console.error('Failed to get offline track:', error);
        return null;
    }
}

export async function removeOfflineTrack(trackId) {
    try {
        const db = await initDB();
        await db.delete('tracks', trackId);
        return true;
    } catch (error) {
        return false;
    }
}

export async function isTrackOffline(trackId) {
    try {
        const db = await initDB();
        const blob = await db.get('tracks', trackId);
        return !!blob;
    } catch (error) {
        return false;
    }
}

export async function getAllOfflineTrackIds() {
    try {
        const db = await initDB();
        const keys = await db.getAllKeys('tracks');
        return keys || [];
    } catch (e) {
        return [];
    }
}

// Manage Lyrics
export async function saveLyricsOffline(trackId, lyricsData) {
    try {
        const db = await initDB();
        await db.put('lyrics', lyricsData, trackId);
        return true;
    } catch (error) {
        return false;
    }
}

export async function getOfflineLyrics(trackId) {
    try {
        const db = await initDB();
        return await db.get('lyrics', trackId);
    } catch (error) {
        return null;
    }
}

export async function removeOfflineLyrics(trackId) {
    try {
        const db = await initDB();
        await db.delete('lyrics', trackId);
        return true;
    } catch (e) {
        return false;
    }
}
