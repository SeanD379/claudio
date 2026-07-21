-- AlterTable
ALTER TABLE `playlist` ADD COLUMN `neteaseId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `customAvatarUrl` VARCHAR(191) NULL,
    ADD COLUMN `nickname` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `usersetting` ADD COLUMN `autoPlay` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `dynamicBg` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `narrationEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `quickSwitch` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `PlayRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `songId` VARCHAR(191) NOT NULL,
    `playedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `duration` INTEGER NULL,

    INDEX `PlayRecord_userId_playedAt_idx`(`userId`, `playedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Narration` (
    `id` VARCHAR(191) NOT NULL,
    `songId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'zh',
    `context` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Narration_songId_language_key`(`songId`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlayRecord` ADD CONSTRAINT `PlayRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayRecord` ADD CONSTRAINT `PlayRecord_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Narration` ADD CONSTRAINT `Narration_songId_fkey` FOREIGN KEY (`songId`) REFERENCES `Song`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
