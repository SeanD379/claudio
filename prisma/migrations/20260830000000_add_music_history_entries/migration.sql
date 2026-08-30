CREATE TABLE MusicHistoryEntry (
    id VARCHAR(191) NOT NULL,
    monthDay CHAR(5) NOT NULL,
    displayYear INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    eventYear INTEGER NOT NULL,
    event TEXT NOT NULL,
    artist VARCHAR(191) NULL,
    sourceType VARCHAR(16) NOT NULL,
    sourceTitle VARCHAR(191) NOT NULL,
    sourceUrl TEXT NULL,
    fingerprint CHAR(64) NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE INDEX uq_music_history_batch_slot (monthDay, displayYear, slot),
    UNIQUE INDEX uq_music_history_fingerprint (monthDay, fingerprint),
    INDEX idx_music_history_batch (monthDay, displayYear)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
